/* eslint-disable */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from './supabaseClient';
import Auth from './Auth';
import { API_URL } from './config';

import { Panel, Taskbar, StatStrip, PageHeader, usePanelLayout } from './Panel';
import { enablePush, disablePush, getPushState, sendTestPush, isIosNeedsInstall } from './pushNotifications';
import Tour, { FlipCompanion, INTRO_STEPS, FIRST_SCAN_STEPS, fetchTourProgress, markTourSeen } from './Tour';
import { EyeIcon } from './icons';

const SCANNER_PLATFORM_ORDER = ['craigslist', 'offerup', 'mercari', 'facebook'];

/** Console lines kept in the browser. Matches the server's MAX_USER_LOGS default. */
const CONSOLE_CLIENT_CAP = 500;

/**
 * Quiet period before auto-saving settings. Long enough that dragging the
 * distance slider sends one request instead of one per pixel, short enough that
 * a user who changes something and immediately hits START is already saved.
 */
const AUTOSAVE_DELAY_MS = 900;

/** Replaces the per-section SAVE buttons: says what auto-save just did. */
const SaveStatus = ({ saving, dirty, savedAt, isDark }) => {
  const [, forceTick] = useState(0);
  useEffect(() => {
    // "Saved just now" would otherwise stay frozen at its render-time value.
    const id = setInterval(() => forceTick((n) => n + 1), 15000);
    return () => clearInterval(id);
  }, []);

  let label = 'All changes saved';
  let color = isDark ? '#68D391' : '#276749';
  if (saving) {
    label = 'Saving…';
    color = isDark ? '#A0AEC0' : '#4A5568';
  } else if (dirty) {
    label = 'Unsaved changes…';
    color = isDark ? '#F6E05E' : '#744210';
  } else if (savedAt) {
    const mins = Math.floor((Date.now() - savedAt) / 60000);
    label = mins < 1 ? 'Saved just now' : `Saved ${mins}m ago`;
  }

  return (
    <span className="text-[11px] font-bold flex items-center gap-1.5" style={{ color }} aria-live="polite">
      <span
        className={saving ? 'animate-pulse' : ''}
        style={{
          width: 8, height: 8, background: color,
          display: 'inline-block', flexShrink: 0,
        }}
      />
      {label}
    </span>
  );
};

/**
 * "Found 2m ago" — how long since PixelFlip scraped this listing.
 * `nowTick` is passed in rather than read from Date.now() so React re-renders
 * when the caller's timer fires; a helper reading the clock itself would go
 * stale on screen.
 */
function timeAgo(iso, nowTick) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const secs = Math.max(0, Math.floor(((nowTick || Date.now()) - then) / 1000));
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? 'yesterday' : `${days}d ago`;
}

/** Anything scraped in the last 30 minutes is highlighted as new. */
function isFreshScrape(iso, nowTick, windowMins = 30) {
  if (!iso) return false;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return false;
  return ((nowTick || Date.now()) - then) < windowMins * 60 * 1000;
}

/** null/undefined bounds mean "unbounded", not $0 — render that honestly. */
function formatPriceRange(prices) {
  const min = prices?.min;
  const max = prices?.max;
  const hasMin = min !== null && min !== undefined && min !== '';
  const hasMax = max !== null && max !== undefined && max !== '';
  if (!hasMin && !hasMax) return 'ANY PRICE';
  if (hasMin && !hasMax) return `$${min}+`;
  if (!hasMin && hasMax) return `UP TO $${max}`;
  return `$${min} - $${max}`;
}

// Panels the user can minimise/close, and their default state.
const DASHBOARD_PANELS = [
  { id: 'settings', title: 'Scanner Settings' },
  { id: 'terms', title: 'Search Terms' },
  { id: 'alerts', title: 'Alerts' },
  { id: 'console', title: 'Live Console' },
];
const DEFAULT_PANEL_LAYOUT = {
  settings: 'open', terms: 'open', alerts: 'open', console: 'open',
};

// Scan cadence is a plan feature and applies to every platform equally —
// Facebook is no longer throttled separately. Must match the tables in
// app.py / scraper_multi_user.py; the server re-clamps on save regardless.
const PLAN_INTERVAL_OPTIONS = {
  pro: [5, 10, 15, 30, 60],
  basic: [10, 15, 30, 60],
};
const INTERVAL_OPTIONS_FOR_TIER = (tier) =>
  PLAN_INTERVAL_OPTIONS[(tier || '').toLowerCase()] || PLAN_INTERVAL_OPTIONS.basic;
const INTERVAL_FLOOR_FOR_TIER = (tier) => INTERVAL_OPTIONS_FOR_TIER(tier)[0];

const LISTINGS_PAGE_LIMIT = 24;

const TERMS_URL = process.env.REACT_APP_TERMS_URL || 'https://pixelflip.app/terms';
const PRIVACY_URL = process.env.REACT_APP_PRIVACY_URL || 'https://pixelflip.app/privacy';

const PolicyLinks = ({ isDark, className = '' }) => (
  <p className={`text-xs font-bold ${className}`} style={{ color: isDark ? '#A0AEC0' : '#718096' }}>
    <a href={TERMS_URL} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: isDark ? '#90CDF4' : '#4338CA' }}>Terms</a>
    {' · '}
    <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: isDark ? '#90CDF4' : '#4338CA' }}>Privacy</a>
  </p>
);

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

