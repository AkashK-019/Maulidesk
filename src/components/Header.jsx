import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Menu, Loader2, ArrowRight, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabase';

export default function Header({ title }) {
  const { profile } = useAuth();
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

  const fetchRealtimeAlerts = async () => {
    setLoadingAlerts(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const activeAlerts = [];

      // Query Overdue Invoices
      const { data: invoices } = await supabase
        .from('invoices')
        .select('invoice_number, due_date')
        .in('status', ['Unpaid', 'Overdue'])
        .lt('due_date', todayStr);

      (invoices || []).forEach(inv => {
        activeAlerts.push({
          id: `invoice-${inv.invoice_number}`,
          text: `Invoice #${inv.invoice_number} is overdue (due ${inv.due_date})`,
          type: 'danger',
          to: '/invoices'
        });
      });

      // Query Low Stock Decorator Items
      const { data: items } = await supabase
        .from('inventory_items')
        .select('name, quantity_available, low_stock_threshold');

      (items || []).forEach(item => {
        if (Number(item.quantity_available) < Number(item.low_stock_threshold)) {
          activeAlerts.push({
            id: `inventory-${item.name}`,
            text: `Low stock: "${item.name}" (${item.quantity_available} left)`,
            type: 'warning',
            to: '/inventory'
          });
        }
      });

      // Save to session cache
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

  const dangerCount  = alerts.filter(a => a.type === 'danger').length;
  const warningCount = alerts.filter(a => a.type === 'warning').length;

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
            className="gs-bell-btn"
            onClick={() => setShowNotifications(v => !v)}
            title="Alerts"
          >
            <Bell size={16} />
            {alerts.length > 0 && (
              <span className={`gs-bell-dot ${dangerCount > 0 ? 'danger' : 'warning'}`} />
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
          border-bottom: 1px solid #e8e2d5;
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
          color: #2c1810;
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
          background: #faf5ea;
          border: none;
          border-radius: 8px;
          color: #2c1810;
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
          background: #FAF8F5;
          border: 1px solid #e8e2d5;
          border-radius: 9px;
          color: #2c1810;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .gs-bell-btn:hover {
          background: #faf5ea;
          border-color: #d4a847;
          color: #d4a847;
        }

        .gs-bell-dot {
          position: absolute;
          top: 7px;
          right: 7px;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          border: 1.5px solid white;
        }

        .gs-notif-dropdown {
          position: absolute;
          top: calc(100% + 10px);
          right: 0;
          width: 330px;
          max-width: calc(100vw - 2rem);
          background: #ffffff;
          border: 1px solid #e8e2d5;
          border-radius: 14px;
          box-shadow: 0 12px 32px rgba(44,24,16,0.12);
          overflow: hidden;
          z-index: 200;
        }

        .gs-notif-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.9rem 1rem 0.75rem;
          border-bottom: 1px solid #faf5ea;
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
          color: #2c1810;
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
          color: #8c7a70;
          white-space: nowrap;
        }

        .gs-notif-close {
          background: none;
          border: none;
          cursor: pointer;
          color: #8c7a70;
          display: flex;
          align-items: center;
        }

        .gs-notif-list {
          max-height: 280px;
          overflow-y: auto;
        }

        .gs-notif-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 1.5rem;
          color: #8c7a70;
          font-size: 0.82rem;
        }

        .gs-notif-empty {
          padding: 2rem 1.5rem;
          text-align: center;
          color: #8c7a70;
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
          border-bottom: 1px solid #f9f8f6;
          cursor: pointer;
          font-size: 0.82rem;
          transition: background 0.15s;
        }

        .gs-alert-item:hover {
          background-color: #faf9f6;
        }

        .gs-alert-bar {
          width: 4px;
          align-self: stretch;
          border-radius: 4px;
          flex-shrink: 0;
        }

        .gs-alert-text {
          flex: 1;
          color: #372a24;
          min-width: 0;
          word-break: break-word;
        }

        .gs-alert-arrow {
          color: #8c7a70;
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
          }
        }

        @media (max-width: 380px) {
          .gs-header-title {
            max-width: 38vw;
          }
        }
      `}</style>
    </header>
  );
}