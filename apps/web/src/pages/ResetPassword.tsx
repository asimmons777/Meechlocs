import React, { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { apiFetch } from '../api'

export default function ResetPassword() {
  const [params] = useSearchParams()
  const token = useMemo(() => params.get('token') || '', [params])

  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const passwordsMatch = password && password === password2

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    try {
      setBusy(true)
      setError(null)
      const res: any = await apiFetch('/api/auth/password/reset', {
        method: 'POST',
        body: { token, password },
      })
      if (res?.ok) {
        setDone(true)
      } else {
        setError('Could not reset password')
      }
    } catch (err: any) {
      setError(err.message || 'Could not reset password')
    }
    setBusy(false)
  }

  return (
    <div className="card card-pad" style={{ maxWidth: 640, margin: '0 auto' }}>
      <div style={{ display: 'grid', gap: 12 }}>
        <div>
          <div className="h2">Reset password</div>
          <div className="small muted">
            Choose a new password for your account.
          </div>
        </div>

        {!token && (
          <div className="alert alert-danger">
            Missing reset token. Please request a new reset link.
          </div>
        )}

        {error && <div className="alert alert-danger">{error}</div>}

        {done ? (
          <div className="alert">
            Password updated. You can now log in with your new password.
            <div style={{ marginTop: 12 }}>
              <Link className="btn btn-secondary" to="/">Back to login</Link>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
            <div className="field">
              <div className="label">New password</div>
              <input
                value={password}
                onChange={e => setPassword(e.target.value)}
                type="password"
                placeholder="New password"
                className="input"
                autoComplete="new-password"
                disabled={!token}
              />
            </div>
            <div className="field">
              <div className="label">Confirm password</div>
              <input
                value={password2}
                onChange={e => setPassword2(e.target.value)}
                type="password"
                placeholder="Confirm password"
                className="input"
                autoComplete="new-password"
                disabled={!token}
              />
            </div>

            {!passwordsMatch && (password || password2) && (
              <div className="small" style={{ color: 'var(--danger-fg)' }}>
                Passwords must match.
              </div>
            )}

            <div style={{ display: 'grid', gap: 12, marginTop: 2 }}>
              <button className="btn" type="submit" disabled={busy || !token || !passwordsMatch}>
                Reset password
              </button>
              <Link className="btn btn-secondary" to="/forgot-password">Request a new link</Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
