/**
 * utils/dateRange.js
 *
 * Resolves query parameters into a { startDate, endDate } pair of Date objects.
 *
 * Priority:
 *   1. Explicit startDate + endDate  →  use them directly (custom range)
 *   2. preset                        →  resolve to a named window
 *   3. Neither                       →  default to current month (same as preset='month')
 *
 * Accepted query shapes:
 *   ?preset=today
 *   ?preset=week
 *   ?preset=month          (default)
 *   ?preset=year
 *   ?startDate=2025-01-01&endDate=2025-03-31
 *
 * startDate is normalised to 00:00:00.000 UTC.
 * endDate   is normalised to 23:59:59.999 UTC so the entire end day is included.
 */

/**
 * @param {object} query  req.query
 * @returns {{ startDate: Date, endDate: Date }}
 */
const resolveDateRange = (query = {}) => {
  const { preset, startDate, endDate } = query;

  // ── 1. Explicit range ──────────────────────────────────────────────────────
  if (startDate && endDate) {
    const start = parseDay(startDate);
    const end   = endOfDay(parseDay(endDate));

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error(
        `Invalid date range: startDate="${startDate}", endDate="${endDate}". ` +
        'Expected YYYY-MM-DD.'
      );
    }
    if (start > end) {
      throw new Error('startDate must not be after endDate.');
    }
    return { startDate: start, endDate: end };
  }

  // ── 2. Preset ──────────────────────────────────────────────────────────────
  return resolvePreset(preset ?? 'month');
};

// ── Preset resolver ────────────────────────────────────────────────────────────

const resolvePreset = (preset) => {
  const now   = new Date();
  const year  = now.getUTCFullYear();
  const month = now.getUTCMonth();   // 0-indexed
  const day   = now.getUTCDate();

  switch (preset) {
    case 'today': {
      const start = utcMidnight(year, month, day);
      return { startDate: start, endDate: endOfDay(start) };
    }

    case 'week': {
      // Mon–Sun week containing today.
      const dow   = now.getUTCDay();            // 0 = Sun
      const diff  = (dow === 0) ? -6 : 1 - dow; // shift so Mon = 0
      const mon   = new Date(Date.UTC(year, month, day + diff));
      const sun   = new Date(Date.UTC(year, month, day + diff + 6));
      return { startDate: mon, endDate: endOfDay(sun) };
    }

    case 'month': {
      const start = utcMidnight(year, month, 1);
      // Day 0 of next month = last day of current month.
      const end   = utcMidnight(year, month + 1, 0);
      return { startDate: start, endDate: endOfDay(end) };
    }

    case 'year': {
      const start = utcMidnight(year, 0, 1);
      const end   = utcMidnight(year, 11, 31);
      return { startDate: start, endDate: endOfDay(end) };
    }

    default:
      throw new Error(
        `Unknown preset "${preset}". Valid values: today, week, month, year.`
      );
  }
};

// ── Date helpers ───────────────────────────────────────────────────────────────

/** Parse a YYYY-MM-DD string into a UTC midnight Date. */
const parseDay = (str) => {
  // new Date('YYYY-MM-DD') is spec-defined as UTC midnight — no timezone shift.
  const d = new Date(str);
  return d;
};

/** Return a new Date set to 23:59:59.999 UTC on the same calendar day. */
const endOfDay = (d) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));

/** UTC midnight for a given year / month (0-indexed) / day. */
const utcMidnight = (year, month, day) => new Date(Date.UTC(year, month, day));

module.exports = { resolveDateRange };