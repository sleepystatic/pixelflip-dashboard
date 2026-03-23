import React, { useState } from 'react';
import { supabase } from './supabaseClient';

export default function Auth({ onLogin }) {
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');

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
          onLogin(data.session);
        } else {
          setMessage('Account created successfully! You can now log in.');
          setIsSignUp(false); // Switch back to login view
          setPassword('');
          setConfirmPassword('');
        }
      } else {
        // Log into an existing account
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email,
          password: password,
        });
        if (error) throw error;
        if (data.session) {
          onLogin(data.session);
        }
      }
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      fontFamily: 'monospace'
    }}>
      <div className="w-full max-w-md p-8" style={{
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
          {isSignUp ? 'CREATE ACCOUNT' : 'SYSTEM LOGIN'}
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

          <div>
            <label className="block text-sm font-bold mb-2" style={{ color: '#4A5568' }}>PASSWORD</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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

          {/* NEW: Confirm Password Field (Only visible during Sign Up) */}
          {isSignUp && (
            <div>
              <label className="block text-sm font-bold mb-2" style={{ color: '#4A5568' }}>CONFIRM PASSWORD</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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
          )}

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
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setMessage('');
              setPassword('');
              setConfirmPassword('');
            }}
            className="text-sm font-bold hover:underline"
            style={{ color: '#5A67D8' }}
          >
            {isSignUp ? 'ALREADY HAVE AN ACCOUNT? LOGIN' : 'NEED AN ACCOUNT? SIGN UP'}
          </button>
        </div>
      </div>
    </div>
  );
}