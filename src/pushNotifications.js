/* eslint-disable */

/**
 * Web Push registration for PixelFlip.
 *
 * Free alternative to SMS: no per-message cost, no carrier registration.
 * Works in Chrome/Edge/Firefox on desktop and Android, and on iOS 16.4+ but
 * ONLY once the user adds the site to their Home Screen (see isIosNeedsInstall).
 *
 * Usage from a settings toggle:
 *     import { enablePush, disablePush, getPushState } from './pushNotifications';
 *     const result = await enablePush(session.access_token);
 */

import { API_URL } from './config';

/** Push requires HTTPS. localhost is exempt so local dev still works. */
export function isSecureContextOk() {
  return (
    window.isSecureContext ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  );
}

export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/**
 * iOS only exposes Push to installed (Home Screen) web apps. Safari in a normal
 * tab has no PushManager at all, so without this check the UI would show a
 * generic "not supported" message when the real fix is "Add to Home Screen".
 */
export function isIosNeedsInstall() {
  const ua = window.navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = window.navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches;
  return isIos && !isStandalone;
}

/** VAPID keys travel as base64url; PushManager wants a Uint8Array. */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i);
  return output;
}

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) throw new Error('Service workers unsupported');
  // Scope '/' so the worker can handle notifications for the whole app.
  const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  await navigator.serviceWorker.ready;
  return reg;
}

/** Current state, for rendering the toggle without prompting the user. */
export async function getPushState() {
  if (!isPushSupported()) {
    return { supported: false, subscribed: false, permission: 'unsupported' };
  }
  let subscribed = false;
  try {
    const reg = await navigator.serviceWorker.getRegistration('/');
    if (reg) {
      const sub = await reg.pushManager.getSubscription();
      subscribed = !!sub;
    }
  } catch (e) {
    // fall through — treat as not subscribed
  }
  return { supported: true, subscribed, permission: Notification.permission };
}

/**
 * Ask permission, subscribe, and store the subscription server-side.
 * Returns { ok, error }.
 */
export async function enablePush(accessToken) {
  if (!isSecureContextOk()) {
    return { ok: false, error: 'Push requires HTTPS.' };
  }
  if (!isPushSupported()) {
    if (isIosNeedsInstall()) {
      return {
        ok: false,
        error: 'On iPhone, tap Share → Add to Home Screen, then enable alerts from that icon.',
      };
    }
    return { ok: false, error: 'This browser does not support push notifications.' };
  }

  // Must be called from a user gesture (a click), or browsers reject it.
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return {
      ok: false,
      error: permission === 'denied'
        ? 'Notifications are blocked. Enable them in your browser site settings.'
        : 'Notification permission was not granted.',
    };
  }

  let keyRes;
  try {
    keyRes = await fetch(`${API_URL}/push/vapid-public-key`);
  } catch (e) {
    return { ok: false, error: 'Could not reach the server.' };
  }
  if (!keyRes.ok) {
    return { ok: false, error: 'Push is not configured on the server yet.' };
  }
  const { publicKey } = await keyRes.json();
  if (!publicKey) return { ok: false, error: 'Server did not return a VAPID key.' };

  const reg = await registerServiceWorker();

  // Reuse an existing subscription when present; re-subscribing with a
  // different key throws.
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true, // required by Chrome
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  const res = await fetch(`${API_URL}/push/subscribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ subscription: sub.toJSON() }),
  });
  if (!res.ok) {
    const msg = await res.text();
    return { ok: false, error: `Could not save subscription: ${msg.slice(0, 120)}` };
  }
  return { ok: true };
}

/**
 * Ask the server to push a test notification to this account.
 * The only reliable way to confirm delivery — automated browsers can't
 * register with FCM, so this has to be exercised from a real one.
 */
export async function sendTestPush(accessToken) {
  try {
    const res = await fetch(`${API_URL}/push/test`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const js = await res.json().catch(() => ({}));
    if (!res.ok || js.success === false) {
      return { ok: false, error: js.error || `Server returned ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: 'Could not reach the server.' };
  }
}

/** Unsubscribe locally and clear the stored subscription server-side. */
export async function disablePush(accessToken) {
  try {
    const reg = await navigator.serviceWorker.getRegistration('/');
    if (reg) {
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
    }
  } catch (e) {
    // still clear it server-side below
  }
  try {
    await fetch(`${API_URL}/push/unsubscribe`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch (e) {
    return { ok: false, error: 'Unsubscribed locally, but the server was unreachable.' };
  }
  return { ok: true };
}
