import React, { useEffect, useState } from 'react'
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

export default function Services(){
  const [items, setItems] = useState<Service[]>([])

  useEffect(()=>{
    apiFetch('/api/services').then(setItems).catch(console.error)
  },[])

  return (
    <div>
      <h2 className="h2">Services</h2>
      <p className="p">Choose a service to view details and book an available time.</p>

      <div className="grid grid-2">
        {items.map(s => (
          <div key={s.id} className="card service-card">
            <div className="card-pad">
              <h3 className="card-title">{s.title}</h3>
              {s.description ? <p className="card-subtitle">{s.description}</p> : <p className="card-subtitle">&nbsp;</p>}

              <div className="service-meta">
                <div className="price-block">
                  <div className="small muted">Price: ${(s.priceCents/100).toFixed(2)}</div>
                  <div className="small muted">Deposit: ${(s.depositCents/100).toFixed(2)}</div>
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
  )
}
