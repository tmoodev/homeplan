import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'

export default function Login() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.post('/auth/login', { username, password })
      navigate('/projects')
    } catch {
      setError('Invalid username or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0f0c29, #302b63)' }}>
      <div style={{ width: '100%', maxWidth: 380, padding: '0 16px' }}>
        <div style={{ textAlign: 'center', marginBottom: 32, color: 'white' }}>
          <div style={{ fontSize: '0.8rem', letterSpacing: '0.2em', textTransform: 'uppercase', opacity: 0.6, marginBottom: 8 }}>
            DataTrav
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700 }}>HomePlan</h1>
          <p style={{ opacity: 0.7, marginTop: 6, fontSize: '0.9rem' }}>WiFi infrastructure planning platform</p>
        </div>
        <div className="card">
          <form onSubmit={handleSubmit}>
            {error && <div className="alert alert-error">{error}</div>}
            <div className="field">
              <label>Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                required
              />
            </div>
            <div className="field">
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
