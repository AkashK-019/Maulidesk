import { useState, useEffect, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { supabase } from '../supabase';
import { formatCurrency } from '../utils/helpers';
import {
  TrendingUp, TrendingDown, DollarSign, CreditCard,
  RefreshCw, Loader2, Calendar, BarChart2, FileText,
  ArrowUpRight, ArrowDownRight, Wallet, Minus, Lightbulb
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart, Area,
  BarChart, Bar,
  LineChart, Line,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid,
  Tooltip, Legend
} from 'recharts';
import '../styles/finance.css';

/* ─── Date helpers ───────────────────────────────────────── */
const pad = n => String(n).padStart(2, '0');
const fmtDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function getDateRange(period) {
  const now = new Date();

  if (period === 'daily') {
    return { start: fmtDate(now), end: fmtDate(now), label: 'Today' };
  }
  if (period === 'weekly') {
    const cloned = new Date(now);
    const day  = cloned.getDay();
    const diff = cloned.getDate() - day + (day === 0 ? -6 : 1);
    const mon  = new Date(cloned.setDate(diff));
    const sun  = new Date(new Date(mon).setDate(mon.getDate() + 6));
    return { start: fmtDate(mon), end: fmtDate(sun), label: 'This Week' };
  }
  if (period === 'monthly') {
    const s = new Date(now.getFullYear(), now.getMonth(), 1);
    const e = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { start: fmtDate(s), end: fmtDate(e), label: 'This Month' };
  }
  const s = new Date(now.getFullYear(), 0, 1);
  const e = new Date(now.getFullYear(), 11, 31);
  return { start: fmtDate(s), end: fmtDate(e), label: `Year ${now.getFullYear()}` };
}

/* Same calendar window as getDateRange(period), but exactly one year earlier */
function getPreviousYearEquivalent(period) {
  const { start, end } = getDateRange(period);
  const shift = s => { const d = new Date(s); d.setFullYear(d.getFullYear() - 1); return d; };
  return { start: fmtDate(shift(start)), end: fmtDate(shift(end)) };
}

/* Full Jan–Dec window for (current year - yearsAgo) */
function getCalendarYearRange(yearsAgo = 0) {
  const y = new Date().getFullYear() - yearsAgo;
  return { start: fmtDate(new Date(y, 0, 1)), end: fmtDate(new Date(y, 11, 31)), year: y };
}

/* ─── Chart colours ──────────────────────────────────────── */
const ACCENT      = '#0d9488';
const DANGER      = '#ef4444';
const WARNING     = '#f59e0b';
const PURPLE      = '#8b5cf6';
const MUTED_BLUE  = '#94a3b8';
const PIE_COLORS  = [ACCENT, WARNING, DANGER, PURPLE, '#60a5fa', '#34d399'];

/* ─── Custom Tooltip ─────────────────────────────────────── */
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="fin-tooltip">
      <p className="fin-tooltip-label">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
}

/* ─── Aggregation helpers ────────────────────────────────── */
function sumTotals(invoices, receipts, labourPay) {
  const totalRevenue    = invoices.reduce((s, i) => s + (parseFloat(i.total_amount) || 0), 0);
  const totalPaid       = receipts.reduce((s, r) => s + (parseFloat(r.amount)       || 0), 0);
  const totalLabourCost = labourPay.reduce((s, l) => s + (parseFloat(l.amount_paid) || 0), 0);
  const totalOutstanding = invoices.reduce((s, i) => {
    const out = (parseFloat(i.total_amount) || 0) - (parseFloat(i.amount_paid) || 0);
    return s + (out > 0 ? out : 0);
  }, 0);
  return {
    totalRevenue, totalPaid, totalLabourCost, totalOutstanding,
    netProfit: totalPaid - totalLabourCost,
    invoiceCount: invoices.length,
    paidCount:    invoices.filter(i => i.status === 'Paid').length,
    unpaidCount:  invoices.filter(i => i.status === 'Unpaid' || i.status === 'Overdue').length,
    partialCount: invoices.filter(i => i.status === 'Partially Paid').length,
  };
}

