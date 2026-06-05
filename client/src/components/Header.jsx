import { Link } from 'react-router-dom'

export default function Header() {
  return (
    <header className="site-header">
      <Link to="/trips" className="site-title">Crazy Crew 🎉</Link>
    </header>
  )
}
