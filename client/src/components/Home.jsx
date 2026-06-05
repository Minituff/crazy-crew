import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Home() {
  const navigate = useNavigate()

  useEffect(() => {
    fetch('/api/itineraries')
      .then(r => r.json())
      .then(trips => {
        const current = trips.find(t => t.current) || trips.find(t => t.active)
        navigate(current ? `/${current.slug}` : '/trips', { replace: true })
      })
      .catch(() => navigate('/trips', { replace: true }))
  }, [navigate])

  return <div className="loading">Loading…</div>
}
