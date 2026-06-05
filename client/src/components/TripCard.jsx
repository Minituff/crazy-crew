import { Link } from 'react-router-dom'

function formatDateRange(start, end) {
  const opts = { month: 'short', day: 'numeric', timeZone: 'UTC' }
  const s = new Date(start + 'T12:00:00Z').toLocaleDateString('en-US', opts)
  const e = new Date(end + 'T12:00:00Z').toLocaleDateString('en-US', opts)
  const year = new Date(end + 'T12:00:00Z').getFullYear()
  return `${s} – ${e}, ${year}`
}

export default function TripCard({ trip }) {
  return (
    <Link
      to={`/${trip.slug}`}
      className="trip-card"
      style={{ '--card-color': trip.cover_color || 'var(--orange)' }}
    >
      <div className="trip-card-emoji">{trip.emoji}</div>
      <div className="trip-card-body">
        <div className="trip-card-title">{trip.title}</div>
        <div className="trip-card-meta">{formatDateRange(trip.start, trip.end)}</div>
        <div className="trip-card-location">{trip.location}</div>
      </div>
      {trip.active && <div className="trip-card-badge">ACTIVE NOW</div>}
    </Link>
  )
}
