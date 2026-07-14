import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  CreditCard, Plus, Printer, Download, X, Share2, Trash2,
  CheckCircle, AlertTriangle, Clock, Loader2, IndianRupee, Receipt, Wallet
} from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { supabase } from '../../supabase';
import html2pdf from 'html2pdf.js';
import '../../styles/quotations.css';

const PAYMENT_MODES = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Card'];

const PAYMENT_LABELS = [
  'Advance', '1st Installment', '2nd Installment', '3rd Installment',
  'Final Payment', 'Balance Payment', 'Token Amount', 'Custom'
];

const PRINT_FONT_SPECS = ['700 38pt Tangerine', '700 1em Tillana', '700 1em "Yatra One"', '800 26pt Inter', '400 22px "Great Vibes"'];

const MAULI_LOGO_DATA_URI = 'data:image/png;base64,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';

const numToWords = (num) => {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  if (!num || num === 0) return 'Zero';
  const convert = (n) => {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convert(n % 100) : '');
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '');
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '');
  };
  const intPart = Math.floor(num);
  const paisa = Math.round((num - intPart) * 100);
  return convert(intPart) + ' Rupees' + (paisa > 0 ? ' and ' + convert(paisa) + ' Paise' : '') + ' Only';
};

const inr = (n) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const todayLocal = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

const invoiceSeqSegment = (invoiceNumber) => {
  const parts = String(invoiceNumber || '').split('-');
  const last = parts[parts.length - 1];
  return /^\d+$/.test(last) ? last : '001';
};

const genReceiptNumber = async (invoice) => {
  const now = new Date();
  const yr = now.getFullYear();
  const mo = now.getMonth() + 1;
  const fyStart = mo >= 4 ? yr : yr - 1;
  const fy = `${String(fyStart).slice(-2)}${String(fyStart + 1).slice(-2)}`;
  const invSeq = invoiceSeqSegment(invoice.invoice_number);
  const prefix = `RCT-${fy}-${invSeq}-`;
  try {
    const { data } = await supabase
      .from('payment_receipts')
      .select('receipt_number')
      .eq('invoice_id', invoice.id)
      .like('receipt_number', `${prefix}%`)
      .order('receipt_number', { ascending: false })
      .limit(1);
    if (data && data.length > 0) {
      const last = parseInt(data[0].receipt_number.replace(prefix, ''), 10);
      return `${prefix}${String(isNaN(last) ? 1 : last + 1).padStart(3, '0')}`;
    }
  } catch {}
  return `${prefix}001`;
};

