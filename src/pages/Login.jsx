import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured, supabase } from '../supabase';
import '../styles/login.css';

// ── ImageKit background image URL ──────────────────────────────
// Replace this with your ImageKit URL when ready:
// e.g. 'https://ik.imagekit.io/yourID/login_bg.jpg'
const BG_IMAGE_URL = '/login_bg.png';
// ───────────────────────────────────────────────────────────────

export default function Login() {
  const [mode, setMode]             = useState('login'); // 'login' | 'reset'
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [errorMsg, setErrorMsg]     = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPass, setShowPass]     = useState(false);

  const { signIn } = useAuth();
  const navigate   = useNavigate();

  /* ── Login ── */
  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg(''); setSuccessMsg('');
    setSubmitting(true);
    const { error } = await signIn(email, password);
    setSubmitting(false);
    if (error) {
      setErrorMsg('Invalid email or password. Please try again.');
    } else {
      navigate('/');
    }
  };

  /* ── Reset Password ─────────────────────────────────────────
     1. Check profiles table → role must be 'Admin'
     2. If Admin  → send magic reset link via Supabase
     3. If Staff  → show "contact your admin" message
     4. If unknown email → show "not registered" message
  ────────────────────────────────────────────────────────────── */
  const handleReset = async (e) => {
    e.preventDefault();
    setErrorMsg(''); setSuccessMsg('');
    if (!email) { setErrorMsg('Please enter your email address.'); return; }

    setSubmitting(true);

    // Step 1 — check role in profiles table
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('email', email)
      .single();

    if (profileError || !profile) {
      setSubmitting(false);
      setErrorMsg('This email is not registered in the system.');
      return;
    }

    if (profile.role !== 'Admin') {
      setSubmitting(false);
      setErrorMsg('Password reset is not allowed for staff accounts. Please contact your admin.');
      return;
    }

    // Step 2 — Admin confirmed → send reset link
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setSubmitting(false);

    if (resetError) {
      setErrorMsg('Could not send reset link. Please try again.');
    } else {
      setSuccessMsg('Reset link sent! Check your inbox (and spam folder). Link expires in 1 hour.');
    }
  };

  const switchMode = (m) => {
    setMode(m);
    setErrorMsg('');
    setSuccessMsg('');
    setPassword('');
  };

  return (
    <div className="lp-root">
      {/* Background */}
      <div className="lp-bg">
        <img className="lp-bg-image" src={BG_IMAGE_URL} alt="" aria-hidden="true" />
        <div className="lp-bg-overlay" />
      </div>

      {/* Card */}
      <div className="lp-card">

        {/* Brand */}
        <div className="lp-brand">
          <span className="lp-brand-name">Mauli Decorators</span>
        </div>

        {/* Heading */}
        <div className="lp-heading">
          <h1>{mode === 'login' ? 'Welcome back' : 'Reset Password'}</h1>
          <p>
            {mode === 'login'
              ? 'Sign in to your business dashboard'
              : 'Admin accounts only — enter your email'}
          </p>
        </div>

        {/* Supabase warning */}
        {!isSupabaseConfigured && (
          <div className="lp-alert lp-alert--warn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <span><strong>Database not linked.</strong> Set your Supabase URL &amp; Anon Key in <code>.env</code>, then restart Vite.</span>
          </div>
        )}

        {/* Error */}
        {errorMsg && (
          <div className="lp-alert lp-alert--error">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Success */}
        {successMsg && (
          <div className="lp-alert lp-alert--success">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <span>{successMsg}</span>
          </div>
        )}

        {/* ── LOGIN FORM ── */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="lp-form">
            <div className="lp-field">
              <label htmlFor="lp-email">Email address</label>
              <div className="lp-input-wrap">
                <span className="lp-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                </span>
                <input
                  id="lp-email"
                  className="lp-input"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@maulidecorators.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="lp-field">
              <div className="lp-label-row">
                <label htmlFor="lp-password">Password</label>
                <button type="button" className="lp-link" onClick={() => switchMode('reset')}>
                  Forgot password?
                </button>
              </div>
              <div className="lp-input-wrap">
                <span className="lp-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </span>
                <input
                  id="lp-password"
                  className="lp-input lp-input--pass"
                  type={showPass ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="lp-eye"
                  onClick={() => setShowPass(!showPass)}
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                >
                  {showPass ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button type="submit" className="lp-btn" disabled={submitting}>
              {submitting ? (
                <><span className="lp-spinner" /> Signing in…</>
              ) : (
                <>
                  Sign In
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"/>
                    <polyline points="12 5 19 12 12 19"/>
                  </svg>
                </>
              )}
            </button>
          </form>
        )}

        {/* ── RESET PASSWORD FORM ── */}
        {mode === 'reset' && (
          <form onSubmit={handleReset} className="lp-form">

            {/* Info note */}
            <div className="lp-alert lp-alert--info">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="8"/>
                <line x1="12" y1="12" x2="12" y2="16"/>
              </svg>
              <span>Only <strong>Admin</strong> accounts can reset their password. Staff should contact their admin.</span>
            </div>

            <div className="lp-field">
              <label htmlFor="lp-reset-email">Admin Email address</label>
              <div className="lp-input-wrap">
                <span className="lp-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                </span>
                <input
                  id="lp-reset-email"
                  className="lp-input"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="admin@maulidecorators.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <button type="submit" className="lp-btn" disabled={submitting}>
              {submitting ? (
                <><span className="lp-spinner" /> Checking &amp; Sending…</>
              ) : (
                <>
                  Send Reset Link
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"/>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                </>
              )}
            </button>

            <button type="button" className="lp-back" onClick={() => switchMode('login')}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12"/>
                <polyline points="12 19 5 12 12 5"/>
              </svg>
              Back to Sign In
            </button>
          </form>
        )}

      </div>
    </div>
  );
}