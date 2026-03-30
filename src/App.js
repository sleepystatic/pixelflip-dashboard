/* eslint-disable */

import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Auth from './Auth';
import config from './config';
import { API_URL } from './config';

// ==========================================
// REUSABLE PIXEL UI COMPONENTS
// ==========================================
const PixelBox = React.memo(({ children, className = "", color = "#4A5568", isDark }) => (
  <div className={className} style={{
    background: isDark ? '#1A202C' : 'white',
    color: isDark ? '#E2E8F0' : '#2D3748',
    boxShadow: `0 0 0 3px ${color}, 3px 0 0 3px ${color}, -3px 0 0 3px ${color}, 0 3px 0 3px ${color}, 0 -3px 0 3px ${color}, 6px 6px 0 0 rgba(0,0,0,0.3)`,
    imageRendering: 'pixelated',
    transition: 'background 0.3s, color 0.3s'
  }}>
    {children}
  </div>
));

const PixelButton = React.memo(({ children, onClick, disabled, color = "#667eea", textColor = "white", small = false, className = "" }) => (
  <button
    onClick={onClick} disabled={disabled}
    className={`${small ? 'px-3 py-1 text-xs' : 'px-6 py-3 text-sm'} font-bold relative transition-colors ${className}`}
    style={{
      background: disabled ? '#CBD5E0' : color,
      color: textColor, border: 'none',
      boxShadow: disabled ? 'none' : `0 0 0 3px #2D3748, 3px 0 0 3px #2D3748, -3px 0 0 3px #2D3748, 0 3px 0 3px #2D3748, 0 -3px 0 3px #2D3748, 0 5px 0 0 #2D3748, 0 6px 0 0 rgba(0,0,0,0.4)`,
      cursor: disabled ? 'not-allowed' : 'pointer',
      imageRendering: 'pixelated',
      transform: disabled ? 'none' : 'translateY(0)',
    }}
    onMouseDown={(e) => !disabled && (e.currentTarget.style.transform = 'translateY(3px)')}
    onMouseUp={(e) => !disabled && (e.currentTarget.style.transform = 'translateY(0)')}
    onMouseLeave={(e) => !disabled && (e.currentTarget.style.transform = 'translateY(0)')}
  >
    {children}
  </button>
));

const PixelInput = React.memo(({ value, onChange, placeholder, type = "text", isDark }) => (
  <input
    type={type} value={value} onChange={onChange} placeholder={placeholder}
    className="w-full p-3 text-base font-bold focus:outline-none"
    style={{
      background: isDark ? '#2D3748' : '#F7FAFC',
      color: isDark ? '#F7FAFC' : '#2D3748',
      border: 'none',
      boxShadow: `0 0 0 3px ${isDark ? '#4A5568' : '#2D3748'}, inset 3px 3px 0 0 rgba(0,0,0,0.15)`,
      imageRendering: 'pixelated'
    }}
  />
));

const PixelCheckbox = React.memo(({ checked, onChange, isDark }) => (
  <div
    onClick={onChange} className="w-6 h-6 cursor-pointer flex-shrink-0 transition-colors"
    style={{
      background: checked ? '#667eea' : (isDark ? '#2D3748' : 'white'),
      boxShadow: `0 0 0 3px ${isDark ? '#4A5568' : '#2D3748'}, inset 0 0 0 3px ${checked ? '#667eea' : (isDark ? '#2D3748' : 'white')}, inset 3px 3px 0 0 ${checked ? '#5A67D8' : 'rgba(0,0,0,0.1)'}`,
      imageRendering: 'pixelated'
    }}
  />
));