function bucketKey(dateStr, period) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  if (period === 'daily')   return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  if (period === 'weekly')  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' });
  if (period === 'monthly') return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  return d.toLocaleDateString('en-IN', { month: 'short' });
}

function buildTimeChart(period, invoices, receipts, labourPay) {
  const map = {};
  invoices.forEach(i => {
    const k = bucketKey(i.invoice_date, period);
    if (!k) return;
    if (!map[k]) map[k] = { name: k, Revenue: 0, Received: 0, Labour: 0 };
    map[k].Revenue += parseFloat(i.total_amount) || 0;
  });
  receipts.forEach(r => {
    const k = bucketKey(r.payment_date, period);
    if (!k) return;
    if (!map[k]) map[k] = { name: k, Revenue: 0, Received: 0, Labour: 0 };
    map[k].Received += parseFloat(r.amount) || 0;
  });
  labourPay.forEach(l => {
    const k = bucketKey(l.payment_date, period);
    if (!k) return;
    if (!map[k]) map[k] = { name: k, Revenue: 0, Received: 0, Labour: 0 };
    map[k].Labour += parseFloat(l.amount_paid) || 0;
  });
  return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
}

function buildLabourChart(period, labourPay) {
  const map = {};
  labourPay.forEach(l => {
    const k = bucketKey(l.payment_date, period);
    if (!k) return;
    if (!map[k]) map[k] = { name: k, Labour: 0 };
    map[k].Labour += parseFloat(l.amount_paid) || 0;
  });
  return Object.values(map);
}

/* Bucket a full calendar year of records into 12 monthly totals */
function buildMonthlyTotals(invoices, receipts, labourPay) {
  const months = MONTH_NAMES.map(() => ({ Revenue: 0, Received: 0, Labour: 0 }));
  invoices.forEach(i => {
    const d = new Date(i.invoice_date);
    if (isNaN(d)) return;
    months[d.getMonth()].Revenue += parseFloat(i.total_amount) || 0;
  });
  receipts.forEach(r => {
    const d = new Date(r.payment_date);
    if (isNaN(d)) return;
    months[d.getMonth()].Received += parseFloat(r.amount) || 0;
  });
  labourPay.forEach(l => {
    const d = new Date(l.payment_date);
    if (isNaN(d)) return;
    months[d.getMonth()].Labour += parseFloat(l.amount_paid) || 0;
  });
  return months;
}

function pctChange(curr, prev) {
  if (!prev) return curr > 0 ? null : 0; // null = "new", no baseline to compare
  return ((curr - prev) / Math.abs(prev)) * 100;
}

/* ─── Sub-components ─────────────────────────────────────── */
const COLOR_MAP = {
  teal:   { bg: 'rgba(13,148,136,0.1)',  text: '#0d9488', border: 'rgba(13,148,136,0.3)'  },
  green:  { bg: 'rgba(16,185,129,0.1)',  text: '#10b981', border: 'rgba(16,185,129,0.3)'  },
  amber:  { bg: 'rgba(245,158,11,0.1)',  text: '#f59e0b', border: 'rgba(245,158,11,0.3)'  },
  red:    { bg: 'rgba(239,68,68,0.1)',   text: '#ef4444', border: 'rgba(239,68,68,0.3)'   },
  purple: { bg: 'rgba(139,92,246,0.1)',  text: '#8b5cf6', border: 'rgba(139,92,246,0.3)'  },
};

function DeltaBadge({ value, invert = false }) {
  if (value === null) {
    return <span className="fin-delta fin-delta-neutral"><Minus size={11} /> New</span>;
  }
  const isFlat = Math.abs(value) < 0.5;
  const isGood = invert ? value <= 0 : value >= 0;
  const cls = isFlat ? 'fin-delta-neutral' : (isGood ? 'fin-delta-up' : 'fin-delta-down');
  const Icon = isFlat ? Minus : (value >= 0 ? ArrowUpRight : ArrowDownRight);
  return (
    <span className={`fin-delta ${cls}`}>
      <Icon size={11} />{isFlat ? '0%' : `${Math.abs(value).toFixed(1)}%`}
    </span>
  );
}

