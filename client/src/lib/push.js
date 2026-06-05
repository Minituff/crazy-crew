function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

function uint8ArraysEqual(a, b) {
  if (!a || !b || a.byteLength !== b.byteLength) return false
  const av = new Uint8Array(a)
  const bv = new Uint8Array(b)
  return av.every((value, i) => value === bv[i])
}

export function getNotificationDeviceId() {
  const storageKey = 'crazycreNotificationDeviceId'
  let deviceId = localStorage.getItem(storageKey)
  if (!deviceId) {
    deviceId = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
    localStorage.setItem(storageKey, deviceId)
  }
  return deviceId
}

function serializeSubscription(sub) {
  return {
    ...sub.toJSON(),
    deviceId: getNotificationDeviceId(),
    metadata: getNotificationDeviceMetadata(),
  }
}

export function getNotificationDeviceMetadata() {
  const ua = navigator.userAgent || ''
  const platform = navigator.userAgentData?.platform || navigator.platform || 'Unknown platform'
  const browser = detectBrowser(ua)
  const label = `${browser} on ${platform}`
  return {
    label,
    browser,
    platform,
    userAgent: ua,
    language: navigator.language || '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
  }
}

function detectBrowser(ua) {
  if (/firefox|fxios/i.test(ua)) return 'Firefox'
  if (/edg\//i.test(ua)) return 'Edge'
  if (/opr\//i.test(ua)) return 'Opera'
  if (/chrome|crios/i.test(ua)) return 'Chrome'
  if (/safari/i.test(ua)) return 'Safari'
  return 'Browser'
}

export async function deletePushSubscription(endpoint) {
  await fetch('/api/push/subscribe', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint, deviceId: getNotificationDeviceId() }),
  })
}

async function savePushSubscription(sub) {
  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(serializeSubscription(sub)),
  })
}

export async function subscribeToPush(reg) {
  try {
    const res = await fetch('/api/push/vapid-public-key')
    const { publicKey } = await res.json()
    const applicationServerKey = urlBase64ToUint8Array(publicKey)
    const existingSub = await reg.pushManager.getSubscription()

    if (existingSub) {
      const existingKey = existingSub.options?.applicationServerKey
      if (!existingKey || uint8ArraysEqual(existingKey, applicationServerKey)) {
        await savePushSubscription(existingSub)
        return existingSub
      }
      await deletePushSubscription(existingSub.endpoint)
      await existingSub.unsubscribe()
    }

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    })
    await savePushSubscription(sub)
    return sub
  } catch (e) {
    console.error('Push subscription failed:', e)
  }
}
