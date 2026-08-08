/* eslint-disable */

/**
 * Vintage-window panel chrome for the PixelFlip dashboard.
 *
 * Each panel gets a title bar with minimize / maximize / close, mirroring the
 * old Windows control cluster. Closing never destroys anything — the panel
 * moves to the Taskbar and one click brings it back. Without that restore
 * path, a close button is a trap.
 *
 * Mobile (<820px) deliberately drops close and maximize: there is no room for
 * a taskbar, and free-floating windows fight with scrolling. Minimize stays,
 * behaving as a plain accordion, so the mental model survives the breakpoint.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';

const LAYOUT_KEY = 'pf_panel_layout_v1';

export const THEME = {
  gradient: 'linear-gradient(90deg,#667eea,#764ba2)',
  primary: '#764ba2',
  secondary: '#667eea',
  dark: '#2D3748',
  light: '#F7FAFC',
};

export function panelColors(isDark) {
  return {
    panel: isDark ? '#232B38' : '#FFFFFF',
    bg: isDark ? '#171C26' : '#F7FAFC',
    text: isDark ? '#E2E8F0' : '#2D3748',
    muted: isDark ? '#A0AEC0' : '#718096',
    line: isDark ? '#2D3748' : '#E2E8F0',
    border: isDark ? '#4A5568' : '#2D3748',
  };
}

/** Panel open/closed/minimized state, persisted so a layout survives refresh. */
export function usePanelLayout(defaults = {}) {
  const [layout, setLayout] = useState(() => {
    try {
      const raw = localStorage.getItem(LAYOUT_KEY);
      return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
    } catch (e) {
      return defaults;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
    } catch (e) {
      /* private mode — layout just won't persist */
    }
  }, [layout]);

  const setState = useCallback((id, state) => {
    setLayout((prev) => ({ ...prev, [id]: state }));
  }, []);

  const resetLayout = useCallback(() => setLayout(defaults), [defaults]);

  return { layout, setState, resetLayout };
}

const ctrlStyle = {
  width: 19,
  height: 17,
  border: '1px solid rgba(0,0,0,0.45)',
  background: '#D8DEE9',
  color: '#1A202C',
  fontSize: 10,
  lineHeight: '15px',
  textAlign: 'center',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontWeight: 700,
  padding: 0,
};

function Ctrl({ label, title, onClick, danger, hideOnMobile }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={hideOnMobile ? 'pf-ctrl-desktop' : undefined}
      style={{
        ...ctrlStyle,
        background: hover ? (danger ? '#E53E3E' : '#FFFFFF') : '#D8DEE9',
        color: hover && danger ? '#FFFFFF' : '#1A202C',
      }}
    >
      {label}
    </button>
  );
}

/**
 * @param id        stable key used for persistence
 * @param title     shown in the title bar
 * @param state     'open' | 'min' | 'max' | 'closed'
 * @param onState   (id, nextState) => void
 * @param canMax    only give maximize to panels with content worth expanding
 */
export function Panel({
  id, title, children, isDark, state = 'open', onState,
  canMax = false, className = '', bodyClassName = 'p-4', dataTour,
}) {
  const c = panelColors(isDark);
  if (state === 'closed') return null;

  const minimized = state === 'min';
  const maximized = state === 'max';

  return (
    <div
      className={className}
      // Lets the tour find and highlight this panel without threading refs.
      data-tour={dataTour || id}
      style={{
        background: c.panel,
        color: c.text,
        border: `2px solid ${c.border}`,
        boxShadow: '4px 4px 0 0 rgba(0,0,0,0.18)',
        imageRendering: 'pixelated',
        transition: 'background 0.2s, color 0.2s',
        gridColumn: maximized ? '1 / -1' : undefined,
        alignSelf: 'start',
      }}
    >
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 6px 6px 10px',
          background: THEME.gradient,
          color: '#fff', userSelect: 'none',
        }}
      >
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '.6px',
          flex: 1, textTransform: 'uppercase',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {title}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {/* '+' while collapsed reads as "expand me" — a '–' on an already
              collapsed panel gives no signal that it can be reopened. */}
          <Ctrl
            label={minimized ? '+' : '–'}
            title={minimized ? 'Restore' : 'Minimize'}
            onClick={() => onState(id, minimized ? 'open' : 'min')}
          />
          {canMax && (
            <Ctrl
              label="□"
              title={maximized ? 'Restore' : 'Maximize'}
              onClick={() => onState(id, maximized ? 'open' : 'max')}
              hideOnMobile
            />
          )}
          <Ctrl
            label="×"
            title="Close"
            danger
            onClick={() => onState(id, 'closed')}
            hideOnMobile
          />
        </div>
      </div>
      {!minimized && <div className={bodyClassName}>{children}</div>}
    </div>
  );
}