function KpiCard({ icon, label, value, sub, color = 'teal', delta, invert }) {
  const c = COLOR_MAP[color] || COLOR_MAP.teal;
  return (
    <div className="fin-kpi-card">
      <div className="fin-kpi-icon" style={{ background: c.bg, color: c.text }}>{icon}</div>
      <div className="fin-kpi-content">
        <span className="fin-kpi-label">{label}</span>
        <div className="fin-kpi-value-row">
          <span className="fin-kpi-value" style={{ color: c.text }}>{value}</span>
        </div>
        <div className="fin-kpi-foot">
          <span className="fin-kpi-sub">{sub}</span>
          {delta !== undefined && <DeltaBadge value={delta} invert={invert} />}
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, color, bold, icon }) {
  return (
    <div className="fin-summary-row" style={{ fontWeight: bold ? '700' : '400' }}>
      <span className="fin-summary-label">{label}</span>
      <span className="fin-summary-value" style={{ color, display: 'flex', alignItems: 'center', gap: 4 }}>
        {icon}{value}
      </span>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="fin-empty-chart">
      <BarChart2 size={32} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
      <p>No data for this period</p>
    </div>
  );
}

/* Row in the This-Year-vs-Last-Year comparison table */
function CompareRow({ label, thisYear, lastYear }) {
  const delta = pctChange(thisYear, lastYear);
  const isGood = delta === null ? true : delta >= 0;
  return (
    <div className="fin-cmp-row">
      <span className="fin-cmp-label">{label}</span>
      <span className="fin-cmp-value fin-cmp-ty">{formatCurrency(thisYear)}</span>
      <span className="fin-cmp-value fin-cmp-value-muted fin-cmp-ly">{formatCurrency(lastYear)}</span>
      <span className={`fin-cmp-change ${delta === null ? '' : (isGood ? 'fin-cmp-up' : 'fin-cmp-down')}`}>
        {delta === null ? '—' : `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`}
      </span>
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────── */
export default function Finance() {
  const [period,  setPeriod]  = useState('monthly');
  const [loading, setLoading] = useState(true);

  const [kpi, setKpi] = useState({
    totalRevenue: 0, totalPaid: 0, totalOutstanding: 0,
    totalLabourCost: 0, netProfit: 0, invoiceCount: 0, paidCount: 0,
    unpaidCount: 0, partialCount: 0,
  });
  const [prevKpi, setPrevKpi] = useState(null); // same period, one year earlier

  const [revenueChart,  setRevenueChart]  = useState([]);
  const [labourChart,   setLabourChart]   = useState([]);
  const [invoiceStatus, setInvoiceStatus] = useState([]);
  const [topClients,    setTopClients]    = useState([]);

  const [yearly, setYearly] = useState({
    thisYear: new Date().getFullYear(),
    lastYear: new Date().getFullYear() - 1,
    monthly: [],
    thisYearTotals: null,
    lastYearTotals: null,
  });

  const fetchRange = async (start, end) => {
    const [{ data: invoices = [] }, { data: receipts = [] }, { data: labourPay = [] }] =
      await Promise.all([
        supabase.from('invoices')
          .select('id, total_amount, amount_paid, status, invoice_date, client_name')
          .gte('invoice_date', start).lte('invoice_date', end)
          .order('invoice_date', { ascending: true }),
        supabase.from('payment_receipts')
          .select('amount, payment_date')
          .gte('payment_date', start).lte('payment_date', end),
        supabase.from('labour_payments')
          .select('amount_paid, payment_date')
          .gte('payment_date', start).lte('payment_date', end),
      ]);
    return { invoices, receipts, labourPay };
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const cur  = getDateRange(period);
      const prev = getPreviousYearEquivalent(period);
      const curYear  = getCalendarYearRange(0);
      const lastYear = getCalendarYearRange(1);

      const [curData, prevData, curYearData, lastYearData] = await Promise.all([
        fetchRange(cur.start, cur.end),
        fetchRange(prev.start, prev.end),
        fetchRange(curYear.start, curYear.end),
        fetchRange(lastYear.start, lastYear.end),
      ]);

      /* Current period KPIs + charts */
      const totals = sumTotals(curData.invoices, curData.receipts, curData.labourPay);
      setKpi(totals);
      setRevenueChart(buildTimeChart(period, curData.invoices, curData.receipts, curData.labourPay));
      setLabourChart(buildLabourChart(period, curData.labourPay));
      setInvoiceStatus([
        { name: 'Paid',           value: totals.paidCount    },
        { name: 'Unpaid/Overdue', value: totals.unpaidCount  },
        { name: 'Partially Paid', value: totals.partialCount },
      ].filter(d => d.value > 0));

      const clientMap = {};
      curData.invoices.forEach(i => {
        const amt = parseFloat(i.total_amount) || 0;
        clientMap[i.client_name] = (clientMap[i.client_name] || 0) + amt;
      });
      setTopClients(
        Object.entries(clientMap)
          .sort((a, b) => b[1] - a[1]).slice(0, 5)
          .map(([name, value]) => ({ name, value }))
      );

      /* Same period, last year — powers the delta badges */
      setPrevKpi(sumTotals(prevData.invoices, prevData.receipts, prevData.labourPay));

      /* Full calendar-year comparison — this year vs last year, month by month */
      const curMonthly  = buildMonthlyTotals(curYearData.invoices, curYearData.receipts, curYearData.labourPay);
      const lastMonthly = buildMonthlyTotals(lastYearData.invoices, lastYearData.receipts, lastYearData.labourPay);
      const monthly = MONTH_NAMES.map((name, i) => ({
        name,
        ThisYear: curMonthly[i].Revenue,
        LastYear: lastMonthly[i].Revenue,
      }));
      setYearly({
        thisYear: curYear.year,
        lastYear: lastYear.year,
        monthly,
        thisYearTotals:  sumTotals(curYearData.invoices, curYearData.receipts, curYearData.labourPay),
        lastYearTotals:  sumTotals(lastYearData.invoices, lastYearData.receipts, lastYearData.labourPay),
      });
    } catch (err) {
      console.error('Finance fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const netProfit = kpi.totalPaid - kpi.totalLabourCost;
  const { label: periodLabel } = getDateRange(period);

  const revDelta    = prevKpi ? pctChange(kpi.totalRevenue,     prevKpi.totalRevenue)     : undefined;
  const paidDelta   = prevKpi ? pctChange(kpi.totalPaid,        prevKpi.totalPaid)        : undefined;
  const outDelta    = prevKpi ? pctChange(kpi.totalOutstanding, prevKpi.totalOutstanding) : undefined;
  const labourDelta = prevKpi ? pctChange(kpi.totalLabourCost,  prevKpi.totalLabourCost)  : undefined;
  const profitDelta = prevKpi ? pctChange(netProfit,            prevKpi.netProfit)        : undefined;

  const yoyRevenueDelta = yearly.thisYearTotals && yearly.lastYearTotals
    ? pctChange(yearly.thisYearTotals.totalRevenue, yearly.lastYearTotals.totalRevenue) : null;
  const yoyProfitDelta = yearly.thisYearTotals && yearly.lastYearTotals
    ? pctChange(yearly.thisYearTotals.netProfit, yearly.lastYearTotals.netProfit) : null;

  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-content">
        <Header title="Finance" />
        <main className="gs-main">

          {/* ── Top bar ── */}
          <div className="fin-topbar animate-fade">
            <div>
              <h2 className="fin-page-title">Finance Report</h2>
              <p className="fin-page-sub">Track revenue, payments &amp; labour expenses — compared against last year</p>
            </div>
            <div className="fin-controls">
              <div className="fin-period-tabs">
                {['daily','weekly','monthly','yearly'].map(p => (
                  <button
                    key={p}
                    className={`fin-tab ${period === p ? 'active' : ''}`}
                    onClick={() => setPeriod(p)}
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
              <button className="btn-secondary fin-refresh" onClick={fetchData} disabled={loading}>
                <RefreshCw size={14} className={loading ? 'spin-anim' : ''} />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="fin-loader">
              <Loader2 size={36} className="spin-anim" style={{ color: 'var(--accent)' }} />
              <p>Loading financial data…</p>
            </div>
          ) : (
            <div className="animate-fade">

              {/* ── KPI Row — each card shows the change vs the same period last year ── */}
              <div className="fin-kpi-grid">
                <KpiCard icon={<DollarSign size={20} />}   label="Total Invoiced"  value={formatCurrency(kpi.totalRevenue)}     sub={`${kpi.invoiceCount} invoice${kpi.invoiceCount !== 1 ? 's' : ''}`} color="teal"   delta={revDelta} />
                <KpiCard icon={<Wallet size={20} />}       label="Amount Received" value={formatCurrency(kpi.totalPaid)}        sub={`${kpi.paidCount} paid`}                                            color="green"  delta={paidDelta} />
                <KpiCard icon={<CreditCard size={20} />}   label="Outstanding"     value={formatCurrency(kpi.totalOutstanding)} sub={`${kpi.unpaidCount + kpi.partialCount} pending`}                    color="amber"  delta={outDelta} invert />
                <KpiCard icon={<TrendingDown size={20} />} label="Labour Cost"     value={formatCurrency(kpi.totalLabourCost)}  sub="Wages &amp; payments"                                               color="red"    delta={labourDelta} invert />
                <KpiCard
                  icon={netProfit >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                  label="Net Profit"
                  value={formatCurrency(netProfit)}
                  sub="Received − Labour"
                  color={netProfit >= 0 ? 'purple' : 'red'}
                  delta={profitDelta}
                />
              </div>

              {/* ── Year-over-year overview ── */}
              <div className="glass-card fin-chart-card fin-yoy-card">
                <div className="fin-chart-header">
                  <h3 className="fin-chart-title"><Calendar size={16} /> {yearly.thisYear} vs {yearly.lastYear} — Revenue by Month</h3>
                  <p className="fin-chart-sub">Full calendar year, regardless of the filter above</p>
                </div>

                <div className="fin-yoy-body">
                  <div className="fin-yoy-chart">
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={yearly.monthly} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#74838c' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#74838c' }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: '0.8rem' }} />
                        <Bar dataKey="LastYear" name={`${yearly.lastYear}`} fill={MUTED_BLUE} radius={[4,4,0,0]} />
                        <Bar dataKey="ThisYear" name={`${yearly.thisYear}`} fill={ACCENT}     radius={[4,4,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="fin-yoy-stats">
                    <div className="fin-yoy-stat">
                      <span className="fin-yoy-stat-label">{yearly.thisYear} Revenue</span>
                      <span className="fin-yoy-stat-value" style={{ color: ACCENT }}>
                        {yearly.thisYearTotals ? formatCurrency(yearly.thisYearTotals.totalRevenue) : '—'}
                      </span>
                    </div>
                    <div className="fin-yoy-stat">
                      <span className="fin-yoy-stat-label">{yearly.lastYear} Revenue</span>
                      <span className="fin-yoy-stat-value" style={{ color: MUTED_BLUE }}>
                        {yearly.lastYearTotals ? formatCurrency(yearly.lastYearTotals.totalRevenue) : '—'}
                      </span>
                    </div>
                    <div className="fin-yoy-stat-divider" />
                    <div className="fin-yoy-stat">
                      <span className="fin-yoy-stat-label">Year-on-year growth</span>
                      <span className="fin-yoy-stat-value">
                        <DeltaBadge value={yoyRevenueDelta} />
                      </span>
                    </div>
                    <div className="fin-yoy-stat">
                      <span className="fin-yoy-stat-label">Profit growth</span>
                      <span className="fin-yoy-stat-value">
                        <DeltaBadge value={yoyProfitDelta} />
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Plain-language insights ── */}
              <div className="fin-insights-row">
                <div className="fin-insight-card">
                  <Lightbulb size={16} className="fin-insight-icon" />
                  <p>
                    {periodLabel} revenue is <strong>{formatCurrency(kpi.totalRevenue)}</strong>
                    {revDelta !== undefined && revDelta !== null && (
                      <> — {revDelta >= 0 ? 'up' : 'down'} <strong>{Math.abs(revDelta).toFixed(1)}%</strong> versus the same period last year</>
                    )}.
                  </p>
                </div>
                <div className="fin-insight-card">
                  <Lightbulb size={16} className="fin-insight-icon" />
                  <p>
                    You are carrying <strong>{formatCurrency(kpi.totalOutstanding)}</strong> in unpaid invoices
                    {kpi.unpaidCount + kpi.partialCount > 0 && <> across <strong>{kpi.unpaidCount + kpi.partialCount}</strong> invoice(s)</>}.
                  </p>
                </div>
                <div className="fin-insight-card">
                  <Lightbulb size={16} className="fin-insight-icon" />
                  <p>
                    Net {netProfit >= 0 ? 'profit' : 'loss'} for {periodLabel.toLowerCase()} is <strong style={{ color: netProfit >= 0 ? '#10b981' : DANGER }}>{formatCurrency(Math.abs(netProfit))}</strong> after labour costs.
                  </p>
                </div>
              </div>

              {/* ── Area + Pie ── */}
              <div className="fin-chart-row">
                <div className="glass-card fin-chart-card fin-chart-lg">
                  <div className="fin-chart-header">
                    <h3 className="fin-chart-title"><BarChart2 size={16} /> Revenue vs Received vs Labour</h3>
                    <p className="fin-chart-sub">{periodLabel}</p>
                  </div>
                  {revenueChart.length === 0 ? <EmptyChart /> : (
                    <ResponsiveContainer width="100%" height={280}>
                      <AreaChart data={revenueChart} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor={ACCENT}  stopOpacity={0.25} />
                            <stop offset="95%" stopColor={ACCENT}  stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="gRec" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor={PURPLE} stopOpacity={0.25} />
                            <stop offset="95%" stopColor={PURPLE} stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="gLab" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor={DANGER} stopOpacity={0.2} />
                            <stop offset="95%" stopColor={DANGER} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#74838c' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#74838c' }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: '0.8rem' }} />
                        <Area type="monotone" dataKey="Revenue"  stroke={ACCENT}  fill="url(#gRev)" strokeWidth={2} dot={false} />
                        <Area type="monotone" dataKey="Received" stroke={PURPLE}  fill="url(#gRec)" strokeWidth={2} dot={false} />
                        <Area type="monotone" dataKey="Labour"   stroke={DANGER}  fill="url(#gLab)" strokeWidth={2} dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>

                <div className="glass-card fin-chart-card fin-chart-sm">
                  <div className="fin-chart-header">
                    <h3 className="fin-chart-title"><FileText size={16} /> Invoice Status</h3>
                    <p className="fin-chart-sub">{kpi.invoiceCount} total</p>
                  </div>
                  {invoiceStatus.length === 0 ? <EmptyChart /> : (
                    <>
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie data={invoiceStatus} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                            {invoiceStatus.map((_, i) => (
                              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v, n) => [v, n]} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="fin-legend">
                        {invoiceStatus.map((d, i) => (
                          <div key={i} className="fin-legend-item">
                            <span className="fin-legend-dot" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                            <span>{d.name}</span>
                            <span className="fin-legend-val">{d.value}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* ── Labour Bar + Top Clients ── */}
              <div className="fin-chart-row">
                <div className="glass-card fin-chart-card fin-chart-md">
                  <div className="fin-chart-header">
                    <h3 className="fin-chart-title"><TrendingDown size={16} /> Labour Expenses</h3>
                    <p className="fin-chart-sub">{periodLabel}</p>
                  </div>
                  {labourChart.length === 0 ? <EmptyChart /> : (
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={labourChart} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#74838c' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#74838c' }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="Labour" fill={DANGER} radius={[4,4,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>

                <div className="glass-card fin-chart-card fin-chart-md">
                  <div className="fin-chart-header">
                    <h3 className="fin-chart-title"><TrendingUp size={16} /> Top Clients</h3>
                    <p className="fin-chart-sub">By invoice value</p>
                  </div>
                  {topClients.length === 0 ? <EmptyChart /> : (
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={topClients} layout="vertical" margin={{ top: 5, right: 25, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10, fill: '#74838c' }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                        <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11, fill: '#74838c' }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="value" name="Revenue" fill={ACCENT} radius={[0,4,4,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* ── Net Cash Flow Line Chart ── */}
              <div className="glass-card fin-chart-card" style={{ marginBottom: '1.5rem' }}>
                <div className="fin-chart-header">
                  <h3 className="fin-chart-title"><Calendar size={16} /> Net Cash Flow (Received − Labour)</h3>
                  <p className="fin-chart-sub">{periodLabel}</p>
                </div>
                {revenueChart.length === 0 ? <EmptyChart /> : (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart
                      data={revenueChart.map(d => ({ ...d, NetFlow: (d.Received || 0) - (d.Labour || 0) }))}
                      margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#74838c' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#74838c' }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: '0.8rem' }} />
                      <Line type="monotone" dataKey="NetFlow" name="Net Cash Flow" stroke={PURPLE} strokeWidth={2.5} dot={{ r: 4, fill: PURPLE }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* ── Financial Summary — this period ── */}
              <div className="glass-card" style={{ marginBottom: '1.5rem' }}>
                <div className="fin-chart-header" style={{ marginBottom: '1rem' }}>
                  <h3 className="fin-chart-title"><FileText size={16} /> Financial Summary — {periodLabel}</h3>
                </div>
                <div className="fin-summary-table">
                  <SummaryRow label="Total Invoiced"     value={formatCurrency(kpi.totalRevenue)}     color="var(--accent)" />
                  <SummaryRow label="Amount Received"    value={formatCurrency(kpi.totalPaid)}        color={PURPLE} />
                  <SummaryRow label="Outstanding"        value={formatCurrency(kpi.totalOutstanding)} color={WARNING} />
                  <SummaryRow label="Labour Expenses"    value={formatCurrency(kpi.totalLabourCost)}  color={DANGER} />
                  <div className="fin-summary-divider" />
                  <SummaryRow
                    label="Net Profit / Loss"
                    value={formatCurrency(netProfit)}
                    color={netProfit >= 0 ? '#10b981' : DANGER}
                    bold
                    icon={netProfit >= 0
                      ? <ArrowUpRight size={14} color="#10b981" />
                      : <ArrowDownRight size={14} color={DANGER} />}
                  />
                </div>
              </div>

              {/* ── This Year vs Last Year — full comparison table ── */}
              <div className="glass-card" style={{ marginBottom: '1.5rem' }}>
                <div className="fin-chart-header" style={{ marginBottom: '1rem' }}>
                  <h3 className="fin-chart-title"><Calendar size={16} /> {yearly.thisYear} vs {yearly.lastYear} — Full Year Comparison</h3>
                  <p className="fin-chart-sub">Every figure below covers the whole calendar year, not just the filter above</p>
                </div>
                {yearly.thisYearTotals && yearly.lastYearTotals ? (
                  <div className="fin-cmp-table">
                    <div className="fin-cmp-row fin-cmp-header">
                      <span className="fin-cmp-label">Metric</span>
                      <span className="fin-cmp-value fin-cmp-ty">{yearly.thisYear}</span>
                      <span className="fin-cmp-value fin-cmp-ly">{yearly.lastYear}</span>
                      <span className="fin-cmp-change">Change</span>
                    </div>
                    <CompareRow label="Total Invoiced"  thisYear={yearly.thisYearTotals.totalRevenue}     lastYear={yearly.lastYearTotals.totalRevenue} />
                    <CompareRow label="Amount Received" thisYear={yearly.thisYearTotals.totalPaid}        lastYear={yearly.lastYearTotals.totalPaid} />
                    <CompareRow label="Outstanding"     thisYear={yearly.thisYearTotals.totalOutstanding} lastYear={yearly.lastYearTotals.totalOutstanding} />
                    <CompareRow label="Labour Expenses" thisYear={yearly.thisYearTotals.totalLabourCost}  lastYear={yearly.lastYearTotals.totalLabourCost} />
                    <div className="fin-summary-divider" />
                    <CompareRow label="Net Profit / Loss" thisYear={yearly.thisYearTotals.netProfit} lastYear={yearly.lastYearTotals.netProfit} />
                  </div>
                ) : <EmptyChart />}
              </div>

            </div>
          )}
        </main>
      </div>
    </div>
  );
}