// ==========================================
// ACCOUNT PAGE COMPONENT
// ==========================================
const AccountPage = ({ onBack, isDark }) => (
  <div className="max-w-2xl mx-auto">
    <PixelBox className="p-6 mb-6 flex justify-between items-center" color="#5A67D8" isDark={isDark}>
      <h1 className="text-3xl font-bold">ACCOUNT SETTINGS</h1>
      <PixelButton onClick={onBack} color="#718096" small>RETURN TO DASHBOARD</PixelButton>
    </PixelBox>

    <PixelBox className="p-6 mb-6" color="#48BB78" isDark={isDark}>
      <h2 className="text-xl font-bold mb-4">SUBSCRIPTION PLAN</h2>
      <div className="p-4 mb-4" style={{ background: isDark ? '#276749' : '#C6F6D5', border: '2px solid #2F855A' }}>
        <p className="font-bold text-lg text-green-900 dark:text-green-100">PRO SNIPER</p>
        <p className="text-sm text-green-800 dark:text-green-200">Active • Renews on April 24, 2026</p>
      </div>
      <div className="flex gap-4">
        <PixelButton color="#48BB78" onClick={() => alert('Stripe Portal Coming Soon')}>MANAGE BILLING</PixelButton>
        <PixelButton color="#F56565" onClick={() => alert('Cancel Flow Coming Soon')}>CANCEL PLAN</PixelButton>
      </div>
    </PixelBox>

    <PixelBox className="p-6" color="#ECC94B" isDark={isDark}>
      <h2 className="text-xl font-bold mb-4">SECURITY</h2>
      <div className="space-y-4">
        <PixelInput placeholder="NEW PASSWORD" type="password" isDark={isDark} />
        <PixelInput placeholder="CONFIRM NEW PASSWORD" type="password" isDark={isDark} />
        <PixelButton color="#ECC94B" textColor="#2D3748" onClick={() => alert('Password Update Coming Soon')}>UPDATE PASSWORD</PixelButton>
      </div>
    </PixelBox>
  </div>
);

// ==========================================
// PRICING GATE (UNPAID USERS)
// ==========================================
const PricingGate = ({ onLogout, isDark }) => (
  <div className="min-h-screen p-4 md:p-8 flex items-center justify-center transition-colors duration-300" style={{ background: isDark ? 'linear-gradient(135deg, #2D3748 0%, #1A202C 100%)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', fontFamily: 'monospace' }}>
    <PixelBox className="max-w-4xl w-full p-8 text-center" color="#5A67D8" isDark={isDark}>
      <h1 className="text-3xl md:text-5xl font-bold mb-4">PIXELFLIP PRO</h1>
      <p className="text-lg mb-8" style={{ color: isDark ? '#A0AEC0' : '#718096' }}>Your account is currently inactive. Upgrade to start sniping deals.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 text-left">
        {/* Free Tier */}
        <div className="p-6 border-4 border-gray-500 relative" style={{ background: isDark ? '#2D3748' : '#F7FAFC' }}>
          <h2 className="text-xl font-bold mb-2">FREE TIER</h2>
          <p className="text-3xl font-bold mb-4">$0<span className="text-sm" style={{ color: isDark ? '#A0AEC0' : '#718096' }}>/mo</span></p>
          <ul className="space-y-2 mb-6 text-sm font-bold" style={{ color: isDark ? '#E2E8F0' : '#4A5568' }}>
            <li>✓ 1 Platform (Craigslist)</li>
            <li>✓ 3 Search Terms</li>
            <li>✓ 30 Minute Checks</li>
            <li>❌ No AI Filtering</li>
          </ul>
          <PixelButton disabled color="#A0AEC0" className="w-full">CURRENT PLAN</PixelButton>
        </div>

        {/* Pro Tier */}
        <div className="p-6 border-4 border-indigo-500 relative transform md:-translate-y-4 shadow-xl" style={{ background: isDark ? '#2B6CB0' : '#EBF4FF' }}>
          <div className="absolute top-0 right-0 bg-indigo-500 text-white text-xs font-bold px-2 py-1 transform translate-x-2 -translate-y-2 border-2 border-gray-900">RECOMMENDED</div>
          <h2 className="text-xl font-bold mb-2" style={{ color: isDark ? '#E2E8F0' : '#434190' }}>PRO SNIPER</h2>
          <p className="text-3xl font-bold mb-4" style={{ color: isDark ? '#F7FAFC' : '#312E81' }}>$7.99<span className="text-sm" style={{ color: isDark ? '#A3BFFA' : '#5A67D8' }}>/mo</span></p>
          <ul className="space-y-2 mb-6 text-sm font-bold" style={{ color: isDark ? '#E2E8F0' : '#3730A3' }}>
            <li>✓ All Platforms (OfferUp, Mercari)</li>
            <li>✓ Unlimited Search Terms</li>
            <li>✓ 5 Minute Checks</li>
            <li>✓ Advanced AI Image Filtering</li>
          </ul>
          <PixelButton onClick={() => alert("Stripe Checkout Coming Soon!")} color="#48BB78" className="w-full">
            UPGRADE NOW
          </PixelButton>
        </div>
      </div>

      <button onClick={onLogout} className="text-sm font-bold hover:underline mt-4" style={{ color: isDark ? '#A0AEC0' : '#718096' }}>
        LOG OUT & RETURN
      </button>
    </PixelBox>
  </div>
);

