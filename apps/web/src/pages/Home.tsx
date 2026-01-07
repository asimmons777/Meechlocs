import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../api'

type Service = {
  id: number
  title: string
  description?: string
  priceCents: number
  depositCents: number
  durationMins: number
  images?: string[]
}

export default function Home(){
  const [services, setServices] = useState<Service[]>([])
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement | null>(null)

  useEffect(()=>{
    // fetch all services for landing page preview
    apiFetch('/api/services').then((list: Service[]) => setServices(list)).catch(console.error)
  },[])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return services
    return services.filter(s => {
      const hay = `${s.title || ''} ${s.description || ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [services, query])

  function goToSearch(){
    const el = document.getElementById('services')
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    window.setTimeout(() => searchRef.current?.focus(), 100)
  }

  return (
    <div>
      <div className="card card-pad">
        <h1 className="h1">Welcome to MeechLocs</h1>
        <p className="p">Book services with real-time availability and a deposit payment flow (Stripe will be connected for live payments).</p>
        <div className="row">
          <a href="#services" className="btn">Browse Services</a>
          <button type="button" className="btn btn-secondary" onClick={goToSearch}>Search Services</button>
        </div>
      </div>

      <div className="spacer-16" />

      <div id="services" className="card card-pad">
        <div className="section-head">
          <div>
            <h2 className="h2">All Services</h2>
            <p className="p">Choose a service to view details and book.</p>
          </div>
        </div>

        <div className="spacer-8" />

        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div style={{ flex: '2 1 18rem', minWidth: 220 }}>
            <input
              ref={searchRef}
              className="input"
              placeholder="Search services…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setQuery('')}
            disabled={!query.trim()}
            style={{ flex: '0 0 auto', minWidth: 0 }}
          >
            Clear
          </button>
        </div>

        <div className="spacer-8" />

        {query.trim() && (
          <div className="small muted" style={{ marginBottom: 10 }}>
            Showing {filtered.length} of {services.length}
          </div>
        )}

        <div className="grid grid-2">
          {services.length === 0 ? (
            <div className="card card-pad">Loading services…</div>
          ) : filtered.length === 0 ? (
            <div className="card card-pad">No services match your search.</div>
          ) : filtered.map(s => (
            <div key={s.id} className="card service-card">
              <div className="card-pad">
                <h3 className="card-title">{s.title}</h3>
                {s.description ? <p className="card-subtitle">{s.description}</p> : <p className="card-subtitle">&nbsp;</p>}

                <div className="service-meta">
                  <div className="price-block small muted">
                    <div>Price: ${(s.priceCents/100).toFixed(2)}</div>
                    <div>Deposit: ${(s.depositCents/100).toFixed(2)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Link to="/services" className="btn btn-secondary btn-sm">View Photos</Link>
                    <Link to={`/booking/${s.id}`} className="btn btn-sm">Book</Link>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
