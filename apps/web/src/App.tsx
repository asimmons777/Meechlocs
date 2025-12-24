import React, { useEffect, useMemo, useState } from 'react'
import { Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import Services from './pages/Services'
import ServiceDetail from './pages/ServiceDetail'
import Booking from './pages/Booking'
import Dashboard from './pages/Dashboard'
import Admin from './pages/Admin'

type StoredUser = {
  id: number
  email: string
  role: 'USER' | 'ADMIN'
  name?: string | null
}

function readStoredUser(): StoredUser | null {
  const raw = localStorage.getItem('user')
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    if (typeof parsed.email !== 'string' || typeof parsed.role !== 'string') return null
    return parsed as StoredUser
  } catch {
    return null
  }
}

export default function App() {
  const nav = useNavigate()

  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))
  const [user, setUser] = useState<StoredUser | null>(() => readStoredUser())
  const [flash, setFlash] = useState<string | null>(() => sessionStorage.getItem('flash'))

  useEffect(() => {
    const handler = () => {
      setToken(localStorage.getItem('token'))
      setUser(readStoredUser())
      setFlash(sessionStorage.getItem('flash'))
    }

    window.addEventListener('storage', handler)
    window.addEventListener('auth-changed', handler as EventListener)
    return () => {
      window.removeEventListener('storage', handler)
      window.removeEventListener('auth-changed', handler as EventListener)
    }
  }, [])

  useEffect(() => {
    if (!flash) return
    sessionStorage.removeItem('flash')
  }, [flash])

  const isAdmin = useMemo(() => user?.role === 'ADMIN', [user])

  function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    sessionStorage.setItem('flash', 'Logged out.')
    window.dispatchEvent(new Event('auth-changed'))
    nav('/')
  }

  return (
    <div className="app">
      <header className="header">
        <div className="container header-row">
          <Link to="/" className="brand">MeechLocs</Link>
          <nav className="nav">
            <Link to="/services" className="navlink">Services</Link>
            {token ? (
              <>
                <Link to="/dashboard" className="navlink">Dashboard</Link>
                {isAdmin && <Link to="/admin" className="navlink">Admin</Link>}
                <span className="navmeta">{user?.email}</span>
                <button type="button" className="btn btn-secondary btn-sm" onClick={logout}>Logout</button>
              </>
            ) : (
              <Link to="/login" className="navlink">Login</Link>
            )}
          </nav>
        </div>
      </header>
      <div className="banner">
        <div className="container">
          <p>
            Demo mode: payments are simulated. Use <strong>user@meechlocs.test</strong> / <strong>Passw0rd!</strong> to try booking.
          </p>
        </div>
      </div>
      <main className="main">
        <div className="container">
        {flash && (
          <div className="alert alert-success" style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
            <div>{flash}</div>
            <button type="button" className="btn btn-link btn-sm" onClick={() => setFlash(null)}>Dismiss</button>
          </div>
        )}
        <Routes>
          <Route path="/" element={<Home/>} />
          <Route path="/login" element={<Login/>} />
          <Route path="/register" element={<Register/>} />
          <Route path="/services" element={<Services/>} />
          <Route path="/services/:id" element={<ServiceDetail/>} />
          <Route path="/booking/:id" element={<Booking/>} />
          <Route path="/dashboard" element={token ? <Dashboard/> : <Navigate to="/login" replace/>} />
          <Route path="/admin" element={token ? (isAdmin ? <Admin/> : <Navigate to="/dashboard" replace/>) : <Navigate to="/login" replace/>} />
        </Routes>
        </div>
      </main>
      <footer className="footer">
        Demo site — no real payments are processed. For live payments we’ll connect your Stripe account.
      </footer>
    </div>
  )
}
