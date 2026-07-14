import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header  from '../components/Header';
import {
  Plus, Search, Loader2, Receipt,
  CheckCircle, Clock, AlertTriangle,
  Pencil, Trash2, Share2, DollarSign,
  FileDown, MessageCircle, TrendingUp, X,
  Printer, MapPin, Briefcase
} from 'lucide-react';
import { supabase } from '../supabase';
import '../styles/quotations.css';
import '../styles/invoices.css';
import {
  COMPANY_DEFAULTS,
  calcTotals,
  calcItemAmount,
  isInterState,
  formatDateSafe,
  numToWords,
  genInvoiceNumber,
  getDocItems,
  printDocument,
  downloadDocumentPDF,
  whatsappShareDocument,
} from '../utils/documentPrint';

/* ─── Constants ─── */
const UNITS          = ['Nos','Sq.ft','Meter','Days','hr','Rolls'];
const GST_OPTIONS    = [0, 5, 12, 18, 28];
const ITEM_SUGGESTIONS = [
  'Chair','Plastic Chair','Shivari Chair','Modi Chair','VIP Chair',
  'Table (2X4)','Round Table','Box Sofa','Box Sofa (Single Seater)','Steel Sofa',
  'Flood Light','Green Metal','Warm Light','Stage','Mandap','Water Proof Mandap',
];
const INDIAN_STATES  = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
  'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
  'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab',
  'Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh',
  'Uttarakhand','West Bengal','Andaman and Nicobar Islands','Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu','Delhi','Jammu and Kashmir','Ladakh',
  'Lakshadweep','Puducherry',
];

const STATUS_FILTERS = ['All','Unpaid','Partially Paid','Paid','Overdue'];
const STATUS_CONFIG = {
  Paid:             { color: '#10b981', bg: '#ecfdf5' },
  'Partially Paid': { color: '#f59e0b', bg: '#fffbeb' },
  Unpaid:           { color: '#ef4444', bg: '#fef2f2' },
  Overdue:          { color: '#b91c1c', bg: '#fee2e2' },
};

