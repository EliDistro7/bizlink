/**
 * resolveDateRange — parses startDate / endDate query params or falls back to
 * the current calendar month.
 *
 * Accepted query params:
 *   ?startDate=2024-01-01&endDate=2024-01-31
 *   ?preset=today | week | month | year
 *
 * Returns: { startDate: Date, endDate: Date }
 */
const resolveDateRange = (query = {}) => {
  const { startDate, endDate, preset } = query;

  if (startDate && endDate) {
    return {
      startDate: new Date(startDate),
      endDate:   new Date(new Date(endDate).setHours(23, 59, 59, 999)),
    };
  }

  const now = new Date();

  if (preset === 'today') {
    return {
      startDate: new Date(now.setHours(0, 0, 0, 0)),
      endDate:   new Date(new Date().setHours(23, 59, 59, 999)),
    };
  }

  if (preset === 'week') {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay()); // Sunday
    start.setHours(0, 0, 0, 0);
    return {
      startDate: start,
      endDate:   new Date(new Date().setHours(23, 59, 59, 999)),
    };
  }

  if (preset === 'year') {
    return {
      startDate: new Date(now.getFullYear(), 0, 1),
      endDate:   new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999),
    };
  }

  // Default: current calendar month
  return {
    startDate: new Date(now.getFullYear(), now.getMonth(), 1),
    endDate:   new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
  };
};

module.exports = { resolveDateRange };