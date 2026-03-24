// CRA only exposes env vars prefixed with REACT_APP_ at build time.
// Set REACT_APP_API_URL on Vercel to e.g. https://pixelflip-backend.onrender.com (with or without /api).
function normalizeApiUrl(raw) {
    if (!raw || typeof raw !== 'string') return null;
    const trimmed = raw.trim().replace(/\/+$/, '');
    if (!trimmed) return null;
    return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
}

const fromEnv = normalizeApiUrl(process.env.REACT_APP_API_URL);
const defaultProd = 'https://pixelflip-backend.onrender.com/api';

const config = {
    API_URL:
        fromEnv ||
        (process.env.NODE_ENV === 'production' ? defaultProd : 'http://localhost:5000/api'),
};

export default config;