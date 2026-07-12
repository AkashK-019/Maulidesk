import { useState } from 'react';
import {
  FileText, Printer, Download, MessageCircle,
  MapPin, Calendar, Phone, Mail, Loader2,
  CheckCircle, Clock, XCircle
} from 'lucide-react';
import { formatCurrency } from '../../utils/helpers';
import {
  printDocument, downloadDocumentPDF, whatsappShareDocument
} from '../../utils/documentPrint';

const Q_STATUS = {
  Pending:  { color: '#f59e0b', bg: '#fffbeb', icon: Clock },
  Approved: { color: '#10b981', bg: '#ecfdf5', icon: CheckCircle },
  Rejected: { color: '#ef4444', bg: '#fef2f2', icon: XCircle },
};

export default function QuotationTab({ quotation, company, project }) {
  const [busyAction, setBusyAction] = useState(null);

  if (!quotation) {
    return (
      <div className="pd-empty">
        <div className="pd-empty-icon"><FileText size={28} /></div>
        <p>No quotation linked to this project yet. Create one from the Quotations page to see it here.</p>
      </div>
    );
  }

  const sc = Q_STATUS[quotation.status] || Q_STATUS.Pending;
  const StatusIcon = sc.icon;
  const inter = quotation.gst_type === 'IGST';

  const runAction = async (action) => {
    setBusyAction(action);
    try {
      if (action === 'print')    await printDocument({ type: 'quote', doc: quotation, company, project });
      if (action === 'pdf')      await downloadDocumentPDF({ type: 'quote', doc: quotation, company, project });
      if (action === 'whatsapp') await whatsappShareDocument({ type: 'quote', doc: quotation, company, project });
    } catch (err) {
      alert('Failed: ' + err.message);
    } finally {
      setBusyAction(null);
    }
  };

  let lineItems = [];
  try {
    if (quotation.line_items) {
      const p = typeof quotation.line_items === 'string'
        ? JSON.parse(quotation.line_items)
        : quotation.line_items;
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
            <FileText size={16} /> Quotation #{quotation.quotation_number}
          </h3>
          <span className="pd-status-badge" style={{ color: sc.color, background: sc.bg }}>
            <StatusIcon size={12} /> {quotation.status}
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
          <p className="pd-info-label">Client</p>
          <p className="pd-info-val">{quotation.client_name}</p>
          {quotation.client_phone && <p className="pd-info-meta"><Phone size={11} /> {quotation.client_phone}</p>}
          {quotation.client_email && <p className="pd-info-meta"><Mail size={11} /> {quotation.client_email}</p>}
          {quotation.client_address && <p className="pd-info-meta"><MapPin size={11} /> {quotation.client_address}</p>}
        </div>
        <div className="pd-info-card">
          <p className="pd-info-label">Event Details</p>
          <p className="pd-info-val">{quotation.event_type || '—'}</p>
          {quotation.event_date && <p className="pd-info-meta"><Calendar size={11} /> {formatDateLocal(quotation.event_date)}</p>}
          <p className="pd-info-meta">Quotation Date: {formatDateLocal(quotation.quotation_date)}</p>
          {quotation.validity_days && <p className="pd-info-meta">Valid for {quotation.validity_days} days</p>}
        </div>
        <div className="pd-info-card">
          <p className="pd-info-label">Amount Summary</p>
          <div className="pd-amount-row"><span>Subtotal</span><strong>{formatCurrency(quotation.amount)}</strong></div>
          {inter
            ? <div className="pd-amount-row"><span>IGST</span><strong>{formatCurrency(quotation.igst_amount)}</strong></div>
            : <>
                <div className="pd-amount-row"><span>CGST</span><strong>{formatCurrency(quotation.cgst_amount)}</strong></div>
                <div className="pd-amount-row"><span>SGST</span><strong>{formatCurrency(quotation.sgst_amount)}</strong></div>
              </>
          }
          <div className="pd-amount-row grand"><span>Grand Total</span><strong>{formatCurrency(quotation.total_amount)}</strong></div>
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
                <th>Item / Description</th>
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
      {quotation.notes && (
        <div className="pd-notes-box">
          <p className="pd-notes-label">Notes</p>
          <p className="pd-notes-text">{quotation.notes}</p>
        </div>
      )}
    </div>
  );
}