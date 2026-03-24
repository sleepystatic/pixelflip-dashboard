import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from './supabaseClient';
import Auth from './Auth';
import config from './config';

// ==========================================
// REUSABLE PIXEL UI COMPONENTS
// ==========================================
const SearchTermsList = React.memo(({ thresholds, onRemove }) => {
  const scrollContainerRef = useRef(null);
  const scrollPositionRef = useRef(0);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollPositionRef.current;
    }
  });

  const handleScroll = (e) => {
    scrollPositionRef.current = e.target.scrollTop;
  };

  return (
    <div ref={scrollContainerRef} onScroll={handleScroll} className="mb-6 max-h-64 overflow-y-auto">
      {Object.entries(thresholds || {}).map(([term, price], index, array) => (
        <div
          key={term}
          className="flex items-center justify-between gap-3 py-3"
          style={{ borderBottom: index < array.length - 1 ? '2px solid #CBD5E0' : 'none' }}
        >
          <div className="text-sm font-bold flex-1" style={{ color: '#2D3748' }}>
            {term.toUpperCase()}
          </div>
          <div className="text-lg font-bold flex-shrink-0" style={{ color: '#667eea', minWidth: '80px', textAlign: 'center' }}>
            ${price}
          </div>
          <button
            onClick={() => onRemove(term)}
            className="font-bold text-sm flex-shrink-0 hover:bg-red-600 transition-colors"
            style={{
              background: '#F56565', color: 'white', border: 'none',
              width: '36px', height: '36px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
});

const PixelBox = React.memo(({ children, className = "", color = "#4A5568" }) => (
  <div className={className} style={{
    background: 'white',
    boxShadow: `0 0 0 3px ${color}, 3px 0 0 3px ${color}, -3px 0 0 3px ${color}, 0 3px 0 3px ${color}, 0 -3px 0 3px ${color}, 6px 6px 0 0 rgba(0,0,0,0.3)`,
    imageRendering: 'pixelated'
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

const PixelCheckbox = React.memo(({ checked, onChange }) => (
  <div
    onClick={onChange} className="w-6 h-6 cursor-pointer flex-shrink-0 transition-colors"
    style={{
      background: checked ? '#667eea' : 'white',
      boxShadow: `0 0 0 3px #2D3748, inset 0 0 0 3px ${checked ? '#667eea' : 'white'}, inset 3px 3px 0 0 ${checked ? '#5A67D8' : 'rgba(0,0,0,0.1)'}`,
      imageRendering: 'pixelated'
    }}
  />
));

const PixelInput = React.memo(({ value, onChange, placeholder, type = "text" }) => (
  <input
    type={type} value={value} onChange={onChange} placeholder={placeholder}
    className="w-full p-3 text-base font-bold focus:outline-none"
    style={{
      background: '#F7FAFC', color: '#2D3748', border: 'none',
      boxShadow: `0 0 0 3px #2D3748, inset 3px 3px 0 0 rgba(0,0,0,0.15)`,
      imageRendering: 'pixelated'
    }}
  />
));

const API_URL = config.API_URL || 'http://localhost:5000/api';

// ==========================================
// PRICING GATE (UNPAID USERS)
// ==========================================
const PricingGate = ({ onLogout }) => (
  <div className="min-h-screen p-4 md:p-8 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', fontFamily: 'monospace' }}>
    <PixelBox className="max-w-4xl w-full p-8 text-center" color="#5A67D8">
      <h1 className="text-3xl md:text-5xl font-bold mb-4" style={{ color: '#2D3748' }}>PIXELFLIP PRO</h1>
      <p className="text-lg mb-8" style={{ color: '#718096' }}>Your account is currently inactive. Upgrade to start sniping deals.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 text-left">
        {/* Free/Trial Tier (Optional to show) */}
        <div className="p-6 border-4 border-gray-300 bg-gray-50 relative">
          <h2 className="text-xl font-bold mb-2">FREE TIER</h2>
          <p className="text-3xl font-bold mb-4">$0<span className="text-sm text-gray-500">/mo</span></p>
          <ul className="space-y-2 mb-6 text-sm font-bold text-gray-600">
            <li>✓ 1 Platform (Craigslist)</li>
            <li>✓ 3 Search Terms</li>
            <li>✓ 30 Minute Checks</li>
            <li>❌ No AI Filtering</li>
          </ul>
          <PixelButton disabled color="#A0AEC0" className="w-full">CURRENT PLAN</PixelButton>
        </div>

        {/* Pro Tier */}
        <div className="p-6 border-4 border-indigo-500 bg-indigo-50 relative transform md:-translate-y-4 shadow-xl">
          <div className="absolute top-0 right-0 bg-indigo-500 text-white text-xs font-bold px-2 py-1 transform translate-x-2 -translate-y-2 border-2 border-gray-900">RECOMMENDED</div>
          <h2 className="text-xl font-bold mb-2 text-indigo-700">PRO SNIPER</h2>
          <p className="text-3xl font-bold mb-4 text-indigo-900">$7.99<span className="text-sm text-indigo-500">/mo</span></p>
          <ul className="space-y-2 mb-6 text-sm font-bold text-indigo-800">
            <li>✓ All Platforms (OfferUp, Mercari)</li>
            <li>✓ Unlimited Search Terms</li>
            <li>✓ 5 Minute Checks</li>
            <li>✓ Advanced AI Image Filtering</li>
          </ul>
          {/* We will wire this to Stripe Checkout later! */}
          <PixelButton onClick={() => alert("Stripe Checkout Coming Soon!")} color="#48BB78" className="w-full">
            UPGRADE NOW
          </PixelButton>
        </div>
      </div>

      <button onClick={onLogout} className="text-sm font-bold text-gray-500 hover:text-gray-800 underline">
        LOG OUT
      </button>
    </PixelBox>
  </div>
);

// ==========================================
// MAIN APP WRAPPER (AUTH GATEKEEPER)
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

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
        <div className="text-white text-2xl font-bold font-mono">LOADING SYSTEM...</div>
      </div>
    );
  }

  if (!session) {
    return <Auth onLogin={setSession} />;
  }

  return <Dashboard session={session} />;
}

// ==========================================
// DASHBOARD COMPONENT
// ==========================================
function Dashboard({ session }) {
  const [status, setStatus] = useState({
    running: false, status: 'stopped', items_scanned_today: 0,
    matches_found_today: 0, recent_activity: []
  });

  const [settings, setSettings] = useState({
    subscription_status: 'checking',
    platforms: { craigslist: true, offerup: true, mercari: true },
    zip_code: '95212', distance: 25, check_interval: 10,
    thresholds: {}, excluded_keywords: [],
    ai_detection: true, strictness: 2
  });

  const [newSearch, setNewSearch] = useState({ term: '', price: '' });
  const [newExcluded, setNewExcluded] = useState('');
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [nextCheckTime, setNextCheckTime] = useState('--:--');

  const authHeaders = useMemo(() => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`
  }), [session.access_token]);

  // 1. Fetch initial settings
  useEffect(() => {
    fetch(`${API_URL}/settings`, { headers: authHeaders })
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch settings');
        return res.json();
      })
      .then(data => {
        setSettings(data);
        setIsLoadingSettings(false);
      })
      .catch(err => {
        console.error('Settings Error:', err);
        setIsLoadingSettings(false);
      });
  }, [authHeaders]);

  // 2. Poll status
  useEffect(() => {
    const interval = setInterval(() => {
      fetch(`${API_URL}/status`, { headers: authHeaders })
        .then(res => res.json())
        .then(data => {
          if (data.error) return;
          setStatus(prevStatus => {
            const activityChanged = JSON.stringify(data.recent_activity) !== JSON.stringify(prevStatus.recent_activity);
            const numbersChanged = data.items_scanned_today !== prevStatus.items_scanned_today ||
                                   data.matches_found_today !== prevStatus.matches_found_today ||
                                   data.status !== prevStatus.status ||
                                   data.running !== prevStatus.running;
            return (activityChanged || numbersChanged) ? data : prevStatus;
          });
        })
        .catch(err => console.error('Status Error:', err));
    }, 2000);

    return () => clearInterval(interval);
  }, [authHeaders]);

  // 3. Countdown Timer
  useEffect(() => {
    if (!status.running || !status.last_check) {
      setNextCheckTime('--:--');
      return;
    }

    const timer = setInterval(() => {
      try {
        const now = new Date();
        const [hours, minutes, seconds] = status.last_check.split(':').map(Number);
        const lastCheck = new Date();
        lastCheck.setHours(hours, minutes, seconds, 0);

        const checkIntervalMs = settings.check_interval * 60 * 1000;
        const nextCheck = new Date(lastCheck.getTime() + checkIntervalMs);
        const diff = Math.max(0, nextCheck - now);

        const minsRemaining = Math.floor(diff / 60000);
        const secsRemaining = Math.floor((diff % 60000) / 1000);
        setNextCheckTime(`${minsRemaining}:${secsRemaining.toString().padStart(2, '0')}`);
      } catch (error) {
        setNextCheckTime('--:--');
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [status.running, status.last_check, settings.check_interval]);

  // ==========================================
  // ACTIONS & HANDLERS
  // ==========================================

  const startScraper = useCallback(() => {
    fetch(`${API_URL}/start`, { method: 'POST', headers: authHeaders })
      .catch(err => console.error('Failed to start:', err));
  }, [authHeaders]);

  const stopScraper = useCallback(() => {
    fetch(`${API_URL}/stop`, { method: 'POST', headers: authHeaders })
      .catch(err => console.error('Failed to stop:', err));
  }, [authHeaders]);

  const saveSettings = async () => {
    try {
      const response = await fetch(`${API_URL}/settings`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(settings)
      });
      if (response.ok) {
        alert("✅ Settings saved successfully!");
      } else {
        alert("❌ Failed to save settings.");
      }
    } catch (err) {
      console.error('Save error:', err);
      alert("❌ Error saving settings.");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const addSearchTerm = useCallback(() => {
    const trimmedTerm = newSearch.term.trim().toLowerCase();
    const parsedPrice = parseInt(newSearch.price);
    if (trimmedTerm && !isNaN(parsedPrice) && parsedPrice > 0) {
      setSettings(prev => ({
        ...prev,
        thresholds: { ...prev.thresholds, [trimmedTerm]: parsedPrice }
      }));
      setNewSearch({ term: '', price: '' });
    }
  }, [newSearch]);

  const removeSearchTerm = useCallback((term) => {
    setSettings(prev => {
      const newThresholds = { ...prev.thresholds };
      delete newThresholds[term];
      return { ...prev, thresholds: newThresholds };
    });
  }, []);

  const addExclusion = () => {
    if (newExcluded.trim()) {
      setSettings(prev => ({
        ...prev,
        excluded_keywords: [...(prev.excluded_keywords || []), newExcluded.trim().toLowerCase()]
      }));
      setNewExcluded('');
    }
  };

  const removeExclusion = (index) => {
    setSettings(prev => ({
      ...prev,
      excluded_keywords: prev.excluded_keywords.filter((_, i) => i !== index)
    }));
  };

  if (isLoadingSettings) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
        <div className="text-white text-2xl font-bold font-mono">LOADING DASHBOARD...</div>
      </div>
    );
  }

  if (!isLoadingSettings && settings.subscription_status === 'inactive') {
    return <PricingGate onLogout={handleLogout} />;
  }

  return (
    <div className="min-h-screen p-4 md:p-8" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', fontFamily: 'monospace' }}>
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <PixelBox className="p-4 md:p-6 mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4" color="#5A67D8">
          <div className="w-full text-center md:text-left">
            <h1 className="text-3xl md:text-5xl font-bold mb-2 break-words" style={{ color: '#2D3748' }}>PIXELFLIP</h1>
            <p className="text-xs md:text-sm break-all" style={{ color: '#718096' }}>{session.user.email}</p>
          </div>

          <div className="w-full flex justify-between md:justify-end items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 md:w-10 md:h-10 shrink-0" style={{ /* pulse styles */ }}/>
              <span className="text-base md:text-xl font-bold">{status.status.toUpperCase()}</span>
            </div>
            <PixelButton onClick={handleLogout} color="#F56565" small>LOGOUT</PixelButton>
          </div>
        </PixelBox>

        {/* Controls */}
        <PixelBox className="p-4 md:p-6 mb-4 md:mb-6" color="#5A67D8">
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <div className="w-full sm:w-auto">
              <PixelButton onClick={startScraper} disabled={status.running} color="#48BB78" className="w-full">
                ▶ START SCANNER
              </PixelButton>
            </div>
            <div className="w-full sm:w-auto">
              <PixelButton onClick={stopScraper} disabled={!status.running} color="#F56565" className="w-full">
                ■ STOP SCANNER
              </PixelButton>
            </div>
          </div>
        </PixelBox>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-6">
          <PixelBox color="#667eea">
            <div className="p-6">
              <div className="text-sm mb-2 font-bold" style={{ color: '#5A67D8' }}>{status.running ? 'NEXT CHECK IN' : 'SCRAPER INACTIVE'}</div>
              <div className="text-4xl font-bold mb-4" style={{ color: '#667eea' }}>{status.running ? nextCheckTime : '--:--'}</div>
              {status.running && <div className="text-xs" style={{ color: '#718096' }}>Checking every {settings.check_interval} minutes</div>}
            </div>
          </PixelBox>
          <PixelBox color="#48BB78">
            <div className="p-6">
              <div className="text-sm mb-2 font-bold" style={{ color: '#38A169' }}>MATCHES FOUND TODAY</div>
              <div className="text-4xl font-bold mb-4" style={{ color: '#48BB78' }}>{status.matches_found_today}</div>
              <PixelButton onClick={() => console.log('Matches page')} color="#38A169">VIEW ALL</PixelButton>
            </div>
          </PixelBox>
        </div>

        {/* Settings Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6">

          {/* Main Settings Panel */}
          <PixelBox className="p-6" color="#5A67D8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold" style={{ color: '#2D3748' }}>SETTINGS</h2>
              <PixelButton onClick={saveSettings} color="#48BB78" small>💾 SAVE</PixelButton>
            </div>

            <div className="mb-6">
              <div className="text-sm mb-3 font-bold" style={{ color: '#4A5568' }}>PLATFORMS</div>
              {Object.entries(settings.platforms || {}).map(([platform, enabled]) => (
                <div key={platform} className="flex items-center gap-3 mb-3">
                  <PixelCheckbox checked={enabled} onChange={() => setSettings(prev => ({ ...prev, platforms: { ...prev.platforms, [platform]: !enabled } }))} />
                  <span className="text-sm font-bold select-none cursor-pointer" style={{ color: '#2D3748' }}>{platform.toUpperCase()}</span>
                </div>
              ))}
            </div>

            <div className="mb-6">
              <div className="text-sm mb-2 font-bold" style={{ color: '#4A5568' }}>ZIP CODE</div>
              <PixelInput value={settings.zip_code || ''} onChange={(e) => setSettings(prev => ({ ...prev, zip_code: e.target.value }))} />
            </div>

            <div className="mb-6">
              <div className="text-sm mb-3 font-bold" style={{ color: '#4A5568' }}>DISTANCE: {settings.distance} MI</div>
              <input type="range" min="5" max="100" step="5" value={settings.distance || 25} onChange={(e) => setSettings(prev => ({ ...prev, distance: parseInt(e.target.value) }))} className="w-full h-8 cursor-pointer" />
            </div>

            <div className="mb-6">
              <div className="text-sm mb-2 font-bold" style={{ color: '#4A5568' }}>CHECK EVERY</div>
              <select value={settings.check_interval || 10} onChange={(e) => setSettings(prev => ({ ...prev, check_interval: parseInt(e.target.value) }))} className="w-full p-3 text-sm font-bold cursor-pointer" style={{ background: '#F7FAFC', border: 'none', boxShadow: `0 0 0 3px #2D3748, inset 3px 3px 0 0 rgba(0,0,0,0.15)`, imageRendering: 'pixelated' }}>
                <option value="5">5 MINUTES</option>
                <option value="10">10 MINUTES</option>
                <option value="15">15 MINUTES</option>
                <option value="30">30 MINUTES</option>
              </select>
            </div>

            <div className="mb-6">
              <div className="flex items-center gap-3 mb-3">
                <PixelCheckbox checked={settings.ai_detection} onChange={() => setSettings(prev => ({ ...prev, ai_detection: !prev.ai_detection }))} />
                <span className="text-sm font-bold select-none" style={{ color: '#2D3748' }}>ENABLE AI DETECTION</span>
              </div>
              {settings.ai_detection && (
                <div className="mt-4">
                  <div className="text-sm mb-2 font-bold" style={{ color: '#4A5568' }}>STRICTNESS: {['LENIENT', 'BALANCED', 'STRICT'][(settings.strictness || 2) - 1]}</div>
                  <input type="range" min="1" max="3" value={settings.strictness || 2} onChange={(e) => setSettings(prev => ({ ...prev, strictness: parseInt(e.target.value) }))} className="w-full h-8 cursor-pointer" />
                </div>
              )}
            </div>
          </PixelBox>

          {/* Search Terms Panel */}
          <PixelBox className="p-6" color="#5A67D8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold" style={{ color: '#2D3748' }}>SEARCH TERMS</h2>
              <PixelButton onClick={saveSettings} color="#48BB78" small>💾 SAVE</PixelButton>
            </div>
            <SearchTermsList thresholds={settings.thresholds} onRemove={removeSearchTerm} />
            <div className="space-y-3 pt-4 border-t-2 border-gray-300">
              <div className="text-sm font-bold mb-2" style={{ color: '#4A5568' }}>ADD NEW SEARCH</div>
              <PixelInput value={newSearch.term} onChange={(e) => setNewSearch(prev => ({ ...prev, term: e.target.value }))} placeholder="SEARCH TERM" />
              <PixelInput value={newSearch.price} onChange={(e) => setNewSearch(prev => ({ ...prev, price: e.target.value }))} placeholder="MAX PRICE" type="number" />
              <PixelButton onClick={addSearchTerm} color="#667eea" className="w-full">+ ADD TERM</PixelButton>
            </div>
          </PixelBox>

          {/* Exclusions Panel */}
          <PixelBox className="p-6" color="#F56565">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold" style={{ color: '#2D3748' }}>EXCLUSIONS</h2>
              <PixelButton onClick={saveSettings} color="#48BB78" small>💾 SAVE</PixelButton>
            </div>
            <div className="mb-6 max-h-64 overflow-y-auto">
              {(settings.excluded_keywords || []).map((keyword, index) => (
                <div key={index} className="flex items-center justify-between py-3 border-b-2 border-gray-300">
                  <div className="text-sm font-bold" style={{ color: '#2D3748' }}>{keyword.toUpperCase()}</div>
                  <button onClick={() => removeExclusion(index)} className="font-bold text-sm bg-red-500 text-white w-8 h-8 flex items-center justify-center hover:bg-red-600">✕</button>
                </div>
              ))}
            </div>
            <div className="space-y-3 pt-4 border-t-2 border-gray-300">
              <div className="text-sm font-bold mb-2" style={{ color: '#4A5568' }}>ADD EXCLUSION</div>
              <PixelInput value={newExcluded} onChange={(e) => setNewExcluded(e.target.value)} placeholder="WORD TO EXCLUDE" />
              <PixelButton onClick={addExclusion} color="#F56565" className="w-full">+ EXCLUDE</PixelButton>
            </div>
          </PixelBox>

          {/* Console Output */}
          <PixelBox className="p-6" color="#5A67D8">
            <h2 className="text-xl font-bold mb-6" style={{ color: '#2D3748' }}>SYSTEM CONSOLE</h2>
            <div className="space-y-2 max-h-96 overflow-y-auto pr-2" style={{ scrollbarWidth: 'thin', scrollbarColor: '#667eea #E2E8F0' }}>
              {status.recent_activity && status.recent_activity.length > 0 ? (
                status.recent_activity.map((activity, i) => (
                  <div key={i} className="p-3 text-xs font-bold" style={{
                    background: activity.type === 'success' ? '#C6F6D5' : activity.type === 'error' ? '#FED7D7' : '#E2E8F0',
                    color: '#2D3748', border: `2px solid ${activity.type === 'success' ? '#48BB78' : activity.type === 'error' ? '#F56565' : '#A0AEC0'}`,
                    imageRendering: 'pixelated'
                  }}>
                    <div style={{ color: '#718096', marginBottom: '4px' }}>[{activity.time}]</div>
                    {activity.message}
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-sm font-bold text-gray-400">WAITING FOR SYSTEM ACTIVITY...</div>
              )}
            </div>
          </PixelBox>

        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        input[type="range"] { -webkit-appearance: none; width: 100%; height: 32px; background: #E2E8F0; outline: none; box-shadow: 0 0 0 3px #2D3748, inset 3px 3px 0 0 rgba(0,0,0,0.2); }
        input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; width: 24px; height: 24px; background: #667eea; cursor: grab; box-shadow: 0 0 0 3px #2D3748; border: none; }
        input[type="range"]::-webkit-slider-thumb:active { cursor: grabbing; background: #5A67D8; }
        .overflow-y-auto::-webkit-scrollbar { width: 8px; }
        .overflow-y-auto::-webkit-scrollbar-track { background: #E2E8F0; }
        .overflow-y-auto::-webkit-scrollbar-thumb { background: #667eea; border: 2px solid #2D3748; }
      `}</style>
    </div>
  );
}