// ==========================================
// MAIN APP WRAPPER
// ==========================================
export default function App() {
  const [session, setSession] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsInitializing(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (isInitializing) return <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white font-mono">LOADING...</div>;
  if (!session) return <Auth onLogin={setSession} />;

  return <Dashboard session={session} />;
}

// ==========================================
// DASHBOARD COMPONENT
// ==========================================
function Dashboard({ session }) {
  const [status, setStatus] = useState({ running: false, status: 'stopped', items_scanned_today: 0, matches_found_today: 0, recent_activity: [] });
  const [settings, setSettings] = useState({ platforms: { craigslist: true, offerup: true, mercari: true }, zip_code: '95212', distance: 25, check_interval: 10, thresholds: {}, excluded_keywords: [], ai_detection: true, strictness: 2, subscription_status: 'checking' });
  const [newSearch, setNewSearch] = useState({ term: '', maxPrice: '', minPrice: '' });
  const [newExcluded, setNewExcluded] = useState('');

  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') === 'dark');
  const [currentView, setCurrentView] = useState('dashboard');
  const [showDropdown, setShowDropdown] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [targetTimestamp, setTargetTimestamp] = useState(null);
  const [scraperAction, setScraperAction] = useState(null); // 'starting' | 'stopping' | null


  // Theme Toggle Effect
  useEffect(() => {
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    document.body.style.backgroundColor = isDark ? '#1A202C' : '#E2E8F0';
  }, [isDark]);

  // Load Settings
  useEffect(() => {
    const authHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` };
    fetch(`${API_URL}/settings`, { headers: authHeaders })
      .then(res => res.json())
      .then(data => setSettings(data))
      .catch(err => console.error(err));
  }, [session.access_token]);

  // Poll Status & Sync Clock
  useEffect(() => {
    const authHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` };
    const interval = setInterval(() => {
      fetch(`${API_URL}/status`, { headers: authHeaders })
        .then(res => res.json())
        .then(data => {
          if (data.error) return;
          setStatus(prev => ({ ...prev, ...data }));

          if (data.running && data.next_check_timestamp) {
            setTargetTimestamp(data.next_check_timestamp);
          }
        });
    }, 2000);
    return () => clearInterval(interval);
  }, [session.access_token]);

  // Countdown Timer (driven by backend next_check_timestamp)
  useEffect(() => {
    if (!status.running) {
      setTimerSeconds(0);
      return;
    }

    if (!targetTimestamp) {
      setTimerSeconds(0);
      return;
    }

    const tick = () => {
      const now = Math.floor(Date.now() / 1000);
      const remaining = Math.max(0, Math.floor(Number(targetTimestamp) - now));
      setTimerSeconds(remaining);
    };

    tick(); // update immediately
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [status.running, targetTimestamp]);

  // Actions
  const startScraper = async () => {
    const authHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` };
    setScraperAction('starting');
    try {
      await fetch(`${API_URL}/start`, { method: 'POST', headers: authHeaders });
    } finally {
      // Let the next status poll confirm running; keep a short UX lock to prevent spam.
      setTimeout(() => setScraperAction(null), 1200);
    }
  };

  const stopScraper = async () => {
    const authHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` };
    setScraperAction('stopping');
    try {
      await fetch(`${API_URL}/stop`, { method: 'POST', headers: authHeaders });
    } finally {
      setTimeout(() => setScraperAction(null), 1200);
    }
  };

  const saveSettings = () => {
    const authHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` };
    fetch(`${API_URL}/settings`, { method: 'POST', headers: authHeaders, body: JSON.stringify(settings) })
      .then(() => alert("✅ Saved!"));
  };

  const addSearchTerm = () => {
    const term = newSearch.term.trim().toLowerCase();
    const max = parseInt(newSearch.maxPrice);
    const min = parseInt(newSearch.minPrice) || 0;
    if (term && !isNaN(max)) {
      setSettings(prev => ({ ...prev, thresholds: { ...prev.thresholds, [term]: { max, min } } }));
      setNewSearch({ term: '', maxPrice: '', minPrice: '' });
    }
  };

  const removeSearchTerm = (term) => {
    setSettings(prev => {
      const copy = { ...prev.thresholds };
      delete copy[term];
      return { ...prev, thresholds: copy };
    });
  };

  const addExclusion = () => {
    if (newExcluded.trim()) {
      setSettings(prev => ({ ...prev, excluded_keywords: [...(prev.excluded_keywords || []), newExcluded.trim().toLowerCase()] }));
      setNewExcluded('');
    }
  };

  const removeExclusion = (index) => {
    setSettings(prev => ({ ...prev, excluded_keywords: prev.excluded_keywords.filter((_, i) => i !== index) }));
  };

  const formatTime = (totalSeconds) => {
    // 1. Force the number to be a clean, positive integer
    const validSeconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));

    // 2. Calculate minutes and seconds
    const m = Math.floor(validSeconds / 60);
    const s = validSeconds % 60;

    // 3. Format beautifully
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // 1. If we are still asking the database for their status, show a loading screen!
  if (settings.subscription_status === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center transition-colors duration-300" style={{ background: isDark ? '#1A202C' : '#667eea' }}>
        <div className="text-white text-2xl font-bold font-mono animate-pulse">VERIFYING CLEARANCE...</div>
      </div>
    );
  }

  // 2. If they are officially inactive, lock the gate!
  if (settings.subscription_status === 'inactive') {
    return <PricingGate onLogout={() => supabase.auth.signOut()} isDark={isDark} />;
  }

  return (
    <div className="min-h-screen p-4 md:p-8 transition-colors duration-300" style={{ background: isDark ? 'linear-gradient(135deg, #2D3748 0%, #1A202C 100%)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', fontFamily: 'monospace' }}>

      {currentView === 'account' ? (
        <AccountPage onBack={() => setCurrentView('dashboard')} isDark={isDark} />
      ) : (
        <div className="max-w-7xl mx-auto">

          {/* Header */}
          <PixelBox className="p-4 md:p-6 mb-6 flex items-center justify-between" color="#5A67D8" isDark={isDark}>
            <div>
              <h1 className="text-3xl md:text-5xl font-bold mb-2 break-words">PIXELFLIP</h1>
              <p className="text-xs md:text-sm" style={{ color: isDark ? '#A0AEC0' : '#718096' }}>{session.user.email}</p>
            </div>

            <div className="flex items-center gap-4 relative">
              <div className="flex items-center gap-3 mr-4">
                <div className="w-6 h-6 rounded-full" style={{ background: status.running ? '#48BB78' : '#F56565', boxShadow: status.running ? '0 0 10px #48BB78' : 'none' }}/>
                <span className="text-xl font-bold hidden md:block">{status.running ? 'ACTIVE' : 'STOPPED'}</span>
              </div>

              <button
                type="button"
                onClick={() => setShowDropdown(!showDropdown)}
                className="cursor-pointer transition-colors p-2 hover:opacity-70"
                style={{ color: isDark ? '#E2E8F0' : '#4A5568' }}
                aria-label="Menu"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
              </button>

              {showDropdown && (
                <div className="absolute right-0 top-12 w-48 z-50 p-2 space-y-2" style={{ background: isDark ? '#2D3748' : 'white', border: '3px solid #2D3748', boxShadow: '4px 4px 0 rgba(0,0,0,0.5)', imageRendering: 'pixelated' }}>
                  <button onClick={() => { setCurrentView('account'); setShowDropdown(false); }} className={`w-full text-left p-2 font-bold hover:bg-gray-200 ${isDark ? 'hover:text-black' : ''}`}>ACCOUNT</button>
                  <button onClick={() => { setIsDark(!isDark); setShowDropdown(false); }} className={`w-full text-left p-2 font-bold hover:bg-gray-200 ${isDark ? 'hover:text-black' : ''}`}>{isDark ? 'LIGHT MODE' : 'DARK MODE'}</button>
                  <button onClick={() => supabase.auth.signOut()} className="w-full text-left p-2 font-bold text-red-500 hover:bg-red-100">LOGOUT</button>
                </div>
              )}
            </div>
          </PixelBox>

          {/* Controls & Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <PixelBox className="p-6 flex flex-col justify-center gap-4" color="#5A67D8" isDark={isDark}>
              <PixelButton
                onClick={startScraper}
                disabled={status.running || scraperAction === 'starting' || scraperAction === 'stopping'}
                color="#48BB78"
              >
                {scraperAction === 'starting' ? '… STARTING' : '▶ START'}
              </PixelButton>
              <PixelButton
                onClick={stopScraper}
                disabled={!status.running || scraperAction === 'starting' || scraperAction === 'stopping'}
                color="#F56565"
              >
                {scraperAction === 'stopping' ? '… STOPPING' : '■ STOP'}
              </PixelButton>
              {(scraperAction === 'starting' || scraperAction === 'stopping') && (
                <div className="text-xs font-bold animate-pulse" style={{ color: isDark ? '#A0AEC0' : '#E2E8F0' }}>
                  UPDATING SCRAPER STATE…
                </div>
              )}
            </PixelBox>

            <PixelBox className="p-6 text-center flex flex-col justify-center" color="#667eea" isDark={isDark}>
              <div className="text-sm font-bold mb-2" style={{ color: isDark ? '#A3BFFA' : '#5A67D8' }}>
                {status.running && timerSeconds === 0 ? 'SYSTEM STATUS' : 'NEXT CHECK IN'}
              </div>
              <div className={`font-bold ${status.running && timerSeconds === 0 ? 'text-3xl animate-pulse mt-2' : 'text-5xl'}`} style={{ color: isDark ? '#7F9CF5' : '#667eea' }}>
                {!status.running ? '--:--' : (timerSeconds === 0 ? 'SCANNING...' : formatTime(timerSeconds))}
              </div>
            </PixelBox>

            <PixelBox className="p-6 text-center" color="#48BB78" isDark={isDark}>
              <div className="text-sm font-bold mb-2" style={{ color: isDark ? '#9AE6B4' : '#38A169' }}>ITEMS SCANNED TODAY</div>
              <div className="text-5xl font-bold" style={{ color: isDark ? '#68D391' : '#48BB78' }}>{status.items_scanned_today || 0}</div>
            </PixelBox>
          </div>

          {/* Settings Grid (4 Columns) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">

            {/* 1. Main Settings */}
            <PixelBox className="p-6" color="#5A67D8" isDark={isDark}>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">SETTINGS</h2>
                <PixelButton onClick={saveSettings} color="#48BB78" small>💾 SAVE</PixelButton>
              </div>

              <div className="mb-6">
                <div className="text-sm mb-3 font-bold" style={{ color: isDark ? '#A0AEC0' : '#4A5568' }}>PLATFORMS</div>
                {Object.entries(settings.platforms || {}).map(([platform, enabled]) => (
                  <div key={platform} className="flex items-center gap-3 mb-3">
                    <PixelCheckbox isDark={isDark} checked={enabled} onChange={() => setSettings(prev => ({ ...prev, platforms: { ...prev.platforms, [platform]: !enabled } }))} />
                    <span className="text-sm font-bold uppercase">{platform}</span>
                  </div>
                ))}
              </div>

              <div className="mb-6">
                <div className="text-sm mb-2 font-bold" style={{ color: isDark ? '#A0AEC0' : '#4A5568' }}>ZIP CODE</div>
                <PixelInput isDark={isDark} value={settings.zip_code || ''} onChange={(e) => setSettings(prev => ({ ...prev, zip_code: e.target.value }))} />
              </div>

              <div className="mb-6">
                <div className="text-sm mb-3 font-bold" style={{ color: isDark ? '#A0AEC0' : '#4A5568' }}>DISTANCE: {settings.distance} MI</div>
                <input type="range" min="5" max="100" step="5" value={settings.distance || 25} onChange={(e) => setSettings(prev => ({ ...prev, distance: parseInt(e.target.value) }))} className="w-full h-8 cursor-pointer" />
              </div>

              <div className="mb-6">
                <div className="text-sm mb-2 font-bold" style={{ color: isDark ? '#A0AEC0' : '#4A5568' }}>CHECK EVERY</div>
                <select value={settings.check_interval || 10} onChange={(e) => setSettings(prev => ({ ...prev, check_interval: parseInt(e.target.value) }))} className="w-full p-3 text-sm font-bold cursor-pointer" style={{ background: isDark ? '#2D3748' : '#F7FAFC', color: isDark ? 'white' : 'black', border: 'none', boxShadow: `0 0 0 3px ${isDark ? '#4A5568' : '#2D3748'}, inset 3px 3px 0 0 rgba(0,0,0,0.15)`, imageRendering: 'pixelated' }}>
                  <option value="5">5 MINUTES</option>
                  <option value="10">10 MINUTES</option>
                  <option value="15">15 MINUTES</option>
                  <option value="30">30 MINUTES</option>
                </select>
              </div>

              <div className="mb-6">
                <div className="flex items-center gap-3 mb-3">
                  <PixelCheckbox isDark={isDark} checked={settings.ai_detection} onChange={() => setSettings(prev => ({ ...prev, ai_detection: !prev.ai_detection }))} />
                  <span className="text-sm font-bold">ENABLE AI DETECTION</span>
                </div>
                {settings.ai_detection && (
                  <div className="mt-4">
                    <div className="text-sm mb-2 font-bold" style={{ color: isDark ? '#A0AEC0' : '#4A5568' }}>STRICTNESS: {['LENIENT', 'BALANCED', 'STRICT'][(settings.strictness || 2) - 1]}</div>
                    <input type="range" min="1" max="3" value={settings.strictness || 2} onChange={(e) => setSettings(prev => ({ ...prev, strictness: parseInt(e.target.value) }))} className="w-full h-8 cursor-pointer" />
                  </div>
                )}
              </div>
            </PixelBox>

            {/* 2. Search Terms */}
            <PixelBox className="p-6" color="#5A67D8" isDark={isDark}>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">SEARCH TERMS</h2>
                <PixelButton onClick={saveSettings} color="#48BB78" small>💾 SAVE</PixelButton>
              </div>

              <div className="space-y-3 mb-6 max-h-64 overflow-y-auto">
                {Object.entries(settings.thresholds || {}).map(([term, prices]) => (
                  <div key={term} className="flex items-center justify-between p-3 border-b-2" style={{ borderColor: isDark ? '#4A5568' : '#E2E8F0' }}>
                    <span className="font-bold uppercase flex-1">{term}</span>
                    <span className="font-bold text-indigo-500 w-32 text-center">${prices.min} - ${prices.max}</span>
                    <button onClick={() => removeSearchTerm(term)} className="bg-red-500 text-white w-8 h-8 font-bold">✕</button>
                  </div>
                ))}
              </div>

              <div className="space-y-3 pt-4 border-t-2" style={{ borderColor: isDark ? '#4A5568' : '#E2E8F0' }}>
                <div className="text-sm font-bold mb-2" style={{ color: isDark ? '#A0AEC0' : '#4A5568' }}>ADD NEW SEARCH</div>
                <PixelInput isDark={isDark} value={newSearch.term} onChange={e => setNewSearch(p => ({...p, term: e.target.value}))} placeholder="TERM (e.g. Gameboy)" />
                <div className="flex gap-2">
                  <PixelInput isDark={isDark} value={newSearch.minPrice} onChange={e => setNewSearch(p => ({...p, minPrice: e.target.value}))} placeholder="MIN $" type="number" />
                  <PixelInput isDark={isDark} value={newSearch.maxPrice} onChange={e => setNewSearch(p => ({...p, maxPrice: e.target.value}))} placeholder="MAX $" type="number" />
                </div>
                <PixelButton onClick={addSearchTerm} color="#667eea" className="w-full">+ ADD TERM</PixelButton>
              </div>
            </PixelBox>

            {/* 3. Exclusions */}
            <PixelBox className="p-6" color="#F56565" isDark={isDark}>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">EXCLUSIONS</h2>
                <PixelButton onClick={saveSettings} color="#48BB78" small>💾 SAVE</PixelButton>
              </div>
              <div className="mb-6 max-h-64 overflow-y-auto">
                {(settings.excluded_keywords || []).map((keyword, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border-b-2" style={{ borderColor: isDark ? '#4A5568' : '#E2E8F0' }}>
                    <span className="font-bold uppercase flex-1">{keyword}</span>
                    <button onClick={() => removeExclusion(index)} className="bg-red-500 text-white w-8 h-8 font-bold">✕</button>
                  </div>
                ))}
              </div>
              <div className="space-y-3 pt-4 border-t-2" style={{ borderColor: isDark ? '#4A5568' : '#E2E8F0' }}>
                <div className="text-sm font-bold mb-2" style={{ color: isDark ? '#A0AEC0' : '#4A5568' }}>ADD EXCLUSION</div>
                <PixelInput isDark={isDark} value={newExcluded} onChange={(e) => setNewExcluded(e.target.value)} placeholder="WORD TO EXCLUDE" />
                <PixelButton onClick={addExclusion} color="#F56565" className="w-full">+ EXCLUDE</PixelButton>
              </div>
            </PixelBox>

            {/* 4. Live Console */}
            <PixelBox className="p-6 h-[500px] flex flex-col" color="#ECC94B" isDark={isDark}>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <span className="animate-pulse w-3 h-3 bg-yellow-400 rounded-full inline-block"></span>
                LIVE CONSOLE
              </h2>
              <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-black text-green-400 font-mono text-xs border-4 border-gray-600 rounded">
                {status.recent_activity?.length > 0 ? (
                  status.recent_activity.map((log, i) => (
                    <div key={i}>[{log.time}] {log.message}</div>
                  ))
                ) : (
                  <div className="text-gray-500 text-center mt-20">AWAITING SCRAPER PROTOCOL...</div>
                )}
              </div>
            </PixelBox>

          </div>
        </div>
      )}

      <style>{`
        input[type="range"] { -webkit-appearance: none; width: 100%; height: 32px; background: ${isDark ? '#2D3748' : '#E2E8F0'}; outline: none; box-shadow: 0 0 0 3px ${isDark ? '#4A5568' : '#2D3748'}, inset 3px 3px 0 0 rgba(0,0,0,0.2); }
        input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; width: 24px; height: 24px; background: #667eea; cursor: grab; box-shadow: 0 0 0 3px ${isDark ? '#1A202C' : '#2D3748'}; border: none; }
        input[type="range"]::-webkit-slider-thumb:active { cursor: grabbing; background: #5A67D8; }
        .overflow-y-auto::-webkit-scrollbar { width: 8px; }
        .overflow-y-auto::-webkit-scrollbar-track { background: ${isDark ? '#2D3748' : '#E2E8F0'}; }
        .overflow-y-auto::-webkit-scrollbar-thumb { background: #667eea; border: 2px solid ${isDark ? '#1A202C' : '#2D3748'}; }
      `}</style>
    </div>
  );
}