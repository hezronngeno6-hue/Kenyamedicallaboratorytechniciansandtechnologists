'use strict';

/**
 * GET /api/verify?reg=KMLTT/MLT/00118
 *
 * Looks up a single registration number and returns its registry status.
 * Separators are ignored, so KMLTT-MLT-00118 and kmltt mlt 00118 also match.
 */

const {
  findByRegistration,
  publicView,
  verificationReference
} = require('../lib/members');

module.exports = (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const query = req.query || {};
  const regNumber = String(query.reg || query.id || query.q || '').trim();

  res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');

  if (!regNumber) {
    return res.status(400).json({
      error: 'Missing registration number',
      hint: 'Call /api/verify?reg=KMLTT/MLT/00118'
    });
  }

  try {
    const found = findByRegistration(regNumber);
    const checkedAt = new Date().toISOString();

    if (!found) {
      return res.status(404).json({
        found: false,
        query: regNumber,
        checkedAt,
        message: 'No record matches that registration number in this registry.'
      });
    }

    return res.status(200).json({
      found: true,
      query: regNumber,
      checkedAt,
      reference: verificationReference(found.regNumber, checkedAt),
      member: publicView(found)
    });
  } catch (err) {
    return res.status(500).json({
      error: 'Registry lookup failed',
      detail: 'The registry could not be read. Please try again.'
    });
  }
};
