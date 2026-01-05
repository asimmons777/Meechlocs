import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api'

export default function Register(){
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')

  const [verifying, setVerifying] = useState(false)
  const [verificationCode, setVerificationCode] = useState('')
  const [devCode, setDevCode] = useState<string | null>(null)
  const nav = useNavigate()

  async function submit(e: React.FormEvent){
    e.preventDefault()
    try{
      const res = await apiFetch('/api/auth/register/start', { method: 'POST', body: { email, password, name, phone } })
      setDevCode(res?.devCode ?? null)
      setVerifying(true)
    }catch(err:any){
      alert(err.message || 'Register failed')
    }
  }

  async function verify(){
    try{
      const res = await apiFetch('/api/auth/register/verify', { method: 'POST', body: { email, code: verificationCode } })
      localStorage.setItem('token', res.token)
      localStorage.setItem('user', JSON.stringify(res.user))
      window.dispatchEvent(new Event('auth-changed'))
      nav('/dashboard')
    }catch(err:any){
      alert(err.message || 'Verification failed')
    }
  }

  return (
    <div className="card card-pad" style={{ maxWidth: 520, margin: '0 auto' }}>
      <h2 className="h2">Create account</h2>
      <p className="p">We’ll email you a security code to verify your account.</p>

      <form onSubmit={submit} style={{ marginTop: 12 }}>
        <div className="field">
          <div className="label">Full name</div>
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="Full name" className="input" />
        </div>
        <div className="field" style={{ marginTop: 12 }}>
          <div className="label">Email</div>
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" className="input" />
        </div>
        <div className="field" style={{ marginTop: 12 }}>
          <div className="label">Phone (optional)</div>
          <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Phone" className="input" inputMode="tel" />
        </div>
        <div className="field" style={{ marginTop: 12 }}>
          <div className="label">Password</div>
          <input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="Password" className="input" />
        </div>
        <div style={{ marginTop: 14 }}>
          <button className="btn" type="submit">Send security code</button>
        </div>
      </form>

      {verifying && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal" style={{ maxWidth: 520 }}>
            <div className="modal-header" style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div className="h3" style={{ margin: 0 }}>Verify your email</div>
                <div className="small muted" style={{ marginTop: 6 }}>Enter the 6-digit code sent to <strong>{email}</strong>.</div>
              </div>
              <button type="button" className="btn btn-link btn-sm" onClick={() => { setVerifying(false); setVerificationCode(''); setDevCode(null) }}>Cancel</button>
            </div>

            {devCode && (
              <div className="alert" style={{ marginTop: 12 }}>
                Dev code (email not configured): <strong>{devCode}</strong>
              </div>
            )}

            <div className="field" style={{ marginTop: 12 }}>
              <div className="label">Security code</div>
              <input
                value={verificationCode}
                onChange={e => setVerificationCode(e.target.value)}
                placeholder="123456"
                className="input"
                inputMode="numeric"
              />
            </div>

            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
              <button type="button" className="btn" onClick={verify}>Verify & continue</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
