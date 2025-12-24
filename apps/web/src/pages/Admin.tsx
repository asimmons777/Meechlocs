import React, { useEffect, useState } from 'react'
import { apiFetch } from '../api'

export default function Admin(){
  const [services, setServices] = useState<any[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [duration, setDuration] = useState(30)
  const [price, setPrice] = useState('0.00')
  const [deposit, setDeposit] = useState('0.00')
  const [images, setImages] = useState('')
  const [uploading, setUploading] = useState(false)

  async function uploadFile(file: File){
    if(!token) return alert('Login as admin')
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    try{
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/admin/upload`, { method: 'POST', body: fd, headers: { Authorization: `Bearer ${token}` } })
      const json = await res.json()
      if(json.url) {
        setImages(prev => prev ? prev + ',' + json.url : json.url)
      } else {
        alert('Upload failed')
      }
    }catch(e){ console.error(e); alert('Upload failed') }
    setUploading(false)
  }

  const [availabilities, setAvailabilities] = useState<any[]>([])
  const [aStart, setAStart] = useState('')
  const [aEnd, setAEnd] = useState('')

  const [appointments, setAppointments] = useState<any[]>([])

  const token = localStorage.getItem('token')

  useEffect(()=>{ loadAll() }, [])

  async function loadAll(){
    try{
      const sv = await apiFetch('/api/services')
      setServices(sv)
      const av = await apiFetch('/api/availability')
      setAvailabilities(av)
      if(token) {
        const ap = await apiFetch('/api/admin/appointments', { token })
        setAppointments(ap)
      }
    }catch(err){ console.error(err) }
  }

  async function addService(e: React.FormEvent){
    e.preventDefault()
    try{
      if(!token) return alert('Login as admin first')
      const body = { title, description, durationMins: Number(duration), priceCents: Math.round(parseFloat(price || '0')*100), depositCents: Math.round(parseFloat(deposit || '0')*100), images: images.split(',').map(s=>s.trim()).filter(Boolean) }
      await apiFetch('/api/admin/services', { method: 'POST', body, token })
      setTitle(''); setDescription(''); setPrice('0.00'); setDeposit('0.00'); setImages('')
      loadAll()
    }catch(err:any){ alert(err.message || 'Failed') }
  }

  async function deleteService(id:number){
    if(!confirm('Delete this service?')) return
    try{ await apiFetch(`/api/admin/services/${id}`, { method: 'DELETE', token }); loadAll() }catch(err:any){ alert(err.message || 'Failed') }
  }

  async function addAvailability(e: React.FormEvent){
    e.preventDefault()
    if(!token) return alert('Login as admin first')
    try{
      await apiFetch('/api/admin/availability', { method: 'POST', body: { start: new Date(aStart).toISOString(), end: new Date(aEnd).toISOString() }, token })
      setAStart(''); setAEnd('')
      loadAll()
    }catch(err:any){ alert(err.message || 'Failed') }
  }

  async function deleteAvailability(id:number){
    if(!confirm('Remove availability? This will cancel overlapping appointments.')) return
    try{ await apiFetch(`/api/admin/availability/${id}`, { method: 'DELETE', token }); loadAll() }catch(err:any){ alert('Failed') }
  }

  async function refundAppointment(id:number){
    if(!confirm('Issue refund for this appointment?')) return
    try{
      await apiFetch('/api/admin/refund', { method: 'POST', body: { appointmentId: id }, token })
      loadAll()
      alert('Refund issued')
    }catch(err:any){ alert(err.message || 'Refund failed') }
  }

  return (
    <div>
      <h2 className="h2">Admin</h2>
      <p className="p">Manage services, availability, and refunds.</p>

      <section className="card card-pad" style={{ marginTop: 12 }}>
        <h3 className="h3">Create Service</h3>
        <form onSubmit={addService} style={{ marginTop: 10 }}>
          <div className="field">
            <div className="label">Title</div>
            <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Title" className="input" />
          </div>
          <div className="field" style={{ marginTop: 12 }}>
            <div className="label">Description</div>
            <textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="Description" className="textarea" />
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <div className="field">
              <div className="label">Duration (mins)</div>
              <input value={duration} onChange={e=>setDuration(Number(e.target.value))} type="number" className="input" />
            </div>
            <div className="field">
              <div className="label">Price (USD)</div>
              <input value={price} onChange={e=>setPrice(e.target.value)} placeholder="0.00" className="input" />
            </div>
            <div className="field">
              <div className="label">Deposit (USD)</div>
              <input value={deposit} onChange={e=>setDeposit(e.target.value)} placeholder="0.00" className="input" />
            </div>
          </div>
          <div className="field" style={{ marginTop: 12 }}>
            <div className="label">Images (CSV URLs)</div>
            <input value={images} onChange={e=>setImages(e.target.value)} placeholder="https://... , https://..." className="input" />
          </div>

          <div className="field" style={{ marginTop: 12 }}>
            <div className="label">Or upload image</div>
            <input type="file" onChange={e=>{ const f = e.target.files?.[0]; if(f) uploadFile(f) }} />
            {uploading && <div className="small muted">Uploading…</div>}
          </div>

          <div className="row" style={{ marginTop: 12, justifyContent: 'flex-start' }}>
            {images.split(',').map(s=>s.trim()).filter(Boolean).slice(0,6).map(url=> (
              <img key={url} src={url} style={{width:120,height:80,objectFit:'cover',borderRadius:10,border:'1px solid var(--border)'}} alt="preview" />
            ))}
          </div>

          <div style={{ marginTop: 12 }}>
            <button className="btn" type="submit">Create Service</button>
          </div>
        </form>
      </section>

      <section style={{ marginTop: 12 }}>
        <h3 className="h3">Services</h3>
        <div className="grid" style={{ marginTop: 10 }}>
          {services.map(s=> (
            <div key={s.id} className="card card-pad">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 800 }}>{s.title}</div>
                  <div className="small muted">{s.description}</div>
                </div>
                <div className="row" style={{ justifyContent: 'flex-end' }}>
                  <button onClick={()=>{ const t = prompt('Title', s.title); if(t!=null) apiFetch(`/api/admin/services/${s.id}`, { method: 'PUT', body: { title: t }, token }).then(loadAll) }} className="btn btn-secondary btn-sm" type="button">Edit</button>
                  <button onClick={()=>deleteService(s.id)} className="btn btn-danger btn-sm" type="button">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card card-pad" style={{ marginTop: 12 }}>
        <h3 className="h3">Availability</h3>
        <form onSubmit={addAvailability} style={{ marginTop: 10 }}>
          <div className="field">
            <div className="label">Start</div>
            <input type="datetime-local" value={aStart} onChange={e=>setAStart(e.target.value)} className="input" />
          </div>
          <div className="field" style={{ marginTop: 12 }}>
            <div className="label">End</div>
            <input type="datetime-local" value={aEnd} onChange={e=>setAEnd(e.target.value)} className="input" />
          </div>
          <div style={{ marginTop: 12 }}>
            <button className="btn" type="submit">Add Availability</button>
          </div>
        </form>

        <div className="grid" style={{ marginTop: 12 }}>
          {availabilities.map(a=> (
            <div key={a.id} className="card card-pad">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div className="small muted">{new Date(a.start).toLocaleString()} → {new Date(a.end).toLocaleString()}</div>
                <button onClick={()=>deleteAvailability(a.id)} className="btn btn-danger btn-sm" type="button">Remove</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 12 }}>
        <h3 className="h3">Appointments</h3>
        <div className="grid" style={{ marginTop: 10 }}>
          {appointments.map(ap=> (
            <div key={ap.id} className="card card-pad">
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 800 }}>{ap.service?.title || '—'}</div>
                  <div className="small muted">{new Date(ap.start).toLocaleString()} — {new Date(ap.end).toLocaleString()}</div>
                  <div className="small muted">User: {ap.user?.email || '—'}</div>
                </div>
                <div style={{ display: 'grid', gap: 8, justifyItems: 'end' }}>
                  <span className="pill">{ap.status}</span>
                  <button onClick={()=>refundAppointment(ap.id)} className="btn btn-secondary btn-sm" type="button">Refund</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
