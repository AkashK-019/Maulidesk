import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Menu, Loader2, ArrowRight, X } from 'lucide-react';
import { supabase } from '../supabase';
import { getShiftMultiplier } from '../utils/attendanceCodes';

export default function Header({ title }) {
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const lastFetch = sessionStorage.getItem('alerts_last_fetch');
    const cached    = sessionStorage.getItem('alerts_cache');
    const fiveMin   = 5 * 60 * 1000;

    if (cached && lastFetch && Date.now() - Number(lastFetch) < fiveMin) {
      setAlerts(JSON.parse(cached));
      setLoadingAlerts(false);
      return;
    }
    fetchRealtimeAlerts();
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const NEGLIGIBLE_BALANCE = 1; 

  const fetchRealtimeAlerts = async () => {
    setLoadingAlerts(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const activeAlerts = [];

      // ---------- Overdue invoices ----------
      const { data: invoices } = await supabase
        .from('invoices')
        .select('invoice_number, due_date, total_amount, amount_paid, status')
        .lt('due_date', todayStr);

      (invoices || []).forEach(inv => {
        if (inv.status === 'Paid' || inv.status === 'Cancelled') return;
        const total = parseFloat(inv.total_amount) || 0;
        const paid = parseFloat(inv.amount_paid) || 0;
        const remaining = total - paid;
        if (remaining <= NEGLIGIBLE_BALANCE) return;
        activeAlerts.push({
          id: `invoice-${inv.invoice_number}`,
          text: `Invoice #${inv.invoice_number} payment is late (due ${inv.due_date})`,
          type: 'danger',
          to: '/invoices'
        });
      });

      const { data: quotations } = await supabase
        .from('quotations')
        .select('quotation_number, client_name, status')
        .in('status', ['Pending', 'Sent']);

      (quotations || []).forEach(q => {
        activeAlerts.push({
          id: `quotation-${q.quotation_number}`,
          text: `Quotation #${q.quotation_number} for ${q.client_name || 'client'} needs a reply`,
          type: 'warning',
          to: '/quotations'
        });
      });

      const [
        { data: labourers },
        { data: labourAttendance },
        { data: labourPayments },
        { data: crewAttendance },
        { data: memberPayments },
      ] = await Promise.all([
        supabase.from('labour_master').select('id, name, daily_wage, labour_type'),
        supabase.from('labour_attendance').select('labour_id, status'),
        supabase.from('labour_payments').select('labour_id, amount_paid'),
        supabase.from('labour_crew_attendance').select('labour_id, status'),
        supabase.from('labour_member_payments').select('labour_id, amount_paid'),
      ]);

      const balanceByLabour = {};
      (labourers || []).forEach(l => { balanceByLabour[l.id] = 0; });

      (labourAttendance || []).forEach(a => {
        const lab = (labourers || []).find(l => l.id === a.labour_id);
        if (!lab || lab.labour_type === 'Group Leader' || !(a.labour_id in balanceByLabour)) return;
        balanceByLabour[a.labour_id] += (parseFloat(lab.daily_wage) || 0) * getShiftMultiplier(a.status);
      });
      (crewAttendance || []).forEach(a => {
        const lab = (labourers || []).find(l => l.id === a.labour_id);
        if (!lab || !(a.labour_id in balanceByLabour)) return;
        balanceByLabour[a.labour_id] += (parseFloat(lab.daily_wage) || 0) * getShiftMultiplier(a.status);
      });
      (labourPayments || []).forEach(p => {
        if (p.labour_id in balanceByLabour) balanceByLabour[p.labour_id] -= (parseFloat(p.amount_paid) || 0);
      });
      (memberPayments || []).forEach(p => {
        if (p.labour_id in balanceByLabour) balanceByLabour[p.labour_id] -= (parseFloat(p.amount_paid) || 0);
      });

      (labourers || []).forEach(l => {
        const balance = balanceByLabour[l.id] || 0;
        if (balance <= NEGLIGIBLE_BALANCE) return;
        activeAlerts.push({
          id: `labour-payment-${l.id}`,
          text: `Pay ₹${balance.toFixed(2)} to ${l.name}`,
          type: 'warning',
          to: '/labour'
        });
      });

      sessionStorage.setItem('alerts_cache', JSON.stringify(activeAlerts));
      sessionStorage.setItem('alerts_last_fetch', Date.now().toString());

      setAlerts(activeAlerts);
    } catch (err) {
      console.error('Failed to query header alerts:', err);
    } finally {
      setLoadingAlerts(false);
    }
  };

  const handleAlertClick = (to) => {
    setShowNotifications(false);
    navigate(to);
  };

  const dangerCount = alerts.filter(a => a.type === 'danger').length;

  return (
    <header className="gs-header">

      {/* Left — hamburger + title */}
      <div className="gs-header-left">
        <button
          className="gs-hamburger"
          onClick={() => window.dispatchEvent(new CustomEvent('toggle-sidebar'))}
          title="Toggle menu"
        >
          <Menu size={18} />
        </button>
        <div className="gs-header-title-wrap">
          <h1 className="gs-header-title">{title || 'Management Console'}</h1>
        </div>
      </div>

      {/* Right — bell */}
      <div className="gs-header-right">

        {/* Notification bell */}
        <div className="gs-notif-wrap" ref={dropdownRef}>
          <button
            className={`gs-bell-btn ${alerts.length > 0 ? (dangerCount > 0 ? 'has-alerts danger' : 'has-alerts warning') : ''}`}
            onClick={() => setShowNotifications(v => !v)}
            title="Alerts"
          >
            <Bell size={16} />
            {alerts.length > 0 && (
              <span className={`gs-bell-badge ${dangerCount > 0 ? 'danger' : 'warning'}`}>
                {alerts.length > 9 ? '9+' : alerts.length}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="gs-notif-dropdown">
              {/* Dropdown header */}
              <div className="gs-notif-head">
                <div className="gs-notif-head-left">
                  <span className="gs-notif-title">System Alerts</span>
                  {alerts.length > 0 && (
                    <span className="gs-notif-count">{alerts.length}</span>
                  )}
                </div>
                <div className="gs-notif-head-right">
                  {alerts.length > 0 && (
                    <button className="gs-notif-clear" onClick={() => {
                      setAlerts([]);
                      sessionStorage.removeItem('alerts_cache');
                      sessionStorage.removeItem('alerts_last_fetch');
                    }}>
                      Clear all
                    </button>
                  )}
                  <button className="gs-notif-close" onClick={() => setShowNotifications(false)}>
                    <X size={13} />
                  </button>
                </div>
              </div>

              {/* Alert list */}
              <div className="gs-notif-list">
                {loadingAlerts && (
                  <div className="gs-notif-loading">
                    <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
                    <span>Checking alerts…</span>
                  </div>
                )}

                {!loadingAlerts && alerts.length === 0 && (
                  <div className="gs-notif-empty">
                    <span className="gs-notif-empty-icon">✓</span>
                    <span>All systems normal</span>
                  </div>
                )}

                {!loadingAlerts && alerts.map(alert => (
                  <div
                    key={alert.id}
                    className={`gs-alert-item ${alert.type}`}
                    onClick={() => handleAlertClick(alert.to)}
                  >
                    <div className="gs-alert-bar" style={{
                      backgroundColor: alert.type === 'danger' ? '#ef4444' : '#f59e0b'
                    }} />
                    <span className="gs-alert-text">{alert.text}</span>
                    <ArrowRight size={11} className="gs-alert-arrow" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }

        .gs-header {
          height: 60px;
          background-color: #ffffff;
          border-bottom: 1px solid #e1e9e8;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 1.75rem;
          position: sticky;
          top: 0;
          z-index: 90;
          flex-shrink: 0;
          gap: 0.75rem;
        }

        .gs-header-left {
          display: flex;
          align-content: center;
          align-items: center;
          gap: 0.9rem;
          min-width: 0;
        }

        .gs-header-title-wrap {
          min-width: 0;
        }

        .gs-header-title {
          font-family: 'Outfit', sans-serif;
          font-size: 1.05rem;
          font-weight: 700;
          color: #1e2530;
          line-height: 1.2;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .gs-hamburger {
          display: none; /* shown at tablet/mobile breakpoints below */
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          background: #e6f7f5;
          border: none;
          border-radius: 8px;
          color: #1e2530;
          cursor: pointer;
          flex-shrink: 0;
        }

        .gs-header-right {
          display: flex;
          align-items: center;
          gap: 0.85rem;
          flex-shrink: 0;
        }

        .gs-notif-wrap {
          position: relative;
        }

        .gs-bell-btn {
          position: relative;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #F3F8F7;
          border: 1px solid #e1e9e8;
          border-radius: 9px;
          color: #1e2530;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .gs-bell-btn:hover {
          background: #e6f7f5;
          border-color: #0d9488;
          color: #0d9488;
        }

        .gs-bell-btn.has-alerts.danger {
          background: #fef2f2;
          border-color: #fecaca;
          color: #dc2626;
          animation: bell-shake 4s ease-in-out infinite;
        }

        .gs-bell-btn.has-alerts.warning {
          background: #fffbeb;
          border-color: #fde68a;
          color: #b45309;
        }

        .gs-bell-btn.has-alerts.danger::before {
          content: '';
          position: absolute;
          inset: -3px;
          border-radius: 12px;
          border: 1.5px solid #ef4444;
          opacity: 0;
          animation: bell-pulse 2s ease-out infinite;
        }

        @keyframes bell-pulse {
          0%   { opacity: 0.55; transform: scale(1); }
          70%  { opacity: 0; transform: scale(1.35); }
          100% { opacity: 0; transform: scale(1.35); }
        }

        @keyframes bell-shake {
          0%, 92%, 100% { transform: rotate(0); }
          93% { transform: rotate(-10deg); }
          94% { transform: rotate(9deg); }
          95% { transform: rotate(-7deg); }
          96% { transform: rotate(5deg); }
          97% { transform: rotate(-3deg); }
          98% { transform: rotate(0); }
        }

        .gs-bell-badge {
          position: absolute;
          top: -5px;
          right: -5px;
          min-width: 17px;
          height: 17px;
          padding: 0 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          border: 2px solid white;
          font-size: 0.62rem;
          font-weight: 800;
          line-height: 1;
          color: #ffffff;
        }

        .gs-bell-badge.danger { background: #ef4444; }
        .gs-bell-badge.warning { background: #f59e0b; }

        .gs-notif-dropdown {
          position: absolute;
          top: calc(100% + 10px);
          right: 0;
          width: 330px;
          max-width: calc(100vw - 2rem);
          background: #ffffff;
          border: 1px solid #e1e9e8;
          border-radius: 14px;
          box-shadow: 0 12px 32px rgba(15,23,22,0.12);
          overflow: hidden;
          z-index: 200;
        }

        .gs-notif-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.9rem 1rem 0.75rem;
          border-bottom: 1px solid #e6f7f5;
          gap: 0.5rem;
        }

        .gs-notif-head-left {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }

        .gs-notif-title {
          font-size: 0.85rem;
          font-weight: 700;
          color: #1e2530;
          font-family: 'Outfit', sans-serif;
          white-space: nowrap;
        }

        .gs-notif-count {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 20px;
          height: 20px;
          padding: 0 6px;
          background: #fee2e2;
          color: #b91c1c;
          font-size: 0.7rem;
          font-weight: 700;
          border-radius: 10px;
        }

        .gs-notif-head-right {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }

        .gs-notif-clear {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 0.72rem;
          font-weight: 600;
          color: #74838c;
          white-space: nowrap;
        }

        .gs-notif-close {
          background: none;
          border: none;
          cursor: pointer;
          color: #74838c;
          display: flex;
          align-items: center;
        }

        .gs-notif-list {
          max-height: min(280px, 45dvh);
          overflow-y: auto;
        }

        .gs-notif-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 1.5rem;
          color: #74838c;
          font-size: 0.82rem;
        }

        .gs-notif-empty {
          padding: 2rem 1.5rem;
          text-align: center;
          color: #74838c;
          font-size: 0.85rem;
        }

        .gs-notif-empty-icon {
          display: block;
          font-size: 1.5rem;
          margin-bottom: 0.5rem;
          color: #10b981;
        }

        .gs-alert-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0.8rem 1rem;
          border-bottom: 1px solid #f1f6f5;
          cursor: pointer;
          font-size: 0.82rem;
          transition: background 0.15s;
        }

        .gs-alert-item:hover {
          background-color: #f5f9f8;
        }

        .gs-alert-bar {
          width: 4px;
          align-self: stretch;
          border-radius: 4px;
          flex-shrink: 0;
        }

        .gs-alert-text {
          flex: 1;
          color: #1e2530;
          min-width: 0;
          word-break: break-word;
        }

        .gs-alert-arrow {
          color: #74838c;
          flex-shrink: 0;
        }

        /* Tablet */
        @media (max-width: 850px) {
          .gs-hamburger {
            display: flex !important;
          }
        }

        /* Mobile */
        @media (max-width: 640px) {
          .gs-header {
            padding: 0 1rem;
            gap: 0.5rem;
          }
          .gs-header-title {
            font-size: 0.92rem;
            max-width: 44vw;
          }
          .gs-notif-dropdown {
            position: fixed;
            top: 60px;
            right: 0.5rem;
            left: 0.5rem;
            width: auto;
            max-width: none;
            max-height: calc(100dvh - 76px);
            display: flex;
            flex-direction: column;
          }
        }

        @media (max-width: 380px) {
          .gs-header-title {
            max-width: 38vw;
          }
        }

        @media (max-height: 480px) and (orientation: landscape) {
          .gs-notif-dropdown {
            top: 52px;
            max-height: calc(100dvh - 64px);
          }
          .gs-notif-list {
            max-height: min(200px, 40dvh);
          }
        }
      `}</style>
    </header>
  );
}