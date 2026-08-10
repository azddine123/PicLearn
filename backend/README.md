# PicLearn — Backend API

FastAPI service that powers PicLearn's AI pipeline: OCR, LaTeX extraction, subject classification, LLM content generation (summaries/quizzes/flashcards) and RAG-based Q&A over user notes.

See the [root README](../README.md) for the full project overview, screenshots and architecture diagram.

## Stack

| | |
|---|---|
| Framework | FastAPI + Uvicorn (async) |
| Language | Python 3.13 |
| Database | MongoDB (Motor / `AsyncIOMotorClient`) |
| Auth | JWT (`python-jose`) + `bcrypt` |
| OCR | PaddleOCR, EasyOCR, Tesseract (fallback), OpenAI Vision (low-confidence fallback) |
| LLM | OpenAI, Google Gemini, Anthropic Claude |
| RAG | ChromaDB + OpenAI embeddings |
| Rate limiting | SlowAPI |
| Tests | pytest / pytest-asyncio |

## Project structure

```
app/
├── api/
│   ├── routers/        # Routes by domain
│   │   ├── auth.py         # register/login/refresh, OTP flows, profile
│   │   ├── notes.py         # processing, note CRUD, RAG Q&A, search
│   │   ├── study.py         # quizzes, flashcards, progress, stats
│   │   ├── sessions.py      # multi-capture course sessions
│   │   ├── subjects.py      # user-owned subjects
│   │   ├── privacy.py       # GDPR export / account deletion
│   │   └── payments.py      # RevenueCat webhook + premium status
│   └── routes.py        # compatibility aggregator (historical import surface)
├── core/
│   ├── config.py         # Settings (pydantic-settings, reads .env)
│   ├── security.py       # JWT, password hashing
│   ├── exceptions.py      # ServiceUnavailableError -> HTTP 503
│   └── logging.py
├── models/
│   └── schemas.py        # Pydantic request/response models
├── services/
│   ├── pipeline.py         # orchestrates image -> OCR -> LaTeX -> classification -> content
│   ├── ocr_service.py       # dispatches to PaddleOCR / EasyOCR / custom OCR
│   ├── llm_service.py       # multi-provider generation (summary/quiz/flashcards)
│   ├── rag_service.py       # RAG Q&A, embeds + retrieves via ChromaDB
│   ├── embedding_service.py, vector_store_service.py
│   ├── subject_classifier.py, latex_service.py, image_processor.py, pdf_service.py
│   ├── mongodb_service.py   # DB layer (raises ServiceUnavailableError when disconnected)
│   ├── local_storage.py     # uploaded image storage
│   ├── adaptive_learning.py # SM-2 spaced repetition, recommendations
│   ├── gdpr_service.py      # account export/deletion orchestration
│   ├── payments_service.py  # RevenueCat webhook handling
│   └── note_creation.py     # shared capture/finalize note-creation flow
└── main.py               # FastAPI app, middleware, lifespan, image-serving routes
```

## Setup

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

cp .env.example .env   # fill in SECRET_KEY + at least one LLM API key
```

Requires MongoDB 7 running locally (or via `docker compose up -d` from the repo root).

## Run

```bash
uvicorn app.main:app --reload --port 8000
```

- Interactive docs (only when `DEBUG=true`): http://localhost:8000/docs
- Health check: `GET /health`

## Environment variables

Full reference in [.env.example](.env.example). Key ones:

| Variable | Purpose |
|---|---|
| `SECRET_KEY` | Required, ≥ 32 characters |
| `MONGODB_URL`, `DATABASE_NAME` | MongoDB connection |
| `OPENAI_API_KEY` / `GOOGLE_API_KEY` / `ANTHROPIC_API_KEY` | At least one required for generation |
| `OCR_ENGINE`, `OCR_CONFIDENCE_THRESHOLD` | OCR engine and Vision-fallback threshold |
| `EMBEDDING_MODEL`, `VECTOR_STORE_DIR` | RAG embeddings + ChromaDB persistence path |
| `CORS_ORIGINS` | Strict allow-list — never `*` in production |
| `RATE_LIMIT_STORAGE_URI` | `memory://` by default; use Redis with multiple workers |
| `SMTP_*` | Email delivery for OTP codes (optional in dev — OTP is logged instead) |
| `REVENUECAT_WEBHOOK_SECRET`, `FREE_NOTES_MONTHLY_QUOTA` | Premium payments |

