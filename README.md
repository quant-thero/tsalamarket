# Tsala Market -- Frontend Prototype

A frontend-only prototype of **Tsala Market**, a fair-price reference system for smallholder
farmers in Botswana (CSI473 Team project). This build implements the UI, the client-side
business logic described in the project's own decision records (D-002) and business rules
(`docs/business-rules.md`), and a synthetic dataset engineered to match `docs/acceptance-criteria.md`
-- but it has **no real backend, no real accounts, and no real payments**.

## Tech stack, and why

| Layer | Choice | Why |
|---|---|---|
| Markup / styling | Plain HTML5 + hand-written CSS (custom properties) | Zero build step, deploys to GitHub Pages by pushing static files as-is. No framework overhead for a prototype this size. |
| Interactivity | Vanilla JavaScript (ES6, no bundler) | Keeps the repo dependency-free and auditable; every `<script>` maps 1:1 to a page. |
| Charts | [Chart.js](https://www.chartjs.org/) via CDN | Lightweight, no build step, good default styling. |
| Font | [Inter](https://fonts.google.com/specimen/Inter) via Google Fonts CDN | Free, highly legible at small sizes -- important for a system also used on basic phones. |
| "Backend" | `localStorage`, wrapped in `assets/js/store.js` | Simulates persistence (submitted entries, audit log, admin-tunable parameters) across page loads without a real server. Swap this module for real API calls when the backend exists. |

No React/Vue/build tooling was used deliberately: GitHub Pages serves the repository's static
files directly, so this structure works the moment Pages is switched on -- no CI, no `npm run build`.

## Structure

```
index.html                     Landing page / role picker
pages/
  check-price.html + .js       UC-01 Check my offer (the core feature)
  dashboard.html + .js         UC-02 Price lookup & trends (Chart.js line chart)
  submit-entry.html + .js      UC-03 Submit a price entry (vendor/buyer/coop lead)
  admin.html + .js             UC-04 Verification queue, audit log, system parameters
  extension-officer.html + .js UC-05 Anonymised aggregate dashboard
  ussd-simulator.html + .js    Feature-phone / USSD channel simulator
assets/
  css/styles.css               Design system (colour tokens, components)
  js/mock-data.js              Synthetic commodities, districts, seeded price entries
  js/store.js                  localStorage-backed data layer
  js/pricing-engine.js         Bucketing, outlier filtering, median, fairness + confidence logic
  js/nav.js                    Shared top navigation
```

## Design system

The palette is deliberately tied to the product, not a generic template:

- **Deep teal/green** (`--brand-*`) -- growth, agriculture, trust; also doubles as the
  "Fair" fairness-flag colour.
- **Botswana blue** (`--blue-*`) -- referencing the national flag's blue (water/rain, hence
  the currency "Pula"); used for the secondary role (vendors/buyers) and informational badges.
- **Harvest amber** (`--amber-*`) -- sun and grain; also the "Below average" fairness flag.
- **Terracotta red** (`--danger-*`) -- farm-gate soil tone; also the "Significantly underpaid"
  flag, so the same colour that warns admins of a rejected entry also warns a farmer of a bad offer.
- **Warm cream/paper** neutrals -- high legibility, avoids a cold "corporate SaaS" white.

## What's real vs. simulated

**Real (runs in your browser, not hardcoded):**
- Unit-to-P/kg normalisation per commodity
- 30-day verified-entry bucketing, 1.5x IQR outlier exclusion, median reference price
- Sample-size/submitter gating with fallback to neighbouring-district then national data
- Fairness classification (Fair / Below average / Significantly underpaid) and confidence
  labelling (High / Medium / Low), against admin-configurable thresholds
- Peer corroboration auto-verification (two independent entries within the tolerance/window)
- An append-only audit log for every admin verify/reject/configure action

**Simulated (frontend-only limitations):**
- No authentication -- role pages are open, not access-controlled
- Data lives in your browser's `localStorage`, not a shared database; open the site in
  another browser/device and you'll see the original seed data again
- The USSD page is a keyboard-driven simulator, not a real telecom gateway session

## Running locally

No build step. Any static file server works, e.g.:

```bash
cd tsala-market-frontend
python3 -m http.server 8080
# visit http://localhost:8080
```

Opening `index.html` directly via `file://` also works, since there are no ES modules or
server-only APIs in use.

## Deploying to GitHub Pages

1. Push this folder's contents to the root of a GitHub repository (or to a `/docs` folder,
   or a `gh-pages` branch -- your choice; the `.nojekyll` file is already included so GitHub
   doesn't try to run Jekyll over the `assets/` folder).
2. In the repo, go to **Settings -> Pages**.
3. Under **Source**, pick the branch/folder you pushed to (e.g. `main` / `/root`).
4. Save. GitHub will publish at `https://<username>.github.io/<repo-name>/`.
5. Because all links are relative (`pages/...`, `../assets/...`), the site works whether it's
   served from the domain root or a subpath -- no extra configuration needed.

## Resetting the demo

The Admin page (`pages/admin.html`) has a **Reset demo data** button that clears `localStorage`
and re-seeds the original synthetic dataset -- useful after a demo session where entries were
submitted or verified.

---
CSI473 Team 16 &middot; frontend prototype &middot; all data shown is synthetic/mocked for demonstration.
