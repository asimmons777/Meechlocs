import React, { useEffect, useState } from 'react'
import { apiFetch, resolveImageUrl } from '../api'

type Service = {
  id: number
  title: string
  description?: string
  priceCents: number
  depositCents: number
  durationMins: number
  images?: string[]
}

export default function Gallery(){
  const [services, setServices] = useState<Service[]>([])
  const [selectedServiceId, setSelectedServiceId] = useState<number | ''>('')

  useEffect(()=>{
    apiFetch('/api/services').then((list: Service[]) => {
      setServices(list)
      setSelectedServiceId(list[0]?.id ?? '')
    }).catch(console.error)
  },[])

  const selected = selectedServiceId === '' ? null : services.find(s => s.id === selectedServiceId) || null
  const images = selected?.images || []

  return (
    <div>
      <h2 className="h2">Gallery</h2>

      <div className="card card-pad">
        <div className="field">
          <div className="label">Service</div>
          <select
            className="input"
            value={selectedServiceId}
            onChange={(e) => {
              const v = e.target.value
              setSelectedServiceId(v ? Number(v) : '')
            }}
          >
            {services.map(s => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="spacer-12" />

      {services.length === 0 ? (
        <div className="card card-pad">Loading gallery…</div>
      ) : !selected ? (
        <div className="card card-pad">Select a service to view photos.</div>
      ) : images.length === 0 ? (
        <div className="card card-pad">No photos posted for this service yet.</div>
      ) : (
        <div className="gallery-grid">
          {images.map((src, idx) => (
            <div key={idx} className="card gallery-tile">
              <img src={resolveImageUrl(src)} alt={selected.title} className="gallery-img" loading="lazy" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