## Tests

```bash
source venv/bin/activate
python -m pytest -q
```

Runs against a mocked/disconnected DB by default; CI additionally spins up a real MongoDB 7 service container (see [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)).

## Notes on local data

- `uploads/` — user-uploaded images, gitignored
- `vector_store/` — ChromaDB RAG index (real user note content), gitignored

## Deploying to production

Current live deployment: **`https://piclearn.me`**, backend + Caddy (Docker) on an Azure VM, database on **MongoDB Atlas**. `http://<vps-ip>` also works as an HTTP fallback (see [`../Caddyfile`](../Caddyfile)) for older builds that predate the domain.

The steps below work on any VPS (Azure, Oracle, a plain Hetzner/DigitalOcean box, ...) — swap the provider-specific bits (firewall rules, image name) as needed.

### 1. Database — MongoDB Atlas

1. Create a free **M0** (or the current equivalent free/low-cost tier) cluster at [cloud.mongodb.com](https://cloud.mongodb.com)
2. Database Access → create a user (username/password)
3. Network Access → allow the VPS's public IP (`<vps-ip>/32`) — narrower than `0.0.0.0/0`, update it if the VPS IP changes
4. Copy the connection string — it goes in `MONGODB_URL` on the VPS:
   `mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/aaca_db`

### 2. VPS

Any Ubuntu 24.04 VM works. Install Docker, open inbound ports 80/443 in whatever firewall your provider uses (cloud console security group/NSG *and* any host-level firewall like `ufw`/`iptables` — some providers, notably Oracle Cloud, require both):

```bash
ssh <user>@<vps-ip>
sudo apt update && sudo apt install -y docker.io docker-compose-v2
sudo usermod -aG docker $USER   # log out/in once for this to take effect
```

### 3. Deploy

```bash
git clone https://github.com/azddine123/aaca-project.git
cd aaca-project
cp backend/.env.example backend/.env
nano backend/.env   # MONGODB_URL (Atlas), DEBUG=false, SECRET_KEY, LLM keys, ...
nano Caddyfile       # already set to piclearn.me — change if deploying elsewhere

docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs -f backend
```

No domain yet? See the plain-HTTP fallback in [`../Caddyfile`](../Caddyfile) — Android already allows cleartext HTTP for this app (`usesCleartextTraffic` in `app.json`), so it works, just without TLS.

### 4. Point the mobile app at it

In `frontend/.env`:

```bash
EXPO_PUBLIC_API_URL=https://piclearn.me/api/v1
```

Then rebuild: `cd frontend && npx eas-cli build --platform android --profile preview`.

### Operational note: the backend goes down if the VM does

`restart: unless-stopped` (in `docker-compose.prod.yml`) only restarts the containers automatically when Docker itself restarts — it does **not** bring the VM back up if the VM is stopped or rebooted (manually, by the cloud provider, or by running out of trial credit). If the app suddenly can't reach the backend, check the VM/container status *before* looking for a network or app-side cause:

```bash
ssh <user>@<vps-ip> "sudo docker compose -f ~/aaca-project/docker-compose.prod.yml ps"
ssh <user>@<vps-ip> "sudo docker compose -f ~/aaca-project/docker-compose.prod.yml logs backend --tail 20 --timestamps"
```

Consider free external uptime monitoring (e.g. UptimeRobot pinging `https://piclearn.me/health` every 5 min) to get alerted within minutes instead of discovering an outage hours or days later.