const buildReceiptDocHTML = async (receipt, invoice, company, project) => {
  const total    = Number(invoice.total_amount || 0);
  const received = Number(receipt.amount || 0);
  const prevPaid = Number(invoice.amount_paid || 0) - received; 
  const balance  = Math.round((total - Number(invoice.amount_paid || 0)) * 100) / 100;

  const dateStr = new Date(receipt.payment_date).toLocaleDateString('en-IN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
  const paymentDateLong = new Date(receipt.payment_date).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
  const invDateLong = invoice.invoice_date
    ? new Date(invoice.invoice_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : null;

  const amountInWords = numToWords(received);

  const nameParts = (company.name || '').trim().split(' ');
  const brandRest = nameParts.slice(1).join(' ');
  const isMauli = nameParts[0]?.toLowerCase() === 'mauli';
  const brandMarkHTML = (isMauli && MAULI_LOGO_DATA_URI)
    ? `<img src="${MAULI_LOGO_DATA_URI}" alt="${nameParts[0]}" class="qtp-brand-logo-img"/>`
    : `<span class="qtp-brand-marathi">${nameParts[0] || company.name || ''}</span>`;

  const pageHeaderFinal = (pageNum, totalPages) => `
    <div class="qtp-header">
      <div class="qtp-brand-block">
        <div class="qtp-brand-text">
          <div class="qtp-brand-name-wrap">
            <div class="qtp-brand-lockup">
              ${brandMarkHTML}
              ${brandRest ? `<span class="qtp-brand-english">${brandRest}</span>` : ''}
            </div>
          </div>
        </div>
      </div>
      <div class="qtp-header-right">
        <div class="qtp-doc-title">RECEIPT</div>
        <table class="qtp-meta-table">
          <tr><td class="qtp-meta-key">Receipt No.</td><td class="qtp-meta-val"><strong>${receipt.receipt_number || '—'}</strong></td></tr>
          <tr><td class="qtp-meta-key">Date</td><td class="qtp-meta-val"><strong>${dateStr}</strong></td></tr>
          ${company.gstNumber ? `<tr><td class="qtp-meta-key">GST No.</td><td class="qtp-meta-val"><strong>${company.gstNumber}</strong></td></tr>` : ''}
          ${totalPages > 1 ? `<tr><td class="qtp-meta-key">Page</td><td class="qtp-meta-val"><strong>${pageNum} / ${totalPages}</strong></td></tr>` : ''}
        </table>
      </div>
    </div>`;

  const pageFooterHTML = `
    <div class="qtp-page-footer">
      <div class="qtp-footer-addr-row">
        <span class="qtp-footer-sep">·</span>
        <span>${company.address || ''}</span>
      </div>
      <div class="qtp-footer-contact-row">
        ${company.phone ? `<span> ${company.phone}</span><span class="qtp-footer-sep">·</span>` : ''}
        ${company.email ? `<span> ${company.email}</span><span class="qtp-footer-sep">·</span>` : ''}
        ${company.gstNumber ? `<span>GST: ${company.gstNumber}</span>` : ''}
      </div>
    </div>`;

  const infoBandHTML = `
  <div class="qtp-info-band">
    <div class="qtp-billed-col">
      <div class="qtp-band-label">RECEIVED FROM</div>
      <div class="qtp-billed-name">${(invoice.client_name || '—').toUpperCase()}</div>
      ${invoice.client_address ? `<div class="qtp-billed-addr">${invoice.client_address}</div>` : ''}
      ${invoice.client_phone ? `<div class="qtp-billed-contact"><svg class="qtp-icon-phone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 16.98 15H19a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v2.02a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384"/></svg> ${invoice.client_phone}</div>` : ''}
      ${invoice.client_gst ? `<div class="qtp-billed-gst">GST No.: ${invoice.client_gst}</div>` : ''}
    </div>
    <div class="qtp-project-col">
      <div class="qtp-band-label">INVOICE REFERENCE</div>
      <div class="qtp-proj-row"><span class="qtp-proj-key">Invoice No.</span><span class="qtp-proj-val">#${invoice.invoice_number || '—'}</span></div>
      ${invDateLong ? `<div class="qtp-proj-row"><span class="qtp-proj-key">Invoice Date</span><span class="qtp-proj-val">${invDateLong}</span></div>` : ''}
      ${project?.project_name ? `<div class="qtp-proj-row"><span class="qtp-proj-key">Project</span><span class="qtp-proj-val">${project.project_name}</span></div>` : ''}
    </div>
  </div>`;

  const paymentTableHTML = `
  <div class="qtp-financials"><div class="qtp-section-head" style="margin-bottom:12px">Payment Details</div>
    <table class="qtp-items-print-table">
      <thead>
        <tr>
          <th class="col-sr">SR.NO</th>
          <th class="col-item">Payment For</th>
          <th class="col-qty">Mode</th>
          <th class="col-rate">Date</th>
          <th class="col-amt">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="col-sr">1</td>
          <td class="col-item">${receipt.label || 'Payment'}${receipt.notes ? `<div class="item-desc">${receipt.notes}</div>` : ''}</td>
          <td class="col-qty">${receipt.payment_mode || '—'}</td>
          <td class="col-rate">${paymentDateLong}</td>
          <td class="col-amt">${inr(received)}</td>
        </tr>
      </tbody>
    </table>
  </div>`;

  const summaryTopHTML = `
  <div class="qtp-summary-row">
    <div class="qtp-summary-left">
      <div class="qtp-totals-words">Amount in Words: <strong>${amountInWords}</strong></div>
    </div>
    <div class="qtp-summary-right">
      <table class="qtp-totals-table">
        <tbody>
          <tr><td class="qtp-totals-label">Invoice Total</td><td class="qtp-totals-value">${inr(total)}</td></tr>
          <tr><td class="qtp-totals-label">Previously Paid</td><td class="qtp-totals-value">${inr(prevPaid)}</td></tr>
          <tr class="qtp-totals-grand-row" style="background:#fff !important;color:#0f172a !important;"><td class="qtp-totals-label" style="background:#fff !important;color:#0f172a !important;font-weight:700;border-right:1px solid #e2e8f0;">Amount Received</td><td class="qtp-totals-value" style="background:#fff !important;color:#0f172a !important;font-weight:700;">${inr(received)}</td></tr>
        </tbody>
      </table>
    </div>
  </div>`;

  const summaryBottomHTML = `
  <div class="qtp-summary-row" style="display:flex;align-items:flex-end;">
    <div class="qtp-summary-left">
      <div class="qtp-summary-left-terms">
        <div class="qtp-terms-section">
          <div class="qtp-terms-head">Payment Received Against</div>
          <div class="qtp-tc-item">• Invoice #${invoice.invoice_number || '—'}${project?.project_name ? ` — ${project.project_name}` : ''}</div>
          <div class="qtp-tc-item">• Received via ${receipt.payment_mode || '—'} on ${paymentDateLong}</div>
        </div>
        ${company.bank && company.bank.bankName ? `
        <div class="qtp-terms-section">
          <div class="qtp-terms-head">Bank Details</div>
          <div class="qtp-tc-item">Bank: ${company.bank.bankName}</div>
          <div class="qtp-tc-item">A/C No.: ${company.bank.accountNo || '—'}</div>
          <div class="qtp-tc-item">IFSC: ${company.bank.ifsc || '—'} · Branch: ${company.bank.branch || '—'}</div>
        </div>` : ''}
      </div>
    </div>
    <div class="qtp-summary-right" style="align-self:flex-end;">
      <div class="qtp-sig-block">
        <div class="qtp-sig-bottom">
          <div class="qtp-sig-line"></div>
          <div class="qtp-sig-label-row">
            <div class="qtp-sig-label">Authorised Signatory</div>
            <div class="qtp-sig-company-name">${company.name || ''}</div>
          </div>
        </div>
      </div>
    </div>
  </div>`;

  const paidTillNow = Number(invoice.amount_paid || 0);
  const statusLine = balance <= 0.01
    ? `Invoice Paid: <strong>${inr(paidTillNow)}</strong> &nbsp;·&nbsp; Fully Settled`
    : `Invoice Paid: <strong>${inr(paidTillNow)}</strong> &nbsp;·&nbsp; Remaining: <strong>${inr(balance)}</strong>`;

  const thankYouLine = `Thank you!`;

  const thankStripHTML = `
  <div class="qtp-validity-strip" style="display:flex;flex-direction:column;gap:4px;text-align:center;">
    <div class="qtp-validity-row qtp-validity-row-status">${statusLine}</div>
    <div class="qtp-validity-row qtp-validity-row-thanks">${thankYouLine}</div>
  </div>`;

  if (document.fonts && document.fonts.ready) {
    try { await document.fonts.ready; } catch (_) {}
  }

  const sandbox = document.createElement('div');
  sandbox.style.cssText = 'position:fixed;top:0;left:-9999px;z-index:-1;visibility:hidden;pointer-events:none;';
  document.body.appendChild(sandbox);

  const overflowsOnePage = (bodyHTML, pageNum, totalGuess) => {
    sandbox.innerHTML = `<div class="qt-print-doc">${pageHeaderFinal(pageNum, totalGuess)}<div class="qtp-page-body">${bodyHTML}</div>${pageFooterHTML}</div>`;
    const pageBody = sandbox.querySelector('.qtp-page-body');
    if (!pageBody || !pageBody.lastElementChild) return false;
    const reservedBottom = parseFloat(window.getComputedStyle(pageBody).paddingBottom) || 0;
    const safeBottom     = pageBody.getBoundingClientRect().top + pageBody.clientHeight - reservedBottom;
    const contentBottom  = pageBody.lastElementChild.getBoundingClientRect().bottom;
    return contentBottom > safeBottom + 1;
  };

  const topBlockHTML    = `${infoBandHTML}${paymentTableHTML}${summaryTopHTML}`;
  const bottomBlockHTML = `${summaryBottomHTML}${thankStripHTML}`;
  const fullBodyHTML    = `${topBlockHTML}${bottomBlockHTML}`;

  const pinBottomHTML = (topHTML, bottomHTML) => `
    <div style="display:flex;flex-direction:column;height:100%;">
      ${topHTML}
      <div style="flex:1 1 auto;"></div>
      ${bottomHTML}
    </div>`;

  if (!overflowsOnePage(fullBodyHTML, 1, 1)) {
    document.body.removeChild(sandbox);
    return `<div class="qt-print-wrapper"><div class="qt-print-doc">
      ${pageHeaderFinal(1, 1)}<div class="qtp-page-body">${pinBottomHTML(topBlockHTML, bottomBlockHTML)}</div>${pageFooterHTML}</div></div>`;
  }

  const page1Body = topBlockHTML;
  document.body.removeChild(sandbox);

  return `<div class="qt-print-wrapper">
    <div class="qt-print-doc qtp-page-break">${pageHeaderFinal(1, 2)}<div class="qtp-page-body">${page1Body}</div>${pageFooterHTML}</div>
    <div class="qt-print-doc">${pageHeaderFinal(2, 2)}<div class="qtp-page-body">${pinBottomHTML('', bottomBlockHTML)}</div>${pageFooterHTML}</div>
  </div>`;
};

const collectRenderedFontSpecs = (root) => {
  const selector = '.qtp-brand-marathi, .qtp-brand-english, .qtp-doc-title, .qtp-sig-company-name, .qtp-billed-name, .qtp-section-head, .qtp-meta-key, .qtp-meta-val';
  const specs = new Set();
  root.querySelectorAll(selector).forEach(el => {
    const cs = getComputedStyle(el);
    if (cs.fontFamily) specs.add(`${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`);
  });
  return Array.from(specs);
};

const waitForImages = (root) => Promise.all(
  Array.from(root.querySelectorAll('img')).map(img => {
    if (img.complete && img.naturalWidth > 0) {
      return img.decode ? img.decode().catch(() => {}) : Promise.resolve();
    }
    return new Promise(resolve => {
      img.onload  = () => (img.decode ? img.decode().then(resolve).catch(resolve) : resolve());
      img.onerror = resolve;
    });
  })
);

const settleFontsAndLayout = async (root, doc = document, win = window) => {
  const specs = Array.from(new Set([...PRINT_FONT_SPECS, ...collectRenderedFontSpecs(root)]));
  try {
    if (doc.fonts) await Promise.all(specs.map(spec => doc.fonts.load(spec).catch(() => {})));
  } catch (_) {}
  if (doc.fonts && doc.fonts.ready) {
    try { await doc.fonts.ready; } catch (_) {}
  }
  void root.offsetHeight;
  const raf = win.requestAnimationFrame ? win.requestAnimationFrame.bind(win) : requestAnimationFrame;
  await new Promise(r => raf(() => raf(r)));
  await new Promise(r => setTimeout(r, 80));
};

const waitForFontsReady = async (doc, specs, maxMs = 1500) => {
  if (!doc.fonts) return;
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    if (specs.every(spec => doc.fonts.check(spec))) return;
    await new Promise(r => setTimeout(r, 50));
  }
};

const collectPageCSS = () => {
  const imports = [];
  const externalHrefs = [];
  let cssText = '';
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) {
        if (rule.type === CSSRule.MEDIA_RULE && /print/i.test(rule.media?.mediaText || '')) continue;

        if (rule.type === CSSRule.IMPORT_RULE) { imports.push(rule.cssText); continue; }
        cssText += rule.cssText + '\n';
      }
    } catch (_) {
      if (sheet.href) externalHrefs.push(sheet.href);
    }
  }
  return { css: imports.join('\n') + '\n' + cssText, externalHrefs };
};

