'use strict';

/**
 * GET /api/members?q=&cadre=&status=&county=&page=1&perPage=12
 *
 * Paginated search across the registry. Used by the /members directory page.
 */

const { search, publicView, STATUSES } = require('../lib/members');

module.exports = (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const query = req.query || {};

  try {
    const result = search({
      q: query.q,
      cadre: query.cadre,
      status: query.status,
      county: query.county,
      page: query.page,
      perPage: query.perPage
    });

    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');

    return res.status(200).json({
      total: result.total,
      page: result.page,
      perPage: result.perPage,
      totalPages: result.totalPages,
      statuses: STATUSES,
      results: result.results.map(publicView)
    });
  } catch (err) {
    return res.status(500).json({
      error: 'Registry search failed',
      detail: 'The registry could not be read. Please try again.'
    });
  }
};
