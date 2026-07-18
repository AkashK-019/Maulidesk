import { useState } from 'react';
import {
  Receipt, Printer, Download, MessageCircle,
  MapPin, Calendar, Phone, Mail, Loader2,
  CheckCircle, Clock, AlertTriangle, Plus, X,
  Pencil, Check
} from 'lucide-react';
import { formatCurrency } from '../../utils/helpers';
import {
  printDocument, downloadDocumentPDF, whatsappShareDocument
} from '../../utils/documentPrint';
import { supabase } from '../../supabase';
import '../../styles/quotations.css';

const INV_STATUS = {
  'Paid':           { color: '#10b981', bg: '#ecfdf5', icon: CheckCircle },
  'Partially Paid': { color: '#f59e0b', bg: '#fffbeb', icon: Clock },
  'Unpaid':         { color: '#ef4444', bg: '#fef2f2', icon: AlertTriangle },
  'Overdue':        { color: '#b91c1c', bg: '#fee2e2', icon: AlertTriangle },
};

const toLocalYMD = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};
const todayStr = () => toLocalYMD();

const UNITS       = ['Nos','Sq.ft','Meter','Days','hr','Rolls'];
const GST_OPTIONS = [0, 5, 12, 18, 28];
const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
  'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
  'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab',
  'Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh',
  'Uttarakhand','West Bengal','Andaman and Nicobar Islands','Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu','Delhi','Jammu and Kashmir','Ladakh',
  'Lakshadweep','Puducherry',
];

const blankItem = () => ({
  id:     Date.now() + Math.random(),
  name:   '',
  desc:   '',
  qty:    1,
  unit:   'Nos',
  rate:   '',
  gstPct: 18,
});

const isInterState = (clientState, companyState) =>
  (clientState||'').trim().toLowerCase() !== (companyState||'maharashtra').trim().toLowerCase();

const calcItemAmount = (item, clientState, companyState) => {
  const amount   = (Number(item.qty)||0) * (Number(item.rate)||0);
  const gstPct   = item.gstPct ?? 18;
  const gstTotal = parseFloat(((amount * Number(gstPct)) / 100).toFixed(2));
  const inter    = isInterState(clientState, companyState);
  return {
    amount,
    gstTotal,
    cgst:  inter ? 0 : parseFloat((gstTotal/2).toFixed(2)),
    sgst:  inter ? 0 : parseFloat((gstTotal/2).toFixed(2)),
    igst:  inter ? gstTotal : 0,
    total: parseFloat((amount + gstTotal).toFixed(2)),
    gstPct,
  };
};

const calcTotals = (items, clientState, companyState) => {
  let subtotal = 0, totalGst = 0;
  items.forEach(it => {
    const { amount, gstTotal } = calcItemAmount(it, clientState, companyState);
    subtotal += amount;
    totalGst += gstTotal;
  });
  const inter = isInterState(clientState, companyState);
  return {
    subtotal:     parseFloat(subtotal.toFixed(2)),
    totalGst:     parseFloat(totalGst.toFixed(2)),
    cgst:         inter ? 0 : parseFloat((totalGst/2).toFixed(2)),
    sgst:         inter ? 0 : parseFloat((totalGst/2).toFixed(2)),
    igst:         inter ? parseFloat(totalGst.toFixed(2)) : 0,
    grandTotal:   parseFloat((subtotal + totalGst).toFixed(2)),
    isInterState: inter,
  };
};

const getCurrentFY = () => {
  const now = new Date();
  const yr  = now.getFullYear();
  const mo  = now.getMonth() + 1;
  const fyStart = mo >= 4 ? yr : yr - 1;
  return `${String(fyStart).slice(-2)}${String(fyStart+1).slice(-2)}`;
};

