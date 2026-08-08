/**
 * Flip's canned help answers.
 *
 * Deliberately a plain lookup, not a model call: it answers instantly, works
 * offline, and costs nothing per message. `answerQuestion` is async purely so
 * that swapping in an LLM later is a one-function change — callers already
 * await it, so nothing in the UI has to move.
 *
 * Every answer below describes behaviour that actually ships. If a limit
 * changes in the backend (PLAN_INTERVAL_FLOOR_MINUTES, _plan_limits), fix the
 * matching answer here or Flip starts confidently lying to users.
 */

export const HELP_TOPICS = [
  {
    id: 'scan-speed',
    q: 'How often does PixelFlip scan?',
    keywords: ['how often', 'how fast', 'interval', 'frequency', 'minutes', 'speed', 'refresh', 'scan rate'],
    a: 'Pro scans every 5 minutes, Basic every 10. You can pick a slower interval in Settings if you want fewer alerts, but not a faster one than your plan allows.',
  },
  {
    id: 'marketplaces',
    q: 'Which marketplaces do you search?',
    keywords: ['marketplace', 'platform', 'which sites', 'facebook', 'craigslist', 'offerup', 'mercari', 'ebay'],
    a: 'Facebook Marketplace, Craigslist, OfferUp and Mercari. You can turn any of them off per scan in Settings. eBay is not supported yet.',
  },
  {
    id: 'no-alerts',
    q: "Why am I not getting alert emails?",
    keywords: ['not getting', 'no email', "didn't get", 'not receiving', 'missing alert', 'no alert', 'no notification'],
    a: 'Three things to check. First, Settings → Notifications, make sure Email is on. Second, check your spam folder. Third, alerts only fire for listings PixelFlip has never seen before — if a scan finds nothing new, no email is sent. That is normal, not a failure.',
  },
  {
    id: 'zero-results',
    q: 'Why did my scan find 0 listings?',
    keywords: ['0 listings', 'zero', 'no results', 'nothing found', 'no matches', 'empty scan', 'found nothing'],
    a: 'Usually because nothing new was posted since your last scan. PixelFlip only saves listings it has not shown you before, so a quiet scan is a good sign, not a broken one. If it is always zero, widen your price range or distance, or check your excluded words are not too broad.',
  },
  {
    id: 'search-terms',
    q: 'How do I add a search term?',
    keywords: ['add search', 'search term', 'add term', 'keyword', 'new search', 'watch'],
    a: 'Dashboard → Search Terms → type the item and hit add. Price limits are optional: leave them blank and PixelFlip matches any price. Basic includes 3 terms, Pro includes 10.',
  },
  {
    id: 'exclusions',
    q: 'How do excluded words work?',
    keywords: ['exclude', 'exclusion', 'negative keyword', 'filter out', 'block word', 'ignore word'],
    a: 'Exclusions are per search term, not global. Excluding "case" from your Switch search will not affect your camera search, so you can be aggressive without breaking other watches.',
  },
  {
    id: 'plans',
    q: "What's the difference between Basic and Pro?",
    keywords: ['difference', 'basic vs', 'pro vs', 'upgrade', 'which plan', 'plan compare'],
    a: 'Basic: scans every 10 minutes, 3 search terms. Pro: scans every 5 minutes, 10 search terms, plus AI image filtering that drops listings whose photos do not match what you asked for.',
  },
  {
    id: 'prices',
    q: 'How do price limits work?',
    keywords: ['price limit', 'min price', 'max price', 'price range', 'budget', 'too expensive'],
    a: 'Both bounds are optional. Blank means unbounded — a max with no min catches everything under your ceiling. Leaving both blank matches any price, which is useful when you are still learning what an item goes for.',
  },
  {
    id: 'timestamps',
    q: 'What does "Found 2m ago" mean?',
    keywords: ['found ago', 'timestamp', 'posted vs', 'what does found', 'time ago', 'how old'],
    a: '"Found" is when PixelFlip discovered the listing. "Posted" is when the seller put it up. A listing can be posted hours ago but only found just now if it recently matched your filters.',
  },
  {
    id: 'stop-scanner',
    q: 'How do I stop the scanner?',
    keywords: ['stop', 'pause', 'turn off', 'halt', 'disable scan'],
    a: 'Hit Stop on the dashboard. A scan already in progress finishes its current marketplace and then stops, so it can take a few seconds to wind down.',
  },
  {
    id: 'push',
    q: 'Why do push notifications not work?',
    keywords: ['push', 'browser notification', 'desktop notification', 'https'],
    a: 'Push requires a secure HTTPS connection, so it will not work over a plain local network address. On iPhone you also have to add PixelFlip to your home screen first — iOS only allows push for installed web apps.',
  },
  {
    id: 'billing',
    q: 'How do I change or cancel my plan?',
    keywords: ['cancel', 'billing', 'refund', 'payment', 'subscription', 'charge', 'invoice', 'card'],
    a: 'Account → Manage Billing opens the Stripe portal, where you can switch plan, update your card, or cancel. Cancelling leaves access running until the end of the period you already paid for.',
  },
];

/**
 * Score by total matched keyword length so a specific phrase beats an
 * incidental short word — "notification" should outrank "no".
 */
export async function answerQuestion(input) {
  const text = (input || '').toLowerCase().trim();
  if (!text) return null;

  let best = null;
  let bestScore = 0;
  for (const topic of HELP_TOPICS) {
    let score = 0;
    for (const k of topic.keywords) {
      if (text.includes(k)) score += k.length;
    }
    if (score > bestScore) {
      best = topic;
      bestScore = score;
    }
  }

  // Below this, the match is one incidental short word and the answer would
  // more likely mislead than help — better to hand off to a human.
  return bestScore >= 5 ? best : null;
}

/** Shown as tappable starters so nobody faces an empty box. */
export const SUGGESTED = HELP_TOPICS.slice(0, 4).map((t) => t.q);
