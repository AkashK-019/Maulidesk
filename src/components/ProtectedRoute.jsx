import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from './Sidebar';
import Header from './Header';

export default function ProtectedRoute({ children, pageKey }) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAF8F5' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '42px',
            height: '42px',
            border: '4px solid #F1EAD9',
            borderTop: '4px solid #D4A847',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite'
          }} />
          <p style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 600, color: '#2C1810', fontSize: '0.9rem' }}>
            Loading Mauli Decorators ERP...
          </p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const isAllowed = profile?.role === 'Admin' || !pageKey || (profile?.allowed_pages && profile.allowed_pages.includes(pageKey));

  if (!isAllowed) {
    return (
      <div className="app-container" style={{ display: 'flex', height: '100vh' }}>
        <Sidebar />
        <div className="main-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Header title="Access Denied" />
          <main className="gs-main" style={{ padding: '2rem', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="glass-card text-center animate-fade" style={{ maxWidth: '480px', padding: '3rem 2rem', border: '1px solid rgba(220, 38, 38, 0.2)' }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: '#FEE2E2',
                color: '#EF4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2rem',
                margin: '0 auto 1.5rem'
              }}>
                🔒
              </div>
              <h2 style={{ fontFamily: 'Outfit, sans-serif', color: '#7F1D1D', marginBottom: '0.75rem', fontWeight: 700 }}>
                Restricted Access
              </h2>
              <p style={{ color: '#6B7280', fontSize: '0.92rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                You do not have permission to access the <strong>{pageKey.toUpperCase()}</strong> page. Please contact your system Administrator to request access.
              </p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return children;
}
