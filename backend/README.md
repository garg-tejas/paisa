# paisa — backend (FastAPI)

Parsing pipeline, Postgres data layer, monthly/weekly summaries, budget
envelopes, and Web Push (end-of-day nudge + weekly digest).

## Run locally

```bash
python -m venv .venv
.venv\Scripts\Activate.ps1          # PowerShell  (bash: source .venv/bin/activate)
pip install -r requirements.txt
copy .env.example .env               # fill in values
uvicorn app.main:app --reload
```

Need a database? From the repo root: `docker compose up -d db` starts Postgres
matching the default `DATABASE_URL`. Migrations in `migrations/001_init.sql`
run automatically on startup (idempotent).

Docs: open http://localhost:8000/docs (Swagger UI).

## Environment

| Var | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Postgres URL. Neon needs `?sslmode=require` (auto-detected too). |
| `GLM_API_KEY` | for image/OCR | Z.ai key. Image parsing returns 503 without it; manual entry still works. |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | for push | VAPID keypair (below). |
| `VAPID_EMAIL` | for push | Contact `mailto:` for push services. |
| `CORS_ORIGINS` | no | Comma-separated, or `*` (default). |
| `PORT` | no | Defaults to 8000; Railway sets it. |

### Generate VAPID keys

```bash
pip install py-vapid
vapid --gen                      # writes private_key.pem / public_key.pem
vapid --applicationServerKey     # prints the base64url public key for the frontend
```

Use the base64url public key for both `VAPID_PUBLIC_KEY` (backend) and
`NEXT_PUBLIC_VAPID_KEY` (frontend); keep the private key on the backend only.

## Parsing pipeline

- **PDF** → `pdfplumber` text → `deterministic_parser` → if confidence < 0.6,
  the free `glm-4.7-flash` structures the same text. → items categorised.
- **Image** → `glm-ocr` (`/layout_parsing`) → `glm-4.7-flash` → categorised.
  Always `needs_review = true`.

> The `glm-ocr` call sends the image as a base64 data-URI in the `file` field
> (per the docs, which also show a URL form). If the live API differs, change
> the single marked line in `app/parsing/glm_client.py`.

Charges (delivery/handling/platform fee/packaging/rain fee/taxes) are stored
separately and **never** counted toward category spend — they surface only on
`/summary/charges` (the Platform Fees tab).

## API

`GET /health` · `POST /parse/pdf` · `POST /parse/image` · `POST /orders` ·
`GET /orders` · `GET /orders/{id}` · `DELETE /orders/{id}` ·
`PATCH /items/{id}` · `DELETE /items/{id}` · `GET /summary/categories` ·
`GET /summary/charges` · `GET /summary/weekly` · `GET/POST /budgets` ·
`POST /notifications/subscribe` · `POST /notifications/test`

## Scheduler (Asia/Kolkata)

- Hourly: nudge each subscription due at the current hour, **unless** an order
  was logged after 18:00 today.
- Sundays 09:00: weekly digest push.

In-process via APScheduler — fine for a single-instance personal deploy.

## Deploy (Railway)

Dockerfile + `railway.toml` included. Set the env vars in the service, point a
Neon `DATABASE_URL` at it, push. Health check hits `/health`.
