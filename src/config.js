/* eslint-disable */

// This function ensures the URL always ends in /api and has no trailing slashes
function normalizeApiUrl(raw, fallback) {
    let url = raw || fallback;
    if (!url) return '';

    // Remove trailing slashes
    url = url.trim().replace(/\/+$/, '');

    // Ensure it ends with /api
    if (!url.endsWith('/api')) {
        // If it contains /api elsewhere (like /api/status), strip it back to /api
        const apiIdx = url.indexOf('/api/');
        if (apiIdx !== -1) {
            url = url.slice(0, apiIdx + 4);
        } else {
            url = `${url}/api`;
        }
    }
    return url;
}

// 1. Check if we are local or live.
//    Private LAN addresses count as local: testing on a phone means loading
//    http://192.168.x.x:3000, and treating that as production sent the phone
//    to the Render backend instead of this machine — which looks like the app
//    hanging forever after login.
const host = window.location.hostname;
const isPrivateLan =
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host);
const isLocal = host === 'localhost' || host === '127.0.0.1' || isPrivateLan;

// 2. Define Fallbacks
const defaultProd = 'https://pixelflip-backend.onrender.com/api';
// On a LAN address the API lives on the SAME host, port 5000 — 'localhost'
// would resolve to the phone itself.
const defaultDev = isPrivateLan
    ? `http://${host}:5000/api`
    : 'http://localhost:5000/api';

// 3. Final Selection
const FINAL_URL = isLocal
    ? normalizeApiUrl(process.env.REACT_APP_API_URL_DEV, defaultDev)
    : normalizeApiUrl(process.env.REACT_APP_API_URL, defaultProd);

console.log(`🌐 API Bridge established at: ${FINAL_URL}`);

const config = {
    API_URL: FINAL_URL
};

export default config;
export { FINAL_URL as API_URL };