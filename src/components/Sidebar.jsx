import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Settings, LogOut,
  Users, Package,
  ChevronRight, FileText, FolderOpen, TrendingUp
} from 'lucide-react';

const NAV_ITEMS = [
  { path: '/',                label: 'Dashboard',        icon: LayoutDashboard, key: 'dashboard' },
  { path: '/projects',        label: 'Projects',         icon: FolderOpen,      key: 'projects' },
  { path: '/quotations',      label: 'Quotations',       icon: FileText,        key: 'quotations' },
  { path: '/inventory',       label: 'Inventory',        icon: Package,         key: 'inventory' },
  { path: '/labour',          label: 'Labour Management',icon: Users,           key: 'labour' },
  { path: '/finance',         label: 'Finance',          icon: TrendingUp,      key: 'finance' },
  { path: '/settings',        label: 'Settings',         icon: Settings,        key: 'settings', alwaysShow: true },
];

export default function Sidebar() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleToggle = () => setIsOpen(prev => !prev);
    window.addEventListener('toggle-sidebar', handleToggle);
    return () => window.removeEventListener('toggle-sidebar', handleToggle);
  }, []);

  useEffect(() => {
    const handleResize = () => { if (window.innerWidth > 850) setIsOpen(false); };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const closeMobile = () => { if (window.innerWidth <= 850) setIsOpen(false); };

  const handleLogout = async () => { await signOut(); navigate('/login'); };

  const filteredNavItems = NAV_ITEMS.filter(item => {
    if (profile?.role === 'Admin') return true;
    if (item.alwaysShow) return true;
    return profile?.allowed_pages?.includes(item.key);
  });

  const adminName    = profile?.full_name || 'Admin';
  const adminInitial = adminName.charAt(0).toUpperCase();

  return (
    <>
      <aside className={`gs-sidebar ${isOpen ? 'open' : ''}`}>

        <div className="gs-sidebar-brand">
          <span className="gs-brand-name">Mauli Decorators</span>
        </div>

        <div className="gs-sidebar-nav">
          <p className="gs-nav-label">Main Menu</p>

          <nav className="gs-nav-list">
            {filteredNavItems.map(({ path, label, icon: Icon }) => (
              <NavLink
                key={path}
                to={path}
                end={path === '/'}
                onClick={closeMobile}
                className={({ isActive }) => `gs-link ${isActive ? 'active' : ''}`}
              >
                <span className="gs-link-icon"><Icon size={15} /></span>
                <span className="gs-link-text">{label}</span>
                <ChevronRight size={12} className="gs-link-chevron" />
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="gs-sidebar-footer">
          <div className="gs-profile-row">
            <div className="gs-avatar">{adminInitial}</div>
            <div className="gs-profile-info">
              <span className="gs-profile-name">{adminName}</span>
              <span className="gs-profile-role">{profile?.role || 'Staff'}</span>
            </div>
          </div>
          <button className="gs-logout-btn" onClick={handleLogout}>
            <LogOut size={13} /><span>Sign Out</span>
          </button>
        </div>
      </aside>

      <div
        className={`gs-sidebar-backdrop ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(false)}
      />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&display=swap');

        .gs-sidebar {
          width: 248px;
          background-color: #171F23;
          display: flex;
          flex-direction: column;
          height: 100vh;
          position: sticky;
          top: 0;
          flex-shrink: 0;
          border-right: 1px solid rgba(255,255,255,0.06);
          z-index: 1000;
          overflow: hidden;
        }

        .gs-sidebar-brand {
          padding: 1.4rem 1.2rem 1.2rem;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          flex-shrink: 0;
        }

        .gs-brand-name {
          font-family: 'Playfair Display', serif;
          font-size: 1.5rem;
          font-weight: 700;
          letter-spacing: 0.02em;
          color: #ffffff;
          line-height: 1;
          display: block;
        }

        .gs-sidebar-nav {
          flex: 1;
          overflow-y: auto;
          padding: 1rem 0.75rem;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .gs-nav-label {
          font-size: 0.62rem;
          font-weight: 700;
          color: rgba(255,255,255,0.25);
          text-transform: uppercase;
          letter-spacing: 0.1em;
          padding: 0 0.5rem;
          margin: 0.5rem 0 0.4rem;
        }

        .gs-nav-list {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .gs-link {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0.6rem 0.75rem;
          border-radius: 8px;
          color: rgba(255,255,255,0.5);
          background-color: transparent;
          border: 1px solid transparent;
          text-decoration: none;
          font-size: 0.84rem;
          font-weight: 400;
          transition: all 0.18s ease;
        }

        .gs-link:hover {
          color: rgba(255,255,255,0.8);
          background-color: rgba(255,255,255,0.04);
        }

        .gs-link.active {
          color: #ffffff;
          background-color: rgba(13,148,136,0.18);
          border: 1px solid rgba(13,148,136,0.32);
          font-weight: 500;
        }

        .gs-link-icon {
          display: flex;
          align-items: center;
          flex-shrink: 0;
        }

        .gs-link-text {
          flex: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .gs-link-chevron {
          opacity: 0.5;
          flex-shrink: 0;
        }

        .gs-sidebar-footer {
          padding: 1rem 0.75rem;
          border-top: 1px solid rgba(255,255,255,0.06);
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
          flex-shrink: 0;
        }

        .gs-profile-row {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .gs-avatar {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: linear-gradient(135deg, #263238, #0d9488);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.82rem;
          font-weight: 700;
          flex-shrink: 0;
        }

        .gs-profile-info {
          display: flex;
          flex-direction: column;
          overflow: hidden;
          min-width: 0;
        }

        .gs-profile-name {
          font-size: 0.82rem;
          font-weight: 600;
          color: rgba(255,255,255,0.9);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .gs-profile-role {
          font-size: 0.65rem;
          color: rgba(255,255,255,0.3);
          text-transform: uppercase;
        }

        .gs-logout-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          width: 100%;
          padding: 0.5rem;
          background: transparent;
          border: 1px solid rgba(248,113,113,0.15);
          border-radius: 7px;
          color: rgba(248,113,113,0.7);
          font-size: 0.78rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .gs-logout-btn:hover {
          background: rgba(248,113,113,0.08);
          border-color: rgba(248,113,113,0.3);
          color: rgba(248,113,113,0.95);
        }

        .gs-sidebar-backdrop {
          display: none;
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
          backdrop-filter: blur(4px);
          z-index: 998;
        }

        @media (max-width: 850px) {
          .gs-sidebar {
            position: fixed;
            top: 0;
            left: 0;
            height: 100vh;
            height: 100dvh;
            transform: translateX(-100%);
            transition: transform 0.3s cubic-bezier(0.4,0,0.2,1);
            box-shadow: 0 0 40px rgba(0,0,0,0.35);
          }

          .gs-sidebar.open {
            transform: translateX(0);
          }

          .gs-sidebar-backdrop.open {
            display: block;
          }
        }

        @media (max-width: 380px) {
          .gs-sidebar {
            width: 84vw;
            max-width: 260px;
          }
        }
      `}</style>
    </>
  );
}