const cloneExternalFontLinks = (frameDoc, hrefs) => Promise.all(
  hrefs.map(href => new Promise(resolve => {
    const link = frameDoc.createElement('link');
    link.rel = 'stylesheet';
    link.href = href
    const timeout = setTimeout(resolve, 3000);
    link.onload = () => { clearTimeout(timeout); resolve(); };
    link.onerror = () => { clearTimeout(timeout); resolve(); };
    frameDoc.head.appendChild(link);
  }))
);

const printReceiptDoc = async (receipt, invoice, company, project) => {
  const bodyHTML = await buildReceiptDocHTML(receipt, invoice, company, project);
  const { css: pageCSS, externalHrefs } = collectPageCSS();

  let iframe = document.getElementById('pr-print-frame');
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'pr-print-frame';

    iframe.style.cssText = 'position:fixed;top:0;left:-10000px;width:210mm;height:297mm;border:0;';
    document.body.appendChild(iframe);
  }

  const frameDoc = iframe.contentDocument || iframe.contentWindow.document;
  frameDoc.open();
  frameDoc.write(`<!DOCTYPE html><html><head><meta charset="utf-8" />
    <base href="${document.baseURI}" />
    <style>
      @page { size: A4; margin: 0; }
      html, body { margin: 0; padding: 0; background: #fff; }
      ${pageCSS}
    </style>
    <style>
      html, body { visibility: visible !important; display: block !important; }
      body * { visibility: visible !important; }
    </style>
  </head><body id="pr-print-root">${bodyHTML}</body></html>`);
  frameDoc.close();

  await cloneExternalFontLinks(frameDoc, externalHrefs);

  const frameWin = iframe.contentWindow;
  await waitForImages(frameDoc.body);
  await settleFontsAndLayout(frameDoc.body, frameDoc, frameWin);
  await waitForFontsReady(frameDoc, Array.from(new Set([...PRINT_FONT_SPECS, ...collectRenderedFontSpecs(frameDoc.body)])), 3000);

  frameWin.focus();
  setTimeout(() => frameWin.print(), 100);

  frameWin.addEventListener?.('afterprint', () => {
    iframe.remove();
  }, { once: true });
};

