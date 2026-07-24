import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="center-screen">
      <h1>404</h1>
      <p>The page you are looking for does not exist.</p>
      <Link to="/">Back to dashboard</Link>
    </div>
  )
}
