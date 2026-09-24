'use strict';

/**
 * Shared registry access layer used by every serverless function in /api.
 *
 * The dataset is read from data/members.json. Swap this module's `loadRegistry`
 * for a real database call (Postgres, Supabase, etc.) when authoritative data
 * becomes available — the rest of the codebase only depends on the shapes
 * returned from here.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_FILE = path.join(process.cwd(), 'data', 'members.json');
const CACHE_TTL_MS = 60 * 1000;

const STATUSES = ['Active', 'Expired', 'Suspended', 'Provisional'];
const PAGE_SIZE = 12;

let cache = { loadedAt: 0, value: null };

function loadRegistry() {
  const now = Date.now();
  if (cache.value && now - cache.loadedAt < CACHE_TTL_MS) {
    return cache.value;
  }

  const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const members = Array.isArray(raw) ? raw : raw.members || [];
  const value = { members, meta: (raw && raw._meta) || {} };
  cache = { loadedAt: now, value };
  return value;
}

/** Uppercase and strip separators so "kmltt/mlt/00118" === "KMLTT-MLT-00118". */
function normalise(value) {
  return String(value == null ? '' : value)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function normaliseRegNumber(value) {
  return normalise(value);
}

function findByRegistration(regNumber) {
  const target = normaliseRegNumber(regNumber);
  if (!target) return null;
  return loadRegistry().members.find((m) => normaliseRegNumber(m.regNumber) === target) || null;
}

function matchesQuery(member, term) {
  const haystack = [
    member.regNumber,
    member.name,
    member.cadre,
    member.county,
    member.facility,
    member.qualification
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(term);
}

/**
 * Paginated, filtered search over the registry.
 * @param {{q?: string, cadre?: string, status?: string, county?: string, page?: number, perPage?: number}} options
 */
function search(options) {
  const opts = options || {};
  const term = String(opts.q || '').trim().toLowerCase();
  const cadre = String(opts.cadre || '').trim().toLowerCase();
  const status = String(opts.status || '').trim().toLowerCase();
  const county = String(opts.county || '').trim().toLowerCase();

  const perPage = Math.min(Math.max(Number(opts.perPage) || PAGE_SIZE, 1), 100);
  const page = Math.max(Number(opts.page) || 1, 1);

  let results = loadRegistry().members.slice();

  if (term) results = results.filter((m) => matchesQuery(m, term));
  if (cadre) results = results.filter((m) => String(m.cadre).toLowerCase() === cadre);
  if (status) results = results.filter((m) => String(m.status).toLowerCase() === status);
  if (county) results = results.filter((m) => String(m.county).toLowerCase() === county);

  results.sort((a, b) => String(a.name).localeCompare(String(b.name)));

  const total = results.length;
  const totalPages = Math.max(Math.ceil(total / perPage), 1);
  const start = (page - 1) * perPage;

  return {
    results: results.slice(start, start + perPage),
    total,
    page: Math.min(page, totalPages),
    perPage,
    totalPages
  };
}

function summarise() {
  const { members, meta } = loadRegistry();
  const byStatus = {};
  const byCadre = {};
  const counties = new Set();

  STATUSES.forEach((s) => {
    byStatus[s] = 0;
  });

  members.forEach((m) => {
    byStatus[m.status] = (byStatus[m.status] || 0) + 1;
    byCadre[m.cadre] = (byCadre[m.cadre] || 0) + 1;
    if (m.county) counties.add(m.county);
  });

  return {
    total: members.length,
    byStatus,
    byCadre,
    counties: counties.size,
    cadres: meta.cadres || Object.keys(byCadre),
    updatedAt: meta.updatedAt || null,
    dataSource: meta.name || 'Registry'
  };
}

/** Deterministic, shareable verification reference for a lookup. */
function verificationReference(regNumber, isoDate) {
  const seed = `${normaliseRegNumber(regNumber)}|${isoDate.slice(0, 10)}`;
  return `KMLTT-V-${crypto.createHash('sha256').update(seed).digest('hex').slice(0, 10).toUpperCase()}`;
}

/** Public-facing view of a record (keeps internal-only fields out of responses). */
function publicView(member) {
  if (!member) return null;
  const today = new Date().toISOString().slice(0, 10);
  const daysRemaining = member.validUntil
    ? Math.ceil((Date.parse(`${member.validUntil}T23:59:59Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000)
    : null;

  return {
    regNumber: member.regNumber,
    name: member.name,
    cadre: member.cadre,
    status: member.status,
    registeredOn: member.registeredOn || null,
    validFrom: member.validFrom || null,
    validUntil: member.validUntil || null,
    daysRemaining,
    county: member.county || null,
    facility: member.facility || null,
    qualification: member.qualification || null,
    cpdPoints: typeof member.cpdPoints === 'number' ? member.cpdPoints : null
  };
}

module.exports = {
  STATUSES,
  PAGE_SIZE,
  loadRegistry,
  normalise,
  findByRegistration,
  search,
  summarise,
  verificationReference,
  publicView
};
