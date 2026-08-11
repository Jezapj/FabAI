# FabAI

Personal wardrobe assistant that suggests weather-aware outfits from your own closet. Upload clothing photos, let the AI classify them, and get daily outfit ideas based on the forecast, formality, and colour preferences.

## Features

- **Google sign-in** for authenticated access, with a **guest mode** for trying the app without an account
- **Persistent sessions** — the signed-in (or guest) profile is cached in `localStorage` for 30 days, so closing the tab doesn't sign you out
- **Swipeable dashboard** with three full-screen views:
  - **Wardrobe** (left): browse, filter, edit, and delete wardrobe items
  - **Home** (center, default): weekly weather forecast and outfit carousel
  - **Add Item** (right): upload photos and view AI classification results
- **Weather-aware outfits** using Open-Meteo forecast data and per-day style settings
- **AI clothing classification** (label, category, warmth value, colour). Colour is sampled from the
  middle 50% of the photo so backdrops don't get mistaken for the garment
- **Staggered menu** for preferences: casual/formal style, colour palette, stats, Settings, and Upgrade to Pro
- **Section-scoped loading overlays** (`Loading...` for wardrobe fetch, `Thinking...` for outfit generation and classification)
- **Installable PWA** with service worker, web manifest, and install prompt (Chrome/Edge and iOS guidance)

## Tech stack

| Layer | Stack |
|-------|--------|
| Frontend | React 18, TypeScript, Vite, GSAP (StaggeredMenu) |
| Backend | Flask, SQLAlchemy, PostgreSQL |
| ML | PyTorch / torchvision (image classification) |
| Auth | Google OAuth (`@react-oauth/google`) |

## Project structure

```
FabAI/
├── backend/           # Flask API, ML model, PostgreSQL models
├── react-app/         # Vite React frontend
│   ├── public/        # Static assets, sw.js, manifest.webmanifest
│   └── src/           # App source (Main.tsx, StaggeredMenu, PWA)
├── docker-compose.yml # Local full stack (backend + db + frontend)
└── .github/workflows/ # CI (Python deps + frontend build)
```

## Local development

### Prerequisites

- Node.js 18+
- Python 3.11+
- PostgreSQL (or use Docker Compose)
- Google Cloud OAuth Web client ID (for sign-in)

### Option 1: Docker Compose

From the repo root:

```bash
docker-compose up --build
```

- Frontend: http://localhost:3000
- Backend: http://localhost:5000
- Postgres: localhost:5432

### Option 2: Run services separately

**Backend**

```bash
cd backend
pip install -r requirements.txt
# Configure DB and env vars, then start Flask (see backend/)
python recolor_items.py  # optional: recompute stored colours for existing items
```

**Frontend**

```bash
cd react-app
cp .env.example .env
npm install
npm run dev
```

## Environment variables

### Frontend (`react-app/.env`)

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API base URL (e.g. `http://localhost:5000`) |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth Web client ID |

These are embedded at **build time**. Set them on your hosting provider before deploying production builds.

### Backend (root `.env` or platform env)

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `DB_PW` | Database password |
| `CORS_ORIGINS` | Allowed frontend origins (e.g. `http://localhost:3000`) |
| `FLASK_SECRET_KEY` | Flask session secret |

## API overview

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Health check |
| `/api/auth` | POST | Verify Google ID token |
| `/api/uploadnx` | POST | Upload clothing image |
| `/api/image/<id>` | GET | Serve stored image |
| `/api/classify_image/<id>` | POST | Run AI classification |
| `/api/inventory` | GET | List user wardrobe |
| `/api/inventory/<id>` | PATCH / DELETE | Update or remove item |
| `/api/outfit` | GET | Generate outfit suggestions |

Outfit query params: `user_id`, `target` (warmth 0-100), `weather_code`, `formality`, `color_preset`.

## PWA installation

The frontend is installable as a Progressive Web App:

- **Manifest:** `react-app/public/manifest.webmanifest`
- **Service worker:** `react-app/public/sw.js` (registered in production only)
- **Icons:** `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`

Icons are square and generated from the landscape source logo by `react-app/scripts/generate-icons.py`
(`python scripts/generate-icons.py` from `react-app/`). Declaring the non-square source directly in
the manifest makes the OS stretch it, which is why the home-screen icon looked squashed.

Install requires **HTTPS** in production. Users see an install banner (or iOS Add to Home Screen instructions). Dismissals are remembered for 7 days.

Verify after deploy:

1. Chrome DevTools > Application > Manifest
2. Application > Service Workers
3. Lighthouse PWA audit (optional)

## Deployment notes

- **Frontend (Railway):** `npm run build` then `npm run start` (`serve -s dist`). Set `VITE_API_URL` and `VITE_GOOGLE_CLIENT_ID` on the web service at build time.
- **Backend:** Gunicorn via `backend/Dockerfile` or Railway (`backend/railway.toml`).
- **Static headers:** `react-app/public/serve.json` sets COOP/COEP and service worker cache headers for `serve`.

Add your production frontend URL to Google Cloud **Authorized JavaScript origins** and backend `CORS_ORIGINS`.

## Scripts

**Frontend (`react-app/`)**

```bash
npm run dev      # Vite dev server (port 3000)
npm run build    # Production build to dist/
npm run start    # Serve dist/ (production)
npm run preview  # Preview production build
```

**CI:** On push/PR to `main` or `Database`, GitHub Actions installs backend Python deps and runs `npm run build` for the frontend.

## Wardrobe categories

The UI uses five filter/edit categories: **Hat**, **Top**, **Bottom**, **Shoes**, and **Other**. Backend categories (e.g. `Optional`, `Head`, `One piece`) are mapped to these labels in the frontend.

## License

Private project. Add a license file if you intend to open-source.