const downloadReceiptPdfDoc = async (receipt, invoice, company, project) => {
  let root = document.getElementById('pr-pdf-export-root');
  if (!root) { root = document.createElement('div'); root.id = 'pr-pdf-export-root'; document.body.appendChild(root); }
  root.style.width = root.style.minWidth = '794px';
  root.innerHTML = await buildReceiptDocHTML(receipt, invoice, company, project);
  await waitForImages(root);
  await settleFontsAndLayout(root);
  await waitForFontsReady(document, Array.from(new Set([...PRINT_FONT_SPECS, ...collectRenderedFontSpecs(root)])), 3000);
  const pageDivs = Array.from(root.querySelectorAll('.qt-print-doc'));
  pageDivs.forEach(d => { d.style.width = d.style.minWidth = '794px'; d.style.height = d.style.minHeight = d.style.maxHeight = '1122px'; d.style.overflow = 'hidden'; });
  const filename = `Receipt-${receipt.receipt_number || receipt.id}.pdf`;
  const opts = { margin: 0, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true, scrollX: 0, scrollY: 0, windowWidth: 794, width: 794, height: 1122, letterRendering: true, imageTimeout: 0, logging: false }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } };
  try {
    if (pageDivs.length === 1) { await html2pdf().set({ ...opts, filename }).from(pageDivs[0]).save(); }
    else {
      const w = html2pdf().set({ ...opts, filename });
      await w.from(pageDivs[0]).toImg().toPdf();
      const pdf = w.prop.pdf;
      for (let i = 1; i < pageDivs.length; i++) { const w2 = html2pdf().set(opts); await w2.from(pageDivs[i]).toImg(); pdf.addPage(); pdf.addImage(w2.prop.img, 'JPEG', 0, 0, 210, 297); }
      pdf.save(filename);
    }
  } catch (err) { alert('Failed to generate PDF: ' + err.message); }
  finally { root.innerHTML = ''; root.style.width = root.style.minWidth = ''; }
};

