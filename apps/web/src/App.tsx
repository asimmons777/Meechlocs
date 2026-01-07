import React, { useEffect, useMemo, useState } from 'react'
import { Routes, Route, Link, NavLink, Navigate, useNavigate } from 'react-router-dom'
import Home from './pages/Home'
import Register from './pages/Register'
import Gallery from './pages/Gallery'
import Booking from './pages/Booking'
import Dashboard from './pages/Dashboard'
import Admin from './pages/Admin'
import AuthGateModal from './components/AuthGateModal'

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
  const [guestBrowsing, setGuestBrowsing] = useState<boolean>(() => sessionStorage.getItem('guest-browsing') === 'true')

  useEffect(() => {
    const handler = () => {
      setToken(localStorage.getItem('token'))
      setUser(readStoredUser())
      setFlash(sessionStorage.getItem('flash'))
      setGuestBrowsing(sessionStorage.getItem('guest-browsing') === 'true')
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
    sessionStorage.removeItem('guest-browsing')
    sessionStorage.setItem('flash', 'Logged out.')
    window.dispatchEvent(new Event('auth-changed'))
    nav('/')
  }

  function continueAsGuestBrowsing() {
    sessionStorage.setItem('guest-browsing', 'true')
    setGuestBrowsing(true)
  }

  return (
    <div className="app">
      <header className="header">
        <div className="container header-row">
          <Link to="/" className="brand bubble-word">MeechLocs</Link>
          <nav className="nav">
            <NavLink to="/services" className={({ isActive }) => isActive ? 'navlink navlink-active' : 'navlink'}>Gallery</NavLink>
            {!token && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  sessionStorage.removeItem('guest-browsing')
                  setGuestBrowsing(false)
                  nav('/')
                }}
              >
                Login
              </button>
            )}
            {token && (
              <>
                <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'navlink navlink-active' : 'navlink'}>Dashboard</NavLink>
                {isAdmin && <NavLink to="/admin" className={({ isActive }) => isActive ? 'navlink navlink-active' : 'navlink'}>Admin</NavLink>}
                <span className="navmeta">{user?.email}</span>
                <button type="button" className="btn btn-secondary btn-sm" onClick={logout}>Logout</button>
              </>
            )}
          </nav>
        </div>
      </header>
      <div className="banner">
        <img className="site-banner-img" src="/banner.png" alt="MeechLocs banner" />
      </div>
      <main className="main">
        <div className="container">
        {flash && (
          <div className="alert alert-success" style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
            <div>{flash}</div>
            <button type="button" className="btn btn-link btn-sm" onClick={() => setFlash(null)}>Dismiss</button>
          </div>
        )}

        {!token && !guestBrowsing && (
          <AuthGateModal
            initialMode="login"
            allowUnverifiedGuest
            onGuestBrowse={continueAsGuestBrowsing}
          />
        )}

        <Routes>
          <Route path="/" element={<Home/>} />
          <Route path="/register" element={<Register/>} />
          <Route path="/services" element={<Gallery/>} />
          <Route path="/booking/:id" element={<Booking/>} />

          <Route
            path="/dashboard"
            element={
              token ? (
                <Dashboard />
              ) : (
                <AuthGateModal initialMode="login" onRequestClose={() => nav('/')} />
              )
            }
          />
          <Route
            path="/admin"
            element={
              token ? (
                isAdmin ? <Admin /> : <Navigate to="/dashboard" replace />
              ) : (
                <AuthGateModal initialMode="login" onRequestClose={() => nav('/')} />
              )
            }
          />

          {/* When logged out and not browsing as guest, block navigation behind the modal */}
          {!token && !guestBrowsing ? (
            <Route path="*" element={<Navigate to="/" replace />} />
          ) : (
            <Route path="*" element={<Navigate to="/" replace />} />
          )}
        </Routes>
        </div>
      </main>
      <footer className="footer">
        <div className="container footer-inner">
          <div className="footer-top">
            <div className="footer-brand">
              <div className="footer-logo bubble-word">MeechLocs</div>
              <div className="footer-tagline">Chicago braids & locs</div>
            </div>

            <div className="footer-col">
              <div className="footer-title">Location</div>
              <div className="footer-item">
                <svg className="footer-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M12 21s7-4.4 7-11a7 7 0 1 0-14 0c0 6.6 7 11 7 11Z" />
                  <circle cx="12" cy="10" r="2.5" />
                </svg>
                <span>2045 E 75th St, Chicago IL</span>
              </div>
            </div>

            <div className="footer-col">
              <div className="footer-title">Contact</div>
              <div className="footer-links">
                <a className="footer-link" data-platform="instagram" href="https://www.instagram.com/meechlocs/" target="_blank" rel="noreferrer">
                  <svg className="footer-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <defs>
                      <linearGradient id="igGradientFooter" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#F58529" />
                        <stop offset="35%" stopColor="#DD2A7B" />
                        <stop offset="70%" stopColor="#8134AF" />
                        <stop offset="100%" stopColor="#515BD4" />
                      </linearGradient>
                    </defs>
                    <rect x="6" y="6" width="12" height="12" rx="4" />
                    <circle cx="12" cy="12" r="3.2" />
                    <circle cx="16.7" cy="7.3" r="1" />
                  </svg>
                  <span>Instagram: meechlocs</span>
                </a>
                <a className="footer-link" data-platform="facebook" href="https://www.facebook.com/search/top?q=Meech%20Tucker" target="_blank" rel="noreferrer">
                  <svg className="footer-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M14 9h3V6h-3c-2.2 0-4 1.8-4 4v3H7v3h3v6h3v-6h3l1-3h-4v-3c0-.6.4-1 1-1Z" />
                  </svg>
                  <span>Facebook: Meech Tucker</span>
                </a>
                <a className="footer-link" data-platform="email" href="mailto:dctucker23@gmail.com">
                  <svg className="footer-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M4 6h16v12H4V6Z" />
                    <path d="M4 7l8 6 8-6" />
                  </svg>
                  <span>dctucker23@gmail.com</span>
                </a>
              </div>
            </div>
          </div>

        </div>
      </footer>
    </div>
  )
}
