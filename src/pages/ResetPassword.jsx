import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import '../styles/login.css';

const BG_IMAGE_URL = 'https://ik.imagekit.io/greenspire/GreenDesk/luxurious-dinner-hall-with-large-crystal-chandelier.avif';


export default function ResetPassword() {
  const [password, setPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMsg, setErrorMsg]         = useState('');
  const [successMsg, setSuccessMsg]     = useState('');
  const [submitting, setSubmitting]     = useState(false);
  const [checkingLink, setCheckingLink] = useState(true);
  const [validLink, setValidLink]       = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setValidLink(!!session);
      setCheckingLink(false);
    });
  }, []);

  const handleSetPassword = async (e) => {
    e.preventDefault();
    setErrorMsg(''); setSuccessMsg('');

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);

    if (error) {
      setErrorMsg('Could not set password. The link may have expired — ask your admin to resend it.');
    } else {
      setSuccessMsg('Password set! Redirecting to your dashboard…');
      setTimeout(() => navigate('/'), 1500);
    }
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
          <svg className="lp-brand-flourish" viewBox="0 0 92 10" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="lp-flourish-gradient-rp" x1="0" y1="0" x2="92" y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#0d9488" stopOpacity="0" />
                <stop offset="50%" stopColor="#2dd4bf" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#0d9488" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M1 5 Q 23 1, 46 5 T 91 5" />
          </svg>
        </div>

        {/* Heading */}
        <div className="lp-heading">
          <h1>Set Your Password</h1>
          <p>
            {checkingLink
              ? 'Verifying your link…'
              : validLink
                ? 'Choose a password to activate your account'
                : 'This link is invalid or has expired'}
          </p>
        </div>

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

        {/* Set-password form — only once we've confirmed a valid session */}
        {!checkingLink && validLink && !successMsg && (
          <form onSubmit={handleSetPassword} className="lp-form">
            <div className="lp-field">
              <label htmlFor="rp-password">New Password</label>
              <div className="lp-input-wrap">
                <span className="lp-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </span>
                <input
                  id="rp-password"
                  className="lp-input lp-input--pass"
                  type="password"
                  required
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <div className="lp-field">
              <label htmlFor="rp-confirm">Confirm Password</label>
              <div className="lp-input-wrap">
                <span className="lp-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </span>
                <input
                  id="rp-confirm"
                  className="lp-input lp-input--pass"
                  type="password"
                  required
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            <button type="submit" className="lp-btn" disabled={submitting}>
              {submitting ? (
                <><span className="lp-spinner" /> Setting Password…</>
              ) : (
                <>
                  Set Password &amp; Continue
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"/>
                    <polyline points="12 5 19 12 12 19"/>
                  </svg>
                </>
              )}
            </button>
          </form>
        )}

        {/* Invalid/expired link — send them back to login */}
        {!checkingLink && !validLink && (
          <button type="button" className="lp-back" onClick={() => navigate('/login')}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"/>
              <polyline points="12 19 5 12 12 5"/>
            </svg>
            Back to Sign In
          </button>
        )}

      </div>
    </div>
  );
}