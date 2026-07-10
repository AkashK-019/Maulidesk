import { useState } from 'react';
import {
  Receipt, Printer, Download, MessageCircle,
  MapPin, Calendar, Phone, Mail, Loader2,
  CheckCircle, Clock, AlertTriangle
} from 'lucide-react';
import { formatCurrency } from '../../utils/helpers';
import {
  printDocument, downloadDocumentPDF, whatsappShareDocument
} from '../../utils/documentPrint';

const INV_STATUS = {
  'Paid':           { color: '#10b981', bg: '#ecfdf5', icon: CheckCircle },
  'Partially Paid': { color: '#f59e0b', bg: '#fffbeb', icon: Clock },
  'Unpaid':         { color: '#ef4444', bg: '#fef2f2', icon: AlertTriangle },
  'Overdue':        { color: '#b91c1c', bg: '#fee2e2', icon: AlertTriangle },
};

const todayStr = () => new Date().toISOString().split('T')[0];

const effectiveStatus = (inv) => {
  if (inv.status === 'Paid') return 'Paid';
  const balance = Number(inv.total_amount || 0) - Number(inv.amount_paid || 0);
  if (balance <= 0) return 'Paid';
  if (inv.due_date && inv.due_date < todayStr()) return 'Overdue';
  return inv.status || 'Unpaid';
};

export default function TaxInvoiceTab({ invoice, company, project }) {
  const [busyAction, setBusyAction] = useState(null);

  if (!invoice) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
        <Receipt size={40} style={{ marginBottom: '1rem', opacity: 0.3 }} />
        <p style={{ margin: 0, fontSize: '0.9rem' }}>
          Tax Invoice will appear here once the quotation is approved and confirmed.
        </p>
      </div>
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
          {invoice.invoice_date && <p className="pd-info-meta"><Calendar size={11} /> Invoice Date: {formatDateLocal(invoice.invoice_date)}</p>}
          {invoice.due_date && <p className="pd-info-meta">Due Date: {formatDateLocal(invoice.due_date)}</p>}
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