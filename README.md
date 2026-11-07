# MATLOG — iPhone-first training tracker

A static, mobile-first training tracker that can be deployed to GitHub Pages. It comes preloaded with the historical data extracted from `bjj.tracking_cloud.numbers`.

## Included

- **Overview** — all-time and yearly mat hours, coached hours, open mat hours, classes, Gi/No-Gi split, monthly/yearly chart, recent training.
- **Training Log** — searchable historical sessions and dated training/technique notes with filters. Tap an individual session to edit it.
- **Rollups** — annual totals, school hours, school drop-ins, belt milestones, 25 seminars.
- **Floating +** — add or edit a dated training block with type, duration, gym, training focus and notes. Automatically recalculates statistics.
- **Backups** — download JSON, export sessions CSV, merge a JSON backup, or restore the starting dataset.
- **iOS** — iPhone Safari sizing, bottom-sheet entry form, Add to Home Screen support, offline cache after first successful visit.

## Source-data reconciliation

The historical dataset covers 2023 through November 7, 2026. The imported session records reconcile **exactly** with the workbook's stored annual mat-hour and class totals:

| Year | Mat hours | Classes |
|---|---:|---:|
| 2023 | 376.25 | 225 |
| 2024 | 637.75 | 292 |
| 2025 | 589.50 | 251 |
| 2026 | 296.50 | 141 |
| **Total** | **1,900.00** | **909** |

Original years 2023–26 have 1,837 training blocks. The export also includes 365 dated note records, school rollup totals, 47 named drop-in schools, 25 seminars and recorded belt dates. An empty 2027 worksheet was not imported. Original daily sessions do not include a gym field; historical gym-hour totals are taken from the separate summary table. New entries can specify a gym and those hours are incorporated into rollups.

One nuance in the source: the 2024 daily mat-hour formulas include 11 additional coaching hours not assigned to one of the six main training columns. These are imported as `Coaching` blocks, so the overall total remains correct. The source also has two 2026 half-hour Gi sessions with a zero class-count flag; those flags are preserved.

## Publish to a new GitHub Pages repository

1. Create your new GitHub repository.
2. Upload the **contents of this ZIP** directly to the repository's root, keeping `index.html`, `app.js`, `style.css`, `data/`, and `icons/` together.
3. Commit to the `main` branch.
4. Go to **Settings → Pages** and choose **Deploy from a branch**, branch **main**, folder **/(root)**, then Save.
5. Open the GitHub Pages site on your iPhone. Optionally select **Share → Add to Home Screen** in Safari.

To preview on a computer without publishing, run `python3 -m http.server 8000` from this folder and visit `http://localhost:8000`. Opening `index.html` as a `file://` page does not work, because modern browsers restrict JSON fetches from local files.

## Important storage limitation

**This initial version uses the browser's `localStorage`.** New entries are saved to the iPhone/browser where they were entered. GitHub Pages itself is read-only; it **does not write new entries back to GitHub**, and entries **do not automatically sync** between devices. Clearing Safari website data can erase new entries. Download a JSON backup periodically from the gear icon, and do not rely on Private Browsing. The JSON file can be re-imported on another device. If a true cloud-synced log is needed, a small authenticated backend/database or GitHub-backed write service can be added later.

## Files

- `index.html` — page structure and entry/backup dialogs.
- `style.css` — the compact forest-green / cream iOS design.
- `app.js` — entry management, totals, charts, filters, and backup logic.
- `data/seed.json` — original training history and summary metadata; do not delete.
- `manifest.webmanifest`, `service-worker.js`, `icons/` — home screen and offline basics.

No build step, API key, tracking, analytics, or external dependency is required.
