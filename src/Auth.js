import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { API_URL } from './config';
import { EyeIcon } from './icons';

const TERMS_URL = process.env.REACT_APP_TERMS_URL || 'https://pixelflip.app/terms';
const PRIVACY_URL = process.env.REACT_APP_PRIVACY_URL || 'https://pixelflip.app/privacy';

const REMEMBER_KEY = 'pixelflip_remember_me_v1';

/**
 * Password field with a show/hide toggle.
 *
 * Matches the chrome of the plain inputs around it — Auth renders on a fixed
 * light card, so unlike the dashboard's PixelInput there is no dark variant.
 *
 * Each instance owns its own `show` state, so revealing the password on signup
 * does not also reveal the confirm field: seeing them independently is the
 * whole point of a confirm box.
 */
function PasswordInput({ value, onChange, autoComplete, required = true }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        className="w-full p-3 pr-12 text-sm font-bold"
        style={{
          background: '#F7FAFC',
          border: 'none',
          boxShadow: '0 0 0 3px #2D3748, inset 3px 3px 0 0 rgba(0,0,0,0.15)',
          outline: 'none',
        }}
        required={required}
      />
      <button
        // type="button" or it submits the form on click.
        type="button"
        onClick={() => setShow((v) => !v)}
        // Skipped in the tab order: tabbing should run email → password →
        // submit, not detour through a visibility control.
        tabIndex={-1}
        className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center"
        style={{ color: '#5A67D8', background: 'transparent', border: 'none', cursor: 'pointer' }}
        aria-label={show ? 'Hide password' : 'Show password'}
        title={show ? 'Hide password' : 'Show password'}
      >
        <EyeIcon off={show} />
      </button>
    </div>
  );
}

