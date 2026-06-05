# Architecture — Crazy Crew

## Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20 (ESM) |
| Backend | Express 4 — `server/index.js` (app + itinerary + scheduler) + `server/push.js` (all push) |
| Frontend | React 18 + Vite 5 |
| Routing | react-router-dom v6 |
| Markdown rendering | react-markdown + remark-gfm |
| Frontmatter parsing | gray-matter (server-side) |
| Styling | Plain CSS (`global.css`) with CSS custom properties |
| Fonts | Fredoka One (headings) + Nunito (body) — Google Fonts |
| Icons | lucide-react |
| Push notifications | Web Push API with VAPID (`web-push` npm package) |
| Container | Single Docker container (multi-stage prod build) |
| Reverse proxy | Cloudflare tunnel (`crazy-crew.com`) |
| Network | macvlan — `10.1.2.112` prod / `10.1.2.113` dev |

## Container Strategy

**Production** (`docker-compose.yml`):
- Multi-stage Dockerfile: build React with Vite, serve `dist/` as static from Express at `/app/public`
- Express serves both API (`/api/*`) and the React build
- Single port: 3000
- Data bind-mounted from `./data:/data`

**Development** (`docker-compose.dev.yml`):
- Separate `Dockerfile.dev` — no build step, source files mounted as volumes
- `concurrently` runs `nodemon server/index.js` + `vite` in parallel
- Two ports: 3000 (API) + 5173 (Vite dev server — use this in the browser)
- Vite dev server proxies `/api` → `localhost:3000`
- Traefik labels point to port 5173 in dev

## Data Layer

All persistence lives in `/data/` (bind-mounted from `./data/` on host):

| File / Dir | Purpose |
|---|---|
| `itineraries/*.md` | Trip markdown files with YAML frontmatter — committed to repo |
| `custom-trips.json` | Metadata for trips that use custom React pages — committed to repo |
| `vapid_keys.json` | VAPID public/private keys (generated once on first run, gitignored) |
| `push_subscriptions.json` | Browser push subscriptions array (gitignored) |

No database. No ORM. Files read synchronously via `fs` module. gray-matter parses `.md` frontmatter on every request (no caching).

> **gray-matter date quirk**: js-yaml auto-converts bare `YYYY-MM-DD` frontmatter values to JS `Date` objects. The server uses `normDate(val)` (`val instanceof Date ? val.toISOString().slice(0,10) : String(val)`) before storing or comparing any date field.

## Request Flow

```
Browser → Cloudflare → Container
                         ├── GET /api/itineraries          → scan /data/itineraries/*.md + custom-trips.json
                         ├── GET /api/itineraries/:slug    → read + parse single .md file
                         ├── GET /api/push/vapid-public-key
                         ├── POST /api/push/subscribe      → upsert to push_subscriptions.json
                         ├── DELETE /api/push/subscribe
                         ├── GET /api/push/subscriptions
                         ├── DELETE /api/push/subscriptions/others
                         ├── DELETE /api/push/subscriptions/:deviceId
                         ├── GET /api/push/subscriptions/count
                         ├── POST /api/notify/test         → sendPushToAll()
                         ├── GET /sw.js                    → served with Service-Worker-Allowed: / header
                         └── GET /*                        → React build (SPA fallback to index.html)
```

## Client Routing

```
/          → <Home />        — fetches trips, redirects to current/active trip or /trips
/trips     → <AllTrips />    — always shows the card grid, no redirect
/:slug     → <TripRoute />   — checks trips.js registry first, then <ItineraryView slug>
```

**Redirect priority at `/`:**
1. First trip with `current: true` in frontmatter
2. Fallback: first trip where `active === true` (today ≥ start && today ≤ end)
3. Fallback: redirect to `/trips`

## Trip Registry (`client/src/trips.js`)

Markdown trips are auto-discovered server-side. Custom React pages must be registered client-side:

```js
const trips = {
  'beach-2027': { component: lazy(() => import('./pages/BeachPage.jsx')) },
}
```

If a slug is in the registry, `<TripRoute>` lazy-loads the component instead of `<ItineraryView>`.

