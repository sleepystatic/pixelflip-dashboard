/**
 * Per-term scan cadence (migration 012).
 *
 * Cadence belongs to the SEARCH TERM now, not the account: each term carries its
 * own interval and the single "check every" dropdown is gone. Per-term rates
 * generalise to a credit system, where a user buys a budget and spends it per
 * term; one account-wide dropdown does not generalise at all.
 *
 * These live in their own module rather than inside App.js for two reasons:
 * they are the copy of a table that also exists in app.py and
 * scraper_multi_user.py — so the sync point should be obvious — and they are
 * pure, so they can be tested without rendering anything.
 */

// Fallback only. The server sends the authoritative list for the plan as
// `term_interval_options`; this is what a failed settings load falls back to.
// It still has to match app.py / scraper_multi_user.py, and the server re-clamps
// on save regardless, so drift here is a cosmetic bug rather than a billing one.
export const PLAN_INTERVAL_OPTIONS = {
  pro: [5, 10, 15, 30, 60],
  basic: [10, 15, 30, 60],
};

export const DEFAULT_TERM_INTERVAL = 10;
export const FASTEST_TIER_INTERVAL = 5;

export const INTERVAL_OPTIONS_FOR_TIER = (tier) =>
  PLAN_INTERVAL_OPTIONS[(tier || '').toLowerCase()] || PLAN_INTERVAL_OPTIONS.basic;

/** One term's cadence, defaulting exactly the way the backend does. */
export const TERM_INTERVAL = (prices) => {
  const n = Number((prices || {}).interval);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TERM_INTERVAL;
};

/** True when this term sits at the plan's fastest tier — what ⚡ used to mean. */
export const IS_FAST_TERM = (prices) => TERM_INTERVAL(prices) === FASTEST_TIER_INTERVAL;

/**
 * What to render in a term's cadence menu: every rate the plan sells, plus the
 * fastest tier shown DISABLED when it does not sell it.
 *
 * Showing 5 greyed out rather than hiding it is the upsell — a Basic user should
 * be able to see what Pro buys without reading a pricing page.
 *
 * Never sorts the caller's array in place: `allowed` may be the module constant
 * above or the array the server sent, and mutating either would corrupt every
 * later render.
 */
export const TERM_INTERVAL_CHOICES = (settings) => {
  const served = (settings || {}).term_interval_options;
  const allowed = Array.isArray(served) && served.length
    ? served
    : INTERVAL_OPTIONS_FOR_TIER((settings || {}).plan_tier);
  const shown = allowed.includes(FASTEST_TIER_INTERVAL)
    ? [...allowed]
    : [FASTEST_TIER_INTERVAL, ...allowed];
  return shown
    .sort((a, b) => a - b)
    .map((mins) => ({ mins, allowed: allowed.includes(mins) }));
};

export const INTERVAL_LABEL = (mins) => (mins === 60 ? '1 HR' : `${mins} MIN`);

/**
 * How many OTHER terms already sit at the fastest tier.
 *
 * "Other" matters: counting the term being edited would make re-selecting 5 on a
 * term already at 5 fail against its own slot.
 */
export const FAST_TERMS_BESIDES = (thresholds, term) =>
  Object.entries(thresholds || {})
    .filter(([name, prices]) => name !== term && IS_FAST_TERM(prices)).length;
