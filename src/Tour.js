/* eslint-disable */

/**
 * Flip — the guided tour.
 *
 * Design notes worth keeping:
 *  - Steps target panels by a `data-tour` attribute rather than a ref, so a
 *    step can point at anything without threading refs through the tree.
 *  - The overlay only DIMS; it doesn't darken. The point is to draw the eye,
 *    not to hide the thing being explained.
 *  - Clicking Next while text is still typing completes the line instead of
 *    advancing, so fast clickers can't skip half the content by accident.
 *  - Flip is positioned relative to the highlighted element on desktop and
 *    pinned below it on mobile, where panels are full width.
 */

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { API_URL } from './config';
import { answerQuestion, SUGGESTED as SUGGESTED_QUESTIONS } from './helpChat';

/* ---- Flip's dials. Everything you'd want to tweak lives here. ---- */
const TYPE_MS = 18;               // typewriter speed, ms per character (lower = faster)
const FLIP_SIZE = 160;            // during the tour, desktop
const FLIP_SIZE_MOBILE = 140;      // during the tour, mobile
const FLIP_REST_SIZE = 160;        // resting in the corner, desktop
const FLIP_REST_SIZE_MOBILE = 120; // resting in the corner, mobile

/** Steps shown before the first scan. */
export const INTRO_STEPS = [
  {
    id: 'greeting',
    target: null,                      // centre of screen
    text: "Hi! I'm Flip. Give me 30 seconds and I'll show you around.",
  },
  {
    id: 'terms',
    target: 'terms',
    text: "Start here — what are you hunting for? Add a term, set a min or max price (or leave blank for any price), then add exclusions like 'broken' or 'for parts' to filter out junk.",
  },
  {
    id: 'settings',
    target: 'settings',
    text: 'Now the where and how often. Set your zip, pick your search radius, choose your marketplaces, and how often I check. Facebook Marketplace is Pro-only.',
  },
  {
    id: 'alerts',
    target: 'alerts',
    text: 'Pick how I reach you — email, push, or text. Push is free and works on your phone.',
  },
  {
    id: 'chrome',
    target: 'terms',
    text: 'Every panel has these buttons up top: – tucks it away, □ makes it bigger, × closes it. Anything you close drops into the bar at the bottom, so nothing is ever lost.',
  },
  {
    id: 'start',
    target: 'controls',
    text: "That's it. Hit Start and I'll begin hunting.",
  },
];

/**
 * Shown once, right after the first scrape finishes — and always included in a
 * replay. Wording stays true whether or not a scan has run yet, since a replay
 * can happen on a brand-new account with an empty console.
 */
export const FIRST_SCAN_STEPS = [
  {
    id: 'console',
    target: 'console',
    text: 'This is where I show my work — every site I check and everything I find, live. If something ever looks wrong, this is what to send us.',
  },
  {
    id: 'countdown',
    target: 'controls',
    text: 'And here is your countdown to the next scan, plus every listing I have found so far.',
  },
];

export async function fetchTourProgress(accessToken) {
  try {
    const res = await fetch(`${API_URL}/tour`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return {};
    return (await res.json()).seen || {};
  } catch (e) {
    return {};
  }
}

export async function markTourSeen(accessToken, section) {
  try {
    await fetch(`${API_URL}/tour`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ section, done: true }),
    });
  } catch (e) {
    /* non-fatal: worst case the section shows again next login */
  }
}

