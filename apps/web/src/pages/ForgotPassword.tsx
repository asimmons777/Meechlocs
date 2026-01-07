import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../api'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    try {
      setBusy(true)
      setError(null)
      setSent(false)
      setDevResetUrl(null)
      const res: any = await apiFetch('/api/auth/password/forgot', {
        method: 'POST',
        body: { email },
      })
      setSent(true)
      setDevResetUrl(res?.devResetUrl ?? null)
    } catch (err: any) {
      setError(err.message || 'Could not request reset link')
    }
    setBusy(false)
  }

  return (
    <div className="card card-pad" style={{ maxWidth: 640, margin: '0 auto' }}>
      <div style={{ display: 'grid', gap: 12 }}>
        <div>
          <div className="h2">Forgot password</div>
          <div className="small muted">
            Enter your email and we’ll send you a password reset link.
          </div>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}
        {sent && (
          <div className="alert">
            If an account exists for <strong>{email}</strong>, you’ll receive a reset link shortly.
            {devResetUrl && (
              <div style={{ marginTop: 10 }}>
                Dev link (email not configured):{' '}
                <a href={devResetUrl}>{devResetUrl}</a>
              </div>
            )}
          </div>
        )}

        <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
          <div className="field">
            <div className="label">Email</div>
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="input"
              autoComplete="email"
            />
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            <button className="btn" type="submit" disabled={busy || !email}>Send reset link</button>
            <Link className="btn btn-secondary" to="/">Back to login</Link>
          </div>
        </form>
      </div>
    </div>
  )
}
