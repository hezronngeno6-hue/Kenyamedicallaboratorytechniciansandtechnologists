'use strict';

/**
 * GET /api/stats
 *
 * Aggregate counts for the homepage counters and the directory filters.
 */

const { summarise } = require('../lib/members');

module.exports = (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
    return res.status(200).json(summarise());
  } catch (err) {
    return res.status(500).json({
      error: 'Statistics unavailable',
      detail: 'The registry could not be read. Please try again.'
    });
  }
};
