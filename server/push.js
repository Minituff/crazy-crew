import fs from 'fs';
import webpush from 'web-push';

const VAPID_KEYS_PATH = '/data/vapid_keys.json';
const PUSH_SUBS_PATH = '/data/push_subscriptions.json';

// ── VAPID key management ───────────────────────────────────────────────────
let vapidKeys = null;

function loadVapidKeys() {
  if (fs.existsSync(VAPID_KEYS_PATH)) {
    return JSON.parse(fs.readFileSync(VAPID_KEYS_PATH, 'utf8'));
  }
  const keys = webpush.generateVAPIDKeys();
  fs.mkdirSync('/data', { recursive: true });
  fs.writeFileSync(VAPID_KEYS_PATH, JSON.stringify(keys, null, 2));
  console.log('VAPID keys generated');
  return keys;
}

export function initPush() {
  vapidKeys = loadVapidKeys();
  webpush.setVapidDetails('mailto:crazy-crew@localhost', vapidKeys.publicKey, vapidKeys.privateKey);
}

// ── Subscription storage ───────────────────────────────────────────────────
export function readPushSubs() {
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

// ── Sending ────────────────────────────────────────────────────────────────
let lastPushReport = null;

export async function sendPushToAll(payload) {
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
      if (e.statusCode !== 410 && e.statusCode !== 404) console.error('[push] Send failed:', e.message);
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

// ── API routes ─────────────────────────────────────────────────────────────
export function mountPushRoutes(app) {
  app.get('/api/push/vapid-public-key', (req, res) => {
    res.json({ publicKey: vapidKeys.publicKey });
  });

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

  app.get('/api/push/subscriptions/count', (req, res) => {
    res.json({ count: readPushSubs().length });
  });

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
}