export default function Auth({ onLogin }) {
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [resetStep, setResetStep] = useState('request'); // request | verify
  const [resetCode, setResetCode] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [signUpVerifyMode, setSignUpVerifyMode] = useState(false);
  const [signUpCode, setSignUpCode] = useState('');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(REMEMBER_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved?.rememberMe) {
        setRememberMe(true);
        setEmail(saved.email || '');
        setPassword(saved.password || '');
      }
    } catch {
      // ignore bad local cache
    }
  }, []);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    // NEW: Check if passwords match during sign up
    if (isSignUp && password !== confirmPassword) {
      setMessage('Error: Passwords do not match!');
      setLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        // Create a new account
        const { data, error } = await supabase.auth.signUp({
          email: email,
          password: password,
        });
        if (error) throw error;

        // If email confirmation is off, Supabase might log them in immediately
        if (data.session) {
          if (rememberMe) {
            localStorage.setItem(REMEMBER_KEY, JSON.stringify({ rememberMe: true, email, password }));
          } else {
            localStorage.removeItem(REMEMBER_KEY);
          }
          onLogin(data.session);
        } else {
          setSignUpVerifyMode(true);
          setSignUpCode('');
          setMessage('Account created. Enter the verification code sent to your email.');
        }
      } else {
        // Log into an existing account
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email,
          password: password,
        });
        if (error) throw error;
        if (data.session) {
          if (rememberMe) {
            localStorage.setItem(REMEMBER_KEY, JSON.stringify({ rememberMe: true, email, password }));
          } else {
            localStorage.removeItem(REMEMBER_KEY);
          }
          onLogin(data.session);
        }
      }
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const verifySignUpCode = async () => {
    if (!email.trim() || !signUpCode.trim()) {
      setMessage('Error: Enter your email and verification code.');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: signUpCode.trim(),
        type: 'signup',
      });
      if (error) throw error;
      if (data?.session) {
        if (rememberMe) {
          localStorage.setItem(REMEMBER_KEY, JSON.stringify({ rememberMe: true, email, password }));
        } else {
          localStorage.removeItem(REMEMBER_KEY);
        }
        onLogin(data.session);
        return;
      }
      setSignUpVerifyMode(false);
      setIsSignUp(false);
      setPassword('');
      setConfirmPassword('');
      setMessage('Email verified. You can now log in.');
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const requestResetCode = async () => {
    if (!email.trim()) {
      setMessage('Error: Enter your account email first.');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch(`${API_URL}/request-password-reset-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        throw new Error(data.error || 'Could not send reset code.');
      }
      setResetStep('verify');
      setMessage('Reset code sent. Check your email and enter the 6-digit code.');
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const submitResetPassword = async () => {
    if (!resetCode.trim()) {
      setMessage('Error: Enter the 6-digit reset code.');
      return;
    }
    if (!resetNewPassword || resetNewPassword.length < 8) {
      setMessage('Error: New password must be at least 8 characters.');
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      setMessage('Error: Passwords do not match.');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch(`${API_URL}/reset-password-with-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code: resetCode.trim(),
          new_password: resetNewPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        throw new Error(data.error || 'Could not reset password.');
      }
      setForgotMode(false);
      setResetStep('request');
      setResetCode('');
      setResetNewPassword('');
      setResetConfirmPassword('');
      setPassword('');
      setMessage('Password reset complete. You can log in now.');
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="h-[100dvh] max-h-[100dvh] w-full overflow-hidden overscroll-none flex items-center justify-center p-4 fixed inset-0"
      style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        fontFamily: 'monospace',
        touchAction: 'manipulation',
      }}
    >
      <div className="w-full max-w-md max-h-full overflow-y-auto p-8 overscroll-contain" style={{
        background: 'white',
        boxShadow: `
          0 0 0 4px #2D3748,
          8px 8px 0 0 rgba(0,0,0,0.3)
        `,
        imageRendering: 'pixelated'
      }}>
        <h1 className="text-3xl font-bold mb-6 text-center" style={{ color: '#2D3748' }}>
          PIXELFLIP
        </h1>

        <h2 className="text-xl font-bold mb-6 text-center" style={{ color: '#667eea' }}>
          {forgotMode ? 'FORGOT PASSWORD' : (signUpVerifyMode ? 'VERIFY EMAIL' : (isSignUp ? 'CREATE ACCOUNT' : 'SYSTEM LOGIN'))}
        </h2>

        {message && (
          <div className="mb-4 p-3 text-sm font-bold bg-gray-100 border-2 border-gray-800">
            {message}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-sm font-bold mb-2" style={{ color: '#4A5568' }}>EMAIL</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 text-sm font-bold"
              style={{
                background: '#F7FAFC',
                border: 'none',
                boxShadow: '0 0 0 3px #2D3748, inset 3px 3px 0 0 rgba(0,0,0,0.15)',
                outline: 'none'
              }}
              required
            />
          </div>

          {!forgotMode && !signUpVerifyMode && (
            <div>
              <label className="block text-sm font-bold mb-2" style={{ color: '#4A5568' }}>PASSWORD</label>
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
              />
            </div>
          )}

          {/* NEW: Confirm Password Field (Only visible during Sign Up) */}
          {!forgotMode && !signUpVerifyMode && isSignUp && (
            <div>
              <label className="block text-sm font-bold mb-2" style={{ color: '#4A5568' }}>CONFIRM PASSWORD</label>
              <PasswordInput
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
          )}

          {!forgotMode && !signUpVerifyMode && !isSignUp && (
            <label className="flex items-center gap-2 text-sm font-bold cursor-pointer" style={{ color: '#4A5568' }}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              REMEMBER ME
            </label>
          )}

          {!forgotMode && !signUpVerifyMode ? (
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-6 px-6 py-3 text-white font-bold"
              style={{
                background: loading ? '#CBD5E0' : '#48BB78',
                boxShadow: '0 0 0 3px #2D3748, 0 4px 0 0 #2D3748',
                transform: loading ? 'translateY(4px)' : 'none',
                transition: 'transform 0.1s'
              }}
            >
              {loading ? 'PROCESSING...' : (isSignUp ? 'SIGN UP' : 'START SESSION')}
            </button>
          ) : forgotMode ? (
            <div className="space-y-3 mt-4">
              {resetStep === 'request' ? (
                <button
                  type="button"
                  disabled={loading}
                  onClick={requestResetCode}
                  className="w-full px-6 py-3 text-white font-bold"
                  style={{
                    background: loading ? '#CBD5E0' : '#667eea',
                    boxShadow: '0 0 0 3px #2D3748, 0 4px 0 0 #2D3748',
                  }}
                >
                  {loading ? 'SENDING...' : 'SEND RESET CODE'}
                </button>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-bold mb-2" style={{ color: '#4A5568' }}>CONFIRMATION CODE</label>
                    <input
                      type="text"
                      value={resetCode}
                      onChange={(e) => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="w-full p-3 text-sm font-bold"
                      style={{
                        background: '#F7FAFC',
                        border: 'none',
                        boxShadow: '0 0 0 3px #2D3748, inset 3px 3px 0 0 rgba(0,0,0,0.15)',
                        outline: 'none'
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-2" style={{ color: '#4A5568' }}>NEW PASSWORD</label>
                    <PasswordInput
                      value={resetNewPassword}
                      onChange={(e) => setResetNewPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-2" style={{ color: '#4A5568' }}>CONFIRM NEW PASSWORD</label>
                    <PasswordInput
                      value={resetConfirmPassword}
                      onChange={(e) => setResetConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={submitResetPassword}
                    className="w-full px-6 py-3 text-white font-bold"
                    style={{
                      background: loading ? '#CBD5E0' : '#48BB78',
                      boxShadow: '0 0 0 3px #2D3748, 0 4px 0 0 #2D3748',
                    }}
                  >
                    {loading ? 'UPDATING...' : 'RESET PASSWORD'}
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-3 mt-4">
              <div>
                <label className="block text-sm font-bold mb-2" style={{ color: '#4A5568' }}>VERIFICATION CODE</label>
                <input
                  type="text"
                  value={signUpCode}
                  onChange={(e) => setSignUpCode(e.target.value.replace(/\s/g, ''))}
                  className="w-full p-3 text-sm font-bold"
                  style={{
                    background: '#F7FAFC',
                    border: 'none',
                    boxShadow: '0 0 0 3px #2D3748, inset 3px 3px 0 0 rgba(0,0,0,0.15)',
                    outline: 'none'
                  }}
                />
              </div>
              <button
                type="button"
                disabled={loading}
                onClick={verifySignUpCode}
                className="w-full px-6 py-3 text-white font-bold"
                style={{
                  background: loading ? '#CBD5E0' : '#48BB78',
                  boxShadow: '0 0 0 3px #2D3748, 0 4px 0 0 #2D3748',
                }}
              >
                {loading ? 'VERIFYING...' : 'VERIFY EMAIL CODE'}
              </button>
            </div>
          )}
        </form>

        <div className="mt-6 text-center">
          {!isSignUp && !forgotMode && !signUpVerifyMode && (
            <button
              onClick={() => {
                setForgotMode(true);
                setResetStep('request');
                setResetCode('');
                setResetNewPassword('');
                setResetConfirmPassword('');
                setMessage('');
              }}
              className="text-sm font-bold hover:underline mr-4"
              style={{ color: '#5A67D8' }}
            >
              FORGOT PASSWORD?
            </button>
          )}
          {(forgotMode || signUpVerifyMode) && (
            <button
              onClick={() => {
                setForgotMode(false);
                setSignUpVerifyMode(false);
                setResetStep('request');
                setResetCode('');
                setResetNewPassword('');
                setResetConfirmPassword('');
                setSignUpCode('');
                setMessage('');
              }}
              className="text-sm font-bold hover:underline mr-4"
              style={{ color: '#5A67D8' }}
            >
              BACK TO LOGIN
            </button>
          )}
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setForgotMode(false);
              setSignUpVerifyMode(false);
              setMessage('');
              setPassword('');
              setConfirmPassword('');
              setSignUpCode('');
            }}
            className="text-sm font-bold hover:underline"
            style={{ color: '#5A67D8' }}
          >
            {isSignUp ? 'ALREADY HAVE AN ACCOUNT? LOGIN' : 'NEED AN ACCOUNT? SIGN UP'}
          </button>
        </div>

        <div className="mt-6 text-center text-xs font-bold" style={{ color: '#718096' }}>
          <a href={TERMS_URL} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: '#4338CA' }}>Terms</a>
          {' · '}
          <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: '#4338CA' }}>Privacy</a>
        </div>
      </div>
    </div>
  );
}