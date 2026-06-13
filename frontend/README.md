# paisa — frontend (Next.js 16)

Mobile-first PWA. Dark "Midnight Ledger" aesthetic: warm charcoal base, vivid
chartreuse accent, tabular-mono numbers, bottom nav + center FAB, bottom-sheet
entry. Built with the App Router, React 19, Tailwind CSS, and `next/font`.

## Run locally

```bash
npm install
copy .env.local.example .env.local      # bash: cp
npm run dev                              # http://localhost:3000
```

Point `NEXT_PUBLIC_API_URL` at the backend (default `http://localhost:8000`).

## Environment

| Var | Notes |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend base URL, no trailing slash. |
| `NEXT_PUBLIC_VAPID_KEY` | VAPID **public** key (base64url) for Web Push. Must match the backend's `VAPID_PUBLIC_KEY`. |

## Structure

```
app/
  layout.tsx          fonts, metadata, viewport, providers, service worker
  page.tsx            home dashboard (spend hero, category bars, recent)
  category/[slug]/    drill-down: items in a category this month
  orders/[id]/        order detail — edit/delete items, delete order
  fees/               platform fees (the hidden cost of convenience)
  budgets/            monthly envelopes with burn-down bars
  weekly/             weekly digest
components/
  ui/                 Button, Card, BottomSheet, BarChart, BurnBar, Skeleton, Badge, Toast
  entry/              AddSheetProvider, ManualForm, UploadFlow, ReviewCards, CategoryPicker, ChargesCollapse
  dashboard/          BudgetHero, CategoryBreakdown, RecentEntries, Fab
  AppShell.tsx        nav + atmosphere   ·   Icons.tsx   ·   ServiceWorkerRegister.tsx
lib/
  api.ts types.ts categories.ts format.ts hooks/usePush.ts
public/
  manifest.webmanifest  sw.js  icons/
```

## PWA

- `public/manifest.webmanifest` + a hand-written `public/sw.js` (push +
  `notificationclick`). The SW is registered client-side in `layout.tsx`.
- **App icons:** `public/icons/icon.svg` is the source mark. Export PNGs from it
  so the manifest's raster entries resolve:
  - `icon-192.png` (192×192)
  - `icon-512.png` (512×512)
  - `icon-maskable-512.png` (512×512, safe-zone padded)

  e.g. with [sharp](https://sharp.pixelplumbing.com/) or
  `npx @resvg/resvg-js` / any SVG→PNG tool. The SVG icon alone works in most
  modern browsers if you skip this.
- **iOS:** Web Push requires **Add to Home Screen** (installed PWA). Surface this
  prominently to users on iOS — browser-tab Safari won't deliver pushes.

## Enabling notifications

Generate a VAPID keypair on the backend (see `backend/README.md`), put the
public key in `NEXT_PUBLIC_VAPID_KEY`, then call `usePush().subscribe(hour)`
from a settings UI (or wire it to a toggle). `usePush().sendTest()` fires a
server-side test push to all subscriptions.

## Notes

- `next lint` was removed in Next 16; linting runs via ESLint flat config
  (`eslint.config.mjs`) — `npm run lint`.
- Tailwind v3 (PostCSS) is used intentionally; it works with Next 16 + Turbopack.
