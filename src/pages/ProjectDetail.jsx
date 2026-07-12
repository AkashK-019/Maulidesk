import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import {
  ArrowLeft, User, Phone, MapPin,
  Calendar, FileText, Receipt, CreditCard,
  Edit, Loader2, X
} from 'lucide-react';
import { supabase } from '../supabase';
import { formatDate } from '../utils/helpers';
import { COMPANY_DEFAULTS } from '../utils/documentPrint';
import QuotationTab     from '../components/tabs/QuotationTab';
import TaxInvoiceTab    from '../components/tabs/TaxInvoiceTab';
import PaymentReceiptTab from '../components/tabs/PaymentReceiptTab';
import '../styles/Projects.css';
import '../styles/projectDetail.css';

const EVENT_TYPES = ['Wedding','Birthday','Corporate','Anniversary','Engagement','Other'];

const STATUS_CONFIG = {
  Active:    { color: '#2563eb', bg: '#eff6ff' },
  Completed: { color: '#10b981', bg: '#ecfdf5' },
  Cancelled: { color: '#ef4444', bg: '#fef2f2' },
};

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [project, setProject]       = useState(null);
  const [quotation, setQuotation]   = useState(null);
  const [invoice, setInvoice]       = useState(null);
  const [payments, setPayments]     = useState([]);
  const [company, setCompany]       = useState(COMPANY_DEFAULTS);
  const [loading, setLoading]       = useState(true);
  const [activeTab, setActiveTab]   = useState('quotation');
  const tabRefs = useRef({});

  // Edit project modal
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    if (id) { fetchAll(id); fetchCompany(); }
  }, [id]);

  useEffect(() => {
    tabRefs.current[activeTab]?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
  }, [activeTab]);

  const fetchCompany = async () => {
    try {
      const { data } = await supabase.from('settings').select('*').eq('id', 1).single();
      if (data) {
        setCompany({
          name:      data.company_name || COMPANY_DEFAULTS.name,
          tagline:   COMPANY_DEFAULTS.tagline,
          address:   data.address      || COMPANY_DEFAULTS.address,
          phone:     data.phone        || '',
          email:     data.email        || '',
          gstNumber: data.gst_number   || '',
          state:     data.state        || 'Maharashtra',
          bank: {
            bankName:  data.bank_name      || COMPANY_DEFAULTS.bank.bankName,
            branch:    data.branch_name    || COMPANY_DEFAULTS.bank.branch,
            accountNo: data.account_number || COMPANY_DEFAULTS.bank.accountNo,
            ifsc:      data.ifsc_code      || COMPANY_DEFAULTS.bank.ifsc,
          },
          paymentTerms:       COMPANY_DEFAULTS.paymentTerms,
          termsAndConditions: COMPANY_DEFAULTS.termsAndConditions,
        });
      }
    } catch {}
  };

  const fetchAll = async (projectId) => {
    setLoading(true);
    try {
      const [
        { data: proj },
        { data: quotes },
        { data: invs },
        { data: rcpts },
      ] = await Promise.all([
        supabase.from('projects').select('*').eq('id', projectId).single(),
        supabase.from('quotations').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
        supabase.from('invoices').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
        supabase.from('payment_receipts').select('*').eq('project_id', projectId).order('payment_date', { ascending: true }),
      ]);

      if (!proj) { navigate('/projects'); return; }
      setProject(proj);
      setQuotation(quotes?.[0] || null);
      setInvoice(invs?.[0] || null);
      setPayments(rcpts || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentAdded = () => fetchAll(id);
  const handleInvoiceAdded = () => fetchAll(id);

  // Edit project
  const openEdit = () => {
    setEditForm({
      project_name:   project.project_name,
      client_name:    project.client_name,
      client_phone:   project.client_phone || '',
      client_email:   project.client_email || '',
      client_address: project.client_address || '',
      event_date:     project.event_date || '',
      event_type:     project.event_type || 'Wedding',
      status:         project.status,
      notes:          project.notes || '',
    });
    setShowEdit(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await supabase.from('projects').update(editForm).eq('id', id);
      if (error) throw error;
      setProject(prev => ({ ...prev, ...editForm }));
      setShowEdit(false);
    } catch (err) { alert('Error: ' + err.message); }
    finally { setSaving(false); }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      await supabase.from('projects').update({ status: newStatus }).eq('id', id);
      setProject(prev => ({ ...prev, status: newStatus }));
    } catch (err) { alert('Failed: ' + err.message); }
  };

  if (loading) {
    return (
      <div className="app-container pd-page">
        <Sidebar />
        <div className="main-content">
          <Header title="Project Detail" />
          <main className="gs-main" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '4rem', minHeight: '50vh' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.85rem', color: 'var(--pd-muted, #8993a8)' }}>
              <Loader2 size={30} style={{ animation: 'spin 1s linear infinite', color: '#c17a4e' }} />
              <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Loading project…</span>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!project) return null;

  const sc = STATUS_CONFIG[project.status] || STATUS_CONFIG.Active;

  const TABS = [
    { key: 'quotation',  label: 'Quotation',        icon: FileText,    count: quotation ? 1 : 0 },
    { key: 'invoice',    label: 'Tax Invoice',       icon: Receipt,     count: invoice ? 1 : 0 },
    { key: 'payments',   label: 'Payment Receipts',  icon: CreditCard,  count: payments.length },
  ];

  return (
    <div className="app-container pd-page">
      <Sidebar />
      <div className="main-content">
        <Header title="Project Detail" />
        <main className="gs-main">

          {/* ── Back + Project Header ── */}
          <div className="pd-header animate-fade">
            <div className="pd-header-top">
              <button className="pd-back-btn" onClick={() => navigate('/projects')}>
                <ArrowLeft size={15} /> Back to Projects
              </button>
              <div className="pd-header-actions">
                <select
                  className="prj-status-pill pd-status-select"
                  value={project.status}
                  onChange={e => handleStatusChange(e.target.value)}
                  style={{ background: sc.bg, color: sc.color }}
                >
                  <option>Active</option>
                  <option>Completed</option>
                  <option>Cancelled</option>
                </select>
                <button className="pd-edit-btn" onClick={openEdit}>
                  <Edit size={13} /> Edit Project
                </button>
              </div>
            </div>

            <div className="pd-project-info">
              <div>
                <h1 className="pd-project-name">{project.project_name}</h1>
                <div className="pd-project-meta">
                  <span><User size={12} /> {project.client_name}</span>
                  {project.client_phone && <span><Phone size={12} /> {project.client_phone}</span>}
                  {project.event_type && <span><MapPin size={12} /> {project.event_type}</span>}
                  {project.event_date && <span><Calendar size={12} /> {formatDate(project.event_date)}</span>}
                </div>
              </div>
            </div>
          </div>

          {/* ── Tabs ── */}
          <div className="pd-tabs-scroll animate-fade">
            <div className="pd-tabs">
              {TABS.map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    ref={el => { tabRefs.current[tab.key] = el; }}
                    className={`pd-tab-btn${activeTab === tab.key ? ' active' : ''}`}
                    onClick={() => setActiveTab(tab.key)}
                  >
                    <Icon size={14} />
                    {tab.label}
                    <span className="pd-tab-count">{tab.count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Tab Content ── */}
          <div className="animate-fade">
            {activeTab === 'quotation' && (
              <QuotationTab quotation={quotation} company={company} project={project} />
            )}
            {activeTab === 'invoice' && (
              <TaxInvoiceTab invoice={invoice} company={company} project={project} onInvoiceCreated={handleInvoiceAdded} />
            )}
            {activeTab === 'payments' && (
              <PaymentReceiptTab
                invoice={invoice}
                payments={payments}
                company={company}
                project={project}
                onPaymentAdded={handlePaymentAdded}
              />
            )}
          </div>

        </main>
      </div>

      {/* ── Edit Project Modal ── */}
      {showEdit && (
        <div className="modal-overlay">
          <div className="modal-content pd-modal" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>Edit Project</h3>
              <button onClick={() => setShowEdit(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleSaveEdit}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group" style={{ gridColumn: '1/-1' }}>
                    <label>Project Name *</label>
                    <input className="input-field" required value={editForm.project_name} onChange={e => setEditForm(p => ({ ...p, project_name: e.target.value }))} />
                  </div>
                  <div className="form-group"><label>Client Name *</label><input className="input-field" required value={editForm.client_name} onChange={e => setEditForm(p => ({ ...p, client_name: e.target.value }))} /></div>
                  <div className="form-group"><label>Client Phone</label><input className="input-field" value={editForm.client_phone} onChange={e => setEditForm(p => ({ ...p, client_phone: e.target.value }))} /></div>
                  <div className="form-group"><label>Client Email</label><input type="email" className="input-field" value={editForm.client_email} onChange={e => setEditForm(p => ({ ...p, client_email: e.target.value }))} /></div>
                  <div className="form-group"><label>Event Type</label>
                    <select className="input-field" value={editForm.event_type} onChange={e => setEditForm(p => ({ ...p, event_type: e.target.value }))}>
                      {EVENT_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="form-group"><label>Event Date</label><input type="date" className="input-field" style={{ colorScheme: 'light' }} value={editForm.event_date} onChange={e => setEditForm(p => ({ ...p, event_date: e.target.value }))} /></div>
                  <div className="form-group"><label>Status</label>
                    <select className="input-field" value={editForm.status} onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))}>
                      <option>Active</option><option>Completed</option><option>Cancelled</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ gridColumn: '1/-1' }}><label>Client Address</label><textarea className="input-field" rows={2} value={editForm.client_address} onChange={e => setEditForm(p => ({ ...p, client_address: e.target.value }))} /></div>
                  <div className="form-group" style={{ gridColumn: '1/-1' }}><label>Notes</label><textarea className="input-field" rows={2} value={editForm.notes} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))} /></div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowEdit(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Project'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}