const buildReceiptPdfBlob = async (receipt, invoice, company, project) => {
  let root = document.getElementById('pr-pdf-export-root');
  if (!root) { root = document.createElement('div'); root.id = 'pr-pdf-export-root'; document.body.appendChild(root); }
  root.style.width = root.style.minWidth = '794px';
  root.innerHTML = await buildReceiptDocHTML(receipt, invoice, company, project);
  await waitForImages(root);
  await settleFontsAndLayout(root);
  await waitForFontsReady(document, Array.from(new Set([...PRINT_FONT_SPECS, ...collectRenderedFontSpecs(root)])), 3000);
  const pageDivs = Array.from(root.querySelectorAll('.qt-print-doc'));
  pageDivs.forEach(d => { d.style.width = d.style.minWidth = '794px'; d.style.height = d.style.minHeight = d.style.maxHeight = '1122px'; d.style.overflow = 'hidden'; });
  const filename = `Receipt-${receipt.receipt_number || receipt.id}.pdf`;
  const opts = { margin: 0, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true, scrollX: 0, scrollY: 0, windowWidth: 794, width: 794, height: 1122, letterRendering: true, imageTimeout: 0, logging: false }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } };
  try {
    if (pageDivs.length === 1) { const blob = await html2pdf().set({ ...opts, filename }).from(pageDivs[0]).outputPdf('blob'); return { blob, filename }; }
    const w = html2pdf().set(opts); await w.from(pageDivs[0]).toImg().toPdf();
    const pdf = w.prop.pdf;
    for (let i = 1; i < pageDivs.length; i++) { const w2 = html2pdf().set(opts); await w2.from(pageDivs[i]).toImg(); pdf.addPage(); pdf.addImage(w2.prop.img, 'JPEG', 0, 0, 210, 297); }
    return { blob: pdf.output('blob'), filename };
  } finally { root.innerHTML = ''; root.style.width = root.style.minWidth = ''; }
};

const toWhatsAppNumber = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.length === 10 ? `91${digits}` : digits;
};

