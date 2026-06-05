import { useState, useEffect } from 'react'
import TripCard from './TripCard.jsx'

export default function AllTrips() {
  const [trips, setTrips] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/api/itineraries')
      .then(r => { if (!r.ok) throw new Error('Failed to load trips'); return r.json() })
      .then(setTrips)
      .catch(e => setError(e.message))
  }, [])

  return (
    <main className="home">
      <div className="hero">
        <h1>Welcome, Crazy Crew! 🎉</h1>
        <p>Your family trip planner</p>
      </div>
      {error && <div className="error-view">{error}</div>}
      {trips === null && !error && <div className="loading">Loading trips…</div>}
      {trips?.length === 0 && <div className="empty">No trips yet — add a .md file to data/itineraries!</div>}
      {trips && trips.length > 0 && (
        <div className="trip-grid">
          {trips.map(trip => <TripCard key={trip.slug} trip={trip} />)}
        </div>
      )}
    </main>
  )
}
