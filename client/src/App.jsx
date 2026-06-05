import { Suspense } from 'react'
import { BrowserRouter, Routes, Route, useParams } from 'react-router-dom'
import Header from './components/Header.jsx'
import Home from './components/Home.jsx'
import AllTrips from './components/AllTrips.jsx'
import ItineraryView from './components/ItineraryView.jsx'
import PushSubscribe from './components/PushSubscribe.jsx'
import trips from './trips.js'

function TripRoute() {
  const { slug } = useParams()
  const entry = trips[slug]
  if (entry) {
    const Page = entry.component
    return <Suspense fallback={<div className="loading">Loading…</div>}><Page /></Suspense>
  }
  return <ItineraryView slug={slug} />
}

export default function App() {
  return (
    <BrowserRouter>
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/trips" element={<AllTrips />} />
        <Route path="/:slug" element={<TripRoute />} />
      </Routes>
      <PushSubscribe />
    </BrowserRouter>
  )
}
