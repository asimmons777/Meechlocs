import React, { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { apiFetch } from '../api'

export default function ServiceDetail(){
  const { id } = useParams()
  const [service, setService] = useState<any>(null)
  const nav = useNavigate()

  useEffect(()=>{
    if(!id) return
    apiFetch(`/api/services/${id}`).then(setService).catch(console.error)
  },[id])

  if(!service) return <div>Loading...</div>

  return (
    <div className="card">
      {service.images?.[0] ? (
        <img className="service-media" src={service.images[0]} alt={service.title} loading="lazy" />
      ) : (
        <div className="service-media" />
      )}

      <div className="card-pad">
        <h2 className="h2">{service.title}</h2>
        <p className="p">{service.description || ' '}</p>

        <div className="row">
          <span className="pill">{service.durationMins} mins</span>
          <span className="pill">Deposit ${(service.depositCents/100).toFixed(2)}</span>
          <span className="pill">Total ${(service.priceCents/100).toFixed(2)}</span>
        </div>

        <div className="divider" />

        <div className="row">
          <button
            onClick={() => {
              const token = localStorage.getItem('token')
              if(!token){ nav('/login'); return }
              nav(`/booking/${service.id}`)
            }}
            className="btn"
          >
            Book
          </button>
          <Link to="/services" className="btn btn-secondary">Back</Link>
        </div>
      </div>
    </div>
  )
}