const shareReceiptViaWhatsApp = async (receipt, invoice, company, project) => {
  const balance = Math.round((Number(invoice.total_amount || 0) - Number(invoice.amount_paid || 0)) * 100) / 100;
  const waText = encodeURIComponent(
    [
      `Payment Receipt ${receipt.receipt_number || ''}`,
      `${company.name || ''}`,
      `Received from: ${invoice.client_name || ''}`,
      `Amount: ${inr(receipt.amount)}`,
      `Against Invoice #${invoice.invoice_number || '—'}${project?.project_name ? ` — ${project.project_name}` : ''}`,
      balance > 0.01 ? `Balance Due: ${inr(balance)}` : 'Invoice fully paid.',
    ].join('\n')
  );
  const num = toWhatsAppNumber(invoice.client_phone);
  const waUrl = num ? `https://wa.me/${num}?text=${waText}` : `https://wa.me/?text=${waText}`;
  try {
    const { blob, filename } = await buildReceiptPdfBlob(receipt, invoice, company, project);
    const file = new File([blob], filename, { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: `Receipt ${receipt.receipt_number}` });
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
      alert(`"${filename}" downloaded. Attach it in WhatsApp (📎 → Document).`);
      window.open(waUrl, '_blank');
    }
  } catch (err) { if (err?.name !== 'AbortError') alert('Failed to share: ' + err.message); }
};

const isMobilePrintUnreliable = () =>
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
  (navigator.maxTouchPoints > 1 && /Mac/i.test(navigator.platform));

