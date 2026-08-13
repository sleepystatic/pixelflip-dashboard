import {
  PLAN_INTERVAL_OPTIONS,
  DEFAULT_TERM_INTERVAL,
  FASTEST_TIER_INTERVAL,
  INTERVAL_OPTIONS_FOR_TIER,
  TERM_INTERVAL,
  IS_FAST_TERM,
  TERM_INTERVAL_CHOICES,
  INTERVAL_LABEL,
  FAST_TERMS_BESIDES,
} from './termIntervals';

describe('TERM_INTERVAL — defaults the way the backend does', () => {
  test('reads the stored interval', () => {
    expect(TERM_INTERVAL({ interval: 30 })).toBe(30);
    expect(TERM_INTERVAL({ interval: '15' })).toBe(15);
  });

  // A term saved before migration 012 has no interval at all. It must land on
  // the same default the backend uses, or the UI shows a rate that is not the
  // one being scanned.
  test.each([
    ['missing key', {}],
    ['undefined', { interval: undefined }],
    ['null', { interval: null }],
    ['empty string', { interval: '' }],
    ['junk', { interval: 'abc' }],
    ['zero', { interval: 0 }],
    ['negative', { interval: -5 }],
    ['no object at all', null],
  ])('%s falls back to the default', (_label, prices) => {
    expect(TERM_INTERVAL(prices)).toBe(DEFAULT_TERM_INTERVAL);
  });
});

describe('IS_FAST_TERM', () => {
  test('only the fastest tier counts', () => {
    expect(IS_FAST_TERM({ interval: 5 })).toBe(true);
    expect(IS_FAST_TERM({ interval: 10 })).toBe(false);
    expect(IS_FAST_TERM({})).toBe(false);
  });
});

describe('TERM_INTERVAL_CHOICES', () => {
  test('Pro can pick every rate, including 5', () => {
    const got = TERM_INTERVAL_CHOICES({ plan_tier: 'pro' });
    expect(got.map((c) => c.mins)).toEqual([5, 10, 15, 30, 60]);
    expect(got.every((c) => c.allowed)).toBe(true);
  });

  // The upsell: Basic SEES 5 but cannot choose it. Hiding it would remove the
  // only place the plan difference is visible in the UI.
  test('Basic sees 5 rendered but disabled', () => {
    const got = TERM_INTERVAL_CHOICES({ plan_tier: 'basic' });
    expect(got.map((c) => c.mins)).toEqual([5, 10, 15, 30, 60]);
    expect(got.find((c) => c.mins === 5).allowed).toBe(false);
    expect(got.filter((c) => c.mins !== 5).every((c) => c.allowed)).toBe(true);
  });

  test('an unknown or missing tier is treated as Basic', () => {
    for (const tier of ['inactive', '', null, undefined, 'nonsense']) {
      const got = TERM_INTERVAL_CHOICES({ plan_tier: tier });
      expect(got.find((c) => c.mins === 5).allowed).toBe(false);
    }
    expect(TERM_INTERVAL_CHOICES({}).length).toBe(5);
    expect(TERM_INTERVAL_CHOICES(undefined).length).toBe(5);
  });

  test('the server list wins over the local table', () => {
    const got = TERM_INTERVAL_CHOICES({
      plan_tier: 'basic',
      term_interval_options: [5, 20],
    });
    expect(got.map((c) => c.mins)).toEqual([5, 20]);
    expect(got.every((c) => c.allowed)).toBe(true);
  });

  test('an empty or malformed server list falls back rather than blanking the menu', () => {
    for (const served of [[], null, 'nope', {}]) {
      const got = TERM_INTERVAL_CHOICES({ plan_tier: 'pro', term_interval_options: served });
      expect(got.map((c) => c.mins)).toEqual([5, 10, 15, 30, 60]);
    }
  });

  test('always sorted ascending', () => {
    const got = TERM_INTERVAL_CHOICES({ term_interval_options: [60, 10, 30] });
    expect(got.map((c) => c.mins)).toEqual([5, 10, 30, 60]);
  });

  // The bug this guards: .sort() mutates in place, and `allowed` can BE the
  // module constant or the server's array. Sorting it would reorder the shared
  // table for every later render.
  test('never mutates its inputs', () => {
    const before = [...PLAN_INTERVAL_OPTIONS.pro];
    TERM_INTERVAL_CHOICES({ plan_tier: 'pro' });
    expect(PLAN_INTERVAL_OPTIONS.pro).toEqual(before);

    const served = [60, 10, 5];
    TERM_INTERVAL_CHOICES({ term_interval_options: served });
    expect(served).toEqual([60, 10, 5]);
  });
});

describe('FAST_TERMS_BESIDES — the cap count', () => {
  const thresholds = {
    a: { interval: 5 },
    b: { interval: 5 },
    c: { interval: 30 },
    d: {},
  };

  test('counts other terms at the fastest tier', () => {
    expect(FAST_TERMS_BESIDES(thresholds, 'c')).toBe(2);
  });

  // Re-selecting 5 on a term already at 5 must not be rejected by its own slot.
  test('excludes the term being edited', () => {
    expect(FAST_TERMS_BESIDES(thresholds, 'a')).toBe(1);
    expect(FAST_TERMS_BESIDES(thresholds, 'b')).toBe(1);
  });

  test('handles an empty or missing map', () => {
    expect(FAST_TERMS_BESIDES({}, 'a')).toBe(0);
    expect(FAST_TERMS_BESIDES(null, 'a')).toBe(0);
  });

  test('a term absent from the map still counts the others', () => {
    expect(FAST_TERMS_BESIDES(thresholds, 'zzz')).toBe(2);
  });
});

describe('labels and tier tables', () => {
  test('60 reads as an hour, everything else as minutes', () => {
    expect(INTERVAL_LABEL(60)).toBe('1 HR');
    expect(INTERVAL_LABEL(5)).toBe('5 MIN');
    expect(INTERVAL_LABEL(10)).toBe('10 MIN');
  });

  test('tier tables match the backend', () => {
    expect(INTERVAL_OPTIONS_FOR_TIER('pro')).toEqual([5, 10, 15, 30, 60]);
    expect(INTERVAL_OPTIONS_FOR_TIER('PRO')).toEqual([5, 10, 15, 30, 60]);
    expect(INTERVAL_OPTIONS_FOR_TIER('basic')).toEqual([10, 15, 30, 60]);
    // Bryan's decision: no 45, and Basic's floor is 10.
    expect(INTERVAL_OPTIONS_FOR_TIER('basic')).not.toContain(45);
    expect(INTERVAL_OPTIONS_FOR_TIER('basic')).not.toContain(FASTEST_TIER_INTERVAL);
  });
});