/** Restores closed panels. Hidden on mobile, where close is unavailable. */
export function Taskbar({ panels, layout, onState, isDark }) {
  const c = panelColors(isDark);
  const closed = panels.filter((p) => layout[p.id] === 'closed');

  return (
    <div
      className="pf-taskbar"
      style={{
        position: 'fixed', left: 0, right: 0, bottom: 0,
        background: c.panel, borderTop: `2px solid ${c.border}`,
        padding: '7px 12px', display: 'flex', gap: 7,
        alignItems: 'center', flexWrap: 'wrap', zIndex: 40,
      }}
    >
      <span style={{ fontSize: 9.5, color: c.muted, letterSpacing: '.5px' }}>CLOSED:</span>
      {closed.length === 0 && (
        <span style={{ fontSize: 10, color: c.muted, fontStyle: 'italic' }}>
          nothing closed — click × on a panel
        </span>
      )}
      {closed.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onState(p.id, 'open')}
          style={{
            border: `2px solid ${c.border}`, background: c.bg, color: c.text,
            fontFamily: 'inherit', fontSize: 10, padding: '5px 10px',
            cursor: 'pointer', fontWeight: 700,
          }}
        >
          {p.title}
        </button>
      ))}
    </div>
  );
}

/**
 * Page header with the same gradient title bar as Panel, so the Listings and
 * Account pages read as part of the same system rather than separate screens.
 */
export function PageHeader({ title, subtitle, isDark, children }) {
  const c = panelColors(isDark);
  return (
    <div
      className="mb-6"
      style={{
        background: c.panel,
        color: c.text,
        border: `2px solid ${c.border}`,
        boxShadow: '4px 4px 0 0 rgba(0,0,0,0.18)',
        imageRendering: 'pixelated',
      }}
    >
      <div style={{
        padding: '6px 10px', background: THEME.gradient, color: '#fff',
        fontSize: 11, fontWeight: 700, letterSpacing: '.6px',
        textTransform: 'uppercase',
      }}>
        {title}
      </div>
      <div className="p-5 flex justify-between items-start flex-wrap gap-4">
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.4px' }}>{title}</div>
          {subtitle && (
            <div style={{ fontSize: 12, color: c.muted, marginTop: 4 }}>{subtitle}</div>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

/** The one-glance status row. This is what fixes "too much going on". */
export function StatStrip({ stats, isDark }) {
  const c = panelColors(isDark);
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
      {stats.map((s) => (
        <div
          key={s.k}
          style={{
            background: c.panel, border: `2px solid ${c.border}`,
            padding: '11px 13px', boxShadow: '3px 3px 0 0 rgba(0,0,0,0.16)',
            imageRendering: 'pixelated',
          }}
        >
          <div style={{ fontSize: 10, color: c.muted, letterSpacing: '.5px' }}>{s.k}</div>
          <div style={{ fontSize: 20, fontWeight: 700, marginTop: 3, color: s.color || c.text }}>
            {s.v}
            {s.sub && (
              <small style={{ fontSize: 11, color: c.muted, fontWeight: 400 }}> {s.sub}</small>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