// `thin` halves the pixel border (3px -> 1.5px). Used where several buttons sit
// together — at full weight the borders dominate the content they sit beside.
const PixelButton = React.memo(({ children, onClick, disabled, color = "#667eea", textColor = "white", small = false, thin = false, className = "" }) => (
  <button
    type="button"
    onClick={onClick} disabled={disabled}
    className={`${small ? 'px-3 py-2 min-h-[40px] sm:min-h-0 sm:py-1 text-xs' : 'px-6 py-3 min-h-[44px] sm:min-h-0 text-sm'} font-bold relative transition-colors touch-manipulation ${className}`}
    style={{
      background: disabled ? '#CBD5E0' : color,
      color: textColor, border: 'none',
      boxShadow: disabled ? 'none' : (thin
        ? `0 0 0 1.5px #2D3748, 1.5px 0 0 1.5px #2D3748, -1.5px 0 0 1.5px #2D3748, 0 1.5px 0 1.5px #2D3748, 0 -1.5px 0 1.5px #2D3748, 0 3px 0 0 #2D3748, 0 3.5px 0 0 rgba(0,0,0,0.4)`
        : `0 0 0 3px #2D3748, 3px 0 0 3px #2D3748, -3px 0 0 3px #2D3748, 0 3px 0 3px #2D3748, 0 -3px 0 3px #2D3748, 0 5px 0 0 #2D3748, 0 6px 0 0 rgba(0,0,0,0.4)`),
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

const PixelInput = React.memo(({ value, onChange, placeholder, type = "text", isDark, withToggle = false }) => {
  const [show, setShow] = useState(false);
  const finalType = withToggle ? (show ? 'text' : 'password') : type;
  return (
    <div className="relative">
      <input
        type={finalType}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full p-3 text-base font-bold focus:outline-none ${withToggle ? 'pr-12' : ''}`}
        style={{
          background: isDark ? '#2D3748' : '#F7FAFC',
          color: isDark ? '#F7FAFC' : '#2D3748',
          border: 'none',
          boxShadow: `0 0 0 3px ${isDark ? '#4A5568' : '#2D3748'}, inset 3px 3px 0 0 rgba(0,0,0,0.15)`,
          imageRendering: 'pixelated'
        }}
      />
      {withToggle && (
        <button
          type="button"
          onClick={() => setShow(v => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center"
          style={{ color: isDark ? '#A3BFFA' : '#5A67D8', background: 'transparent', border: 'none', cursor: 'pointer' }}
          aria-label={show ? 'Hide password' : 'Show password'}
          title={show ? 'Hide password' : 'Show password'}
        >
          <EyeIcon off={show} />
        </button>
      )}
    </div>
  );
});

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
// SKELETON LOADING COMPONENT
// ==========================================
const SkeletonPulse = ({ className, isDark }) => (
  <div
    className={`animate-pulse ${className || ''}`}
    style={{
      background: isDark ? '#4A5568' : '#CBD5E0',
      borderRadius: '2px',
    }}
  />
);

const SkeletonListing = ({ isDark }) => (
  <div
    className="p-4 border-4"
    style={{
      background: isDark ? '#2D3748' : '#F7FAFC',
      borderColor: isDark ? '#4A5568' : '#2D3748',
    }}
  >
    <div className="flex gap-4 flex-col sm:flex-row">
      {/* Image placeholder */}
      <SkeletonPulse
        className="flex-shrink-0 mx-auto sm:mx-0 w-full sm:w-28 h-28"
        isDark={isDark}
      />
      <div className="flex-1 min-w-0 space-y-3">
        {/* Title line */}
        <SkeletonPulse className="h-6 w-3/4" isDark={isDark} />
        {/* Price line */}
        <SkeletonPulse className="h-5 w-24" isDark={isDark} />
        {/* Platform/location line */}
        <SkeletonPulse className="h-4 w-1/2" isDark={isDark} />
        {/* Time line */}
        <SkeletonPulse className="h-3 w-32" isDark={isDark} />
      </div>
    </div>
  </div>
);

// ==========================================
// ACCOUNT PAGE COMPONENT
// ==========================================
const AccountPage = ({ onBack, isDark, session, settings, onRefreshBilling, notify, confirmAction, refreshSession, onContactPhoneSaved }) => {
  const [passwords, setPasswords] = useState({ old: '', new: '', confirm: '' });
  const [emailDraft, setEmailDraft] = useState(session?.user?.email || '');
  const [emailCode, setEmailCode] = useState('');
  const [emailStep, setEmailStep] = useState('request'); // request | verify
  const [emailBusy, setEmailBusy] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [billingBusy, setBillingBusy] = useState(null); // 'portal' | 'cancel'
  const [phoneDraft, setPhoneDraft] = useState(settings?.contact_phone || '');
  const [phoneBusy, setPhoneBusy] = useState(false);

  useEffect(() => {
    setPhoneDraft(settings?.contact_phone || '');
  }, [settings?.contact_phone]);

  const renewalLabel = (() => {
    const ts = settings?.subscription_current_period_end;
    if (!ts) return null;
    try {
      return new Date(ts * 1000).toLocaleDateString(undefined, { dateStyle: 'medium' });
    } catch {
      return null;
    }
  })();

  const openBillingPortal = async () => {
    setBillingBusy('portal');
    try {
      const res = await fetch(`${API_URL}/create-portal-session`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else notify(data.message || data.error || 'Could not open billing portal.', 'error');
    } catch {
      notify('Billing portal request failed.', 'error');
    } finally {
      setBillingBusy(null);
    }
  };

  const cancelAtPeriodEnd = async () => {
    const confirmed = await confirmAction(
      'Cancel your plan at the end of the current billing period? You keep access until then.'
    );
    if (!confirmed) return;
    setBillingBusy('cancel');
    try {
      const res = await fetch(`${API_URL}/cancel-subscription`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (data.success) {
        notify('Your subscription will end after the current period.', 'success');
        if (onRefreshBilling) onRefreshBilling();
      } else {
        notify(data.error || 'Could not cancel subscription.', 'error');
      }
    } catch {
      notify('Cancel request failed.', 'error');
    } finally {
      setBillingBusy(null);
    }
  };

  const handleEmailUpdate = async () => {
    const next = emailDraft.trim().toLowerCase();
    if (!next) return notify('Please enter a valid email.', 'error');
    if (next === (session?.user?.email || '').toLowerCase()) {
      return notify('That is already your current email.', 'info');
    }
    setEmailBusy(true);
    try {
      const res = await fetch(`${API_URL}/request-email-change`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ new_email: next })
      });
      const data = await res.json();
      if (data.success) {
        setEmailStep('verify');
        notify('Verification code sent. Enter it below to confirm email change.', 'success');
      } else {
        notify(data.error || 'Email update failed.', 'error');
      }
    } catch {
      notify('Server error while updating email.', 'error');
    } finally {
      setEmailBusy(false);
    }
  };

  const verifyEmailCode = async () => {
    const next = emailDraft.trim().toLowerCase();
    const code = emailCode.trim();
    if (!code) return notify('Enter the 6-digit verification code.', 'error');
    setEmailBusy(true);
    try {
      const res = await fetch(`${API_URL}/update-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ new_email: next, code })
      });
      const data = await res.json();
      if (data.success) {
        notify('Email updated in Supabase. Please confirm from your inbox if prompted.', 'success');
        setEmailCode('');
        setEmailStep('request');
        if (refreshSession) await refreshSession();
      } else {
        notify(data.error || 'Code verification failed.', 'error');
      }
    } catch {
      notify('Server error while verifying code.', 'error');
    } finally {
      setEmailBusy(false);
    }
  };

  const handlePasswordUpdate = async () => {
    if (!passwords.old || !passwords.new) return notify("Please fill in all fields.", 'error');
    if (passwords.new !== passwords.confirm) return notify("New passwords do not match!", 'error');

    setUpdating(true);
    try {
      const res = await fetch(`${API_URL}/update-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          old_password: passwords.old,
          new_password: passwords.new
        })
      });
      const data = await res.json();
      if (data.success) {
        notify("Success! Password updated.", 'success');
        setPasswords({ old: '', new: '', confirm: '' });
      } else {
        notify(`Error: ${data.error || 'Update failed'}`, 'error');
      }
    } catch (err) {
      notify("Server error. Try again later.", 'error');
    } finally {
      setUpdating(false);
    }
  };

  const saveContactPhone = async () => {
    setPhoneBusy(true);
    try {
      const res = await fetch(`${API_URL}/account-contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ contact_phone: phoneDraft.trim() }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        notify(data.error || 'Could not save phone number.', 'error');
        return;
      }
      if (onContactPhoneSaved) onContactPhoneSaved(data.contact_phone || '');
      notify('Contact phone saved.', 'success');
    } catch {
      notify('Could not save phone number.', 'error');
    } finally {
      setPhoneBusy(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader isDark={isDark} title="Account Settings" subtitle="Billing, contact details and security">
        <PixelButton onClick={onBack} color="#718096" small>RETURN TO DASHBOARD</PixelButton>
      </PageHeader>
      <div className="mb-6"><PolicyLinks isDark={isDark} /></div>

      <PixelBox className="p-6 mb-6" color="#48BB78" isDark={isDark}>
        <h2 className="text-xl font-bold mb-4">SUBSCRIPTION PLAN</h2>
        <div className="p-4 mb-4" style={{
            background: isDark ? '#276749' : '#C6F6D5',
            border: '2px solid #2F855A'
        }}>
            <p className="font-bold text-lg" style={{ color: isDark ? '#F0FFF4' : '#1A202C' }}>
                {(settings?.plan_name || '').trim() || (settings?.plan_tier === 'basic' ? 'Basic Scanner' : settings?.plan_tier === 'pro' ? 'Pro Scanner' : 'Scanner')}
            </p>
            <p className="text-sm" style={{ color: isDark ? '#C6F6D5' : '#2D3748', opacity: 0.9 }}>
                {settings?.subscription_cancel_at_period_end
                  ? `Ends after current period${renewalLabel ? ` (${renewalLabel})` : ''}.`
                  : renewalLabel
                    ? `Active • Renews on ${renewalLabel}`
                    : 'Active • Billing date syncs from Stripe after checkout.'}
            </p>
        </div>
        <div className="flex flex-wrap gap-4">
          <PixelButton color="#48BB78" disabled={billingBusy} onClick={openBillingPortal}>
            {billingBusy === 'portal' ? 'OPENING…' : 'MANAGE BILLING'}
          </PixelButton>
          <PixelButton color="#F56565" disabled={billingBusy || settings?.subscription_cancel_at_period_end} onClick={cancelAtPeriodEnd}>
            {billingBusy === 'cancel' ? 'UPDATING…' : (settings?.subscription_cancel_at_period_end ? 'ALREADY CANCELLING' : 'CANCEL PLAN')}
          </PixelButton>
        </div>
      </PixelBox>

      <PixelBox className="p-6 mb-6" color="#667eea" isDark={isDark}>
        <h2 className="text-xl font-bold mb-4">ACCOUNT EMAIL</h2>
        <div className="space-y-4">
          <PixelInput
            placeholder="NEW EMAIL"
            type="email"
            isDark={isDark}
            value={emailDraft}
            onChange={(e) => setEmailDraft(e.target.value)}
          />
          {emailStep === 'verify' && (
            <PixelInput
              placeholder="6-DIGIT CODE"
              type="text"
              isDark={isDark}
              value={emailCode}
              onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
          )}
          <div className="flex gap-3 flex-wrap">
            <PixelButton
              color="#667eea"
              disabled={emailBusy}
              onClick={handleEmailUpdate}
            >
              {emailBusy ? 'SENDING…' : 'SEND VERIFICATION CODE'}
            </PixelButton>
            {emailStep === 'verify' && (
              <PixelButton
                color="#48BB78"
                disabled={emailBusy}
                onClick={verifyEmailCode}
              >
                {emailBusy ? 'VERIFYING…' : 'VERIFY & UPDATE EMAIL'}
              </PixelButton>
            )}
          </div>
        </div>
      </PixelBox>

      <PixelBox className="p-6 mb-6" color="#4A5568" isDark={isDark}>
        <h2 className="text-xl font-bold mb-2">CONTACT PHONE (OPTIONAL)</h2>
        <p className="text-xs font-bold mb-4" style={{ color: isDark ? '#A0AEC0' : '#718096' }}>
          Used only if you enable SMS deal alerts on the dashboard. Standard message rates may apply.
        </p>
        <PixelInput
          placeholder="+1 555 123 4567"
          type="tel"
          isDark={isDark}
          value={phoneDraft}
          onChange={(e) => setPhoneDraft(e.target.value)}
        />
        <div className="mt-4 flex gap-3 flex-wrap items-center">
          <PixelButton color="#48BB78" disabled={phoneBusy} onClick={saveContactPhone}>
            {phoneBusy ? 'SAVING…' : 'SAVE PHONE'}
          </PixelButton>
          <PolicyLinks isDark={isDark} />
        </div>
      </PixelBox>

      <PixelBox className="p-6" color="#ECC94B" isDark={isDark}>
        <h2 className="text-xl font-bold mb-4">SECURITY</h2>
        <div className="space-y-4">
          <PixelInput
            placeholder="CURRENT PASSWORD"
            type="password"
            withToggle
            isDark={isDark}
            value={passwords.old}
            onChange={(e) => setPasswords({...passwords, old: e.target.value})}
          />
          <PixelInput
            placeholder="NEW PASSWORD"
            type="password"
            withToggle
            isDark={isDark}
            value={passwords.new}
            onChange={(e) => setPasswords({...passwords, new: e.target.value})}
          />
          <PixelInput
            placeholder="CONFIRM NEW PASSWORD"
            type="password"
            withToggle
            isDark={isDark}
            value={passwords.confirm}
            onChange={(e) => setPasswords({...passwords, confirm: e.target.value})}
          />
          <PixelButton
            color="#ECC94B"
            textColor="#2D3748"
            disabled={updating}
            onClick={handlePasswordUpdate}
          >
            {updating ? 'UPDATING...' : 'UPDATE PASSWORD'}
          </PixelButton>
        </div>
      </PixelBox>
    </div>
  );
};

// ==========================================
// LIVE CONSOLE — server sends UTC `ts`; we show the viewer's local timezone
// ==========================================
const formatConsoleLogTime = (log) => {
  if (log && log.ts != null && !Number.isNaN(Number(log.ts))) {
    try {
      return new Date(Number(log.ts) * 1000).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
    } catch {
      /* fall through */
    }
  }
  return log?.time || '';
};

// ==========================================
// PRICING GATE (UNPAID USERS)
// ==========================================
const formatListingTime = (iso) => {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return null;
  }
};

