import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api'

export default function Register(){
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const nav = useNavigate()

  async function submit(e: React.FormEvent){
    e.preventDefault()
    try{
      const res = await apiFetch('/api/auth/register', { method: 'POST', body: { email, password, name } })
      localStorage.setItem('token', res.token)
      localStorage.setItem('user', JSON.stringify(res.user))
      nav('/dashboard')
    }catch(err:any){
      alert(err.message || 'Register failed')
    }
  }

  return (
    <div className="card card-pad" style={{ maxWidth: 520, margin: '0 auto' }}>
      <h2 className="h2">Create account</h2>
      <p className="p">Create a user account to book appointments.</p>
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
          <div className="label">Password</div>
          <input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="Password" className="input" />
        </div>
        <div style={{ marginTop: 14 }}>
          <button className="btn" type="submit">Register</button>
        </div>
      </form>
    </div>
  )
}