/* ─── Type-to-filter combobox (same UX as Quotations) ─── */
function Combobox({ value, onChange, options, placeholder, className, required }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const onDocMouseDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  const term     = (value || '').trim().toLowerCase();
  const filtered = term ? options.filter(o => o.toLowerCase().includes(term)) : options;

  return (
    <div className="qt-combobox" ref={wrapRef}>
      <input
        type="text"
        className={className}
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
        required={required}
      />
      {open && filtered.length > 0 && (
        <div className="qt-combobox-list">
          {filtered.slice(0, 8).map(opt => (
            <div key={opt} className="qt-combobox-option"
              onMouseDown={() => { onChange(opt); setOpen(false); }}>
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const blankItem = () => ({
  id: Date.now() + Math.random(), name: '', desc: '', qty: 1, unit: 'Nos', rate: '', gstPct: 0,
});

const todayStr = () => new Date().toISOString().split('T')[0];
const addDays  = (dateStr, days) => {
  const d = dateStr ? new Date(dateStr) : new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

const BLANK_FORM = {
  project_id:        '',
  quotation_id:       null,
  invoice_number:    '',
  client_name:       '',
  client_email:      '',
  client_phone:      '',
  client_gst:        '',
  client_address:    '',
  client_state:      'Maharashtra',
  invoice_date:      todayStr(),
  notes:             '',
};

/* ─── Helpers (identical engine to Quotations, kept self-contained) ─── */
const fmt = (n) =>
  n >= 10000000 ? `₹${(n/10000000).toFixed(2)}Cr`
  : n >= 100000  ? `₹${(n/100000).toFixed(1)}L`
  : n >= 1000    ? `₹${(n/1000).toFixed(1)}K`
  : `₹${n}`;

const fmtINR = (n) =>
  `₹${Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`;

const displayStatus = (inv) => {
  if (inv.status === 'Paid') return 'Paid';
  const balance = Number(inv.total_amount||0) - Number(inv.amount_paid||0);
  if (balance <= 0) return 'Paid';
  return inv.status || 'Unpaid';
};

export default function Invoices() {
  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading]           = useState(true);
  const [invoices, setInvoices]         = useState([]);
  const [projects, setProjects]         = useState([]);
  const [quotationTotals, setQuotationTotals] = useState([]); // {id, quotation_number, total_amount} for every quotation any invoice links to
  const [projectQuotes, setProjectQuotes] = useState([]); 
  const [searchTerm, setSearchTerm]     = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showModal, setShowModal]       = useState(false);
  const [editingId, setEditingId]       = useState(null);
  const [form, setForm]                 = useState(BLANK_FORM);
  const [items, setItems]               = useState([blankItem()]);
  const [shareOpen, setShareOpen]       = useState(null);
  const [payTarget, setPayTarget]       = useState(null);
  const [payAmount, setPayAmount]       = useState('');
  const [paying, setPaying]             = useState(false);
  const [company, setCompany]           = useState(COMPANY_DEFAULTS);
  const shareRef                        = useRef(null);
  const consumedNav                     = useRef(false);

  useEffect(() => {
    const handler = (e) => {
      if (shareRef.current && !shareRef.current.contains(e.target)) setShareOpen(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => { fetchInvoices(); fetchCompany(); fetchProjects(); }, []);

  useEffect(() => {
    if (consumedNav.current) return;
    if (!location.state || !projects.length) return;
    const { projectId, quotationId } = location.state;
    if (projectId) {
      consumedNav.current = true;
      openAddModal(projectId, quotationId || null);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [projects, location.state]);

  const fetchCompany = async () => {
    try {
      const { data } = await supabase.from('settings').select('*').eq('id',1).single();
      if (data) {
        setCompany({
          name:      data.company_name || 'Mauli Decorators',
          tagline:   'Exclusive Decoration & Event Styling',
          address:   data.address      || 'Maharashtra, India',
          phone:     data.phone        || '',
          email:     data.email        || '',
          gstNumber: data.gst_number   || '',
          state:     data.state        || 'Maharashtra',
          bank: {
            bankName:  data.bank_name      || '',
            branch:    data.branch_name    || '',
            accountNo: data.account_number || '',
            ifsc:      data.ifsc_code      || '',
          },
          paymentTerms:      COMPANY_DEFAULTS.paymentTerms,
          termsAndConditions:COMPANY_DEFAULTS.termsAndConditions,
        });
      }
    } catch {}
  };

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, project_name, client_name, client_phone, client_email, client_address, status')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setProjects(data || []);
    } catch (err) { console.error('Error fetching projects:', err); }
  };

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setInvoices(data || []);
      const quoteIds = [...new Set((data || []).map(i => i.quotation_id).filter(Boolean))];
      if (quoteIds.length) {
        const { data: quotes } = await supabase
          .from('quotations')
          .select('id, quotation_number, total_amount')
          .in('id', quoteIds);
        setQuotationTotals(quotes || []);
      } else {
        setQuotationTotals([]);
      }
    } catch (err) {
      console.error('Error fetching invoices:', err);
    } finally { setLoading(false); }
  };

  const projectMap = projects.reduce((m,p) => { m[p.id]=p; return m; }, {});
  const quotationMap = quotationTotals.reduce((m,q) => { m[q.id]=q; return m; }, {});

  const invoicedTotalsByQuote = invoices.reduce((m, i) => {
    if (!i.quotation_id) return m;
    m[i.quotation_id] = (m[i.quotation_id] || 0) + Number(i.total_amount || 0);
    return m;
  }, {});

  const balanceVsQuotation = (inv) => {
    const q = quotationMap[inv.quotation_id];
    if (!q) return null; 
    const invoicedSoFar = invoicedTotalsByQuote[inv.quotation_id] || 0;
    return {
      quotationTotal: Number(q.total_amount || 0),
      invoicedSoFar,
      balance: parseFloat((Number(q.total_amount || 0) - invoicedSoFar).toFixed(2)),
    };
  };

  /* ─── Form helpers ─── */
  const f          = (field, value) => setForm(prev => ({ ...prev, [field]: value }));
  const addItem    = () => setItems(prev => [...prev, blankItem()]);
  const removeItem = (id) => setItems(prev => prev.filter(it => it.id !== id));
  const updateItem = (id, field, value) =>
    setItems(prev => prev.map(it => it.id === id ? { ...it, [field]: value } : it));


  const totals = calcTotals(items, form.client_state, company.state);

  const loadProjectQuotes = async (projectId) => {
    if (!projectId) { setProjectQuotes([]); return; }
    try {
      const { data } = await supabase
        .from('quotations')
        .select('id, quotation_number, client_gst, client_state, total_amount, line_items')
        .eq('project_id', projectId)
        .eq('status', 'Approved')
        .order('created_at', { ascending: false });
      setProjectQuotes(data || []);
    } catch { setProjectQuotes([]); }
  };

  const handleProjectSelect = (projectId) => {
    const p = projectMap[projectId];
    setForm(prev => ({
      ...prev,
      project_id:     projectId,
      quotation_id:   null,
      client_name:    p?.client_name    || prev.client_name,
      client_phone:   p?.client_phone   || prev.client_phone,
      client_email:   p?.client_email   || prev.client_email,
      client_address: p?.client_address || prev.client_address,
    }));
    loadProjectQuotes(projectId);
  };

  const applyQuotationPrefill = (quotationId) => {
    const q = projectQuotes.find(x => x.id === quotationId);
    f('quotation_id', quotationId || null);
    if (!q) return;
    const saved = getDocItems(q, 'quote');
    if (saved.length) {
      setItems(saved.map(i => ({ ...i, id: Date.now()+Math.random(), gstPct: i.gstPct ?? 0 })));
    }
    setForm(prev => ({ ...prev, client_gst: q.client_gst || prev.client_gst, client_state: q.client_state || prev.client_state }));
  };

  /* ─── Open modals ─── */
  const openAddModal = async (presetProjectId = '', presetQuotationId = null) => {
    const invNum = await genInvoiceNumber(supabase);
    const p = presetProjectId ? projectMap[presetProjectId] : null;
    setForm({
      ...BLANK_FORM,
      invoice_number: invNum,
      project_id:     presetProjectId || '',
      client_name:    p?.client_name    || '',
      client_phone:   p?.client_phone   || '',
      client_email:   p?.client_email   || '',
      client_address: p?.client_address || '',
    });
    setItems([blankItem()]);
    setEditingId(null);
    setShowModal(true);
    if (presetProjectId) {
      const { data } = await supabase
        .from('quotations')
        .select('id, quotation_number, client_gst, client_state, total_amount, line_items')
        .eq('project_id', presetProjectId)
        .eq('status', 'Approved')
        .order('created_at', { ascending: false });
      setProjectQuotes(data || []);
      if (presetQuotationId) {
        const q = (data || []).find(x => x.id === presetQuotationId);
        if (q) {
          f('quotation_id', q.id);
          const saved = getDocItems(q, 'quote');
          if (saved.length) setItems(saved.map(i => ({ ...i, id: Date.now()+Math.random(), gstPct: i.gstPct ?? 0 })));
          setForm(prev => ({ ...prev, quotation_id: q.id, client_gst: q.client_gst || prev.client_gst, client_state: q.client_state || prev.client_state }));
        }
      }
    } else {
      setProjectQuotes([]);
    }
  };

  const openEditModal = (inv) => {
    setForm({
      project_id:        inv.project_id || '',
      quotation_id:       inv.quotation_id || null,
      invoice_number:    inv.invoice_number || '',
      client_name:       inv.client_name      || '',
      client_email:      inv.client_email     || '',
      client_phone:      inv.client_phone     || '',
      client_gst:        inv.client_gst       || '',
      client_address:    inv.client_address   || '',
      client_state:      inv.client_state     || 'Maharashtra',
      invoice_date:      inv.invoice_date     || todayStr(),
      notes:             inv.notes            || '',
    });
    const existingItems = getDocItems(inv, 'invoice');
    setItems(existingItems.length
      ? existingItems.map(i => ({ ...i, id: Date.now()+Math.random(), gstPct: i.gstPct ?? 0 }))
      : [blankItem()]);
    setProjectQuotes([]);
    setEditingId(inv.id);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false); setEditingId(null); setForm(BLANK_FORM); setItems([blankItem()]); setProjectQuotes([]);
  };

  /* ─── Save ─── */
  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.project_id) { alert('Please select a client to bill this invoice against.'); return; }
    const { subtotal, totalGst, grandTotal, cgst, sgst, igst, isInterState: inter } = totals;
    const effectiveGstPct = subtotal > 0 ? parseFloat(((totalGst/subtotal)*100).toFixed(2)) : 0;

    const cleanItems = items.map(it => ({ ...it, gstPct: it.gstPct ?? 0 }));

    const payload = {
      project_id:        form.project_id,
      quotation_id:       form.quotation_id || null,
      invoice_number:    form.invoice_number,
      client_name:       form.client_name,
      client_email:      form.client_email   || null,
      client_phone:      form.client_phone   || null,
      client_gst:        form.client_gst     || null,
      client_address:    form.client_address || null,
      client_state:      form.client_state,
      invoice_date:      form.invoice_date   || null,
      items:             cleanItems,
      amount:            subtotal,
      gst_percent:       effectiveGstPct,
      gst_type:          inter ? 'IGST' : 'CGST_SGST',
      cgst_amount:       cgst,
      sgst_amount:       sgst,
      igst_amount:       igst,
      gst_amount:        totalGst,
      total_amount:      grandTotal,
      notes:             form.notes           || null,
    };

    try {
      if (editingId) {
        const { error } = await supabase.from('invoices').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        payload.status = 'Unpaid';
        payload.amount_paid = 0;
        const { error } = await supabase.from('invoices').insert([payload]);
        if (error) throw error;
      }
      closeModal(); fetchInvoices();
    } catch (err) { alert(err.message || 'Failed to save invoice'); }
  };

  /* ─── Delete ─── */
  const handleDelete = async (id) => {
    if (!window.confirm('Delete this invoice permanently?')) return;
    try {
      const { error } = await supabase.from('invoices').delete().eq('id', id);
      if (error) throw error;
      fetchInvoices();
    } catch (err) { alert('Failed to delete: ' + err.message); }
  };

  /* ─── Record payment ─── */
  const openPayModal = (inv) => { setPayTarget(inv); setPayAmount(''); };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!payTarget) return;
    setPaying(true);
    try {
      const newPaid = (parseFloat(payTarget.amount_paid)||0) + (parseFloat(payAmount)||0);
      const total   = parseFloat(payTarget.total_amount)||0;
      const newStatus = newPaid >= total ? 'Paid' : newPaid > 0 ? 'Partially Paid' : 'Unpaid';
      const { error } = await supabase.from('invoices')
        .update({ amount_paid: newPaid, status: newStatus })
        .eq('id', payTarget.id);
      if (error) throw error;
      setPayTarget(null); setPaying(false);
      fetchInvoices();
    } catch (err) { setPaying(false); alert('Failed to record payment: ' + err.message); }
  };

  const handlePrint = async (inv) => {
    setShareOpen(null);
    try {
      await printDocument({ type: 'invoice', doc: inv, company, project: projectMap[inv.project_id] });
    } catch (err) { alert('Failed to print: ' + err.message); }
  };

  const handleDownloadPDF = async (inv) => {
    setShareOpen(null);
    try {
      await downloadDocumentPDF({ type: 'invoice', doc: inv, company, project: projectMap[inv.project_id] });
    } catch (err) { alert('Failed to generate PDF: ' + err.message); }
  };

  const handleWhatsApp = async (inv) => {
    setShareOpen(null);
    try {
      await whatsappShareDocument({ type: 'invoice', doc: inv, company, project: projectMap[inv.project_id] });
    } catch (err) { alert('Failed to share: ' + err.message); }
  };


  /* ─── Filter + metrics ─── */
  const filtered = invoices.filter(inv => {
    const proj = projectMap[inv.project_id];
    const haystack = `${inv.client_name||''} ${inv.invoice_number||''} ${proj?.project_name||''}`.toLowerCase();
    const matchSearch = haystack.includes(searchTerm.toLowerCase());
    const stat = displayStatus(inv);
    return matchSearch && (statusFilter==='All' || stat===statusFilter);
  });

  const totalBilled     = invoices.reduce((s,i) => s+(Number(i.total_amount)||0), 0);
  const totalOutstanding = invoices.reduce((s,i) => s+((Number(i.total_amount)||0)-(Number(i.amount_paid)||0)), 0);

  /* ════════════════════════════════════════ RENDER ═══════════ */
  return (
    <div className="qt-layout">
      <Sidebar />
      <div className="qt-right">
        <Header title="Invoices" />

        <main className="qt-main animate-fade">

          <div className="qt-page-head">
            <div>
              <h1 className="qt-page-title">Invoice Management</h1>
              <p className="qt-page-sub">Bill projects with itemised GST invoices, track payments and download professional PDFs.</p>
            </div>
            <button className="qt-add-btn" onClick={() => openAddModal()}><Plus size={15}/> New Invoice</button>
          </div>

          {/* Metrics */}
          <div className="qt-metrics">
            <div className="qt-metric">
              <div className="qt-metric-icon" style={{background:'#FBF4EC',color:'#C25A0F'}}><Receipt size={17}/></div>
              <div className="qt-metric-body"><span className="qt-metric-val">{invoices.length}</span><span className="qt-metric-lbl">Total</span></div>
            </div>
            <div className="qt-metric">
              <div className="qt-metric-icon" style={{background:'#fef2f2',color:'#ef4444'}}><Clock size={17}/></div>
              <div className="qt-metric-body"><span className="qt-metric-val">{invoices.filter(i=>displayStatus(i)==='Unpaid').length}</span><span className="qt-metric-lbl">Unpaid</span></div>
            </div>
            <div className="qt-metric">
              <div className="qt-metric-icon" style={{background:'#ecfdf5',color:'#10b981'}}><CheckCircle size={17}/></div>
              <div className="qt-metric-body"><span className="qt-metric-val">{invoices.filter(i=>displayStatus(i)==='Paid').length}</span><span className="qt-metric-lbl">Paid</span></div>
            </div>
            <div className="qt-metric">
              <div className="qt-metric-icon" style={{background:'#fee2e2',color:'#b91c1c'}}><AlertTriangle size={17}/></div>
              <div className="qt-metric-body"><span className="qt-metric-val">{invoices.filter(i=>displayStatus(i)==='Overdue').length}</span><span className="qt-metric-lbl">Overdue</span></div>
            </div>
            <div className="qt-metric">
              <div className="qt-metric-icon" style={{background:'#eff6ff',color:'#3b82f6'}}><TrendingUp size={17}/></div>
              <div className="qt-metric-body"><span className="qt-metric-val">{fmt(totalOutstanding)}</span><span className="qt-metric-lbl">Outstanding</span></div>
            </div>
          </div>

          {/* Toolbar */}
          <div className="qt-toolbar">
            <div className="qt-search-wrap">
              <Search size={14} className="qt-search-icon"/>
              <input type="text" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)}
                placeholder="Search client, invoice no. or project…" className="qt-search-input"/>
            </div>
            <div className="qt-filters">
              {STATUS_FILTERS.map(s => (
                <button key={s} onClick={()=>setStatusFilter(s)}
                  className={`qt-filter-btn ${statusFilter===s?'active':''}`}>{s}</button>
              ))}
            </div>
          </div>

          {/* Cards */}
          {loading ? (
            <div className="qt-loading"><Loader2 size={28} className="db-spin" style={{color:'#E8741C'}}/></div>
          ) : filtered.length===0 ? (
            <div className="qt-empty">
              <Receipt size={42} style={{color:'#F2A057',marginBottom:'0.75rem'}}/>
              <p>{invoices.length===0 ? 'No invoices yet. Bill an approved project to get started!' : 'No invoices match your search/filter.'}</p>
              <button className="qt-add-btn" onClick={()=>openAddModal()} style={{marginTop:'1rem'}}><Plus size={14}/> New Invoice</button>
            </div>
          ) : (
            <div className="qt-grid">
              {filtered.map(inv => {
                const stat    = displayStatus(inv);
                const sc      = STATUS_CONFIG[stat] || STATUS_CONFIG.Unpaid;
                const balance = Number(inv.total_amount||0) - Number(inv.amount_paid||0);
                const proj    = projectMap[inv.project_id];
                const qBal    = balanceVsQuotation(inv);
                const itemCount = inv.items?.length || 1;
                return (
                  <div key={inv.id} className="qt-card">
                    <div className="qt-card-head">
                      <span className="qt-card-num">#{inv.invoice_number}</span>
                      <div className="qt-card-actions">
                        {balance > 0 && (
                          <button className="qt-card-action-btn approve-btn" title="Record Payment"
                            onClick={()=>openPayModal(inv)}>
                            <DollarSign size={13}/>
                          </button>
                        )}
                        <button className="qt-card-action-btn" title="Edit" onClick={()=>openEditModal(inv)}>
                          <Pencil size={13}/>
                        </button>
                        <div className="qt-share-wrap" ref={shareOpen===inv.id ? shareRef : null}>
                          <button className="qt-card-action-btn" title="Share / Export"
                            onClick={()=>setShareOpen(prev=>prev===inv.id?null:inv.id)}>
                            <Share2 size={13}/>
                          </button>
                          {shareOpen===inv.id && (
                            <div className="qt-share-dropdown">
                              <button className="qt-share-option pdf-opt" onClick={()=>handleDownloadPDF(inv)}>
                                <FileDown size={14}/> Download PDF
                              </button>
                              <button className="qt-share-option wa-opt" onClick={()=>handleWhatsApp(inv)}>
                                <MessageCircle size={14}/> WhatsApp (PDF)
                              </button>
                              <button className="qt-share-option" onClick={()=>handlePrint(inv)}>
                                <Printer size={14}/> Print
                              </button>
                            </div>
                          )}
                        </div>
                        <button className="qt-card-action-btn delete-btn" title="Delete"
                          onClick={()=>handleDelete(inv.id)}>
                          <Trash2 size={13}/>
                        </button>
                      </div>
                    </div>

                    <div className="qt-card-name-wrap">
                      <h2 className="qt-card-name">{inv.client_name}</h2>
                      <p className="qt-card-client">
                        <Briefcase size={11} style={{verticalAlign:'-1px',marginRight:4}}/>
                        {proj?.project_name || 'Unlinked project'}
                      </p>
                    </div>

                    <div className="qt-card-stats">
                      <div className="qt-stat">
                        <span className="qt-stat-lbl">Total</span>
                        <span className="qt-stat-val">{fmt(Number(inv.total_amount)||0)}</span>
                      </div>
                      <div className="qt-stat">
                        <span className="qt-stat-lbl">Balance</span>
                        <span className="qt-stat-val" style={{color: balance>0 ? '#ef4444':'#10b981'}}>{fmt(balance)}</span>
                      </div>
                      <div className="qt-stat">
                        <span className="qt-stat-lbl">Bal. vs Quotation</span>
                        <span className="qt-stat-val" style={{color: qBal===null ? '#94a3b8' : (qBal.balance>0 ? '#ef4444':'#10b981')}}>
                          {qBal===null ? 'Not linked' : fmt(qBal.balance)}
                        </span>
                      </div>
                      <div className="qt-stat">
                        <span className="qt-stat-lbl">Items</span>
                        <span className="qt-stat-val">{itemCount}</span>
                      </div>
                    </div>

                    <div className="qt-card-footer">
                      <div className="qt-card-address">
                        <MapPin size={11}/>
                        <span>{inv.client_address||inv.client_state||'No address'}</span>
                      </div>
                      <div className="qt-card-status" style={{color:sc.color,background:sc.bg}}>
                        {stat}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* ══════════ ADD / EDIT MODAL ══════════ */}
      {showModal && (
        <div className="qt-modal-overlay">
          <div className="qt-modal qt-modal-wide">
            <div className="qt-modal-head">
              <h3 className="qt-modal-title">{editingId ? 'Edit Invoice' : 'New Invoice'}</h3>
              <button className="qt-modal-close" onClick={closeModal}>×</button>
            </div>
            <form onSubmit={handleSave} style={{display:'flex',flexDirection:'column',flex:1,minHeight:0,overflow:'hidden'}}>
              <div className="qt-modal-body">
                <div className="qt-form-grid">

                  <div className="qt-section-label">Client &amp; Source</div>

                  <div className="form-group">
                    <label>Client *</label>
                    <select className="input-field" required value={form.project_id} disabled={!!editingId}
                      onChange={e=>handleProjectSelect(e.target.value)}>
                      <option value="">— Select a client —</option>
                      {[...projects].sort((a,b)=>(a.client_name||'').localeCompare(b.client_name||'')).map(p => (
                        <option key={p.id} value={p.id}>{p.client_name} — {p.project_name}</option>
                      ))}
                    </select>
                    {!projects.length && (
                      <p style={{fontSize:'.72rem',color:'#94a3b8',marginTop:4}}>
                        No clients yet — clients are created automatically when you add a project.
                      </p>
                    )}
                  </div>

                  {!editingId && projectQuotes.length > 0 && (
                    <div className="form-group">
                      <label>Bill from Approved Quotation <span style={{fontSize:'.72rem',color:'#94a3b8',fontWeight:400}}>(optional, prefills items)</span></label>
                      <select className="input-field" value={form.quotation_id || ''}
                        onChange={e=>applyQuotationPrefill(e.target.value)}>
                        <option value="">— Start blank —</option>
                        {projectQuotes.map(q => (
                          <option key={q.id} value={q.id}>{q.quotation_number} — {fmtINR(q.total_amount)}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="qt-section-label">Client Details</div>

                  <div className="form-group">
                    <label>Invoice Number</label>
                    <input type="text" required value={form.invoice_number}
                      onChange={e=>f('invoice_number',e.target.value)}
                      className="input-field" placeholder="MLD-INV-2526-001"/>
                  </div>
                  <div className="form-group">
                    <label>Invoice Date</label>
                    <input type="date" lang="en-GB" value={form.invoice_date}
                      onChange={e=>f('invoice_date',e.target.value)}
                      className="input-field" style={{colorScheme:'light'}}/>
                  </div>
                  <div className="form-group">
                    <label>Client Name *</label>
                    <input type="text" required value={form.client_name}
                      onChange={e=>f('client_name',e.target.value)}
                      className="input-field" placeholder="e.g. Priya Sharma"/>
                  </div>
                  <div className="form-group">
                    <label>Client Phone (WhatsApp)</label>
                    <input type="tel" value={form.client_phone}
                      onChange={e=>f('client_phone',e.target.value)}
                      className="input-field" placeholder="e.g. 9876543210"/>
                  </div>
                  <div className="form-group">
                    <label>Client Email</label>
                    <input type="email" value={form.client_email}
                      onChange={e=>f('client_email',e.target.value)}
                      className="input-field" placeholder="client@example.com"/>
                  </div>
                  <div className="form-group">
                    <label>Client GST Number <span style={{fontSize:'.72rem',color:'#94a3b8',fontWeight:400}}>(optional)</span></label>
                    <input type="text" value={form.client_gst}
                      onChange={e=>f('client_gst',e.target.value.toUpperCase())}
                      className="input-field" placeholder="e.g. 27XXXXX0000X1ZX" maxLength={15}/>
                  </div>
                  <div className="form-group">
                    <label>Client State (for GST) *</label>
                    <Combobox
                      value={form.client_state}
                      onChange={v=>f('client_state',v)}
                      options={INDIAN_STATES}
                      className="input-field"
                      placeholder="Start typing a state…"
                      required
                    />
                  </div>
                  <div className="form-group qt-full">
                    <label>Client Address</label>
                    <input type="text" value={form.client_address}
                      onChange={e=>f('client_address',e.target.value)}
                      className="input-field" placeholder="e.g. Flat 12, Andheri West, Mumbai"/>
                  </div>

                  {/* ── LINE ITEMS ── */}
                  <div className="qt-section-label">
                    Billed Items &amp; Services
                    {form.client_state !== company.state && (
                      <span style={{marginLeft:8,fontSize:'.68rem',color:'#ef4444',fontWeight:600}}>
                        ⚠ Inter-state → IGST applies
                      </span>
                    )}
                  </div>

                  <div className="qt-items-wrap">
                    <table className="qt-items-table">
                      <thead>
                        <tr>
                          <th style={{width:'30px'}}>#</th>
                          <th style={{width:'150px'}}>Item / Service</th>
                          <th>Description</th>
                          <th style={{width:'55px'}}>Qty</th>
                          <th style={{width:'80px'}}>Unit</th>
                          <th style={{width:'100px'}}>Rate (₹)</th>
                          <th style={{width:'65px'}}>GST %</th>
                          <th style={{width:'95px'}}>Amount</th>
                          <th style={{width:'30px'}}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((it, idx) => {
                          const { gstTotal, total } = calcItemAmount(it, form.client_state, company.state);
                          return (
                            <tr key={it.id}>
                              <td style={{textAlign:'center',color:'#94a3b8',fontSize:'.75rem',fontWeight:600}}>{idx+1}</td>
                              <td><Combobox className="qt-item-input" value={it.name}
                                onChange={v=>updateItem(it.id,'name',v)}
                                options={ITEM_SUGGESTIONS}
                                placeholder="e.g. Stage Backdrop" required/></td>
                              <td><input className="qt-item-input" value={it.desc}
                                onChange={e=>updateItem(it.id,'desc',e.target.value)}
                                placeholder="Optional detail…"/></td>
                              <td><input type="number" min="0" step="0.01"
                                className="qt-item-input narrow" value={it.qty}
                                onChange={e=>updateItem(it.id,'qty',e.target.value)}/></td>
                              <td><select className="qt-item-input med" value={it.unit}
                                onChange={e=>updateItem(it.id,'unit',e.target.value)}>
                                {UNITS.map(u=><option key={u}>{u}</option>)}
                              </select></td>
                              <td><input type="number" min="0" step="0.01"
                                className="qt-item-input med" value={it.rate}
                                onChange={e=>updateItem(it.id,'rate',e.target.value)} placeholder="0"/></td>
                              <td><select className="qt-gst-pct-input" value={it.gstPct ?? 0}
                                onChange={e=>updateItem(it.id,'gstPct',Number(e.target.value))}>
                                {GST_OPTIONS.map(g=><option key={g} value={g}>{g}%</option>)}
                              </select></td>
                              <td>
                                <div className="qt-row-amount">{fmtINR(total)}</div>
                                {(it.gstPct ?? 0) > 0 && <div style={{fontSize:'.68rem',color:'#94a3b8'}}>+GST {fmtINR(gstTotal)}</div>}
                              </td>
                              <td><button type="button" className="qt-remove-row"
                                onClick={()=>removeItem(it.id)} disabled={items.length===1}>
                                <X size={11}/></button></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <button type="button" className="qt-add-row-btn" onClick={addItem}>
                    <Plus size={13}/> Add Item / Service
                  </button>

                  {/* Summary */}
                  <div className="qt-summary-box">
                    <div className="qt-summary-row">
                      <span className="qt-summary-label">Subtotal (excl. GST)</span>
                      <span className="qt-summary-val">{fmtINR(totals.subtotal)}</span>
                    </div>
                    {totals.isInterState ? (
                      <div className="qt-summary-row">
                        <span className="qt-summary-label">IGST</span>
                        <span className="qt-summary-val">{fmtINR(totals.igst)}</span>
                      </div>
                    ) : (
                      <>
                        <div className="qt-summary-row">
                          <span className="qt-summary-label">CGST</span>
                          <span className="qt-summary-val">{fmtINR(totals.cgst)}</span>
                        </div>
                        <div className="qt-summary-row">
                          <span className="qt-summary-label">SGST</span>
                          <span className="qt-summary-val">{fmtINR(totals.sgst)}</span>
                        </div>
                      </>
                    )}
                    <div className="qt-summary-total">
                      <span className="qt-summary-label">Grand Total</span>
                      <span className="qt-summary-val">{fmtINR(totals.grandTotal)}</span>
                    </div>
                  </div>

                  {/* Additional */}
                  <div className="qt-section-label">Additional Info</div>

                  <div className="form-group qt-full">
                    <label>Bank Details <span style={{fontSize:'.72rem',color:'#94a3b8',fontWeight:400}}>(shown on the invoice PDF instead of payment terms — edit in Settings)</span></label>
                    {company.bank?.bankName ? (
                      <div style={{fontSize:'.82rem',color:'#374151',lineHeight:1.7,padding:'.6rem .8rem',background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:8}}>
                        <div><strong>Bank:</strong> {company.bank.bankName}</div>
                        <div><strong>A/C No.:</strong> {company.bank.accountNo}</div>
                        <div><strong>IFSC:</strong> {company.bank.ifsc} · <strong>Branch:</strong> {company.bank.branch}</div>
                      </div>
                    ) : (
                      <p style={{fontSize:'.78rem',color:'#94a3b8'}}>No bank details on file yet — add them in Settings to have them appear on invoice PDFs.</p>
                    )}
                  </div>
                  <div className="form-group qt-full">
                    <label>Notes</label>
                    <textarea value={form.notes} onChange={e=>f('notes',e.target.value)}
                      className="input-field" rows={2} style={{resize:'vertical'}}/>
                  </div>

                </div>
              </div>
              <div className="qt-modal-foot">
                <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn-primary">{editingId?'Save Changes':'Create Invoice'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════ RECORD PAYMENT MODAL ══════════ */}
      {payTarget && (
        <div className="qt-modal-overlay">
          <div className="qt-approve-modal">
            <div className="qt-approve-icon"><DollarSign size={26} color="#10b981"/></div>
            <h3 className="qt-approve-title">Record Payment</h3>
            <form onSubmit={handleRecordPayment}>
              <div className="payment-tracking-box">
                <div className="payment-tracking-line"><span>Invoice:</span><strong>#{payTarget.invoice_number}</strong></div>
                <div className="payment-tracking-line"><span>Total:</span><strong>{fmtINR(payTarget.total_amount)}</strong></div>
                <div className="payment-tracking-line"><span>Paid so far:</span><span style={{color:'#10b981',fontWeight:600}}>{fmtINR(payTarget.amount_paid)}</span></div>
                <div className="payment-tracking-line">
                  <span className="payment-tracking-due">Balance Due:</span>
                  <strong className="payment-tracking-due">{fmtINR(Number(payTarget.total_amount||0)-Number(payTarget.amount_paid||0))}</strong>
                </div>
              </div>
              <div className="form-group" style={{marginTop:'1rem'}}>
                <label>Amount Received (₹) *</label>
                <input type="number" className="input-field" required min="1"
                  max={Number(payTarget.total_amount||0)-Number(payTarget.amount_paid||0)}
                  value={payAmount} onChange={e=>setPayAmount(e.target.value)} placeholder="e.g. 5000"/>
              </div>
              <div className="qt-approve-btns" style={{marginTop:'1.25rem'}}>
                <button type="button" className="btn-secondary" style={{flex:1}} onClick={()=>setPayTarget(null)} disabled={paying}>Cancel</button>
                <button type="submit" className="btn-approve" disabled={paying}>{paying ? 'Saving…' : 'Record Payment'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}