const ListingsPage = ({ onBack, isDark, session, notify, confirmAction }) => {
  const [listings, setListings] = useState([]);
  const [total, setTotal] = useState(0);
  const [nextOffset, setNextOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [searchDraft, setSearchDraft] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [platFilter, setPlatFilter] = useState([]);
  // Drives the live "Found 2m ago" labels. 30s is fine — the smallest unit
  // shown is minutes, so a faster tick would just burn renders.
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const togglePlatChip = (p) => {
    setPlatFilter((prev) => {
      if (prev.includes(p)) return prev.filter((x) => x !== p);
      return [...prev, p];
    });
  };

  const fetchChunk = async (offset, append) => {
    const isMore = append === true;
    if (!isMore) setLoading(true);
    else setLoadingMore(true);
    try {
      const params = new URLSearchParams({
        limit: String(LISTINGS_PAGE_LIMIT),
        offset: String(offset),
        sort: sortBy,
      });
      if (searchQuery.trim()) params.set('q', searchQuery.trim());
      if (platFilter.length) params.set('platforms', platFilter.join(','));
      const res = await fetch(`${API_URL}/listings?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (data.error) {
        notify(data.error, 'error');
        return;
      }
      const chunk = data.listings || [];
      setTotal(data.total || 0);
      setNextOffset(offset + chunk.length);
      if (append) setListings(prev => [...prev, ...chunk]);
      else setListings(chunk);
    } catch {
      notify('Could not load listings.', 'error');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchChunk(0, false);
  }, [session.access_token, searchQuery, sortBy, platFilter.join(',')]);

  const canLoadMore = nextOffset < total;

  const applyFilters = () => {
    setSearchQuery(searchDraft.trim());
  };

  const clearFilters = () => {
    setSearchDraft('');
    setSearchQuery('');
    setSortBy('newest');
    setPlatFilter([]);
  };

  const confirmClearAll = async () => {
    const ok = await confirmAction(
      'Delete EVERY scraped listing for your account?\nThis cannot be undone.',
      { variant: 'yes_no' },
    );
    if (!ok) return;
    try {
      const res = await fetch(`${API_URL}/listings/clear-all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        notify(data.error || 'Could not clear listings.', 'error');
        return;
      }
      setListings([]);
      setTotal(0);
      setNextOffset(0);
      notify(data.deleted === 0 ? 'No listings to clear.' : `Cleared ${data.deleted} listing(s).`, 'success');
    } catch {
      notify('Could not clear listings.', 'error');
    }
  };

  const markListing = async (row) => {
    const reason = await confirmAction(
      `How should this listing be labeled?`,
      { variant: 'listing_feedback' },
    );
    if (!reason) return;
    try {
      const res = await fetch(`${API_URL}/listings/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ link: row.link, reason }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        notify(data.error || 'Could not update listing.', 'error');
        return;
      }
      setListings(prev => prev.filter(item => item.link !== row.link));
      setTotal(prev => Math.max(0, prev - 1));
      const msg = reason === 'sold'
        ? 'Listing marked sold.'
        : reason === 'false_positive'
          ? 'Listing marked false positive.'
          : reason === 'just_remove'
            ? 'Listing removed.'
            : 'Listing marked not a deal.';
      notify(msg, 'success');
    } catch {
      notify('Request failed while updating listing.', 'error');
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        isDark={isDark}
        title="Your Scraped Listings"
        subtitle={`${total} ${total === 1 ? 'match' : 'matches'} · Newest marketplace post first; undated items list last`}
      >
        <div className="flex flex-row flex-wrap gap-2 w-full md:flex-col md:gap-3 md:items-stretch md:w-auto md:min-w-[10rem]">
          <PixelButton onClick={onBack} color="#718096" small thin className="flex-1 min-w-0 md:flex-none md:w-full">
            <span className="md:hidden">BACK</span>
            <span className="hidden md:inline">BACK TO DASHBOARD</span>
          </PixelButton>
          <PixelButton onClick={() => setShowFilters(v => !v)} color="#667eea" small thin className="flex-1 min-w-0 md:flex-none md:w-full">
            <span className="md:hidden">{showFilters ? 'HIDE' : 'FILTER'}</span>
            <span className="hidden md:inline">{showFilters ? 'HIDE FILTERS' : 'FILTER'}</span>
          </PixelButton>
          <PixelButton onClick={() => confirmClearAll()} color="#F56565" small thin className="flex-1 min-w-0 md:flex-none md:w-full">CLEAR</PixelButton>
        </div>
      </PageHeader>

      {showFilters && (
        <PixelBox className="p-4 mb-5" color="#4A5568" isDark={isDark}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-bold mb-2" style={{ color: isDark ? '#A0AEC0' : '#4A5568' }}>SEARCH TERM</p>
              <PixelInput
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                placeholder="e.g. ds lite"
                isDark={isDark}
              />
            </div>
            <div>
              <p className="text-xs font-bold mb-2" style={{ color: isDark ? '#A0AEC0' : '#4A5568' }}>DATE ORDER</p>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full p-3 text-base font-bold focus:outline-none"
                style={{
                  background: isDark ? '#2D3748' : '#F7FAFC',
                  color: isDark ? '#F7FAFC' : '#2D3748',
                  border: 'none',
                  boxShadow: `0 0 0 3px ${isDark ? '#4A5568' : '#2D3748'}, inset 3px 3px 0 0 rgba(0,0,0,0.15)`,
                }}
              >
                <option value="newest">Posted date (newest)</option>
                <option value="oldest">Posted date (oldest)</option>
                <option value="saved_newest">Saved time (newest)</option>
                <option value="saved_oldest">Saved time (oldest)</option>
              </select>
            </div>
          </div>
          <div className="mt-6">
            <p className="text-xs font-bold mb-3" style={{ color: isDark ? '#A0AEC0' : '#4A5568' }}>
              PLATFORM (toggle one or more; none selected = all)
            </p>
            <div className="flex flex-wrap gap-3 px-1 py-1">
              {SCANNER_PLATFORM_ORDER.map((p) => {
                const on = platFilter.includes(p);
                return (
                  <PixelButton
                    key={p}
                    small
                    thin
                    color={on ? '#5A67D8' : '#718096'}
                    onClick={() => togglePlatChip(p)}
                    className="capitalize"
                  >
                    {p}{on ? ' ✓' : ''}
                  </PixelButton>
                );
              })}
            </div>
          </div>
          <div className="mt-4 flex gap-3 flex-wrap">
            <PixelButton small thin color="#48BB78" onClick={applyFilters}>APPLY</PixelButton>
            <PixelButton small thin color="#718096" onClick={clearFilters}>CLEAR FILTERS</PixelButton>
          </div>
        </PixelBox>
      )}

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: LISTINGS_PAGE_LIMIT }).map((_, i) => (
            <SkeletonListing key={i} isDark={isDark} />
          ))}
        </div>
      ) : listings.length === 0 ? (
        <PixelBox className="p-8 text-center" color="#ECC94B" isDark={isDark}>
          <p className="font-bold">No listings saved yet. Start the scanner to capture matches.</p>
        </PixelBox>
      ) : (
        /* Mobile density: the card stays a row instead of stacking, because a
           full-width image plus stacked text fit barely two listings on a
           phone. Every `sm:` value below is the previous desktop value — the
           desktop card is unchanged; only the sub-640px layout tightens, to
           roughly six cards per screen. */
        <div className="space-y-2 sm:space-y-4">
          {listings.map((row, i) => (
            <PixelBox key={`${row.link}-${i}`} className="p-2.5 sm:p-4" color="#4A5568" isDark={isDark}>
              <div className="flex gap-3 sm:gap-4">
                <div
                  className="flex-shrink-0 w-20 h-20 sm:w-28 sm:h-28 overflow-hidden border-2 sm:border-4"
                  style={{ borderColor: isDark ? '#4A5568' : '#2D3748', background: isDark ? '#2D3748' : '#E2E8F0' }}
                >
                  {row.image_url ? (
                    <img
                      src={row.image_url}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover"
                      referrerPolicy="strict-origin-when-cross-origin"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[10px] sm:text-xs font-bold px-1 text-center" style={{ color: isDark ? '#718096' : '#4A5568' }}>NO IMAGE</div>
                  )}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-start justify-between gap-2 sm:gap-3">
                  <a
                    href={row.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-sm sm:text-lg leading-snug hover:underline break-words block line-clamp-2 sm:line-clamp-none"
                    style={{ color: isDark ? '#7F9CF5' : '#4338CA' }}
                  >
                    {row.title}
                  </a>
                    <button
                      onClick={() => markListing(row)}
                      className="bg-red-500 text-white w-6 h-6 sm:w-8 sm:h-8 text-xs sm:text-base leading-none font-bold flex-shrink-0"
                      title="Mark sold / not a deal"
                    >
                      ✕
                    </button>
                  </div>
                  {/* Price and platform/location share a line on mobile and
                      stack from sm up, which is how the desktop card read. */}
                  <div className="flex flex-wrap items-baseline gap-x-2 mt-0.5 sm:block sm:mt-2">
                    <p className="font-bold text-base sm:text-xl" style={{ color: isDark ? '#68D391' : '#38A169' }}>
                      {typeof row.price === 'number' ? `$${row.price}` : row.price}
                    </p>
                    <p className="text-xs sm:text-sm sm:mt-1 font-bold min-w-0 truncate sm:whitespace-normal" style={{ color: isDark ? '#A0AEC0' : '#718096' }}>
                      {[row.platform, row.location].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 sm:gap-x-3 gap-y-0.5 sm:gap-y-1 mt-1 sm:mt-2">
                    {row.listed_at && formatListingTime(row.listed_at) && (
                      <p className="text-[10px] sm:text-xs font-bold" style={{ color: isDark ? '#718096' : '#4A5568' }}>
                        Posted: {formatListingTime(row.listed_at)}
                      </p>
                    )}
                    {row.created_at && (
                      /* When PixelFlip found it. `nowTick` re-renders this every
                         30s so "2m ago" keeps counting up without a refresh —
                         it's how a user tells a brand-new hit from an old one. */
                      <p
                        className="text-[10px] sm:text-xs font-bold px-1.5 py-0.5"
                        style={isFreshScrape(row.created_at, nowTick)
                          ? { color: isDark ? '#68D391' : '#276749',
                              background: isDark ? '#22543D' : '#C6F6D5' }
                          : { color: isDark ? '#718096' : '#A0AEC0' }}
                      >
                        {isFreshScrape(row.created_at, nowTick) ? '● ' : ''}
                        Found {timeAgo(row.created_at, nowTick)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </PixelBox>
          ))}
          {canLoadMore && (
            <div className="text-center pt-2">
              <PixelButton
                color="#667eea"
                disabled={loadingMore}
                onClick={() => fetchChunk(nextOffset, true)}
              >
                {loadingMore ? 'LOADING…' : 'LOAD MORE'}
              </PixelButton>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const PricingGate = ({ onLogout, isDark, onStartCheckout, checkoutLoading, billingConfig }) => {
  const b = billingConfig || {};
  const prebeta = Boolean(b.prebeta_active);
  const basicShow = Number(b.price_basic_prebeta != null ? b.price_basic_prebeta : 4.99);
  const proShow = Number(b.price_pro_prebeta != null ? b.price_pro_prebeta : 9.99);
  const basicStd = Number(b.price_basic_standard != null ? b.price_basic_standard : 9.99);
  const proStd = Number(b.price_pro_standard != null ? b.price_pro_standard : 19.99);
  const fmt = (n) => (Number.isFinite(n) ? n : 0).toFixed(2);
  return (
  <div className="min-h-screen overflow-x-hidden p-3 sm:p-4 md:p-8 flex items-center justify-center transition-colors duration-300" style={{ background: isDark ? 'linear-gradient(135deg, #2D3748 0%, #1A202C 100%)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', fontFamily: 'monospace', WebkitTapHighlightColor: 'transparent' }}>
    <PixelBox className="max-w-4xl w-full p-8 text-center" color="#5A67D8" isDark={isDark}>
      <h1 className="text-3xl md:text-5xl font-bold mb-4">PIXELFLIP SCANNER</h1>
      <p className="text-lg mb-2" style={{ color: isDark ? '#A0AEC0' : '#718096' }}>Your account is currently inactive. Subscribe to start scanning marketplaces.</p>
      {prebeta && (
        <p className="text-sm font-bold mb-8" style={{ color: isDark ? '#F6E05E' : '#744210' }}>Pre-beta pricing — half off until pre-beta ends.</p>
      )}
      {!prebeta && <div className="mb-8" />}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 text-left">
        <div className="p-6 border-4 border-gray-500 relative" style={{ background: isDark ? '#2D3748' : '#F7FAFC' }}>
          <h2 className="text-xl font-bold mb-2">BASIC SCANNER</h2>
          {prebeta ? (
            <p className="text-3xl font-bold mb-1" style={{ color: isDark ? '#E2E8F0' : '#2D3748' }}>
              ${fmt(basicShow)}<span className="text-sm" style={{ color: isDark ? '#A0AEC0' : '#718096' }}>/mo</span>
            </p>
          ) : null}
          <p className={`text-3xl font-bold mb-4 ${prebeta ? 'text-lg line-through opacity-70' : ''}`} style={{ color: isDark ? '#A0AEC0' : '#4A5568' }}>
            ${fmt(basicStd)}<span className="text-sm">/mo</span>
          </p>
          <ul className="space-y-2 mb-6 text-sm font-bold" style={{ color: isDark ? '#E2E8F0' : '#4A5568' }}>
            <li>✓ Scans every 10 minutes (Craigslist, OfferUp, Mercari)</li>
            <li>✓ Up to 3 search terms</li>
            <li>✓ Configurable check interval</li>
          </ul>
          <PixelButton onClick={() => onStartCheckout('basic')} disabled={checkoutLoading} color="#48BB78" className="w-full">
            {checkoutLoading ? 'REDIRECTING…' : 'SUBSCRIBE'}
          </PixelButton>
        </div>

        <div className="p-6 border-4 border-indigo-500 relative transform md:-translate-y-4 shadow-xl" style={{ background: isDark ? '#2B6CB0' : '#EBF4FF' }}>
          <div className="absolute top-0 right-0 bg-indigo-500 text-white text-xs font-bold px-2 py-1 transform translate-x-2 -translate-y-2 border-2 border-gray-900">RECOMMENDED</div>
          <h2 className="text-xl font-bold mb-2" style={{ color: isDark ? '#E2E8F0' : '#434190' }}>PRO SCANNER</h2>
          {prebeta ? (
            <p className="text-3xl font-bold mb-1" style={{ color: isDark ? '#F7FAFC' : '#312E81' }}>
              ${fmt(proShow)}<span className="text-sm" style={{ color: isDark ? '#A3BFFA' : '#5A67D8' }}>/mo</span>
            </p>
          ) : null}
          <p className={`text-3xl font-bold mb-4 ${prebeta ? 'text-lg line-through opacity-80' : ''}`} style={{ color: isDark ? '#A3BFFA' : '#5A67D8' }}>
            ${fmt(proStd)}<span className="text-sm">/mo</span>
          </p>
          <ul className="space-y-2 mb-6 text-sm font-bold" style={{ color: isDark ? '#E2E8F0' : '#3730A3' }}>
            <li>✓ All platforms (Craigslist, OfferUp, Mercari, Facebook — 30+ min checks)</li>
            <li>✓ Up to 10 search terms</li>
            <li>✓ Configurable check interval</li>
            <li>✓ Optional AI image filtering</li>
          </ul>
          <PixelButton onClick={() => onStartCheckout('pro')} disabled={checkoutLoading} color="#48BB78" className="w-full">
            {checkoutLoading ? 'REDIRECTING…' : 'SUBSCRIBE'}
          </PixelButton>
        </div>
      </div>

      <div className="mt-8 mb-4 text-center">
        <PolicyLinks isDark={isDark} />
        <p className="text-xs font-bold mt-2" style={{ color: isDark ? '#718096' : '#4A5568' }}>
          Subscribing confirms you have read our terms and privacy policy.
        </p>
      </div>
      <button type="button" onClick={onLogout} className="text-sm font-bold hover:underline mt-4" style={{ color: isDark ? '#A0AEC0' : '#718096' }}>
        LOG OUT & RETURN
      </button>
    </PixelBox>
  </div>
  );
};

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
  const [status, setStatus] = useState({ running: false, status: 'stopped', listings_count: 0, items_scanned_today: 0, matches_found_today: 0, recent_activity: [], scraping_in_progress: false });
  // Newest console `ts` we hold, sent back as the `since` cursor. A ref, not
  // state, so updating it never triggers a render of its own.
  const logCursorRef = useRef(null);
  const [settings, setSettings] = useState({
    platforms: { craigslist: true, offerup: true, mercari: true, facebook: false },
    zip_code: '95212',
    distance: 25,
    check_interval: 10,
    thresholds: {},
    ai_detection: false,
    strictness: 2,
    subscription_status: 'checking',
    plan_tier: 'inactive',
    plan_name: null,
    max_search_terms: 999,
    ai_image_allowed: false,
    notifications: { email: true, sms: false, push: false },
    contact_phone: '',
    buyer_include_local: true,
    buyer_include_shipping: true,
  });
  const [billingConfig, setBillingConfig] = useState(null);
  const [newSearch, setNewSearch] = useState({ term: '', maxPrice: '', minPrice: '' });

  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') === 'dark');
  const [pushState, setPushState] = useState({ supported: true, subscribed: false, permission: 'default' });
  const [pushBusy, setPushBusy] = useState(false);
  const [tourSeen, setTourSeen] = useState(null);      // null = not loaded yet
  const [activeTour, setActiveTour] = useState(null);  // 'intro' | 'first_scan'
  const { layout: panelLayout, setState: setPanelState } = usePanelLayout(DEFAULT_PANEL_LAYOUT);
  const [currentView, setCurrentView] = useState('dashboard');
  const [showDropdown, setShowDropdown] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [targetTimestamp, setTargetTimestamp] = useState(null);
  const [scraperAction, setScraperAction] = useState(null); // 'starting' | 'stopping' | null
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSavedAt, setSettingsSavedAt] = useState(null);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [popup, setPopup] = useState(null); // { message, type }
  const [confirmState, setConfirmState] = useState(null); // { message, resolver, variant }

  const [consoleHideMaxTs, setConsoleHideMaxTs] = useState(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('pixelflip_console_hide_ts_v1');
      if (raw && !Number.isNaN(Number(raw))) setConsoleHideMaxTs(Number(raw));
    } catch {
      /* ignore */
    }
  }, [session.access_token]);

  useEffect(() => {
    try {
      if (consoleHideMaxTs != null) sessionStorage.setItem('pixelflip_console_hide_ts_v1', String(consoleHideMaxTs));
      else sessionStorage.removeItem('pixelflip_console_hide_ts_v1');
    } catch {
      /* ignore */
    }
  }, [consoleHideMaxTs]);

  const visibleRecentActivity = useMemo(() => {
    const arr = status.recent_activity || [];
    if (consoleHideMaxTs == null) return arr;
    return arr.filter((l) => Number(l.ts) > consoleHideMaxTs);
  }, [status.recent_activity, consoleHideMaxTs]);

  const clearLiveConsoleOnly = useCallback(() => {
    const arr = status.recent_activity || [];
    const baseline = Number(consoleHideMaxTs) || 0;
    const m = arr.reduce((acc, l) => Math.max(acc, Number(l.ts) || 0), baseline);
    setConsoleHideMaxTs(m);
  }, [status.recent_activity, consoleHideMaxTs]);

  const toggleBuyerDeliveryBox = useCallback((box) => {
    setSettings((prev) => {
      let loc = !!prev.buyer_include_local;
      let ship = !!prev.buyer_include_shipping;
      if (box === 'local') loc = !loc;
      else ship = !ship;
      if (!loc && !ship) {
        if (box === 'local') ship = true;
        else loc = true;
      }
      return { ...prev, buyer_include_local: loc, buyer_include_shipping: ship };
    });
  }, []);

  const notify = (message, type = 'info') => {
    setPopup({ message, type });
    setTimeout(() => setPopup(null), 3000);
  };

  /**
   * Serialized snapshot of what the server last confirmed.
   *
   * Auto-save diffs against this, which is what stops the obvious failure mode:
   * saveSettings() merges the server's echo back into `settings`, that counts as
   * a change, which would schedule another save — an endless request loop rather
   * than a harmless no-op. Anything server-originated updates this ref, so only
   * genuine user edits ever look dirty. `null` means "not hydrated yet", which
   * also stops the initial load from saving itself straight back.
   */
  const lastSavedRef = useRef(null);
  const autoSaveTimerRef = useRef(null);

  const savablePayload = useCallback((s) => {
    // Mirrors what saveSettings actually sends, so the comparison can't drift.
    const { contact_phone: _cp, ...rest } = s || {};
    return JSON.stringify(rest);
  }, []);

  const mergeSettingsResponse = useCallback((data) => {
    setSettings((prev) => {
      const next = {
        ...prev,
        ...data,
        buyer_include_local: data.buyer_include_local ?? prev.buyer_include_local ?? true,
        buyer_include_shipping: data.buyer_include_shipping ?? prev.buyer_include_shipping ?? true,
      };
      // Ref write inside the updater is deliberate: it needs `prev` to build the
      // exact object being stored. Idempotent, so a StrictMode double-invoke is
      // harmless.
      lastSavedRef.current = savablePayload(next);
      return next;
    });
  }, [savablePayload]);

  // Theme Toggle Effect
  useEffect(() => {
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    document.body.style.backgroundColor = isDark ? '#1A202C' : '#E2E8F0';
  }, [isDark]);

  useEffect(() => {
    fetch(`${API_URL}/billing/config`)
      .then((res) => res.json())
      .then(setBillingConfig)
      .catch(() => setBillingConfig({}));
  }, []);

  // Load Settings
  useEffect(() => {
    const authHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` };
    fetch(`${API_URL}/settings`, { headers: authHeaders })
      .then(res => res.json())
      .then(mergeSettingsResponse)
      .catch(err => console.error(err));
  }, [session.access_token, mergeSettingsResponse]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') === 'canceled') {
      window.history.replaceState({}, document.title, window.location.pathname);
      notify('Checkout was canceled — no charges were made.', 'info');
      return;
    }
    if (params.get('checkout') !== 'success') return;

    const sessionId = params.get('session_id');
    const authHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` };

    const reloadSettings = () => {
      window.history.replaceState({}, document.title, window.location.pathname);
      fetch(`${API_URL}/settings`, { headers: authHeaders })
        .then(res => res.json())
        .then(mergeSettingsResponse)
        .catch(err => console.error(err));
    };

    if (sessionId) {
      fetch(`${API_URL}/complete-checkout`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ session_id: sessionId }),
      })
        .then(res => res.json())
        .then(data => {
          if (data.error) console.error('complete-checkout:', data.error);
          reloadSettings();
        })
        .catch(err => {
          console.error(err);
          reloadSettings();
        });
    } else {
      reloadSettings();
    }
  }, [session.access_token, mergeSettingsResponse]);

  // Poll Status & Sync Clock
  useEffect(() => {
    const authHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` };
    const poll = () => {
      // Ask only for console lines newer than what we already hold. The server
      // buffer runs to hundreds of entries and this polls every 2s, so sending
      // the whole thing each time would be pure waste. No cursor yet (first
      // poll, or after a reload) means "send the full snapshot".
      const since = logCursorRef.current;
      const url = since != null
        ? `${API_URL}/status?since=${encodeURIComponent(since)}`
        : `${API_URL}/status`;
      fetch(url, { headers: authHeaders })
        .then(async (res) => {
          if (res.status === 401) {
            notify('Your session expired. Please log in again.', 'error');
            await supabase.auth.signOut();
            return { error: 'unauthorized' };
          }
          return res.json();
        })
        .then(data => {
          if (!data || data.error) return;

          const incoming = data.recent_activity || [];
          if (incoming.length) {
            logCursorRef.current = incoming.reduce(
              (max, l) => Math.max(max, Number(l.ts) || 0),
              logCursorRef.current || 0,
            );
          }
          setStatus(prev => {
            const merged = data.activity_partial
              ? [...(prev.recent_activity || []), ...incoming]
              : incoming;
            return {
              ...prev,
              ...data,
              // Spreading `data` would otherwise replace the whole console with
              // whatever delta just arrived.
              recent_activity: merged.length > CONSOLE_CLIENT_CAP
                ? merged.slice(-CONSOLE_CLIENT_CAP)
                : merged,
            };
          });

          if (!data.running) {
            setTargetTimestamp(null);
          } else if (data.scraping_in_progress) {
            setTargetTimestamp(null);
          } else if (data.next_check_timestamp) {
            setTargetTimestamp(data.next_check_timestamp);
          } else {
            setTargetTimestamp(null);
          }
        })
        .catch((err) => console.error('status poll failed (network/CORS/backend):', err));
    };
    poll();
    const interval = setInterval(poll, 2000);
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
      const saved = await saveSettings(true);
      if (!saved) {
        notify('Could not save settings before start. Please try again.', 'error');
        return;
      }
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

  const saveSettings = async (silent = false) => {
    const authHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` };
    setSettingsSaving(true);
    try {
      const { contact_phone: _cp, ...settingsForSave } = settings;
      const res = await fetch(`${API_URL}/settings`, { method: 'POST', headers: authHeaders, body: JSON.stringify(settingsForSave) });
      const data = await res.json();
      if (!res.ok || data.error) {
        if (!silent) notify(data.error || "Could not save settings.", 'error');
        return false;
      }
      if (data.settings) {
        setSettings((prev) => {
          const next = { ...prev, ...data.settings };
          lastSavedRef.current = savablePayload(next);
          return next;
        });
      } else {
        // No echo returned: still mark clean, or auto-save retries forever.
        lastSavedRef.current = savablePayload(settingsForSave);
      }
      setSettingsSavedAt(Date.now());
      if (!silent) notify("Settings saved.", 'success');
      return true;
    } catch {
      if (!silent) notify("Could not save settings.", 'error');
      return false;
    } finally {
      setSettingsSaving(false);
    }
  };

  /**
   * Auto-save. Replaces the per-section SAVE buttons.
   *
   * Deliberately one debounced writer for the whole `settings` object rather
   * than per-section savers: /api/settings already takes the entire object, so
   * three savers would race and the last one would clobber the other two.
   *
   * Debounced rather than saved-per-keystroke because a distance slider fires
   * a change per pixel — that would be a request storm. AUTOSAVE_DELAY_MS after
   * the user stops, one request goes out.
   *
   * Placed after saveSettings so the dependency array is not evaluated while
   * that const is still in its temporal dead zone.
   */
  useEffect(() => {
    // Not hydrated yet — saving now would echo the defaults over real settings.
    if (lastSavedRef.current === null) return;

    const dirty = savablePayload(settings) !== lastSavedRef.current;
    setSettingsDirty(dirty);
    if (!dirty) return;

    clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      // silent: a toast on every slider nudge would be worse than no feedback.
      // The inline status line carries it instead.
      saveSettings(true).then((ok) => {
        if (!ok) notify('Could not save your changes. Check your connection.', 'error');
      });
    }, AUTOSAVE_DELAY_MS);

    return () => clearTimeout(autoSaveTimerRef.current);
    // saveSettings is intentionally omitted: it is redefined every render, and
    // depending on it would reschedule the timer on every render instead of
    // only when the settings actually change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, savablePayload]);

  const addSearchTerm = () => {
    const cap = settings.max_search_terms != null ? Number(settings.max_search_terms) : 999;
    const n = Object.keys(settings.thresholds || {}).length;
    if (n >= cap) {
      notify(`Your plan allows up to ${cap} search term${cap === 1 ? '' : 's'}.`, 'error');
      return;
    }
    const term = newSearch.term.trim().toLowerCase();
    if (!term) {
      notify('Enter a search term.', 'error');
      return;
    }
    // Prices are optional — an empty bound means "any price", so a user can
    // track something without inventing a ceiling just to save the term.
    const parseBound = (v) => {
      const n = parseInt(v, 10);
      return Number.isNaN(n) ? null : n;
    };
    const max = parseBound(newSearch.maxPrice);
    const min = parseBound(newSearch.minPrice);
    if (max !== null && min !== null && min > max) {
      notify('Minimum price cannot be higher than maximum.', 'error');
      return;
    }
    setSettings(prev => ({
      ...prev,
      thresholds: { ...prev.thresholds, [term]: { max, min, exclusions: [] } },
    }));
    setNewSearch({ term: '', maxPrice: '', minPrice: '' });
  };

  /** Per-term exclusion keywords (replaces the old global exclusions panel). */
  // Reflect the real browser subscription state, so the toggle can't claim
  // push is on when the browser says otherwise.
  useEffect(() => {
    let alive = true;
    getPushState().then((st) => { if (alive) setPushState(st); });
    return () => { alive = false; };
  }, []);

  // --- Flip's tour -------------------------------------------------------
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: { session: sess } } = await supabase.auth.getSession();
      if (!sess?.access_token) return;
      const seen = await fetchTourProgress(sess.access_token);
      if (alive) setTourSeen(seen);
    })();
    return () => { alive = false; };
  }, []);

  // Start the intro only once the dashboard is actually on screen and settings
  // have loaded — the tour measures real panels, so running it early would
  // highlight elements that haven't rendered or are still empty.
  useEffect(() => {
    if (tourSeen === null || activeTour) return;
    if (settings.subscription_status === 'checking') return;
    if (currentView !== 'dashboard') return;
    if (!tourSeen.intro) {
      const t = setTimeout(() => setActiveTour('intro'), 600);
      return () => clearTimeout(t);
    }
  }, [tourSeen, activeTour, settings.subscription_status, currentView]);

  // Flip returns after a scrape FINISHES, so the console and countdown he
  // explains have real content.
  //
  // This watches for the falling edge of scraping_in_progress rather than
  // "has ever scraped": an existing account already has a non-zero
  // last_scrape_duration_ms, so a value check fired the instant the intro
  // ended instead of waiting for a scan.
  const wasScrapingRef = useRef(false);
  useEffect(() => {
    const scraping = !!status.scraping_in_progress;
    const justFinished = wasScrapingRef.current && !scraping;
    wasScrapingRef.current = scraping;

    if (!justFinished) return;
    if (tourSeen === null || activeTour) return;
    if (!tourSeen.intro || tourSeen.first_scan) return;
    if (currentView !== 'dashboard') return;
    setActiveTour('first_scan');
  }, [status.scraping_in_progress, tourSeen, activeTour, currentView]);

  // 'replay' covers both sections in one pass, so finishing it records both.
  const finishTour = async (section) => {
    setActiveTour(null);
    const sections = section === 'replay' ? ['intro', 'first_scan'] : [section];
    setTourSeen((prev) => {
      const next = { ...(prev || {}) };
      sections.forEach((s) => { next[s] = true; });
      return next;
    });
    const { data: { session: sess } } = await supabase.auth.getSession();
    if (sess?.access_token) {
      for (const s of sections) await markTourSeen(sess.access_token, s);
    }
  };

  // Replay shows the WHOLE tour — including the console and countdown steps
  // that normally wait for a real scrape. Someone asking to see it again
  // wants the full walkthrough, not the part that happens to be unlocked.
  const replayTour = async () => {
    setShowDropdown(false);
    setCurrentView('dashboard');
    setActiveTour('replay');
  };

  const togglePush = async () => {
    setPushBusy(true);
    try {
      const { data: { session: sess } } = await supabase.auth.getSession();
      const token = sess?.access_token;
      if (!token) { notify('Session expired — sign in again.', 'error'); return; }

      if (pushState.subscribed) {
        const res = await disablePush(token);
        if (!res.ok) notify(res.error, 'error');
        else notify('Push notifications turned off.', 'success');
      } else {
        const res = await enablePush(token);
        if (!res.ok) { notify(res.error, 'error'); return; }
        notify('Push notifications enabled.', 'success');
        setSettings((prev) => ({
          ...prev,
          notifications: { ...(prev.notifications || {}), push: true },
        }));
      }
      setPushState(await getPushState());
    } finally {
      setPushBusy(false);
    }
  };

  const testPush = async () => {
    setPushBusy(true);
    try {
      const { data: { session: sess } } = await supabase.auth.getSession();
      const res = await sendTestPush(sess?.access_token);
      notify(res.ok ? 'Test notification sent — check your device.' : res.error, res.ok ? 'success' : 'error');
    } finally {
      setPushBusy(false);
    }
  };

  const addTermExclusion = (term, rawWord) => {
    const word = (rawWord || '').trim().toLowerCase();
    if (!word) return;
    setSettings(prev => {
      const t = prev.thresholds?.[term] || {};
      const current = t.exclusions || [];
      if (current.includes(word)) return prev;
      return {
        ...prev,
        thresholds: { ...prev.thresholds, [term]: { ...t, exclusions: [...current, word] } },
      };
    });
  };

  const removeTermExclusion = (term, word) => {
    setSettings(prev => {
      const t = prev.thresholds?.[term] || {};
      return {
        ...prev,
        thresholds: {
          ...prev.thresholds,
          [term]: { ...t, exclusions: (t.exclusions || []).filter(w => w !== word) },
        },
      };
    });
  };

  const removeSearchTerm = (term) => {
    setSettings(prev => {
      const copy = { ...prev.thresholds };
      delete copy[term];
      return { ...prev, thresholds: copy };
    });
  };

  const formatTime = (totalSeconds) => {
    if (totalSeconds <= 0) return "0:00"; // Instead of scanning...
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const confirmAction = (message, opts = {}) => {
    return new Promise((resolve) => {
      const variant = opts.variant
        || (opts.dualAction ? 'listing_feedback' : opts.promptYesNo ? 'yes_no' : 'simple');
      setConfirmState({
        message,
        resolver: resolve,
        variant,
      });
    });
  };

  /**
   * Logging out does NOT stop the scraper — it keeps running server-side.
   * That surprises people (and burns their scan quota), so warn here rather
   * than burying it in the tour, where it isn't actionable.
   */
  const confirmLogout = async () => {
    setShowDropdown(false);
    if (status.running) {
      const ok = await confirmAction(
        'Your scanner is still running and will keep scanning after you log out. '
        + 'Press Stop first if you want it to pause.',
      );
      if (!ok) return;
    }
    supabase.auth.signOut();
  };

  const closeConfirm = (value) => {
    if (!confirmState) return;
    confirmState.resolver(value);
    setConfirmState(null);
  };

  const refreshBilling = () => {
    const authHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` };
    fetch(`${API_URL}/settings`, { headers: authHeaders })
      .then(res => res.json())
      .then(data => setSettings(data))
      .catch(err => console.error(err));
  };

  const startStripeCheckout = async (plan = 'pro') => {
    setCheckoutLoading(true);
    try {
      const res = await fetch(`${API_URL}/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ plan }),
      });
      if (res.status === 401) {
        notify('Auth expired. Please log in again before checkout.', 'error');
        await supabase.auth.signOut();
        return;
      }
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else notify(data.error || 'Checkout could not start. Check Stripe env vars/server logs.', 'error');
    } catch {
      notify('Checkout request failed.', 'error');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const refreshSession = async () => {
    try {
      await supabase.auth.refreshSession();
    } catch {
      // no-op; settings fetch still reflects backend truth
    }
  };

  // 1. If we are still asking the database for their status, show a loading screen!
  if (settings.subscription_status === 'checking') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 transition-colors duration-300" style={{ background: isDark ? '#1A202C' : '#667eea' }}>
        {/* The animated mark carries the "working" signal on its own, so the
            label can drop to a quiet caption instead of a pulsing headline. */}
        <img
          src="/logo.gif"
          alt=""
          width={160}
          height={160}
          style={{ width: 160, height: 160, imageRendering: 'pixelated' }}
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
        <div className="text-white text-sm font-bold font-mono tracking-widest opacity-80">
          VERIFYING CLEARANCE
        </div>
      </div>
    );
  }

  // 2. If they are officially inactive, lock the gate!
  if (settings.subscription_status !== 'active') {
    return <PricingGate
      onLogout={() => supabase.auth.signOut()}
      isDark={isDark}
      onStartCheckout={startStripeCheckout}
      checkoutLoading={checkoutLoading}
      billingConfig={billingConfig}
    />;
  }

  return (
    <div className="min-h-screen overflow-x-hidden p-3 sm:p-4 md:p-8 transition-colors duration-300 pf-has-taskbar" style={{ background: isDark ? 'linear-gradient(135deg, #2D3748 0%, #1A202C 100%)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', fontFamily: 'monospace', WebkitTapHighlightColor: 'transparent' }}>

      {currentView === 'account' ? (
        <AccountPage
          onBack={() => setCurrentView('dashboard')}
          isDark={isDark}
          session={session}
          settings={settings}
          onRefreshBilling={refreshBilling}
          notify={notify}
          confirmAction={confirmAction}
          refreshSession={refreshSession}
          onContactPhoneSaved={(phone) => setSettings((prev) => ({ ...prev, contact_phone: phone || '' }))}
        />
      ) : currentView === 'listings' ? (
        <ListingsPage
          onBack={() => setCurrentView('dashboard')}
          isDark={isDark}
          session={session}
          notify={notify}
          confirmAction={confirmAction}
        />
      ) : (
        <div className="max-w-7xl mx-auto">

          {/* Header — a single slim bar. The old version gave a 5xl wordmark
              its own block and left the middle empty; identity doesn't need
              that much room once the stat strip carries the status. */}
          <PixelBox className="px-4 py-3 mb-4 flex items-center gap-4" color="#5A67D8" isDark={isDark}>
            {/* Drop a circular logo at frontend/public/logo.png to replace the
                wordmark. onError falls back to text so a missing file never
                leaves an empty header. */}
            <img
              src="/logo.png"
              alt="PixelFlip"
              width={60}
              height={60}
              className="shrink-0"
              style={{ borderRadius: '50%', display: 'block' }}
              onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'block'; }}
            />
            <span
              className="text-xl font-bold shrink-0"
              style={{ display: 'none', letterSpacing: '-0.5px' }}
            >
              PIXELFLIP
            </span>

            {/* Middle: the live state, which is what people actually look for */}
            <div className="flex items-center gap-3 min-w-0 flex-1 justify-center">
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{
                  background: status.running ? '#48BB78' : '#F56565',
                  boxShadow: status.running ? '0 0 10px #48BB78' : 'none',
                }}
              />
              <span className="text-sm font-bold whitespace-nowrap">
                {status.running
                  ? (status.scraping_in_progress || timerSeconds === 0
                      ? 'SCANNING…'
                      : `NEXT SCAN ${formatTime(timerSeconds)}`)
                  : 'STOPPED'}
              </span>
              <span
                className="text-xs truncate hidden lg:block"
                style={{ color: isDark ? '#A0AEC0' : '#718096' }}
              >
                · {session.user.email}
              </span>
            </div>

            <div className="flex items-center gap-2 relative shrink-0">

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
                  <button onClick={() => { setCurrentView('listings'); setShowDropdown(false); }} className={`w-full text-left p-2 font-bold hover:bg-gray-200 ${isDark ? 'hover:text-black' : ''}`}>MY LISTINGS</button>
                  <button onClick={() => { setCurrentView('account'); setShowDropdown(false); }} className={`w-full text-left p-2 font-bold hover:bg-gray-200 ${isDark ? 'hover:text-black' : ''}`}>ACCOUNT</button>
                  <button onClick={() => { setIsDark(!isDark); setShowDropdown(false); }} className={`w-full text-left p-2 font-bold hover:bg-gray-200 ${isDark ? 'hover:text-black' : ''}`}>{isDark ? 'LIGHT MODE' : 'DARK MODE'}</button>
                  <button onClick={replayTour} className={`w-full text-left p-2 font-bold hover:bg-gray-200 ${isDark ? 'hover:text-black' : ''}`}>REPLAY TOUR</button>
                  <button onClick={confirmLogout} className="w-full text-left p-2 font-bold text-red-500 hover:bg-red-100">LOGOUT</button>
                </div>
              )}
            </div>
          </PixelBox>

          {/* One-glance status: answers "what's happening" before any panel is read */}
          <StatStrip
            isDark={isDark}
            stats={[
              {
                k: 'NEW TODAY',
                v: status.listings_count ?? 0,
                color: isDark ? '#68D391' : '#38A169',
              },
              {
                k: 'TRACKING',
                v: Object.keys(settings.thresholds || {}).length,
                sub: 'terms',
              },
              {
                k: 'PLATFORMS',
                v: SCANNER_PLATFORM_ORDER.filter((p) => (settings.platforms || {})[p]).length,
                sub: 'active',
              },
              {
                k: 'PLAN',
                v: (settings.plan_tier || 'basic').toUpperCase(),
                sub: `${settings.check_interval || 10} min`,
                color: isDark ? '#B794F4' : '#764ba2',
              },
            ]}
          />

          {/* Controls & Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6" data-tour="controls">
            <PixelBox className="p-6 flex flex-col justify-center gap-4" color="#5A67D8" isDark={isDark}>
              <PixelButton
                onClick={startScraper}
                disabled={settingsSaving || status.running || scraperAction === 'starting' || scraperAction === 'stopping'}
                color="#48BB78"
              >
                {settingsSaving ? '… SAVING' : (scraperAction === 'starting' ? '… STARTING' : '▶ START')}
              </PixelButton>
              <PixelButton
                onClick={stopScraper}
                disabled={!status.running || scraperAction === 'starting' || scraperAction === 'stopping'}
                color="#F56565"
              >
                {scraperAction === 'stopping' ? '… STOPPING' : '■ STOP'}
              </PixelButton>
              {(settingsSaving || scraperAction === 'starting' || scraperAction === 'stopping') && (
                <div className="text-xs font-bold animate-pulse" style={{ color: isDark ? '#A0AEC0' : '#E2E8F0' }}>
                  {settingsSaving ? 'SAVING SETTINGS…' : 'UPDATING SCRAPER STATE…'}
                </div>
              )}
            </PixelBox>

            <PixelBox className="p-6 text-center flex flex-col justify-center" color="#667eea" isDark={isDark}>
              <div className="text-sm font-bold mb-2" style={{ color: isDark ? '#A3BFFA' : '#5A67D8' }}>
                {status.running && (status.scraping_in_progress || timerSeconds === 0) ? 'SYSTEM STATUS' : 'NEXT CHECK IN'}
              </div>
              <div className={`font-bold ${status.running && (status.scraping_in_progress || timerSeconds === 0) ? 'text-3xl animate-pulse mt-2' : 'text-5xl'}`} style={{ color: isDark ? '#7F9CF5' : '#667eea' }}>
                {!status.running ? '--:--' : (status.scraping_in_progress ? 'SCRAPING...' : (timerSeconds === 0 ? 'SCANNING...' : formatTime(timerSeconds)))}
              </div>
              <div className="text-xs mt-3 font-bold" style={{ color: isDark ? '#A3BFFA' : '#5A67D8' }}>
                LAST SCRAPE SPEED: {Math.max(0, Math.round((status.last_scrape_duration_ms || 0) / 100) / 10)}s
              </div>
              <PixelButton color="#2F855A" small thin className="w-full max-w-xs mx-auto mt-4" onClick={() => setCurrentView('listings')}>
                VIEW ALL LISTINGS
              </PixelButton>
            </PixelBox>

          </div>

          {/* Settings Grid (4 Columns) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6 items-stretch">

            {/* 1. Search Terms */}
            <Panel
              id="terms"
              title="Search Terms"
              isDark={isDark}
              state={panelLayout.terms}
              onState={setPanelState}
              bodyClassName="p-6"
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <p className="text-xs font-bold mt-1" style={{ color: isDark ? '#A0AEC0' : '#718096' }}>
                    {Object.keys(settings.thresholds || {}).length} / {settings.max_search_terms != null ? settings.max_search_terms : '—'} used
                  </p>
                </div>
                <SaveStatus saving={settingsSaving} dirty={settingsDirty} savedAt={settingsSavedAt} isDark={isDark} />
              </div>

              <div className="space-y-3 mb-6 max-h-80 overflow-y-auto">
                {Object.entries(settings.thresholds || {}).map(([term, prices]) => (
                  <div key={term} className="p-3 border-b-2" style={{ borderColor: isDark ? '#4A5568' : '#E2E8F0' }}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold uppercase flex-1 min-w-0 truncate">{term}</span>
                      <span className="font-bold text-indigo-500 text-sm whitespace-nowrap">
                        {formatPriceRange(prices)}
                      </span>
                      <button onClick={() => removeSearchTerm(term)} className="bg-red-500 text-white w-8 h-8 font-bold shrink-0">✕</button>
                    </div>

                    {/* Exclusions live with the term they belong to, so a keyword
                        blocked here can't silently filter a different search. */}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {(prices.exclusions || []).map(word => (
                        <span
                          key={word}
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold"
                          style={{
                            background: isDark ? '#4A2530' : '#FED7D7',
                            color: isDark ? '#FEB2B2' : '#822727',
                            border: `1px solid ${isDark ? '#822727' : '#FC8181'}`,
                          }}
                        >
                          −{word}
                          <button
                            onClick={() => removeTermExclusion(term, word)}
                            aria-label={`Remove exclusion ${word}`}
                            style={{ fontWeight: 700, lineHeight: 1 }}
                          >✕</button>
                        </span>
                      ))}
                      <input
                        placeholder="+ exclude word"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            addTermExclusion(term, e.currentTarget.value);
                            e.currentTarget.value = '';
                          }
                        }}
                        onBlur={(e) => {
                          if (e.currentTarget.value.trim()) {
                            addTermExclusion(term, e.currentTarget.value);
                            e.currentTarget.value = '';
                          }
                        }}
                        className="text-xs px-2 py-0.5 outline-none"
                        style={{
                          background: 'transparent',
                          color: isDark ? '#A0AEC0' : '#718096',
                          border: `1px dashed ${isDark ? '#4A5568' : '#CBD5E0'}`,
                          width: 110,
                          fontFamily: 'inherit',
                        }}
                      />
                    </div>
                  </div>
                ))}
                {Object.keys(settings.thresholds || {}).length === 0 && (
                  <p className="text-xs" style={{ color: isDark ? '#A0AEC0' : '#718096' }}>
                    No search terms yet. Add one below — price limits are optional.
                  </p>
                )}
              </div>

              <div className="space-y-3 pt-4 border-t-2" style={{ borderColor: isDark ? '#4A5568' : '#E2E8F0' }}>
                <div className="text-sm font-bold mb-2" style={{ color: isDark ? '#A0AEC0' : '#4A5568' }}>ADD NEW SEARCH</div>
                <p className="text-xs" style={{ color: isDark ? '#718096' : '#A0AEC0' }}>Leave prices blank to match any price.</p>
                <PixelInput isDark={isDark} value={newSearch.term} onChange={e => setNewSearch(p => ({...p, term: e.target.value}))} placeholder="TERM (e.g. Gameboy)" />
                <div className="flex gap-2">
                  <PixelInput isDark={isDark} value={newSearch.minPrice} onChange={e => setNewSearch(p => ({...p, minPrice: e.target.value}))} placeholder="MIN $ (optional)" type="number" />
                  <PixelInput isDark={isDark} value={newSearch.maxPrice} onChange={e => setNewSearch(p => ({...p, maxPrice: e.target.value}))} placeholder="MAX $ (optional)" type="number" />
                </div>
                <PixelButton onClick={addSearchTerm} color="#667eea" className="w-full">+ ADD TERM</PixelButton>
              </div>
            </Panel>

            {/* 2. Scanner Settings */}
            <Panel
              id="settings"
              title="Scanner Settings"
              isDark={isDark}
              state={panelLayout.settings}
              onState={setPanelState}
              bodyClassName="p-6"
            >
              <div className="flex justify-end items-center mb-6">
                <SaveStatus saving={settingsSaving} dirty={settingsDirty} savedAt={settingsSavedAt} isDark={isDark} />
              </div>

              <div className="mb-6">
                <div className="text-sm mb-3 font-bold" style={{ color: isDark ? '#A0AEC0' : '#4A5568' }}>PLATFORMS</div>
                {SCANNER_PLATFORM_ORDER.map((platform) => {
                  const fbLocked = platform === 'facebook' && settings.plan_tier !== 'pro';
                  const enabled = !!(settings.platforms || {})[platform];
                  const togglePlatform = () => {
                    if (fbLocked) {
                      notify('Facebook Marketplace is Pro-only.', 'info');
                      return;
                    }
                    const next = !enabled;
                    setSettings((prev) => {
                      const nextPl = { ...(prev.platforms || {}), [platform]: next };
                      // Facebook no longer forces a slower interval — every
                      // platform now runs at the plan's cadence.
                      const ci = Math.max(prev.check_interval || 10,
                                          INTERVAL_FLOOR_FOR_TIER(prev.plan_tier));
                      return { ...prev, platforms: nextPl, check_interval: ci };
                    });
                  };
                  return (
                    <div
                      key={platform}
                      className={`flex items-center gap-3 mb-3 ${fbLocked ? 'opacity-50' : ''}`}
                    >
                      <PixelCheckbox isDark={isDark} checked={enabled} onChange={togglePlatform} />
                      <span className="text-sm font-bold uppercase">{platform}</span>
                      {platform === 'facebook' && (
                        <span className="text-xs font-bold" style={{ color: isDark ? '#718096' : '#4A5568' }}>(Pro)</span>
                      )}
                    </div>
                  );
                })}
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
                <div className="text-sm mb-3 font-bold" style={{ color: isDark ? '#A0AEC0' : '#4A5568' }}>LISTING TYPE (HEURISTIC)</div>
                <p className="text-xs font-bold mb-4" style={{ color: isDark ? '#718096' : '#4A5568' }}>
                  Pick local pickup alerts, shipped-to-you alerts, or both. At least one must stay on. Filtering uses title keywords only (experimental).
                </p>
                <div className="flex flex-wrap gap-4 px-2">
                  <PixelBox
                    className="p-4 flex-1 min-w-[8rem] cursor-pointer hover:opacity-95"
                    color={settings.buyer_include_local ? '#48BB78' : '#CBD5E0'}
                    isDark={isDark}
                    onClick={() => toggleBuyerDeliveryBox('local')}
                  >
                    <div className="flex items-center gap-3">
                      <PixelCheckbox isDark={isDark} checked={!!settings.buyer_include_local} onChange={() => toggleBuyerDeliveryBox('local')} />
                      <span className="font-bold text-sm uppercase">LOCAL</span>
                    </div>
                  </PixelBox>
                  <PixelBox
                    className="p-4 flex-1 min-w-[8rem] cursor-pointer hover:opacity-95"
                    color={settings.buyer_include_shipping ? '#5A67D8' : '#CBD5E0'}
                    isDark={isDark}
                    onClick={() => toggleBuyerDeliveryBox('shipping')}
                  >
                    <div className="flex items-center gap-3">
                      <PixelCheckbox isDark={isDark} checked={!!settings.buyer_include_shipping} onChange={() => toggleBuyerDeliveryBox('shipping')} />
                      <span className="font-bold text-sm uppercase">SHIPPING</span>
                    </div>
                  </PixelBox>
                </div>
              </div>

              <div className="mb-6">
                <div className="text-sm mb-2 font-bold" style={{ color: isDark ? '#A0AEC0' : '#4A5568' }}>CHECK EVERY</div>
                <select value={settings.check_interval || 10} onChange={(e) => setSettings(prev => ({ ...prev, check_interval: parseInt(e.target.value) }))} className="w-full p-3 text-sm font-bold cursor-pointer" style={{ background: isDark ? '#2D3748' : '#F7FAFC', color: isDark ? 'white' : 'black', border: 'none', boxShadow: `0 0 0 3px ${isDark ? '#4A5568' : '#2D3748'}, inset 3px 3px 0 0 rgba(0,0,0,0.15)`, imageRendering: 'pixelated' }}>
                  {INTERVAL_OPTIONS_FOR_TIER(settings.plan_tier).map((mins) => (
                    <option key={mins} value={mins}>
                      {mins === 60 ? '1 HOUR' : `${mins} MINUTES`}
                    </option>
                  ))}
                </select>
                {settings.plan_tier !== 'pro' && (
                  <p className="text-xs font-bold mt-2" style={{ color: isDark ? '#A0AEC0' : '#4A5568' }}>
                    Upgrade to Pro to scan as often as every 5 minutes.
                  </p>
                )}
              </div>

              {settings.ai_image_allowed && (
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
              )}
            </Panel>

            {/* 3. Alerts — pulled out of Settings, which was carrying too much */}
            <Panel
              id="alerts"
              title="Alerts"
              isDark={isDark}
              state={panelLayout.alerts}
              onState={setPanelState}
              bodyClassName="p-6"
            >
              <div className="flex justify-end items-center mb-4">
                <SaveStatus saving={settingsSaving} dirty={settingsDirty} savedAt={settingsSavedAt} isDark={isDark} />
              </div>

              <p className="text-xs font-bold mb-4" style={{ color: isDark ? '#718096' : '#4A5568' }}>
                One message per scan when new matches are saved — every link in a single alert,
                so a busy scan can't flood you.
              </p>

              {[
                { key: 'email', label: 'EMAIL', hint: 'Digest with photos and prices' },
                { key: 'push', label: 'PUSH', hint: 'Browser & phone notification — free' },
                { key: 'sms', label: 'SMS', hint: 'Text message — needs a phone on file' },
              ].map(({ key, label, hint }) => (
                <div key={key} className="flex items-start gap-3 mb-4">
                  <PixelCheckbox
                    isDark={isDark}
                    /* Push reflects the real browser subscription, not a saved
                       preference — a checkbox that says "on" while the browser
                       has no subscription would be a lie. */
                    checked={key === 'push'
                      ? pushState.subscribed
                      : Boolean((settings.notifications || {})[key])}
                    onChange={key === 'push' ? togglePush : () => setSettings((prev) => ({
                      ...prev,
                      notifications: {
                        ...(prev.notifications || { email: true, sms: false, push: false }),
                        [key]: !(prev.notifications || {})[key],
                      },
                    }))}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold">
                      {label}
                      {key === 'push' && pushBusy && (
                        <span className="text-xs font-normal ml-2" style={{ color: '#718096' }}>working…</span>
                      )}
                    </div>
                    <div className="text-xs" style={{ color: isDark ? '#718096' : '#A0AEC0' }}>{hint}</div>

                    {key === 'push' && pushState.subscribed && (
                      <button
                        type="button"
                        onClick={testPush}
                        disabled={pushBusy}
                        className="text-xs font-bold mt-2 px-2 py-1"
                        style={{
                          border: `1px solid ${isDark ? '#4A5568' : '#CBD5E0'}`,
                          color: isDark ? '#A3BFFA' : '#5A67D8',
                          background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >
                        Send test notification
                      </button>
                    )}
                    {key === 'push' && !pushState.supported && isIosNeedsInstall() && (
                      <p className="text-xs font-bold mt-1" style={{ color: '#C05621' }}>
                        On iPhone: tap Share → Add to Home Screen, then enable alerts from that icon.
                      </p>
                    )}
                    {key === 'push' && pushState.permission === 'denied' && (
                      <p className="text-xs font-bold mt-1" style={{ color: '#C05621' }}>
                        Notifications are blocked for this site — allow them in your browser settings.
                      </p>
                    )}
                  </div>
                </div>
              ))}

              {(settings.notifications || {}).sms && !(settings.contact_phone || '').trim() && (
                <p className="text-xs font-bold mb-2" style={{ color: '#C05621' }}>
                  SMS is on but no phone on file — add one under Account, or alerts cannot be texted.
                </p>
              )}

              <PolicyLinks isDark={isDark} className="mt-3" />
            </Panel>

            {/* 4. Live Console */}
            <Panel
              id="console"
              title="Live Console"
              isDark={isDark}
              state={panelLayout.console}
              onState={setPanelState}
              canMax
              bodyClassName="p-6 flex flex-col min-h-0 max-h-[min(26rem,55vh)]"
            >
              <div className="flex-shrink-0 flex items-center justify-between gap-3 mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2 min-w-0">
                  <span className="animate-pulse w-3 h-3 bg-yellow-400 rounded-full inline-block shrink-0" />
                  LIVE CONSOLE
                </h2>
                <PixelButton small color="#4A5568" onClick={clearLiveConsoleOnly} disabled={!(status.recent_activity || []).length}>
                  CLEAR CONSOLE
                </PixelButton>
              </div>
              <p className="text-[10px] font-bold mb-2 flex-shrink-0" style={{ color: isDark ? '#A0AEC0' : '#4A5568' }}>
                Clear hides lines in this browser only (session).
              </p>
              <div
                className="flex-1 min-h-[12rem] max-h-[min(20rem,42vh)] overflow-y-auto overflow-x-hidden p-2 space-y-2 bg-black text-green-400 font-mono text-xs border-4 border-gray-600 rounded"
                aria-live="polite"
                role="log"
              >
                {visibleRecentActivity?.length > 0 ? (
                  visibleRecentActivity.map((log, i) => (
                    <div
                      key={`${log.ts || i}-${i}`}
                      className={log.type === 'success' ? 'text-green-300' : log.type === 'error' ? 'text-red-400' : ''}
                    >
                      [{formatConsoleLogTime(log)}] {log.message}
                    </div>
                  ))
                ) : (
                  <div className="text-gray-500 text-center py-12">AWAITING SCRAPER PROTOCOL...</div>
                )}
              </div>
            </Panel>

          </div>

          {activeTour && (
            <Tour
              steps={
                activeTour === 'replay' ? [...INTRO_STEPS, ...FIRST_SCAN_STEPS]
                  : activeTour === 'intro' ? INTRO_STEPS
                    : FIRST_SCAN_STEPS
              }
              isDark={isDark}
              onFinish={() => finishTour(activeTour)}
            />
          )}

          {/* Flip rests on the dashboard once the intro is done. Hidden during
              a tour so there aren't two of him on screen. */}
          {!activeTour && tourSeen && tourSeen.intro && (
            <FlipCompanion
              isDark={isDark}
              status={status.scraping_in_progress ? 'searching'
                      : status.running ? 'sleeping' : 'idle'}
              accessToken={session?.access_token}
            />
          )}

          <Taskbar
            panels={DASHBOARD_PANELS}
            layout={panelLayout}
            onState={setPanelState}
            isDark={isDark}
          />
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

      {popup && (
        <div className="fixed z-[70] max-w-sm left-4 right-4 sm:left-auto sm:right-6" style={{ bottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}>
          <PixelBox className="p-4" color={popup.type === 'error' ? '#F56565' : popup.type === 'success' ? '#48BB78' : '#667eea'} isDark={isDark}>
            <div className="font-bold text-sm">{popup.message}</div>
          </PixelBox>
        </div>
      )}

      {confirmState && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }}>
          <PixelBox className="p-6 max-w-lg w-full" color="#5A67D8" isDark={isDark}>
            <p className="font-bold whitespace-pre-line mb-5">{confirmState.message}</p>
            {confirmState.variant === 'listing_feedback' ? (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-3 px-2 py-3" style={{ background: isDark ? '#2D3748' : '#F7FAFC' }}>
                  <PixelButton small color="#718096" onClick={() => closeConfirm('just_remove')}>JUST REMOVE</PixelButton>
                  <PixelButton small color="#F56565" onClick={() => closeConfirm('sold')}>MARK SOLD</PixelButton>
                  <PixelButton small color="#ED8936" onClick={() => closeConfirm('not_a_deal')}>NOT A DEAL</PixelButton>
                  <PixelButton small color="#9F7AEA" onClick={() => closeConfirm('false_positive')}>FALSE POSITIVE</PixelButton>
                </div>
                <PixelButton color="#4A5568" className="w-full" small onClick={() => closeConfirm(null)}>CANCEL</PixelButton>
              </div>
            ) : confirmState.variant === 'yes_no' ? (
              <div className="flex flex-wrap gap-3 px-2">
                <PixelButton color="#48BB78" onClick={() => closeConfirm(true)}>YES</PixelButton>
                <PixelButton color="#718096" onClick={() => closeConfirm(false)}>NO</PixelButton>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3 px-2">
                <PixelButton color="#F56565" onClick={() => closeConfirm(true)}>CONFIRM</PixelButton>
                <PixelButton color="#718096" onClick={() => closeConfirm(false)}>CANCEL</PixelButton>
              </div>
            )}
          </PixelBox>
        </div>
      )}
    </div>
  );
}