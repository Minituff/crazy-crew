import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';
import { initPush, sendPushToAll, mountPushRoutes } from './push.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json());

const ITINERARIES_DIR = '/data/itineraries';
const CUSTOM_TRIPS_PATH = '/data/custom-trips.json';
const PORT = process.env.PORT || 3000;

// Initialize push notifications (loads/generates VAPID keys)
initPush();

// ── Helpers ────────────────────────────────────────────────────────────────

// gray-matter/js-yaml auto-converts YYYY-MM-DD strings to Date objects
function normDate(val) {
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  return String(val || '');
}

function todayString() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: process.env.TZ || 'America/Los_Angeles',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function todayWeekday() {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: process.env.TZ || 'America/Los_Angeles',
    weekday: 'long',
  }).format(new Date());
}

function extractWeekdaySection(markdown, weekday) {
  const lines = markdown.split('\n');
  let inSection = false;
  const body = [];
  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (inSection) break;
      if (line.trim() === `## ${weekday}`) inSection = true;
    } else if (inSection) {
      body.push(line);
    }
  }
  return body.join('\n').trim();
}

// ── Daily 9am push scheduler ───────────────────────────────────────────────
let lastFiredKey = null;
setInterval(async () => {
  const now = new Date();
  if (now.getHours() !== 9 || now.getMinutes() !== 0) return;
  const firedKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}-540`;
  if (lastFiredKey === firedKey) return;
  lastFiredKey = firedKey;

  const today = todayString();
  const weekday = todayWeekday();
  let pushTitle = null;
  let pushBody = null;

  if (fs.existsSync(ITINERARIES_DIR)) {
    for (const file of fs.readdirSync(ITINERARIES_DIR)) {
      if (!file.endsWith('.md')) continue;
      const raw = fs.readFileSync(path.join(ITINERARIES_DIR, file), 'utf8');
      const { data: fm, content } = matter(raw);
      const fmStart = normDate(fm.start), fmEnd = normDate(fm.end);
      if (!fmStart || !fmEnd || today < fmStart || today > fmEnd) continue;
      const section = extractWeekdaySection(content, weekday);
      if (section) {
        pushTitle = `${fm.emoji || '✈️'} ${fm.title || 'Trip Day!'}`;
        pushBody = section.replace(/^#+\s*/gm, '').replace(/\*\*/g, '').trim().slice(0, 200);
        break;
      }
    }
  }

  if (!pushTitle) {
    console.log('[scheduler] No active itinerary today, skipping push');
    return;
  }

  console.log(`[scheduler] Sending 9am trip push — ${pushTitle}`);
  await sendPushToAll({
    title: pushTitle,
    body: pushBody || "Today's itinerary is ready!",
    tag: 'daily-trip',
    url: '/',
  });
}, 20000);

// ── Itinerary helpers ──────────────────────────────────────────────────────
function readAllItineraries() {
  const trips = [];
  const today = todayString();

  if (fs.existsSync(ITINERARIES_DIR)) {
    for (const file of fs.readdirSync(ITINERARIES_DIR)) {
      if (!file.endsWith('.md')) continue;
      const slug = file.replace(/\.md$/, '');
      try {
        const raw = fs.readFileSync(path.join(ITINERARIES_DIR, file), 'utf8');
        const { data: fm } = matter(raw);
        const start = normDate(fm.start), end = normDate(fm.end);
        trips.push({
          slug,
          title: fm.title || slug,
          emoji: fm.emoji || '✈️',
          start,
          end,
          location: fm.location || '',
          cover_color: fm.cover_color || '#FF6B35',
          type: 'markdown',
          active: today >= start && today <= end,
          current: fm.current === true,
        });
      } catch (e) {
        console.error(`Failed to parse ${file}:`, e.message);
      }
    }
  }

  try {
    if (fs.existsSync(CUSTOM_TRIPS_PATH)) {
      const customs = JSON.parse(fs.readFileSync(CUSTOM_TRIPS_PATH, 'utf8'));
      for (const t of customs) {
        trips.push({
          ...t,
          type: 'custom',
          active: today >= String(t.start) && today <= String(t.end),
          current: t.current === true,
        });
      }
    }
  } catch (e) {
    console.error('Failed to parse custom-trips.json:', e.message);
  }

  trips.sort((a, b) => a.start.localeCompare(b.start));
  return trips;
}

// ── Itinerary API ──────────────────────────────────────────────────────────
app.get('/api/itineraries', (req, res) => {
  res.json(readAllItineraries());
});

app.get('/api/itineraries/:slug', (req, res) => {
  const { slug } = req.params;
  const filePath = path.join(ITINERARIES_DIR, `${slug}.md`);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });
  const raw = fs.readFileSync(filePath, 'utf8');
  const { data: fm, content } = matter(raw);
  const frontmatter = { ...fm, start: normDate(fm.start), end: normDate(fm.end) };
  res.json({ slug, frontmatter, raw: content });
});

// ── Push API ───────────────────────────────────────────────────────────────
mountPushRoutes(app);

// ── Static serving + SPA fallback ─────────────────────────────────────────
app.get('/sw.js', (req, res) => {
  res.setHeader('Service-Worker-Allowed', '/');
  res.sendFile(path.join(__dirname, '../public/sw.js'));
});

app.use(express.static(path.join(__dirname, '../public')));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => console.log(`Crazy Crew server on port ${PORT}`));