export default function PaymentReceiptTab({ invoice, payments, company, project, onPaymentAdded }) {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ amount: '', label: 'Advance', customLabel: '', mode: 'Cash', date: todayLocal(), notes: '' });
  const [saving, setSaving] = useState(false);
  const [printingId, setPrintingId] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    if (document.fonts) PRINT_FONT_SPECS.forEach(spec => document.fonts.load(spec).catch(() => {}));
  }, []);

  if (!invoice) {
    return (
      <div className="pd-empty">
        <div className="pd-empty-icon"><CreditCard size={28} /></div>
        <p>Payment receipts will appear here after the tax invoice is generated.</p>
      </div>
    );
  }

  const totalAmt = Number(invoice.total_amount || 0);
  const totalPaid = Number(invoice.amount_paid || 0);
  const balance = Math.round((totalAmt - totalPaid) * 100) / 100;
  const paidPct = totalAmt > 0 ? Math.min(100, Math.round((totalPaid / totalAmt) * 100)) : 0;
  const progressColor = { fill: '#7c3aed', text: '#7c3aed', bg: '#f5f3ff' };
  const isFullyPaid = balance <= 0.01;

  const handleAddPayment = async (e) => {
    e.preventDefault();
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) { alert('Enter a valid amount.'); return; }
    if (amt > balance + 0.01) { alert(`Amount cannot exceed balance due of ${formatCurrency(balance)}.`); return; }
    setSaving(true);
    try {
      const rcptNum = await genReceiptNumber(invoice);
      const label = form.label === 'Custom' ? form.customLabel : form.label;
      const newPaid = totalPaid + amt;
      const newStatus = newPaid >= totalAmt - 0.01 ? 'Paid' : 'Partially Paid';

      const { error: rcptErr } = await supabase.from('payment_receipts').insert([{
        invoice_id:     invoice.id,
        project_id:     invoice.project_id,
        receipt_number: rcptNum,
        amount:         amt,
        label,
        payment_mode:   form.mode,
        payment_date:   form.date,
        notes:          form.notes || null,
      }]);
      if (rcptErr) throw rcptErr;

      const { error: invErr } = await supabase
        .from('invoices')
        .update({ amount_paid: newPaid, status: newStatus })
        .eq('id', invoice.id);
      if (invErr) throw invErr;

      setShowModal(false);
      setForm({ amount: '', label: 'Advance', customLabel: '', mode: 'Cash', date: todayLocal(), notes: '' });
      if (onPaymentAdded) onPaymentAdded();
    } catch (err) {
      alert('Failed to record payment: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const openPaymentModal = () => {
    setForm(prev => ({ ...prev, date: todayLocal() }));
    setShowModal(true);
  };

  const handlePrintReceipt = async (rcpt) => {
    setPrintingId(rcpt.id);
    try {
      if (isMobilePrintUnreliable()) {
        const tab = window.open('', '_blank');
        const { blob, filename } = await buildReceiptPdfBlob(rcpt, invoice, company, project);
        const url = URL.createObjectURL(blob);
        if (tab) {
          tab.location.href = url;
        } else {
          const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
        }
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      } else {
        await printReceiptDoc(rcpt, invoice, company, project);
      }
    } catch (err) {
      alert('Failed to print: ' + err.message);
    } finally {
      setTimeout(() => setPrintingId(null), 400);
    }
  };

  const handleDownloadReceipt = async (rcpt) => {
    setDownloadingId(rcpt.id);
    try {
      await downloadReceiptPdfDoc(rcpt, invoice, company, project);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleShareReceipt = async (rcpt) => {
    await shareReceiptViaWhatsApp(rcpt, invoice, company, project);
  };

  const handleDeleteReceipt = async (rcpt) => {
    if (!window.confirm(`Delete receipt ${rcpt.receipt_number}? This will also reduce the invoice's recorded payments by ${formatCurrency(rcpt.amount)}.`)) return;
    setDeletingId(rcpt.id);
    try {
      const { error: delErr } = await supabase.from('payment_receipts').delete().eq('id', rcpt.id);
      if (delErr) throw delErr;

      const newPaid = Math.max(0, totalPaid - Number(rcpt.amount || 0));
      const newStatus = newPaid <= 0 ? 'Unpaid' : newPaid >= totalAmt - 0.01 ? 'Paid' : 'Partially Paid';
      const { error: invErr } = await supabase
        .from('invoices')
        .update({ amount_paid: newPaid, status: newStatus })
        .eq('id', invoice.id);
      if (invErr) throw invErr;

      if (onPaymentAdded) onPaymentAdded();
    } catch (err) {
      alert('Failed to delete receipt: ' + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="pd-tab-content">
      <div className="pd-section-bar">
        <div>
          <h3 className="pd-section-title">
            <IndianRupee size={16} /> Payment Receipts
          </h3>
          {isFullyPaid ? (
            <span className="pd-status-badge" style={{ color: '#10b981', background: '#ecfdf5' }}>
              <CheckCircle size={12} /> Fully Paid
            </span>
          ) : (
            <span className="pd-status-badge" style={{ color: progressColor.text, background: progressColor.bg }}>
              <Clock size={12} /> {paidPct}% Collected
            </span>
          )}
        </div>
        {!isFullyPaid && (
          <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.5rem 1rem', fontSize: '0.83rem' }} onClick={openPaymentModal}>
            <Plus size={14} /> Record Payment
          </button>
        )}
      </div>

      {!isFullyPaid && (
        <div className="pd-progress-banner">
          <div className="pd-progress-top">
            <span>Payment Progress</span>
            <span className="pd-progress-pct" style={{ color: progressColor.text }}>{paidPct}% Collected</span>
          </div>
          <div className="pd-progress-bar-bg">
            <div className="pd-progress-bar-fill" style={{ width: `${paidPct}%`, background: progressColor.fill }} />
          </div>
        </div>
      )}

      <div className="pd-pay-kpis">
        <div className="pd-pay-kpi">
          <div className="pd-pay-kpi-icon" style={{ background: '#eff6ff', color: '#2563eb' }}>
            <Receipt size={18} />
          </div>
          <div className="pd-pay-kpi-body">
            <span className="pd-pay-kpi-val">{formatCurrency(totalAmt)}</span>
            <span className="pd-pay-kpi-lbl">Invoice Total</span>
          </div>
        </div>
        <div className="pd-pay-kpi">
          <div className="pd-pay-kpi-icon" style={{ background: '#ecfdf5', color: '#10b981' }}>
            <Wallet size={18} />
          </div>
          <div className="pd-pay-kpi-body">
            <span className="pd-pay-kpi-val">{formatCurrency(totalPaid)}</span>
            <span className="pd-pay-kpi-lbl">Total Received</span>
          </div>
        </div>
        <div className="pd-pay-kpi">
          <div
            className="pd-pay-kpi-icon"
            style={isFullyPaid ? { background: '#ecfdf5', color: '#10b981' } : { background: '#fef2f2', color: '#ef4444' }}
          >
            {isFullyPaid ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          </div>
          <div className="pd-pay-kpi-body">
            <span className="pd-pay-kpi-val">{isFullyPaid ? 'Fully Paid' : formatCurrency(balance)}</span>
            <span className="pd-pay-kpi-lbl">Balance Due</span>
          </div>
        </div>
      </div>

      <div className="pd-section-bar" style={{ marginTop: '0.25rem' }}>
        <h3 className="pd-section-title"><IndianRupee size={16} /> Payment History ({payments.length})</h3>
      </div>

      {payments.length === 0 ? (
        <div className="pd-empty">
          <div className="pd-empty-icon"><CreditCard size={26} /></div>
          <p>No payments recorded yet. Click "Record Payment" to add the first installment.</p>
        </div>
      ) : (
        <>
        <p className="pd-scroll-hint">Swipe to see more →</p>
        <div className="pd-items-table-wrap">
          <table className="pd-items-table">
            <thead>
              <tr>
                <th>Receipt #</th>
                <th>Date</th>
                <th>Label</th>
                <th>Mode</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th style={{ textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((rcpt) => (
                <tr key={rcpt.id}>
                  <td className="pd-item-cell"><span className="pd-item-name">{rcpt.receipt_number}</span></td>
                  <td data-label="Date">{formatDate(rcpt.payment_date)}</td>
                  <td data-label="Label">
                    <span className="pd-rcpt-label">{rcpt.label}</span>
                    {rcpt.notes && <span className="pd-item-desc">{rcpt.notes}</span>}
                  </td>
                  <td data-label="Mode"><span className="pd-mode-badge">{rcpt.payment_mode}</span></td>
                  <td className="pd-item-amount" data-label="Amount" style={{ textAlign: 'right', color: '#10b981', fontWeight: 600 }}>{formatCurrency(rcpt.amount)}</td>
                  <td className="pd-item-action" data-label="Action" style={{ textAlign: 'center' }}>
                    <div className="pd-icon-actions">
                      <button className="pd-icon-btn" onClick={() => handlePrintReceipt(rcpt)} disabled={printingId === rcpt.id} title="Print">
                        {printingId === rcpt.id ? <Loader2 size={14} className="spin" /> : <Printer size={14} />}
                      </button>
                      <button className="pd-icon-btn pdf" onClick={() => handleDownloadReceipt(rcpt)} disabled={downloadingId === rcpt.id} title="Download PDF">
                        {downloadingId === rcpt.id ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
                      </button>
                      <button className="pd-icon-btn wa" onClick={() => handleShareReceipt(rcpt)} title="Share on WhatsApp">
                        <Share2 size={14} />
                      </button>
                      <button className="pd-icon-btn danger" onClick={() => handleDeleteReceipt(rcpt)} disabled={deletingId === rcpt.id} title="Delete">
                        {deletingId === rcpt.id ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="pd-table-total-row">
                <td colSpan={4} style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-muted)', paddingTop: '0.5rem' }}>Total Received</td>
                <td style={{ textAlign: 'right', fontWeight: 700, color: '#10b981', paddingTop: '0.5rem' }}>{formatCurrency(totalPaid)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        </>
      )}

      {showModal && createPortal(
        <div className="pd-rcpt-overlay" onClick={() => setShowModal(false)}>
          <div className="pd-rcpt-card" onClick={e => e.stopPropagation()}>
            <div className="pd-rcpt-head">
              <h3>Record Payment</h3>
              <button type="button" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleAddPayment} className="pd-rcpt-form">
              <div className="pd-rcpt-body">

                <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: '1rem', fontSize: '0.83rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertTriangle size={14} />
                  Balance Due: <strong>{formatCurrency(balance)}</strong>
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label>Payment Label *</label>
                    <select className="input-field" value={form.label} onChange={e => setForm(p => ({ ...p, label: e.target.value }))}>
                      {PAYMENT_LABELS.map(l => <option key={l}>{l}</option>)}
                    </select>
                  </div>
                  {form.label === 'Custom' && (
                    <div className="form-group">
                      <label>Custom Label *</label>
                      <input className="input-field" required value={form.customLabel} onChange={e => setForm(p => ({ ...p, customLabel: e.target.value }))} placeholder="e.g. Token Payment" />
                    </div>
                  )}
                  <div className="form-group">
                    <label>Amount Received (₹) *</label>
                    <input type="number" className="input-field" required min="1" max={balance} step="0.01" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder={`Max: ₹${balance.toFixed(2)}`} autoFocus />
                  </div>
                  <div className="form-group">
                    <label>Payment Mode</label>
                    <select className="input-field" value={form.mode} onChange={e => setForm(p => ({ ...p, mode: e.target.value }))}>
                      {PAYMENT_MODES.map(m => <option key={m}>{m}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Payment Date</label>
                    <input type="date" className="input-field" style={{ colorScheme: 'light' }} value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
                  </div>
                  <div className="form-group" style={{ gridColumn: '1/-1' }}>
                    <label>Notes (optional)</label>
                    <input className="input-field" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="e.g. Paid via HDFC UPI" />
                  </div>
                </div>
              </div>
              <div className="pd-rcpt-foot">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? <><Loader2 size={13} className="spin" /> Saving</> : <><Download size={13} /> Save & Print Receipt</>}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}