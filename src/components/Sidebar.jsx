import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Settings, LogOut,
  Users, Package, UserCheck,
  ChevronRight, FileText, FolderOpen
} from 'lucide-react';

const NAV_ITEMS = [
  { path: '/',                label: 'Dashboard',        icon: LayoutDashboard, key: 'dashboard' },
  { path: '/projects',        label: 'Projects',         icon: FolderOpen,      key: 'projects' },
  { path: '/quotations',      label: 'Quotations',       icon: FileText,        key: 'quotations' },
  { path: '/inventory',       label: 'Inventory',        icon: Package,         key: 'inventory' },
  { path: '/labour',          label: 'Labour Management',icon: Users,           key: 'labour' },
  { path: '/attendance',      label: 'Attendance',       icon: UserCheck,       key: 'attendance' },
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
      <aside className={`gs-sidebar ${isOpen ? 'open' : ''}`} style={{
        width: '248px', backgroundColor: '#1A1A1A', display: 'flex',
        flexDirection: 'column', height: '100vh', position: 'sticky',
        top: 0, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.06)',
        transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)', zIndex: 1000, overflow: 'hidden'
      }}>

        {/* Brand — no icon, Charm font */}
        <div style={{
          padding: '1.4rem 1.2rem 1.2rem',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0
        }}>
          <span style={{
            fontFamily: "'Charm', cursive",
            fontSize: '1.5rem',
            fontWeight: 700,
            color: '#ffffff',
            lineHeight: 1,
            display: 'block'
          }}>
            Mauli Decorators
          </span>
        </div>

        {/* Nav */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '1rem 0.75rem',
          display: 'flex', flexDirection: 'column', gap: '0.25rem'
        }}>
          <p style={{
            fontSize: '0.62rem', fontWeight: 700, color: 'rgba(255,255,255,0.25)',
            textTransform: 'uppercase', letterSpacing: '0.1em',
            padding: '0 0.5rem', marginBottom: '0.4rem', marginTop: '0.5rem'
          }}>Main Menu</p>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {filteredNavItems.map(({ path, label, icon: Icon }) => (
              <NavLink
                key={path}
                to={path}
                end={path === '/'}
                onClick={closeMobile}
                className={({ isActive }) => `gs-link ${isActive ? 'active' : ''}`}
                style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '0.6rem 0.75rem', borderRadius: '8px',
                  color: isActive ? '#ffffff' : 'rgba(255,255,255,0.5)',
                  backgroundColor: isActive ? 'rgba(232,116,28,0.15)' : 'transparent',
                  border: isActive ? '1px solid rgba(232,116,28,0.2)' : '1px solid transparent',
                  textDecoration: 'none', fontSize: '0.84rem',
                  fontWeight: isActive ? 500 : 400, transition: 'all 0.18s ease'
                })}
              >
                <span style={{ display: 'flex', alignItems: 'center' }}><Icon size={15} /></span>
                <span style={{ flex: 1 }}>{label}</span>
                <ChevronRight size={12} style={{ opacity: 0.5 }} />
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Footer */}
        <div style={{
          padding: '1rem 0.75rem', borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', flexDirection: 'column', gap: '0.6rem', flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '8px',
              background: 'linear-gradient(135deg, #2E2E2E, #E8741C)',
              color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.82rem', fontWeight: 700, flexShrink: 0
            }}>{adminInitial}</div>
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'rgba(255,255,255,0.9)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{adminName}</span>
              <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>{profile?.role || 'Staff'}</span>
            </div>
          </div>
          <button onClick={handleLogout} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
            width: '100%', padding: '0.5rem', background: 'transparent',
            border: '1px solid rgba(248,113,113,0.15)', borderRadius: '7px',
            color: 'rgba(248,113,113,0.7)', fontSize: '0.78rem', fontWeight: 500,
            cursor: 'pointer', transition: 'all 0.2s ease'
          }}>
            <LogOut size={13} /><span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile backdrop */}
      <div
        className={`sidebar-backdrop ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(false)}
        style={{
          display: isOpen ? 'block' : 'none', position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 998
        }}
      />
    </>
  );
}