function useIsMobile() {
  const [m, setM] = useState(() => window.innerWidth <= 820);
  useEffect(() => {
    const on = () => setM(window.innerWidth <= 820);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return m;
}

export default function Tour({ steps, isDark, onFinish }) {
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState('');
  const [done, setDone] = useState(false);       // current line fully typed
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [rect, setRect] = useState(null);
  const isMobile = useIsMobile();
  const timerRef = useRef(null);

  const step = steps[index];
  const full = step ? step.text : '';

  // Typewriter
  useEffect(() => {
    setTyped('');
    setDone(false);
    if (!full) return;
    let i = 0;
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      i += 1;
      setTyped(full.slice(0, i));
      if (i >= full.length) {
        clearInterval(timerRef.current);
        setDone(true);
      }
    }, TYPE_MS);
    return () => clearInterval(timerRef.current);
  }, [full]);

  // Find and follow the highlighted element.
  const measure = useCallback(() => {
    if (!step || !step.target) { setRect(null); return; }
    const el = document.querySelector(`[data-tour="${step.target}"]`);
    if (!el) { setRect(null); return; }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [step]);

  useLayoutEffect(() => {
    if (!step) return;
    const el = step.target ? document.querySelector(`[data-tour="${step.target}"]`) : null;
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Measure after the scroll settles, then keep following.
    const t = setTimeout(measure, 420);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [step, measure]);

  if (!step) return null;

  const finish = (reason) => {
    clearInterval(timerRef.current);
    onFinish(reason);
  };

  const next = () => {
    if (!done) {
      // Stop the ticker BEFORE filling in the text. Without this the interval
      // fires once more and overwrites the completed line with its own partial
      // slice, which reads as a one-frame flash back to typing.
      clearInterval(timerRef.current);
      setTyped(full);
      setDone(true);
      return;
    }
    if (index + 1 >= steps.length) finish('completed');
    else setIndex(index + 1);
  };

  const skip = () => {
    clearInterval(timerRef.current);
    if (index + 1 >= steps.length) finish('completed');
    else setIndex(index + 1);
  };

  const size = isMobile ? FLIP_SIZE_MOBILE : FLIP_SIZE;
  const pad = 12;
  const bubbleW = isMobile ? Math.min(window.innerWidth - 32, 340) : 380;

  // Where Flip + bubble sit. Below the target on mobile (panels are full
  // width); to the right, or left if there's no room, on desktop.
  let anchor;
  if (!rect) {
    anchor = { left: (window.innerWidth - bubbleW) / 2, top: window.innerHeight / 2 - 160 };
  } else if (isMobile) {
    const below = rect.top + rect.height + pad;
    const fits = below + size + 190 < window.innerHeight;
    anchor = {
      left: Math.max(16, Math.min(window.innerWidth - bubbleW - 16, rect.left)),
      top: fits ? below : Math.max(16, rect.top - size - 190),
    };
  } else {
    const right = rect.left + rect.width + pad;
    const fitsRight = right + bubbleW + 40 < window.innerWidth;
    anchor = {
      left: fitsRight ? right : Math.max(16, rect.left - bubbleW - pad),
      top: Math.max(16, Math.min(window.innerHeight - 300, rect.top)),
    };
  }

  const panel = isDark ? '#232B38' : '#FFFFFF';
  const text = isDark ? '#E2E8F0' : '#2D3748';
  const border = isDark ? '#4A5568' : '#2D3748';

  return (
    <>
      {/* Dim + block. Four strips instead of a full-screen overlay with a
          cutout, so the highlighted panel stays fully interactive-looking and
          at natural brightness. */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 900, pointerEvents: 'auto' }}>
        {rect ? (
          <>
            <div style={dim(0, 0, '100%', Math.max(0, rect.top))} />
            <div style={dim(0, rect.top, rect.left, rect.height)} />
            <div style={dim(rect.left + rect.width, rect.top,
                            Math.max(0, window.innerWidth - rect.left - rect.width), rect.height)} />
            <div style={dim(0, rect.top + rect.height, '100%',
                            Math.max(0, window.innerHeight - rect.top - rect.height))} />
            <div style={{
              position: 'fixed', top: rect.top - 3, left: rect.left - 3,
              width: rect.width + 6, height: rect.height + 6,
              border: '3px solid #764ba2', pointerEvents: 'none',
              boxShadow: '0 0 0 2px rgba(118,75,162,0.35)',
            }} />
          </>
        ) : (
          <div style={dim(0, 0, '100%', '100%')} />
        )}
      </div>

      {/* Flip + speech bubble */}
      <div style={{
        position: 'fixed', zIndex: 950,
        left: anchor.left, top: anchor.top, width: bubbleW,
        fontFamily: "'SF Mono', SFMono-Regular, Consolas, Menlo, monospace",
      }}>
        <div style={{
          background: panel, color: text,
          border: `3px solid ${border}`,
          boxShadow: '5px 5px 0 0 rgba(0,0,0,0.28)',
          padding: '14px 15px', imageRendering: 'pixelated', position: 'relative',
        }}>
          <div style={{ fontSize: 13, lineHeight: 1.6, minHeight: 78 }}>
            {typed}
            {!done && <span style={{ opacity: 0.5 }}>▌</span>}
          </div>

          {confirmEnd ? (
            <div style={{ marginTop: 12, borderTop: `1px solid ${border}`, paddingTop: 10 }}>
              <div style={{ fontSize: 12, marginBottom: 8 }}>End the tour? You can replay it from the menu.</div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <TourBtn onClick={() => setConfirmEnd(false)} isDark={isDark}>Keep going</TourBtn>
                <TourBtn onClick={() => finish('ended')} isDark={isDark} danger>End tour</TourBtn>
              </div>
            </div>
          ) : (
            <div style={{
              marginTop: 12, display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', gap: 8,
            }}>
              <span style={{ fontSize: 11, opacity: 0.55 }}>{index + 1}/{steps.length}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <TourBtn onClick={() => setConfirmEnd(true)} isDark={isDark} subtle>End tour</TourBtn>
                <TourBtn onClick={skip} isDark={isDark} subtle>Skip</TourBtn>
                <TourBtn onClick={next} isDark={isDark} primary>
                  {done ? (index + 1 >= steps.length ? 'Finish' : 'Next') : 'Next'}
                </TourBtn>
              </div>
            </div>
          )}

          {/* tail pointing down at Flip */}
          <div style={{
            position: 'absolute', bottom: -11, left: 26, width: 0, height: 0,
            borderLeft: '11px solid transparent', borderRight: '11px solid transparent',
            borderTop: `11px solid ${border}`,
          }} />
        </div>

        <img
          src="/tourGuide.png"
          alt="Flip"
          width={size}
          height={size}
          style={{ width: size, height: size, imageRendering: 'pixelated', marginTop: 6, display: 'block' }}
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      </div>
    </>
  );
}

/** Hands an unanswered question to a human. Backend mails support@. */
export async function sendSupportMessage(accessToken, message) {
  try {
    const res = await fetch(`${API_URL}/support/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ message }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.success) return { ok: true };
    return { ok: false, error: body.error || 'Could not send that just now.' };
  } catch (e) {
    return { ok: false, error: 'No connection — check your network and try again.' };
  }
}

/**
 * Flip resting on the dashboard once the tour is done, as a help chat.
 *
 * Bottom-RIGHT on desktop, bottom-LEFT on mobile. Right-side on a phone
 * collides with where thumbs rest and with iOS Safari's own controls, and it
 * would sit on the home-indicator swipe area. Desktop has neither problem, and
 * he's lifted clear of the taskbar there.
 *
 * Answers come from a local lookup (helpChat.js) so they are instant and free.
 * When nothing matches, Flip offers to forward the question rather than
 * guessing — a wrong confident answer is worse than an honest handoff.
 * `status` stays wired to the scraper for the animated poses later.
 *
 * The old "Show me around again" button is gone on purpose: replaying the tour
 * lives in the settings menu, and offering it here meant Flip nagged about the
 * tour every time someone opened him for help.
 */
export function FlipCompanion({ isDark, status = 'idle', accessToken }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [handoff, setHandoff] = useState(null); // question awaiting "send to support"
  // Suggestions used to be gated on "no messages yet", which meant picking one
  // hid the rest permanently — a dead end with no way back to the other topics.
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [messages, setMessages] = useState([
    { from: 'flip', text: 'Hi! How can I help you?' },
  ]);
  const isMobile = useIsMobile();
  const size = isMobile ? FLIP_REST_SIZE_MOBILE : FLIP_REST_SIZE;
  const logRef = useRef(null);

  const statusLine = {
    searching: 'out hunting right now',
    found: 'found something new',
    sleeping: 'resting until the next scan',
    idle: 'waiting on you to press Start',
  }[status] || 'here to help';

  const panel = isDark ? '#232B38' : '#FFFFFF';
  const text = isDark ? '#E2E8F0' : '#2D3748';
  const border = isDark ? '#4A5568' : '#2D3748';
  const muted = isDark ? '#A0AEC0' : '#718096';
  const mine = isDark ? '#2C3A4F' : '#EDF2F7';

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages, open]);

  const say = (from, msg) => setMessages((prev) => [...prev, { from, text: msg }]);

  const ask = async (question) => {
    const q = (question || '').trim();
    if (!q || sending) return;
    setInput('');
    setHandoff(null);
    setShowSuggestions(false);
    say('you', q);

    const hit = await answerQuestion(q);
    if (hit) {
      say('flip', hit.a);
    } else {
      say('flip', "I don't have a good answer for that one. Want me to pass it to the team? They'll reply to your account email.");
      setHandoff(q);
    }
  };

  const forward = async () => {
    if (!handoff || sending) return;
    setSending(true);
    const res = await sendSupportMessage(accessToken, handoff);
    setSending(false);
    setHandoff(null);
    say('flip', res.ok
      ? "Sent. Someone will get back to you by email."
      : res.error);
  };

  return (
    <div
      style={{
        position: 'fixed',
        zIndex: 60,
        // clear of the desktop taskbar; clear of the iOS home indicator
        bottom: `calc(${isMobile ? 16 : 74}px + env(safe-area-inset-bottom, 0px))`,
        ...(isMobile
          ? { left: `calc(12px + env(safe-area-inset-left, 0px))` }
          : { right: 18 }),
        fontFamily: "'SF Mono', SFMono-Regular, Consolas, Menlo, monospace",
      }}
    >
      {open && (
        <div style={{
          background: panel, color: text, border: `3px solid ${border}`,
          boxShadow: '4px 4px 0 0 rgba(0,0,0,0.28)', marginBottom: 8,
          width: isMobile ? 264 : 292, imageRendering: 'pixelated',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 8, padding: '7px 9px', borderBottom: `2px solid ${border}`,
          }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700 }}>Flip</div>
              <div style={{ fontSize: 10, color: muted, whiteSpace: 'nowrap',
                            overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {statusLine}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close help"
              style={{
                background: 'transparent', border: 'none', color: muted,
                fontSize: 15, fontWeight: 700, cursor: 'pointer',
                lineHeight: 1, padding: 2, fontFamily: 'inherit',
              }}
            >
              ✕
            </button>
          </div>

          <div ref={logRef} style={{ maxHeight: 210, overflowY: 'auto', padding: '9px' }}>
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  fontSize: 11.5, lineHeight: 1.5, marginBottom: 7,
                  padding: '6px 8px',
                  background: m.from === 'you' ? mine : 'transparent',
                  border: m.from === 'flip' ? `1px solid ${border}` : 'none',
                  marginLeft: m.from === 'you' ? 24 : 0,
                  marginRight: m.from === 'you' ? 0 : 12,
                }}
              >
                {m.text}
              </div>
            ))}

            {handoff && (
              <button
                type="button"
                onClick={forward}
                disabled={sending}
                style={{
                  background: '#764ba2', border: `1px solid ${border}`, color: '#fff',
                  fontSize: 11, fontWeight: 700, padding: '5px 9px',
                  cursor: sending ? 'default' : 'pointer', fontFamily: 'inherit',
                  opacity: sending ? 0.6 : 1, marginBottom: 6,
                }}
              >
                {sending ? 'Sending…' : 'Send to support'}
              </button>
            )}

            {showSuggestions ? (
              <div style={{ marginTop: 2 }}>
                {SUGGESTED_QUESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => ask(s)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      background: 'transparent', border: `1px solid ${border}`,
                      color: muted, fontSize: 10.5, padding: '5px 7px',
                      marginBottom: 5, cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : (
              // Answering one question must not strand the user in it. The
              // transcript stays put — this only brings the menu back.
              <button
                type="button"
                onClick={() => setShowSuggestions(true)}
                style={{
                  background: 'transparent', border: 'none', color: muted,
                  fontSize: 10.5, fontWeight: 700, padding: '3px 0',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                ← Other questions
              </button>
            )}
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); ask(input); }}
            style={{ display: 'flex', gap: 6, padding: '8px 9px', borderTop: `2px solid ${border}` }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me something…"
              aria-label="Ask Flip a question"
              style={{
                flex: 1, minWidth: 0, background: isDark ? '#1A202C' : '#F7FAFC',
                border: `1px solid ${border}`, color: text, fontSize: 11,
                padding: '5px 7px', fontFamily: 'inherit', outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={!input.trim()}
              style={{
                background: input.trim() ? '#764ba2' : 'transparent',
                border: `1px solid ${border}`, color: input.trim() ? '#fff' : muted,
                fontSize: 11, fontWeight: 700, padding: '5px 9px',
                cursor: input.trim() ? 'pointer' : 'default', fontFamily: 'inherit',
              }}
            >
              →
            </button>
          </form>
        </div>
      )}
      <img
        src="/tourGuide.png"
        alt={open ? 'Close help' : 'Ask Flip for help'}
        width={size}
        height={size}
        onClick={() => setOpen((v) => !v)}
        style={{
          width: size, height: size, imageRendering: 'pixelated',
          cursor: 'pointer', display: 'block',
          filter: 'drop-shadow(2px 2px 0 rgba(0,0,0,0.35))',
        }}
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
      />
    </div>
  );
}

function dim(left, top, width, height) {
  return {
    position: 'fixed', left, top, width, height,
    // Deliberately light: enough to pull focus, not so dark the rest of the
    // dashboard disappears.
    background: 'rgba(15,20,30,0.42)',
  };
}

function TourBtn({ children, onClick, isDark, primary, danger, subtle }) {
  const bg = danger ? '#E53E3E' : primary ? '#764ba2' : 'transparent';
  const fg = danger || primary ? '#fff' : (isDark ? '#A0AEC0' : '#4A5568');
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: bg, color: fg,
        border: subtle ? 'none' : `2px solid ${isDark ? '#4A5568' : '#2D3748'}`,
        padding: subtle ? '6px 8px' : '6px 14px',
        fontSize: 12, fontWeight: 700, cursor: 'pointer',
        fontFamily: 'inherit', imageRendering: 'pixelated',
      }}
    >
      {children}
    </button>
  );
}