## Push Scheduler

`setInterval` at 20-second resolution with `lastFiredKey` deduplication (same pattern as cadence). Fires at 9:00 AM (`process.env.TZ` timezone):

1. Scan all `.md` files in `/data/itineraries/`
2. Find one where `today >= start && today <= end`
3. Extract the `## {Weekday}` section from the markdown body
4. `sendPushToAll({ title, body: first 200 chars of section })`
5. If no active itinerary, skip silently

## Itinerary Markdown Format

```yaml
---
title: Big Bear 2026
emoji: 🐻
start: 2026-07-03
end: 2026-07-08
location: Big Bear Lake, CA
cover_color: "#FF6B35"
current: true          # optional — pins this trip as the startup redirect
---

# Trip Title

## Friday

Day content…

## Saturday

Day content…
```

Slug = filename without `.md`. Day headings must match `## {Full Weekday Name}` exactly (e.g., `## Thursday`) for the push scheduler to extract them.

## Custom Trip JSON Format (`data/custom-trips.json`)

```json
[
  {
    "slug": "beach-2027",
    "title": "Beach Trip 2027",
    "emoji": "🏖️",
    "start": "2027-08-10",
    "end": "2027-08-15",
    "location": "Malibu, CA",
    "cover_color": "#00B4D8",
    "current": false
  }
]
```

## Invariants — Never Break These

1. **Two server files only**: `server/index.js` (app + itinerary logic + scheduler) and `server/push.js` (all push concerns). Do not split further.
2. **No database**: `/data/*.md` and `/data/*.json` are the source of truth. Do not introduce SQLite, Redis, or any DB.
3. **Data directory always `/data/`**: Hardcoded — it is the bind-mount contract.
4. **No auth layer**: Access-controlled at the network/Cloudflare level. No session tokens or login flow.
5. **`normDate()` on all gray-matter dates**: Always run frontmatter `start`/`end` through `normDate()` before string comparison or serialization.
6. **`current` priority over `active`**: The startup redirect always prefers `current: true` over the date-based `active` flag.
7. **`/trips` never redirects**: The `/trips` route always shows the full card grid. Only `/` does the smart redirect.

## File Map (Key Files)

```
/opt/docker_volumes/crazy-crew/
├── server/
│   ├── index.js                    ← App setup, itinerary API, scheduler, static serving
│   └── push.js                     ← All push: VAPID init, subscription storage, sendPushToAll, API routes
├── client/
│   ├── src/
│   │   ├── App.jsx                 ← Router: /, /trips, /:slug
│   │   ├── trips.js                ← Custom page registry (lazy imports)
│   │   ├── components/
│   │   │   ├── Home.jsx            ← Smart redirect: current → active → /trips
│   │   │   ├── AllTrips.jsx        ← Card grid (no redirect)
│   │   │   ├── Header.jsx          ← Site header, links to /trips
│   │   │   ├── TripCard.jsx        ← Trip card with ACTIVE NOW badge
│   │   │   ├── ItineraryView.jsx   ← react-markdown renderer + ← All Trips link
│   │   │   └── PushSubscribe.jsx   ← Floating bell button
│   │   ├── lib/
│   │   │   └── push.js             ← VAPID subscribe/unsubscribe helpers
│   │   └── styles/
│   │       └── global.css          ← CSS vars, all component styles
│   └── public/
│       └── sw.js                   ← Service worker (push handler)
├── data/
│   ├── itineraries/                ← Trip markdown files (committed)
│   │   └── bear-2026.md
│   ├── custom-trips.json           ← Custom page trip metadata (committed)
│   ├── vapid_keys.json             ← Generated at runtime (gitignored)
│   └── push_subscriptions.json    ← Generated at runtime (gitignored)
├── context/                        ← Project documentation
├── docker-compose.yml              ← Production (10.1.2.112)
├── docker-compose.dev.yml          ← Dev with hot reload (10.1.2.113)
├── Dockerfile
├── Dockerfile.dev
└── package.json                    ← Express + gray-matter + web-push + nodemon/concurrently
```
