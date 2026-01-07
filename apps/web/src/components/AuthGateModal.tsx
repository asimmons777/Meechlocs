import React, { useEffect, useState } from 'react'
import { apiFetch } from '../api'

type Mode = 'login' | 'register' | 'guest'

type Props = {
  initialMode?: Mode
  onAuthed?: () => void
  onRequestClose?: () => void
  allowUnverifiedGuest?: boolean
  onGuestBrowse?: () => void
}

export default function AuthGateModal({ initialMode = 'login', onAuthed, onRequestClose, allowUnverifiedGuest = false, onGuestBrowse }: Props) {
  const [mode, setMode] = useState<Mode>(initialMode)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setMode(initialMode)
  }, [initialMode])

  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  const [regName, setRegName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regPhone, setRegPhone] = useState('')

  const [pendingVerification, setPendingVerification] = useState(false)
  const [verificationCode, setVerificationCode] = useState('')
  const [devCode, setDevCode] = useState<string | null>(null)

  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [guestPendingVerification, setGuestPendingVerification] = useState(false)
  const [guestVerificationCode, setGuestVerificationCode] = useState('')
  const [guestDevCode, setGuestDevCode] = useState<string | null>(null)

  async function login(e: React.FormEvent) {
    e.preventDefault()
    try {
      setBusy(true)
      setError(null)
      const res: any = await apiFetch('/api/auth/login', { method: 'POST', body: { email: loginEmail, password: loginPassword } })
      localStorage.setItem('token', res.token)
      localStorage.setItem('user', JSON.stringify(res.user))
      sessionStorage.setItem('flash', 'Login successful.')
      window.dispatchEvent(new Event('auth-changed'))
      onAuthed?.()
    } catch (err: any) {
      setError(err.message || 'Login failed')
    }
    setBusy(false)
  }

  async function register(e: React.FormEvent) {
    e.preventDefault()
    try {
      setBusy(true)
      setError(null)
      const res: any = await apiFetch('/api/auth/register/start', {
        method: 'POST',
        body: { email: regEmail, password: regPassword, name: regName, phone: regPhone },
      })
      setDevCode(res?.devCode ?? null)
      setPendingVerification(true)
    } catch (err: any) {
      setError(err.message || 'Register failed')
    }
    setBusy(false)
  }

  async function verifyRegistration(e: React.FormEvent) {
    e.preventDefault()
    try {
      setBusy(true)
      setError(null)
      const res: any = await apiFetch('/api/auth/register/verify', {
        method: 'POST',
        body: { email: regEmail, code: verificationCode },
      })
      localStorage.setItem('token', res.token)
      localStorage.setItem('user', JSON.stringify(res.user))
      sessionStorage.setItem('flash', 'Account created.')
      window.dispatchEvent(new Event('auth-changed'))
      onAuthed?.()
    } catch (err: any) {
      setError(err.message || 'Verification failed')
    }
    setBusy(false)
  }

  async function startGuestVerification(e: React.FormEvent) {
    e.preventDefault()
    try {
      setBusy(true)
      setError(null)
      const res: any = await apiFetch('/api/auth/guest/start', {
        method: 'POST',
        body: { email: guestEmail, name: guestName || 'Guest', phone: guestPhone },
      })
      setGuestDevCode(res?.devCode ?? null)
      setGuestPendingVerification(true)
    } catch (err: any) {
      setError(err.message || 'Could not send code')
    }
    setBusy(false)
  }

  async function verifyGuest(e: React.FormEvent) {
    e.preventDefault()
    try {
      setBusy(true)
      setError(null)
      const res: any = await apiFetch('/api/auth/guest/verify', {
        method: 'POST',
        body: { email: guestEmail, code: guestVerificationCode },
      })
      localStorage.setItem('token', res.token)
      localStorage.setItem('user', JSON.stringify(res.user))
      sessionStorage.setItem('flash', 'Continuing as guest.')
      window.dispatchEvent(new Event('auth-changed'))
      onAuthed?.()
    } catch (err: any) {
      setError(err.message || 'Verification failed')
    }
    setBusy(false)
  }

  function handleGuestClick() {
    if (allowUnverifiedGuest) {
      onGuestBrowse?.()
      return
    }
    setMode('guest')
    setGuestPendingVerification(false)
    setGuestVerificationCode('')
    setGuestDevCode(null)
  }

  function forgotPassword() {
    alert('Password reset is not available yet. Please create an account or continue as a guest.')
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Login required">
      <div className="modal">
        <div className="modal-head">
          <div>
            <div className="h2 bubble-word" style={{ marginBottom: 4 }}>MeechLocs</div>
            <div className="small muted">Login, create an account, or continue as a guest.</div>
          </div>
          {onRequestClose && (
            <button className="btn btn-secondary btn-sm" type="button" onClick={onRequestClose} disabled={busy}>
              Close
            </button>
          )}
        </div>

        {error && <div className="alert alert-danger" style={{ marginTop: 12 }}>{error}</div>}

        {mode === 'login' ? (
          <form onSubmit={login} style={{ marginTop: 12 }}>
            <div className="field">
              <div className="label">Email</div>
              <input value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="Email" className="input" />
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <div className="label">Password</div>
              <input value={loginPassword} onChange={e => setLoginPassword(e.target.value)} type="password" placeholder="Password" className="input" />
            </div>
            <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
              <button className="btn" type="submit" disabled={busy}>Login</button>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={handleGuestClick}
                disabled={busy}
              >
                Continue as Guest
              </button>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <button className="btn btn-link btn-sm" type="button" onClick={forgotPassword} disabled={busy} style={{ flex: '0 0 auto', minWidth: 0 }}>
                  Forgot password?
                </button>
                <button className="btn btn-secondary btn-sm" type="button" onClick={() => setMode('register')} disabled={busy} style={{ flex: '0 0 auto', minWidth: 0 }}>
                  Create account
                </button>
              </div>
            </div>
          </form>
        ) : mode === 'guest' ? guestPendingVerification ? (
          <form onSubmit={verifyGuest} style={{ marginTop: 12 }}>
            <div className="small muted">Enter the 6-digit security code sent to <strong>{guestEmail}</strong>.</div>
            {guestDevCode && (
              <div className="alert" style={{ marginTop: 12 }}>
                Dev code (email not configured): <strong>{guestDevCode}</strong>
              </div>
            )}
            <div className="field" style={{ marginTop: 12 }}>
              <div className="label">Security code</div>
              <input value={guestVerificationCode} onChange={e => setGuestVerificationCode(e.target.value)} placeholder="123456" className="input" inputMode="numeric" />
            </div>
            <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
              <button className="btn" type="submit" disabled={busy}>Verify & continue as guest</button>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <button
                  className="btn btn-link btn-sm"
                  type="button"
                  onClick={() => { setGuestPendingVerification(false); setGuestVerificationCode(''); setGuestDevCode(null) }}
                  disabled={busy}
                  style={{ flex: '0 0 auto', minWidth: 0 }}
                >
                  Back
                </button>
                <button className="btn btn-secondary btn-sm" type="button" onClick={() => setMode('login')} disabled={busy} style={{ flex: '0 0 auto', minWidth: 0 }}>
                  Login instead
                </button>
              </div>
            </div>
          </form>
        ) : (
          <form onSubmit={startGuestVerification} style={{ marginTop: 12 }}>
            <div className="small muted">Continue as a guest with a verified email (required for receipts and refunds).</div>
            <div className="field" style={{ marginTop: 12 }}>
              <div className="label">Name (optional)</div>
              <input value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="Name" className="input" />
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <div className="label">Email</div>
              <input value={guestEmail} onChange={e => setGuestEmail(e.target.value)} placeholder="Email" className="input" />
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <div className="label">Phone (optional)</div>
              <input value={guestPhone} onChange={e => setGuestPhone(e.target.value)} placeholder="Phone" className="input" inputMode="tel" />
            </div>
            <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
              <button className="btn" type="submit" disabled={busy}>Send security code</button>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <button className="btn btn-link btn-sm" type="button" onClick={() => setMode('login')} disabled={busy} style={{ flex: '0 0 auto', minWidth: 0 }}>
                  Back to login
                </button>
                <button className="btn btn-secondary btn-sm" type="button" onClick={() => setMode('register')} disabled={busy} style={{ flex: '0 0 auto', minWidth: 0 }}>
                  Create account
                </button>
              </div>
            </div>
          </form>
        ) : pendingVerification ? (
          <form onSubmit={verifyRegistration} style={{ marginTop: 12 }}>
            <div className="small muted">Enter the 6-digit security code sent to <strong>{regEmail}</strong>.</div>
            {devCode && (
              <div className="alert" style={{ marginTop: 12 }}>
                Dev code (email not configured): <strong>{devCode}</strong>
              </div>
            )}
            <div className="field" style={{ marginTop: 12 }}>
              <div className="label">Security code</div>
              <input value={verificationCode} onChange={e => setVerificationCode(e.target.value)} placeholder="123456" className="input" inputMode="numeric" />
            </div>
            <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
              <button className="btn" type="submit" disabled={busy}>Verify & continue</button>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <button
                  className="btn btn-link btn-sm"
                  type="button"
                  onClick={() => { setPendingVerification(false); setVerificationCode(''); setDevCode(null) }}
                  disabled={busy}
                  style={{ flex: '0 0 auto', minWidth: 0 }}
                >
                  Back
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  type="button"
                  onClick={handleGuestClick}
                  disabled={busy}
                  style={{ flex: '0 0 auto', minWidth: 0 }}
                >
                  Continue as Guest
                </button>
              </div>
            </div>
          </form>
        ) : (
          <form onSubmit={register} style={{ marginTop: 12 }}>
            <div className="field">
              <div className="label">Name</div>
              <input value={regName} onChange={e => setRegName(e.target.value)} placeholder="Name" className="input" />
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <div className="label">Email</div>
              <input value={regEmail} onChange={e => setRegEmail(e.target.value)} placeholder="Email" className="input" />
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <div className="label">Phone (optional)</div>
              <input value={regPhone} onChange={e => setRegPhone(e.target.value)} placeholder="Phone" className="input" inputMode="tel" />
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <div className="label">Password</div>
              <input value={regPassword} onChange={e => setRegPassword(e.target.value)} type="password" placeholder="Password" className="input" />
            </div>
            <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
              <button className="btn" type="submit" disabled={busy}>Send security code</button>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={handleGuestClick}
                disabled={busy}
              >
                Continue as Guest
              </button>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <button className="btn btn-link btn-sm" type="button" onClick={() => setMode('login')} disabled={busy} style={{ flex: '0 0 auto', minWidth: 0 }}>
                  Login instead
                </button>
                <button className="btn btn-link btn-sm" type="button" onClick={forgotPassword} disabled={busy} style={{ flex: '0 0 auto', minWidth: 0 }}>
                  Forgot password?
                </button>
              </div>
            </div>
          </form>
        )}

        <div className="divider" />
      </div>
    </div>
  )
}
