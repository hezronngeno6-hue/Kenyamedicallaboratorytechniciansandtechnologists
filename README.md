# Kenya Medical Laboratory Technicians and Technologists

Public website and practitioner verification service for **Kenya Medical Laboratory
Technicians and Technologists (KMLTT)**.

It is a zero-dependency static site served by Vercel, backed by three serverless
functions that read the registry dataset.

> **Status: demonstration build.** The registry in `data/members.json` contains
> fictional sample records. It is **not** an official register and must not be used
> for employment, regulatory or clinical decisions. See *Going live* below.

---

## Live URLs

| | |
|---|---|
| Site | https://kenyamedicallab.vercel.app |
| Verify | https://kenyamedicallab.vercel.app/verify |
| Register search | https://kenyamedicallab.vercel.app/members |
| Stats API | https://kenyamedicallab.vercel.app/api/stats |

Deployed on Vercel as project `kenyamedicallab` (team `hezii`), connected to this
GitHub repository, so every push to `main` deploys to production automatically.

---

## Project layout

```
.
├── api/                     Serverless functions (Vercel Node runtime)
│   ├── members.js           GET /api/members  — paginated register search
│   ├── stats.js             GET /api/stats    — aggregate counts
│   └── verify.js            GET /api/verify   — single registration lookup
├── data/
│   └── members.json         Registry dataset (replace with real data)
├── lib/
│   └── members.js           Shared registry access + search helpers
├── public/                  Static site root (Vercel outputDirectory)
│   ├── assets/
│   │   ├── app.js           Client script (nav, stats, verify, directory)
│   │   ├── favicon.svg
│   │   └── style.css
│   ├── 404.html
│   ├── index.html           Landing page
│   ├── members.html         Register search
│   ├── robots.txt
│   └── verify.html          Single verification
├── scripts/
│   ├── generate-qr.js       Verification QR generator (npm run qr)
│   └── local-server.js      Offline preview server (npm run preview)
├── output/                  Generated artefacts (gitignored)
│   └── qr/                  QR PNG/SVG files + gallery
├── package.json
└── vercel.json
```

## API reference

### `GET /api/verify?reg=<registration number>`

Separators are ignored, so `KMLTT/MLT/00118`, `KMLTT-MLT-00118` and `kmltt mlt 00118`
all resolve to the same record.

```json
{
  "found": true,
  "query": "KMLTT/MLT/00118",
  "checkedAt": "2026-09-24T09:12:44.301Z",
  "reference": "KMLTT-V-4F1C8A93B2",
  "member": {
    "regNumber": "KMLTT/MLT/00118",
    "name": "Achieng, Mary Wanjiku",
    "cadre": "Medical Laboratory Technologist",
    "status": "Active",
    "registeredOn": "2016-03-14",
    "validFrom": "2026-01-01",
    "validUntil": "2028-12-31",
    "daysRemaining": 828,
    "county": "Nairobi",
    "facility": "Sample Referral Laboratory, Nairobi",
    "qualification": "BSc Medical Laboratory Sciences",
    "cpdPoints": 42
  }
}
```

Returns `404` with `{"found": false}` when nothing matches, and `400` when `reg` is missing.

### `GET /api/members`

| Parameter | Description |
|---|---|
| `q` | Free-text match against name, registration number, cadre, county, facility, qualification |
| `cadre` | Exact cadre match |
| `status` | `Active` · `Provisional` · `Expired` · `Suspended` |
| `county` | Exact county match |
| `page` | 1-based page number (default `1`) |
| `perPage` | Results per page, 1–100 (default `12`) |

```json
{ "total": 18, "page": 1, "perPage": 12, "totalPages": 2, "results": [ /* … */ ] }
```

### `GET /api/stats`

```json
{
  "total": 18,
  "byStatus": { "Active": 13, "Expired": 2, "Suspended": 2, "Provisional": 1 },
  "byCadre": { "Medical Laboratory Technologist": 9, "…": 0 },
  "counties": 18,
  "cadres": ["…"],
  "updatedAt": "2026-09-24",
  "dataSource": "Sample registry (demonstration only)"
}
```

---

## QR codes

Practitioner QR codes encode a plain verification URL, so any phone camera opens the
registry record. There is no proprietary payload format and no app to install.

```bash
npm run qr -- KMLTT/MLT/00051                          # one practitioner
npm run qr -- --all                                    # the whole register
npm run qr -- KMLTT/MLT/00051 --url http://localhost:4321
```

Output lands in `output/qr/` (gitignored): a 1024px PNG for print, a scalable SVG,
and an `index.html` gallery of everything generated. Codes use error-correction
level **H** (30%) so they stay readable when printed small or creased.

---

## Local development

Requires Node.js 20+ and the Vercel CLI.

```bash
npm install -g vercel     # once
npm run dev               # vercel dev  → http://localhost:3000
```

`npm run dev` serves `public/` as static files and runs `api/*.js` locally, so the
verify and register pages work end to end.

## Deployment

```bash
npm run deploy            # vercel deploy --prod
```

The Vercel project is already linked locally (`.vercel/project.json`) and connected
to this GitHub repository, so pushing to `main` deploys automatically.

`vercel.json` sets `public/` as the static output directory and bundles `data/` into
the API functions via `functions.includeFiles`. Without that setting the functions
fail at runtime with ENOENT on `data/members.json`, because Vercel only traces a
function's own imports by default.

---

## Going live — replacing the sample data

1. **Replace the dataset.** Populate `data/members.json` with authoritative records
   using the same field names. Or, for a real deployment, rewrite
   `loadRegistry()` in `lib/members.js` to query your database — every API
   function consumes it through `findByRegistration`, `search` and `summarise`,
   so nothing else needs to change.
2. **Update the identity and content.** The organisation name, acronym, notices,
   address, phone number and email in `public/*.html` are placeholders
   (`+254 20 000 0000`, `info@kmltt.example`, `P.O. Box 00000–00100`). Replace them
   with the organisation's real details, and confirm the official name and acronym.
3. **Remove the demo notices.** Delete the "Demonstration build / sample data"
   banners on `public/index.html`, `public/verify.html` and `public/members.html`
   once the registry holds real data.
4. **Add a privacy notice and terms.** A public register that names individuals
   should state its lawful basis for publication and how corrections are requested.
5. **Consider access controls.** `/api/*` is currently open and unauthenticated. Add
   rate limiting or an API key if the register must not be bulk-downloaded.

## Licence

Proprietary — all rights reserved.
