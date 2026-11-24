/*
 * A stable, random id for this browser, sent with checkout so the backend can
 * tell when one browser is used to start free trials on several accounts
 * (trial_guard.py; the server stores only a keyed hash of it).
 *
 * Websites cannot read a hardware device id. This is the honest equivalent:
 * random, not derived from the device, kept in localStorage with a cookie copy
 * so clearing one restores it from the other. A private window or a fully
 * cleared browser gets a new one — the other trial checks still apply.
 */
const KEY = 'pf_device_id';
const TWO_YEARS = 60 * 60 * 24 * 365 * 2;

function readCookie() {
  try {
    const m = document.cookie.match(new RegExp('(?:^|; )' + KEY + '=([A-Za-z0-9-]{16,64})'));
    return m ? m[1] : null;
  } catch (e) {
    return null;
  }
}

function newId() {
  try {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    const b = window.crypto.getRandomValues(new Uint8Array(16));
    return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    return null;
  }
}

export function getDeviceId() {
  let id = null;
  try {
    id = window.localStorage.getItem(KEY);
  } catch (e) {
    id = null;
  }
  if (!id || !/^[A-Za-z0-9-]{16,64}$/.test(id)) id = readCookie() || newId();
  if (!id) return null;
  try {
    window.localStorage.setItem(KEY, id);
  } catch (e) {
    /* storage blocked: the cookie still carries it */
  }
  try {
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${KEY}=${id}; max-age=${TWO_YEARS}; path=/; SameSite=Lax${secure}`;
  } catch (e) {
    /* cookies blocked: nothing more to do */
  }
  return id;
}
