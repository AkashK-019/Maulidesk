import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabase';
import {
  FileText, TrendingUp, Users,
  ArrowRight, Loader2, RefreshCw, Landmark
} from 'lucide-react';
import { formatCurrency } from '../utils/helpers';
import '../styles/dashboard.css';

const NEGLIGIBLE_BALANCE = 1;

export default function Dashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({
    activeQuotesCount: 0,
    pendingQuotesValue: 0,
    unpaidInvoicesCount: 0,
    unpaidInvoicesValue: 0,
    labourCount: 0,
  });
  const [recentQuotes, setRecentQuotes] = useState([]);
  const [recentInvoices, setRecentInvoices] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const { data: quotes } = await supabase
        .from('quotations')
        .select('total_amount, status');

      const pendingQuotes = (quotes || []).filter(q => q.status === 'Pending' || q.status === 'Sent');
      const pendingQuotesVal = pendingQuotes.reduce((acc, q) => acc + (parseFloat(q.total_amount) || 0), 0);

      const { data: invoices } = await supabase
        .from('invoices')
        .select('total_amount, amount_paid, status');

      const unpaidInvoices = (invoices || []).filter(i => {
        if (i.status === 'Paid') return false;
        const total = parseFloat(i.total_amount) || 0;
        const paid = parseFloat(i.amount_paid) || 0;
        return (total - paid) > NEGLIGIBLE_BALANCE;
      });
      const unpaidInvoicesVal = unpaidInvoices.reduce((acc, i) => {
        const total = parseFloat(i.total_amount) || 0;
        const paid = parseFloat(i.amount_paid) || 0;
        return acc + (total - paid);
      }, 0);

      const { count: labourCount } = await supabase
        .from('labour_master')
        .select('*', { count: 'exact', head: true });

      const { data: recentQ } = await supabase
        .from('quotations')
        .select('id, quotation_number, client_name, total_amount, status')
        .order('created_at', { ascending: false })
        .limit(5);

      const { data: recentI } = await supabase
        .from('invoices')
        .select('id, invoice_number, client_name, total_amount, amount_paid, status')
        .order('created_at', { ascending: false })
        .limit(5);

      setKpis({
        activeQuotesCount: pendingQuotes.length,
        pendingQuotesValue: pendingQuotesVal,
        unpaidInvoicesCount: unpaidInvoices.length,
        unpaidInvoicesValue: unpaidInvoicesVal,
        labourCount: labourCount || 0,
      });

      setRecentQuotes(recentQ || []);
      setRecentInvoices(recentI || []);

    } catch (err) {
      console.error('Error fetching dashboard details:', err);
    } finally {
      setLoading(false);
    }
  };

  const getEffectiveInvoiceStatus = (inv) => {
    if (inv.status === 'Paid' || inv.status === 'Cancelled') return inv.status;
    const total = parseFloat(inv.total_amount) || 0;
    const paid = parseFloat(inv.amount_paid) || 0;
    if (total - paid <= NEGLIGIBLE_BALANCE) return 'Paid';
    return inv.status;
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Approved':
      case 'Paid':
        return <span className="badge badge-success">{status}</span>;
      case 'Pending':
      case 'Sent':
      case 'Partially Paid':
        return <span className="badge badge-warning">{status}</span>;
      case 'Overdue':
      case 'Rejected':
        return <span className="badge badge-danger">{status}</span>;
      default:
        return <span className="badge badge-neutral">{status}</span>;
    }
  };

  return (
    <div className="app-container">
      <Sidebar />
      
      <div className="main-content">
        <Header title="Dashboard" />
        
        <main className="gs-main">
          {/* Header Row */}
          <div className="db-section-header animate-fade">
            <div>
              <h2 className="db-welcome-title">
                Welcome back, {profile?.full_name || 'Admin'}
              </h2>
            </div>
            
            <button className="btn-secondary" onClick={fetchDashboardData} disabled={loading}>
              <RefreshCw size={14} className={loading ? 'db-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>

          {loading ? (
            <div style={{ display: 'flex', minHeight: '300px', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                <Loader2 size={36} className="db-spin" style={{ color: 'var(--accent)', animation: 'spin 1s linear infinite' }} />
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontFamily: 'Outfit' }}>Fetching database status...</p>
              </div>
            </div>
          ) : (
            <div className="animate-fade">
              {/* KPI Cards Grid */}
              <div className="db-grid">
                
                {/* Pending Quotes Value */}
                <div className="db-kpi-card">
                  <div className="db-kpi-icon">
                    <FileText size={20} />
                  </div>
                  <div className="db-kpi-content">
                    <span className="db-kpi-value">{formatCurrency(kpis.pendingQuotesValue)}</span>
                    <span className="db-kpi-label">Pending Quotations ({kpis.activeQuotesCount})</span>
                  </div>
                </div>

                {/* Unpaid Invoices Value */}
                <div className="db-kpi-card">
                  <div className="db-kpi-icon" style={{ backgroundColor: 'rgba(212, 168, 71, 0.1)' }}>
                    <Landmark size={20} style={{ color: 'var(--accent)' }} />
                  </div>
                  <div className="db-kpi-content">
                    <span className="db-kpi-value">{formatCurrency(kpis.unpaidInvoicesValue)}</span>
                    <span className="db-kpi-label">Receivables ({kpis.unpaidInvoicesCount} Invoices)</span>
                  </div>
                </div>

                {/* Labour Directory Count */}
                <div className="db-kpi-card">
                  <div className="db-kpi-icon">
                    <Users size={20} />
                  </div>
                  <div className="db-kpi-content">
                    <span className="db-kpi-value">{kpis.labourCount}</span>
                    <span className="db-kpi-label">Registered Labour</span>
                  </div>
                </div>

              </div>

              {/* Lists Section */}
              <div className="db-row">
                
                {/* Recent Quotations */}
                <div className="glass-card">
                  <div className="db-section-header">
                    <h3 className="db-section-title">Recent Quotations</h3>
                    <button className="btn-secondary" onClick={() => navigate('/quotations')} style={{ padding: '0.4rem 0.8rem', fontSize: '0.78rem' }}>
                      <span>View All</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>

                  {recentQuotes.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                      No quotations found.
                    </div>
                  ) : (
                    <div className="recent-list">
                      {recentQuotes.slice(0, 5).map(q => (
                        <div key={q.id} className="recent-item" onClick={() => navigate('/quotations')}>
                          <div className="recent-info">
                            <span className="recent-title">Quote #{q.quotation_number}</span>
                            <span className="recent-subtitle">{q.client_name}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            {getStatusBadge(q.status)}
                            <span className="recent-amount">{formatCurrency(q.total_amount)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recent Invoices */}
                <div className="glass-card">
                  <div className="db-section-header">
                    <h3 className="db-section-title">Recent Invoices</h3>
                    <button className="btn-secondary" onClick={() => navigate('/invoices')} style={{ padding: '0.4rem 0.8rem', fontSize: '0.78rem' }}>
                      <span>View All</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>

                  {recentInvoices.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                      No invoices found.
                    </div>
                  ) : (
                    <div className="recent-list">
                      {recentInvoices.slice(0, 5).map(i => (
                        <div key={i.id} className="recent-item" onClick={() => navigate('/invoices')}>
                          <div className="recent-info">
                            <span className="recent-title">Invoice #{i.invoice_number}</span>
                            <span className="recent-subtitle">{i.client_name}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            {getStatusBadge(getEffectiveInvoiceStatus(i))}
                            <span className="recent-amount">{formatCurrency(i.total_amount)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}
        </main>
      </div>
      <style>{`
        .db-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
}