import { useState, useEffect } from 'react'
import { Bell, BellOff } from 'lucide-react'
import { subscribeToPush, deletePushSubscription } from '../lib/push.js'

export default function PushSubscribe() {
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    navigator.serviceWorker.register('/sw.js').then(reg => {
      reg.pushManager.getSubscription().then(sub => setSubscribed(!!sub))
    })
  }, [])

  async function toggle() {
    if (loading) return
    setLoading(true)
    try {
      if (subscribed) {
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()
        if (sub) {
          await deletePushSubscription(sub.endpoint)
          await sub.unsubscribe()
        }
        setSubscribed(false)
      } else {
        const reg = await navigator.serviceWorker.ready
        await subscribeToPush(reg)
        setSubscribed(true)
      }
    } catch (e) {
      console.error('Push toggle failed:', e)
    }
    setLoading(false)
  }

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null

  return (
    <button
      className="push-btn"
      onClick={toggle}
      disabled={loading}
      title={subscribed ? 'Disable notifications' : 'Enable notifications'}
    >
      {subscribed ? <BellOff size={22} /> : <Bell size={22} />}
    </button>
  )
}
