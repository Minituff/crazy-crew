import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import webpush from 'web-push';
import matter from 'gray-matter';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json());

const ITINERARIES_DIR = '/data/itineraries';
const CUSTOM_TRIPS_PATH = '/data/custom-trips.json';
const VAPID_KEYS_PATH = '/data/vapid_keys.json';
const PUSH_SUBS_PATH = '/data/push_subscriptions.json';

const PORT = process.env.PORT || 3000;

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

// ── Web Push (VAPID) setup ─────────────────────────────────────────────────
function getVapidKeys() {
  if (fs.existsSync(VAPID_KEYS_PATH)) {
    return JSON.parse(fs.readFileSync(VAPID_KEYS_PATH, 'utf8'));
  }
  const keys = webpush.generateVAPIDKeys();
  fs.mkdirSync('/data', { recursive: true });
  fs.writeFileSync(VAPID_KEYS_PATH, JSON.stringify(keys, null, 2));
  console.log('VAPID keys generated');
  return keys;
}

const vapidKeys = getVapidKeys();
webpush.setVapidDetails('mailto:crazy-crew@localhost', vapidKeys.publicKey, vapidKeys.privateKey);

function readPushSubs() {
  try { if (fs.existsSync(PUSH_SUBS_PATH)) return JSON.parse(fs.readFileSync(PUSH_SUBS_PATH, 'utf8')); } catch {}
  return [];
}

function savePushSubs(subs) {
  fs.mkdirSync('/data', { recursive: true });
  fs.writeFileSync(PUSH_SUBS_PATH, JSON.stringify(subs, null, 2));
}

function sanitizePushSub(sub) {
  let host = '';
  try { host = new URL(sub.endpoint).host; } catch {}
  return {
    deviceId: sub.deviceId || '',
    endpoint: sub.endpoint,
    endpointHost: host,
    label: sub.metadata?.label || sub.deviceId || host || 'Notification device',
    browser: sub.metadata?.browser || '',
    platform: sub.metadata?.platform || '',
    language: sub.metadata?.language || '',
    timezone: sub.metadata?.timezone || '',
    createdAt: sub.createdAt || null,
    updatedAt: sub.updatedAt || null,
  };
}

let lastPushReport = null;

async function sendPushToAll(payload) {
  const subs = readPushSubs();
  const startedAt = new Date().toISOString();
  if (!subs.length) {
    lastPushReport = { startedAt, finishedAt: startedAt, attempted: 0, succeeded: 0, failed: 0, expired: 0 };
    return lastPushReport;
  }
  const dead = [];
  let succeeded = 0;
  let failed = 0;
  await Promise.all(subs.map(async (sub, i) => {
    try {
      await webpush.sendNotification(sub, JSON.stringify(payload));
      succeeded++;
    } catch (e) {
      if (e.statusCode === 410 || e.statusCode === 404) dead.push(i);
      failed++;
      if (e.statusCode !== 410 && e.statusCode !== 404) console.error('Push send failed:', e.message);
    }
  }));
  if (dead.length) savePushSubs(subs.filter((_, i) => !dead.includes(i)));
  lastPushReport = {
    startedAt,
    finishedAt: new Date().toISOString(),
    attempted: subs.length,
    succeeded,
    failed,
    expired: dead.length,
  };
  return lastPushReport;
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

// ── API ─────────────────────────────────────────────────────────────────────
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
app.get('/api/push/vapid-public-key', (req, res) => res.json({ publicKey: vapidKeys.publicKey }));

app.post('/api/push/subscribe', (req, res) => {
  const sub = req.body;
  if (!sub?.endpoint) return res.status(400).json({ error: 'Invalid subscription' });
  const subs = readPushSubs();
  const deviceId = typeof sub.deviceId === 'string' ? sub.deviceId : null;
  const previous = subs.find(s => (deviceId && s.deviceId === deviceId) || s.endpoint === sub.endpoint);
  const now = new Date().toISOString();
  const savedSub = { ...sub, createdAt: previous?.createdAt || now, updatedAt: now };
  const next = subs.filter(s => {
    if (s.endpoint === sub.endpoint) return false;
    if (deviceId && s.deviceId === deviceId) return false;
    return true;
  });
  next.push(savedSub);
  savePushSubs(next);
  res.json({ ok: true, count: next.length });
});

app.delete('/api/push/subscribe', (req, res) => {
  const { endpoint, deviceId } = req.body;
  if (!endpoint && !deviceId) return res.status(400).json({ error: 'No endpoint or deviceId' });
  const subs = readPushSubs();
  const filtered = subs.filter(s => {
    if (endpoint && s.endpoint === endpoint) return false;
    if (deviceId && s.deviceId === deviceId) return false;
    return true;
  });
  savePushSubs(filtered);
  res.json({ ok: true, removed: subs.length - filtered.length, count: filtered.length });
});

app.delete('/api/push/subscriptions/others', (req, res) => {
  const { endpoint, deviceId } = req.body;
  if (!endpoint && !deviceId) return res.status(400).json({ error: 'No endpoint or deviceId' });
  const subs = readPushSubs();
  const filtered = subs.filter(s => {
    if (deviceId) return s.deviceId === deviceId;
    return s.endpoint === endpoint;
  });
  savePushSubs(filtered);
  res.json({ ok: true, removed: subs.length - filtered.length, count: filtered.length });
});

app.get('/api/push/subscriptions', (req, res) => {
  const currentDeviceId = typeof req.query.currentDeviceId === 'string' ? req.query.currentDeviceId : '';
  const subscriptions = readPushSubs().map(sub => ({
    ...sanitizePushSub(sub),
    isCurrent: !!currentDeviceId && sub.deviceId === currentDeviceId,
  }));
  res.json({ subscriptions, count: subscriptions.length, lastPushReport });
});

app.delete('/api/push/subscriptions/:deviceId', (req, res) => {
  const { deviceId } = req.params;
  if (!deviceId) return res.status(400).json({ error: 'No deviceId' });
  const subs = readPushSubs();
  const filtered = subs.filter(s => s.deviceId !== deviceId);
  savePushSubs(filtered);
  res.json({ ok: true, removed: subs.length - filtered.length, count: filtered.length });
});

app.get('/api/push/subscriptions/count', (req, res) => res.json({ count: readPushSubs().length }));

app.post('/api/notify/test', async (req, res) => {
  const subs = readPushSubs();
  if (!subs.length) return res.json({ ok: false, error: 'No push subscriptions — open the app in the browser first to register.' });
  const report = await sendPushToAll({
    title: 'Crazy Crew — Test',
    body: 'Push notifications are working! 🎉',
    tag: 'test',
    url: '/',
  });
  res.json({ ok: true, report });
});

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