const genDirectInvoiceNumber = async (sb, fy) => {
  const prefix = `MLD-INV-${fy}-`;
  try {
    const { data } = await sb
      .from('invoices')
      .select('invoice_number')
      .like('invoice_number', `${prefix}%`);
    let maxNum = 0;
    (data || []).forEach(row => {
      const n = parseInt(String(row.invoice_number || '').replace(prefix, ''), 10);
      if (!isNaN(n) && n > maxNum) maxNum = n;
    });
    return `${prefix}${String(maxNum + 1).padStart(3, '0')}`;
  } catch {}
  return `${prefix}001`;
};

const effectiveStatus = (inv) => {
  if (inv.status === 'Paid') return 'Paid';
  const balance = Number(inv.total_amount || 0) - Number(inv.amount_paid || 0);
  if (balance <= 0) return 'Paid';
  if (inv.due_date && inv.due_date < todayStr()) return 'Overdue';
  return inv.status || 'Unpaid';
};

export default function TaxInvoiceTab({ invoice, company, project, onInvoiceCreated }) {
  const [busyAction, setBusyAction]     = useState(null);
  const [showCreate, setShowCreate]     = useState(false);
  const [form, setForm]                 = useState(null);
  const [items, setItems]               = useState([blankItem()]);
  const [saving, setSaving]             = useState(false);
  const [editingDate, setEditingDate]   = useState(false);
  const [dateValue, setDateValue]       = useState('');
  const [savingDate, setSavingDate]     = useState(false);

  const f = (field, value) => setForm(prev => ({ ...prev, [field]: value }));
  const addItem    = () => setItems(prev => [...prev, blankItem()]);
  const removeItem = (id) => setItems(prev => prev.filter(it => it.id !== id));
  const updateItem = (id, field, value) =>
    setItems(prev => prev.map(it => it.id === id ? { ...it, [field]: value } : it));

  const openCreateInvoice = () => {
    setForm({
      client_gst:    '',
      client_state:  company.state || 'Maharashtra',
      notes:         '',
    });
    setItems([blankItem()]);
    setShowCreate(true);
  };
  const closeCreateInvoice = () => { setShowCreate(false); setForm(null); setItems([blankItem()]); };

  const totals = form ? calcTotals(items, form.client_state, company.state) : null;

  const handleCreateInvoice = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const { subtotal, totalGst, grandTotal, cgst, sgst, igst, isInterState: inter } = calcTotals(items, form.client_state, company.state);
      const effectiveGstPct = subtotal > 0 ? parseFloat(((totalGst / subtotal) * 100).toFixed(2)) : 0;

      const enrichedItems = items.map(it => {
        const { amount, gstTotal, cgst: iC, sgst: iS, igst: iI, total } =
          calcItemAmount(it, form.client_state, company.state);
        return { ...it, gstPct: it.gstPct ?? 0, _amount: amount, _gstTotal: gstTotal, _cgst: iC, _sgst: iS, _igst: iI, _total: total };
      });

      const fy      = getCurrentFY();
      const invNum  = await genDirectInvoiceNumber(supabase, fy);
      const today   = toLocalYMD();

      const payload = {
        quotation_id:   null,
        project_id:     project.id,
        invoice_number: invNum,
        invoice_date:   today,
        due_date:       null,
        client_name:    project.client_name,
        client_email:   project.client_email   || null,
        client_phone:   project.client_phone   || null,
        client_gst:     form.client_gst        || null,
        client_address: project.client_address || null,
        client_state:   form.client_state      || company.state || 'Maharashtra',
        items:          enrichedItems,
        line_items:     null,
        amount:         subtotal,
        gst_percent:    effectiveGstPct,
        gst_type:       inter ? 'IGST' : 'CGST_SGST',
        cgst_amount:    cgst,
        sgst_amount:    sgst,
        igst_amount:    igst,
        gst_amount:     totalGst,
        total_amount:   grandTotal,
        notes:          form.notes          || null,
        payment_terms:  (company.paymentTerms || []).join('\n') || null,
        status:         'Unpaid',
        amount_paid:    0,
      };
      const { error } = await supabase.from('invoices').insert([payload]);
      if (error) throw error;

      closeCreateInvoice();
      onInvoiceCreated?.();
    } catch (err) {
      alert('Failed to create invoice: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!invoice) {
    return (
      <>
        <div className="pd-empty">
          <div className="pd-empty-icon"><Receipt size={28} /></div>
          <p>No tax invoice yet. Approve a quotation, or create one directly if the order was confirmed verbally.</p>
          <button className="qt-add-btn" style={{ marginTop: '0.25rem' }} onClick={openCreateInvoice}>
            <Plus size={14} /> Create Invoice
          </button>
        </div>

        {showCreate && (
          <div className="qt-modal-overlay">
            <div className="qt-modal qt-modal-wide">
              <div className="qt-modal-head">
                <h3 className="qt-modal-title">Create Tax Invoice</h3>
                <button className="qt-modal-close" onClick={closeCreateInvoice}>×</button>
              </div>
              <form onSubmit={handleCreateInvoice} style={{ display:'flex', flexDirection:'column', flex:1, minHeight:0, overflow:'hidden' }}>
                <div className="qt-modal-body">
                  <div className="qt-form-grid">

                    <div className="qt-section-label">Billing Details</div>

                    <div className="form-group">
                      <label>Client GST Number <span style={{fontSize:'.72rem',color:'#94a3b8',fontWeight:400}}>(optional)</span></label>
                      <input type="text" value={form.client_gst}
                        onChange={e=>f('client_gst', e.target.value.toUpperCase())}
                        className="input-field" placeholder="e.g. 27XXXXX0000X1ZX" maxLength={15}/>
                    </div>
                    <div className="form-group">
                      <label>Client State (for GST) *</label>
                      <select className="input-field" required value={form.client_state}
                        onChange={e=>f('client_state', e.target.value)}>
                        {INDIAN_STATES.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>

                    <div className="qt-section-label">
                      Items &amp; Services
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
                                <td><input className="qt-item-input" value={it.name}
                                  onChange={e=>updateItem(it.id,'name',e.target.value)}
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
                                  <div className="qt-row-amount">{formatCurrency(total)}</div>
                                  {(it.gstPct ?? 0) > 0 && <div style={{fontSize:'.68rem',color:'#94a3b8'}}>+GST {formatCurrency(gstTotal)}</div>}
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

                    <div className="qt-summary-box">
                      <div className="qt-summary-row">
                        <span className="qt-summary-label">Subtotal (excl. GST)</span>
                        <span className="qt-summary-val">{formatCurrency(totals.subtotal)}</span>
                      </div>
                      {totals.isInterState ? (
                        <div className="qt-summary-row">
                          <span className="qt-summary-label">IGST</span>
                          <span className="qt-summary-val">{formatCurrency(totals.igst)}</span>
                        </div>
                      ) : (
                        <>
                          <div className="qt-summary-row">
                            <span className="qt-summary-label">CGST</span>
                            <span className="qt-summary-val">{formatCurrency(totals.cgst)}</span>
                          </div>
                          <div className="qt-summary-row">
                            <span className="qt-summary-label">SGST</span>
                            <span className="qt-summary-val">{formatCurrency(totals.sgst)}</span>
                          </div>
                        </>
                      )}
                      <div className="qt-summary-total">
                        <span className="qt-summary-label">Grand Total</span>
                        <span className="qt-summary-val">{formatCurrency(totals.grandTotal)}</span>
                      </div>
                    </div>

                    <div className="form-group qt-full">
                      <label>Notes</label>
                      <textarea className="input-field" rows={2} value={form.notes}
                        onChange={e=>f('notes', e.target.value)} placeholder="Optional notes for this invoice…"/>
                    </div>

                  </div>
                </div>
                <div className="qt-modal-foot">
                  <button type="button" className="btn-secondary" onClick={closeCreateInvoice} disabled={saving}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={saving}>
                    {saving ? 'Creating…' : 'Create Invoice'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </>
    );
  }

  const stat = effectiveStatus(invoice);
  const sc = INV_STATUS[stat] || INV_STATUS['Unpaid'];
  const StatusIcon = sc.icon;
  const inter = invoice.gst_type === 'IGST';

  const runAction = async (action) => {
    setBusyAction(action);
    try {
      if (action === 'print')    await printDocument({ type: 'invoice', doc: invoice, company, project });
      if (action === 'pdf')      await downloadDocumentPDF({ type: 'invoice', doc: invoice, company, project });
      if (action === 'whatsapp') await whatsappShareDocument({ type: 'invoice', doc: invoice, company, project });
    } catch (err) {
      alert('Failed: ' + err.message);
    } finally {
      setBusyAction(null);
    }
  };

  const openDateEdit = () => {
    setDateValue(invoice.invoice_date || todayStr());
    setEditingDate(true);
  };

  const cancelDateEdit = () => {
    setEditingDate(false);
    setDateValue('');
  };

  const handleSaveInvoiceDate = async () => {
    if (!dateValue) return;
    setSavingDate(true);
    try {
      const { error } = await supabase
        .from('invoices')
        .update({ invoice_date: dateValue })
        .eq('id', invoice.id);
      if (error) throw error;
      setEditingDate(false);
      onInvoiceCreated?.();
    } catch (err) {
      alert('Failed to update invoice date: ' + err.message);
    } finally {
      setSavingDate(false);
    }
  };

  let lineItems = [];
  try {
    if (invoice.items) {
      const p = typeof invoice.items === 'string' ? JSON.parse(invoice.items) : invoice.items;
      lineItems = p?.items ?? (Array.isArray(p) ? p : []);
    }
    if (!lineItems.length && invoice.line_items) {
      const p = typeof invoice.line_items === 'string' ? JSON.parse(invoice.line_items) : invoice.line_items;
      lineItems = p?.items ?? (Array.isArray(p) ? p : []);
    }
  } catch {}

  const formatDateLocal = (d) => {
    if (!d) return '—';
    const [y, m, dd] = d.split('-').map(Number);
    return new Date(y, m - 1, dd).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="pd-tab-content">
      {/* Header bar */}
      <div className="pd-section-bar">
        <div>
          <h3 className="pd-section-title">
            <Receipt size={16} /> Tax Invoice #{invoice.invoice_number}
          </h3>
          <span className="pd-status-badge" style={{ color: sc.color, background: sc.bg }}>
            <StatusIcon size={12} /> {stat}
          </span>
        </div>
        <div className="pd-action-group">
          <button className="pd-action-btn" onClick={() => runAction('print')} disabled={!!busyAction} title="Print">
            {busyAction === 'print' ? <Loader2 size={14} className="spin" /> : <Printer size={14} />}
            <span>Print</span>
          </button>
          <button className="pd-action-btn pdf" onClick={() => runAction('pdf')} disabled={!!busyAction} title="Download PDF">
            {busyAction === 'pdf' ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
            <span>PDF</span>
          </button>
          <button className="pd-action-btn wa" onClick={() => runAction('whatsapp')} disabled={!!busyAction} title="WhatsApp">
            {busyAction === 'whatsapp' ? <Loader2 size={14} className="spin" /> : <MessageCircle size={14} />}
            <span>WhatsApp</span>
          </button>
        </div>
      </div>

      {/* Client + event info */}
      <div className="pd-info-grid">
        <div className="pd-info-card">
          <p className="pd-info-label">Bill To</p>
          <p className="pd-info-val">{invoice.client_name}</p>
          {invoice.client_phone && <p className="pd-info-meta"><Phone size={11} /> {invoice.client_phone}</p>}
          {invoice.client_email && <p className="pd-info-meta"><Mail size={11} /> {invoice.client_email}</p>}
          {invoice.client_address && <p className="pd-info-meta"><MapPin size={11} /> {invoice.client_address}</p>}
        </div>
        <div className="pd-info-card">
          <p className="pd-info-label">Invoice Details</p>
          <p className="pd-info-val">{invoice.event_type || '—'}</p>
          {editingDate ? (
            <div className="pd-info-meta" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Calendar size={11} />
              <input
                type="date"
                className="input-field"
                style={{ padding: '2px 6px', fontSize: '0.8rem', width: 140 }}
                value={dateValue}
                onChange={e => setDateValue(e.target.value)}
                disabled={savingDate}
              />
              <button type="button" title="Save" onClick={handleSaveInvoiceDate} disabled={savingDate}
                style={{ background: '#10b981', border: 'none', borderRadius: 4, color: '#fff', width: 22, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                {savingDate ? <Loader2 size={12} className="spin" /> : <Check size={12} />}
              </button>
              <button type="button" title="Cancel" onClick={cancelDateEdit} disabled={savingDate}
                style={{ background: '#f1f5f9', border: 'none', borderRadius: 4, color: '#64748b', width: 22, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <X size={12} />
              </button>
            </div>
          ) : (
            invoice.invoice_date && (
              <p className="pd-info-meta" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Calendar size={11} /> Invoice Date: {formatDateLocal(invoice.invoice_date)}
                <button type="button" title="Edit invoice date" onClick={openDateEdit}
                  style={{
                    background: '#eef2ff',
                    border: '1px solid #c7d2fe',
                    borderRadius: 5,
                    cursor: 'pointer',
                    padding: 4,
                    marginLeft: 4,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#4f46e5',
                    lineHeight: 0,
                  }}>
                  <Pencil size={13} />
                </button>
              </p>
            )
          )}
          {invoice.client_gst && <p className="pd-info-meta">Client GSTIN: {invoice.client_gst}</p>}
        </div>
        <div className="pd-info-card">
          <p className="pd-info-label">Amount Summary</p>
          <div className="pd-amount-row"><span>Subtotal</span><strong>{formatCurrency(invoice.amount)}</strong></div>
          {inter
            ? <div className="pd-amount-row"><span>IGST ({invoice.gst_percent}%)</span><strong>{formatCurrency(invoice.igst_amount)}</strong></div>
            : <>
                <div className="pd-amount-row"><span>CGST</span><strong>{formatCurrency(invoice.cgst_amount)}</strong></div>
                <div className="pd-amount-row"><span>SGST</span><strong>{formatCurrency(invoice.sgst_amount)}</strong></div>
              </>
          }
          <div className="pd-amount-row grand"><span>Grand Total</span><strong>{formatCurrency(invoice.total_amount)}</strong></div>
        </div>
      </div>

      {/* Line items */}
      {lineItems.length > 0 && (
        <>
        <p className="pd-scroll-hint">Swipe to see more →</p>
        <div className="pd-items-table-wrap">
          <table className="pd-items-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Item / Desc.</th>
                <th>Qty</th>
                <th>Unit</th>
                <th>Rate</th>
                <th>GST%</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((it, i) => (
                <tr key={i}>
                  <td className="pd-item-idx">{i + 1}</td>
                  <td className="pd-item-cell">
                    <span className="pd-item-name">{it.name}</span>
                    {it.desc && <span className="pd-item-desc">{it.desc}</span>}
                  </td>
                  <td data-label="Qty">{it.qty}</td>
                  <td data-label="Unit">{it.unit}</td>
                  <td data-label="Rate">{formatCurrency(it.rate)}</td>
                  <td data-label="GST">{it.gstPct ?? 0}%</td>
                  <td className="pd-item-amount" data-label="Amount" style={{ textAlign: 'right' }}>{formatCurrency(it._total ?? (it.qty * it.rate))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}

      {/* Notes */}
      {invoice.notes && (
        <div className="pd-notes-box">
          <p className="pd-notes-label">Notes</p>
          <p className="pd-notes-text">{invoice.notes}</p>
        </div>
      )}
    </div>
  );
}