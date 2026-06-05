# Project Overview — Crazy Crew

## What It Is

Crazy Crew is a self-hosted private family website for planning and sharing trip itineraries. Each trip is a markdown file with frontmatter (title, dates, location, emoji, color). The site auto-redirects to the "current" trip on load, giving everyone in the family an instant full-screen view of what's happening today during an active trip. Between trips, the homepage shows a card grid of all past and upcoming adventures.

Custom React pages can also be registered for trips that deserve a fully bespoke layout beyond markdown (e.g., a cabin trip with a map embed, a beach trip with a photo grid).

Daily 9am push notifications fire during any active trip, sending that day's itinerary section to all subscribed devices.

## Target Users

James's family. Accessed from phones and desktops. Deployed behind Cloudflare tunnel at `crazy-crew.com`. Installed as a PWA for home-screen access and push notification delivery.

## Core User Flows

### 1. Startup / Active Trip
1. Open `crazy-crew.com` — immediately redirects to the active trip's itinerary page
2. Today's full markdown itinerary is displayed
3. Tap "← All Trips" or the header logo to browse other trips

### 2. Browse All Trips
1. Navigate to `/trips` (or tap "Crazy Crew 🎉" in the header)
2. Grid of TripCards — each shows emoji, title, date range, location
3. Active trips have an "ACTIVE NOW" badge
4. Tap a card to open the full itinerary

### 3. Itinerary View
- Markdown rendered with `react-markdown` + `remark-gfm`
- Supports full GFM: tables, bold, lists, links, images
- Day headings (`## Friday`, `## Saturday`, etc.) act as natural section breaks for the push scheduler

### 4. Custom Trip Pages
- Any trip can have a fully custom React component instead of the markdown renderer
- Register in `client/src/trips.js` as a lazy import
- Add metadata to `data/custom-trips.json`
- Component lives in `client/src/pages/` — owns its own styles and layout

### 5. Push Notifications
- Bell icon (bottom-right) to subscribe/unsubscribe per device
- 9am daily push fires for the day's itinerary section while a trip is active
- Works when the app is closed via service worker
- Test push available via `POST /api/notify/test`

## What Is Explicitly Out of Scope

- **Authentication** — access-controlled at the network level (Cloudflare Access). No login flow.
- **User accounts** — single-family, no per-user state.
- **External database** — markdown and JSON are the source of truth.
- **Booking / travel API integrations** — the site is a viewer, not a travel planner.
- **Photo galleries** — images can be embedded in markdown or custom pages, but no gallery component is built in.
- **Multi-language** — English only.
