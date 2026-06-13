# paisa

> A mobile-first PWA for tracking personal daily expenses. Built for visibility: where the money goes, how much is lost to platform fees, and which categories are trending over budget.

The one non-negotiable feature: an **end-of-day push notification** that prompts you to log the day's spend. Everything else exists to keep that logging habit alive.

---

## Monorepo layout

```
paisa/
├── backend/        FastAPI — parsing pipeline, DB, summaries, push, cron
│   ├── app/
│   │   ├── main.py            FastAPI app + lifespan (pool, migrations, scheduler)
│   │   ├── config.py          env settings (pydantic-settings)
│   │   ├── db.py              asyncpg pool + migration runner
│   │   ├── schemas.py         canonical Pydantic models (single source of truth)
│   │   ├── crud.py            all SQL (asyncpg)
│   │   ├── categorizer.py     auto-tagging + learned corrections
│   │   ├── push.py            web-push via pywebpush + VAPID
│   │   ├── scheduler.py       APScheduler — habit nudge + weekly digest
│   │   ├── parsing/           pdfplumber → deterministic → GLM fallback; image → glm-ocr → glm-4.7-flash
│   │   └── routers/           parse, orders, items, summary, budgets, notifications
│   └── migrations/001_init.sql
└── frontend/       Next.js 16 (App Router) PWA — "Midnight Ledger" dark UI
    ├── app/                   dashboard, category drill-down, fees, budgets, weekly
    ├── components/            ui primitives, AppShell, entry sheet, dashboard widgets
    ├── lib/                   typed API client, types, categories, format, push hook
    └── public/                manifest + service worker
```

## Tech stack

| Layer             | Choice                                       | Why                                     |
| ----------------- | -------------------------------------------- | --------------------------------------- |
| Frontend          | Next.js 16 (React 19) + Tailwind + next/font | PWA, mobile-first, Vercel auto-deploy   |
| Push              | Web Push API + service worker                | Native PWA, free, works on Android      |
| Backend           | FastAPI (Python)                             | PDF parsing + GLM calls in one language |
| DB                | Neon (serverless Postgres) via asyncpg       | Generous free tier, no infra            |
| PDF parse         | pdfplumber → deterministic parser            | Free, local, zero API cost              |
| PDF fallback      | `glm-4.7-flash` (free)                       | Fires only when the parser is unsure    |
| Image OCR + parse | `glm-ocr` → `glm-4.7-flash`                  | OCR to markdown, then coerce to schema  |
| Hosting           | Vercel (frontend) + Railway (backend)        | Free tiers, zero-config deploys         |
| Auth              | None                                         | Single user                             |

## The parsing pipeline

**PDF** (Blinkit / Instamart / Zomato invoices):
`pdfplumber → deterministic parser → structured JSON`. If parser confidence `< 0.6`, the raw text is sent to the free `glm-4.7-flash` to coerce into the schema.

**Image** (Swiggy screenshots, photos):
`glm-ocr (/layout_parsing) → markdown → glm-4.7-flash → structured JSON`. Always flagged `needs_review` so you confirm before saving.

Both flows emit the **same canonical JSON** before DB insertion. **Charges are never folded into item costs or category budgets** — they flow only into the Platform Fees tab.

> ⚠️ **GLM image request shape:** the `glm-ocr` call sends the image as a base64 data-URI in the `file` field, per the [docs](https://docs.z.ai/guides/vlm/glm-ocr) (which also show a URL form). This is the one line to adjust if the live API expects a different shape — see the comment in `backend/app/parsing/glm_client.py`.

## Quick start

### Backend

```bash
cd backend
python -m venv .venv && .venv\Scripts\activate   # PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env                            # then fill in values
uvicorn app.main:app --reload
```

Migrations run automatically on startup against `DATABASE_URL`. See `backend/README.md` for env details and Neon setup.

> **Local Postgres in one command:** `docker compose up -d db` starts a Postgres matching the backend's default DSN (`postgresql://postgres:postgres@localhost:5432/paisa`). Or `docker compose --profile full up` to run Postgres + the API together.

### Frontend

```bash
cd frontend
npm install
copy .env.local.example .env.local                # set NEXT_PUBLIC_API_URL + NEXT_PUBLIC_VAPID_KEY
npm run dev
```

See `frontend/README.md` for PWA icon export and VAPID key generation.

### Generating VAPID keys

```bash
pip install pywebpush
python -c "from py_vapid import Vapid01; v=Vapid01(); v.generate_keys(); print(v.private_key, v.public_key)"
```

Put the public key in both `NEXT_PUBLIC_VAPID_KEY` (frontend) and `VAPID_PUBLIC_KEY` (backend); the private key only in the backend.

## Categories

Fixed set of 8 — no user-defined categories in MVP:

Food & Dining · Groceries & Essentials · Transport · Health & Personal Care · Shopping · Entertainment · Utilities & Subscriptions · Other

Auto-tagging = platform + item-name keywords → category. Corrections you make are persisted (`category_corrections`) and improve future tagging for the same item name.

## Deploy

- **Vercel** → `frontend/` (auto-deploys from GitHub, HTTPS for Web Push).
- **Railway** → `backend/` (Dockerfile, `railway.toml`).
- **Neon** → Postgres, set `DATABASE_URL`.
- HTTPS is required for Web Push; Vercel/Railway handle it automatically.

## Out of scope for MVP

Gmail OAuth receipt fetch · UPI SMS parsing · dark-mode toggle (built dark-first) · CSV/PDF export · recurring-expense detection · multi-user · investments.
