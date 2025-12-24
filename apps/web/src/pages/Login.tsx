import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { apiFetch } from '../api'

export default function Login(){
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const nav = useNavigate()

  async function submit(e: React.FormEvent){
    e.preventDefault()
    try{
      const res = await apiFetch('/api/auth/login', { method: 'POST', body: { email, password } })
      localStorage.setItem('token', res.token)
      localStorage.setItem('user', JSON.stringify(res.user))
      sessionStorage.setItem('flash', 'Login successful.')
      window.dispatchEvent(new Event('auth-changed'))
      if (res.user.role === 'ADMIN') nav('/admin')
      else nav('/dashboard')
    }catch(err:any){
      setError(err.message || 'Login failed')
    }
  }

  return (
    <div className="card card-pad" style={{ maxWidth: 520, margin: '0 auto' }}>
      <h2 className="h2">Login</h2>
      <p className="p">Use the demo account or your own registered account.</p>
      {error && <div className="alert alert-danger">{error}</div>}
      <form onSubmit={submit} style={{ marginTop: 12 }}>
        <div className="field">
          <div className="label">Email</div>
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" className="input" />
        </div>
        <div className="field" style={{ marginTop: 12 }}>
          <div className="label">Password</div>
          <input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="Password" className="input" />
        </div>
        <div className="row" style={{ marginTop: 14, justifyContent: 'space-between' }}>
          <button className="btn" type="submit">Login</button>
          <Link to="/register" className="navlink">Create account</Link>
        </div>
      </form>
    </div>
  )
}
