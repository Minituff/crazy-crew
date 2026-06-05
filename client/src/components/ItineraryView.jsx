import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function ItineraryView({ slug }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch(`/api/itineraries/${slug}`)
      .then(r => { if (!r.ok) throw new Error('Trip not found'); return r.json() })
      .then(setData)
      .catch(e => setError(e.message))
  }, [slug])

  if (error) return <div className="error-view">Trip not found.</div>
  if (!data) return <div className="loading">Loading…</div>

  const { frontmatter: fm, raw } = data
  return (
    <div className="itinerary-view">
      <div
        className="itinerary-header"
        style={{ '--header-color': fm.cover_color || 'var(--orange)' }}
      >
        <div className="itinerary-emoji">{fm.emoji}</div>
        <h1>{fm.title}</h1>
        <div className="itinerary-meta">{fm.location}</div>
        <Link to="/trips" className="all-trips-link">← All Trips</Link>
      </div>
      <div className="itinerary-content">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{raw}</ReactMarkdown>
      </div>
    </div>
  )
}
