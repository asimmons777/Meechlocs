import React, { useEffect, useState } from 'react'
import { apiFetch, resolveImageUrl } from '../api'

export default function Admin(){
  const [services, setServices] = useState<any[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [duration, setDuration] = useState(30)
  const [price, setPrice] = useState('0.00')
  const [deposit, setDeposit] = useState('0.00')
  const [images, setImages] = useState('')
  const [uploading, setUploading] = useState(false)

  const [editingServiceId, setEditingServiceId] = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editDuration, setEditDuration] = useState(30)
  const [editPrice, setEditPrice] = useState('0.00')
  const [editDeposit, setEditDeposit] = useState('0.00')
  const [editImages, setEditImages] = useState('')
  const [editIsActive, setEditIsActive] = useState(true)

  async function uploadFile(file: File, onUploaded: (url: string) => void){
    if(!token) return alert('Login as admin')
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    try{
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/admin/upload`, { method: 'POST', body: fd, headers: { Authorization: `Bearer ${token}` } })
      const json = await res.json()
      if(json.url) {
        onUploaded(json.url)
      } else {
        alert('Upload failed')
      }
    }catch(e){ console.error(e); alert('Upload failed') }
    setUploading(false)
  }

  const [availabilities, setAvailabilities] = useState<any[]>([])
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  })
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('17:00')
  const [availabilityError, setAvailabilityError] = useState<string | null>(null)

  const [appointments, setAppointments] = useState<any[]>([])
  const [appointmentsDateFilter, setAppointmentsDateFilter] = useState<string>('')
  const [refundAmounts, setRefundAmounts] = useState<Record<number, string>>({})
  const [refundModes, setRefundModes] = useState<Record<number, 'FULL' | 'CUSTOM'>>({})

  const token = localStorage.getItem('token')

  useEffect(()=>{ loadAll() }, [])

  async function loadAll(){
    try{
      if(token) {
        const sv = await apiFetch('/api/admin/services', { token })
        setServices(sv)
      } else {
        const sv = await apiFetch('/api/services')
        setServices(sv)
      }
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

  function startEditService(s: any){
    setEditingServiceId(s.id)
    setEditTitle(String(s.title || ''))
    setEditDescription(String(s.description || ''))
    setEditDuration(Number(s.durationMins || 30))
    setEditPrice(((Number(s.priceCents || 0)) / 100).toFixed(2))
    setEditDeposit(((Number(s.depositCents || 0)) / 100).toFixed(2))
    const imgArr = Array.isArray(s.images) ? s.images : []
    setEditImages(imgArr.join(','))
    setEditIsActive(Boolean(s.isActive))
  }

  async function saveEditService(e: React.FormEvent){
    e.preventDefault()
    if(!token) return alert('Login as admin first')
    if(editingServiceId == null) return
    try{
      const body = {
        title: editTitle,
        description: editDescription,
        durationMins: Number(editDuration),
        priceCents: Math.round(parseFloat(editPrice || '0') * 100),
        depositCents: Math.round(parseFloat(editDeposit || '0') * 100),
        images: editImages.split(',').map(s => s.trim()).filter(Boolean),
        isActive: Boolean(editIsActive),
      }
      await apiFetch(`/api/admin/services/${editingServiceId}`, { method: 'PUT', body, token })
      setEditingServiceId(null)
      await loadAll()
    }catch(err:any){
      alert(err.message || 'Failed')
    }
  }

  function toYmdLocal(d: Date) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const filteredAppointments = appointmentsDateFilter
    ? appointments.filter(ap => {
        const start = ap?.start ? new Date(ap.start) : null
        if (!start || Number.isNaN(start.getTime())) return false
        return toYmdLocal(start) === appointmentsDateFilter
      })
    : appointments

  function localIsoFromYmdTime(ymd: string, time: string) {
    // Interpret as local time, then convert to ISO for API.
    const dt = new Date(`${ymd}T${time}:00`)
    return dt.toISOString()
  }

  function startOfMonthGrid(d: Date) {
    const first = new Date(d.getFullYear(), d.getMonth(), 1)
    const start = new Date(first)
    start.setDate(first.getDate() - first.getDay()) // Sunday start
    start.setHours(0, 0, 0, 0)
    return start
  }

  async function addAvailabilityForSelectedDay(e: React.FormEvent){
    e.preventDefault()
    setAvailabilityError(null)
    if(!token) return alert('Login as admin first')
    try{
      if(!selectedDate) return
      if(!startTime || !endTime) {
        setAvailabilityError('Pick a start and end time.')
        return
      }

      const startIso = localIsoFromYmdTime(selectedDate, startTime)
      const endIso = localIsoFromYmdTime(selectedDate, endTime)
      if(new Date(endIso).getTime() <= new Date(startIso).getTime()) {
        setAvailabilityError('End time must be after start time.')
        return
      }

      await apiFetch('/api/admin/availability', { method: 'POST', body: { start: startIso, end: endIso }, token })
      await loadAll()
    }catch(err:any){
      setAvailabilityError(err.message || 'Failed')
    }
  }

  async function deleteAvailability(id:number){
    if(!confirm('Remove availability? This will cancel overlapping appointments.')) return
    try{ await apiFetch(`/api/admin/availability/${id}`, { method: 'DELETE', token }); loadAll() }catch(err:any){ alert('Failed') }
  }

  async function refundAppointment(id:number){
    if(!confirm('Issue refund for this appointment?')) return
    try{
      const mode = refundModes[id] || 'FULL'

      // FULL mode: omit amountCents -> Stripe refunds full amount paid.
      // CUSTOM mode: require a valid USD amount.
      let amountCents: number | undefined
      if (mode === 'CUSTOM') {
        const raw = refundAmounts[id]
        const trimmed = (raw ?? '').trim()
        if (!trimmed) {
          alert('Enter a refund amount or choose Full amount.')
          return
        }
        const dollars = Number(trimmed)
        if (!Number.isFinite(dollars) || dollars <= 0) {
          alert('Enter a valid refund amount (e.g. 25.00).')
          return
        }
        amountCents = Math.round(dollars * 100)
      }

      await apiFetch('/api/admin/refund', { method: 'POST', body: { appointmentId: id, amountCents }, token })
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
            <input
              type="file"
              onChange={e=>{
                const f = e.target.files?.[0]
                if(f) uploadFile(f, (url) => setImages(prev => prev ? prev + ',' + url : url))
              }}
            />
            {uploading && <div className="small muted">Uploading…</div>}
          </div>

          <div className="row" style={{ marginTop: 12, justifyContent: 'flex-start' }}>
            {images.split(',').map(s=>s.trim()).filter(Boolean).slice(0,6).map(url=> (
              <img key={url} src={resolveImageUrl(url)} style={{width:120,height:80,objectFit:'cover',borderRadius:10,border:'1px solid var(--border)'}} alt="preview" />
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
              {editingServiceId === s.id ? (
                <form onSubmit={saveEditService}>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <div style={{ fontWeight: 900 }}>Edit Service</div>
                    <div className="row" style={{ justifyContent: 'flex-end' }}>
                      <button className="btn btn-sm" type="submit">Save</button>
                      <button className="btn btn-secondary btn-sm" type="button" onClick={() => setEditingServiceId(null)}>Cancel</button>
                      <button onClick={()=>deleteService(s.id)} className="btn btn-danger btn-sm" type="button">Delete</button>
                    </div>
                  </div>

                  <div className="divider" />

                  <div className="field">
                    <div className="label">Title</div>
                    <input value={editTitle} onChange={e=>setEditTitle(e.target.value)} className="input" />
                  </div>

                  <div className="field" style={{ marginTop: 12 }}>
                    <div className="label">Description</div>
                    <textarea value={editDescription} onChange={e=>setEditDescription(e.target.value)} className="textarea" />
                  </div>

                  <div className="row" style={{ marginTop: 12 }}>
                    <div className="field">
                      <div className="label">Duration (mins)</div>
                      <input value={editDuration} onChange={e=>setEditDuration(Number(e.target.value))} type="number" className="input" />
                    </div>
                    <div className="field">
                      <div className="label">Price (USD)</div>
                      <input value={editPrice} onChange={e=>setEditPrice(e.target.value)} className="input" />
                    </div>
                    <div className="field">
                      <div className="label">Deposit (USD)</div>
                      <input value={editDeposit} onChange={e=>setEditDeposit(e.target.value)} className="input" />
                    </div>
                  </div>

                  <div className="field" style={{ marginTop: 12 }}>
                    <div className="label">Images (CSV URLs)</div>
                    <input value={editImages} onChange={e=>setEditImages(e.target.value)} className="input" />
                  </div>

                  <div className="field" style={{ marginTop: 12 }}>
                    <div className="label">Or upload image</div>
                    <input
                      type="file"
                      onChange={e=>{
                        const f = e.target.files?.[0]
                        if(f) uploadFile(f, (url) => setEditImages(prev => prev ? prev + ',' + url : url))
                      }}
                    />
                    {uploading && <div className="small muted">Uploading…</div>}
                  </div>

                  <div className="field" style={{ marginTop: 12 }}>
                    <label className="small" style={{ display: 'flex', gap: 10, alignItems: 'center', color: 'var(--muted-strong-surface)' }}>
                      <input type="checkbox" checked={editIsActive} onChange={e=>setEditIsActive(e.target.checked)} />
                      Active (visible to customers)
                    </label>
                  </div>

                  <div className="row" style={{ marginTop: 12, justifyContent: 'flex-start' }}>
                    {editImages.split(',').map((u:string)=>u.trim()).filter(Boolean).slice(0,6).map((url:string)=> (
                        <img key={url} src={resolveImageUrl(url)} style={{width:120,height:80,objectFit:'cover',borderRadius:10,border:'1px solid var(--border)'}} alt="preview" />
                    ))}
                  </div>
                </form>
              ) : (
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>{s.title}</div>
                    <div className="small muted">{s.description}</div>
                    <div className="small muted">Duration: {s.durationMins} mins • Deposit ${(Number(s.depositCents || 0)/100).toFixed(2)} • Price ${(Number(s.priceCents || 0)/100).toFixed(2)}</div>
                    <div className="small muted">Status: {s.isActive ? 'Active' : 'Inactive'}</div>
                  </div>
                  <div className="row" style={{ justifyContent: 'flex-end' }}>
                    <button onClick={()=>startEditService(s)} className="btn btn-secondary btn-sm" type="button">Edit</button>
                    <button onClick={()=>deleteService(s.id)} className="btn btn-danger btn-sm" type="button">Delete</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="card card-pad" style={{ marginTop: 12 }}>
        <h3 className="h3">Availability</h3>

        {(() => {
          const byDay = new Map<string, any[]>()
          for(const a of availabilities){
            const k = toYmdLocal(new Date(a.start))
            const list = byDay.get(k) || []
            list.push(a)
            byDay.set(k, list)
          }

          const gridStart = startOfMonthGrid(calMonth)
          const days: Date[] = []
          for(let i=0;i<42;i++){
            const dd = new Date(gridStart)
            dd.setDate(gridStart.getDate() + i)
            days.push(dd)
          }

          const monthLabel = calMonth.toLocaleString(undefined, { month: 'long', year: 'numeric' })
          const selectedList = (byDay.get(selectedDate) || []).slice().sort((a,b)=> new Date(a.start).getTime() - new Date(b.start).getTime())

          return (
            <div style={{ marginTop: 10 }}>
              <div className="calendar-head">
                <div className="calendar-title">{monthLabel}</div>
                <div className="row" style={{ justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setCalMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setCalMonth(() => {
                      const now = new Date()
                      return new Date(now.getFullYear(), now.getMonth(), 1)
                    })}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setCalMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                  >
                    Next
                  </button>
                </div>
              </div>

              <div className="calendar-grid">
                {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(w => (
                  <div key={w} className="calendar-dow">{w}</div>
                ))}

                {days.map(d => {
                  const ymd = toYmdLocal(d)
                  const inMonth = d.getMonth() === calMonth.getMonth()
                  const count = (byDay.get(ymd) || []).length
                  const isSelected = ymd === selectedDate
                  return (
                    <button
                      key={ymd}
                      type="button"
                      className={
                        'calendar-day'
                        + (inMonth ? '' : ' is-out')
                        + (isSelected ? ' is-selected' : '')
                      }
                      onClick={() => setSelectedDate(ymd)}
                      aria-label={`Select ${ymd}`}
                    >
                      <div className="calendar-daynum">{d.getDate()}</div>
                      {count > 0 && <div className="calendar-badge">{count}</div>}
                    </button>
                  )
                })}
              </div>

              <div className="card card-pad" style={{ marginTop: 12 }}>
                <h4 className="h3" style={{ marginBottom: 6 }}>Add availability</h4>
                <div className="small muted">Selected day: {selectedDate}</div>

                {availabilityError && <div className="alert alert-danger" style={{ marginTop: 10 }}>{availabilityError}</div>}

                <form onSubmit={addAvailabilityForSelectedDay} style={{ marginTop: 10 }}>
                  <div className="row" style={{ alignItems: 'flex-end' }}>
                    <div className="field">
                      <div className="label">Start time</div>
                      <input type="time" value={startTime} onChange={e=>setStartTime(e.target.value)} className="input" />
                    </div>
                    <div className="field">
                      <div className="label">End time</div>
                      <input type="time" value={endTime} onChange={e=>setEndTime(e.target.value)} className="input" />
                    </div>
                    <div>
                      <button className="btn" type="submit">Add</button>
                    </div>
                  </div>
                </form>

                <div className="divider" />

                <h4 className="h3" style={{ marginBottom: 6 }}>Availability for {selectedDate}</h4>
                {selectedList.length === 0 ? (
                  <div className="small muted">No availability blocks for this day.</div>
                ) : (
                  <div className="grid" style={{ marginTop: 10 }}>
                    {selectedList.map(a => (
                      <div key={a.id} className="card card-pad">
                        <div className="row" style={{ justifyContent: 'space-between' }}>
                          <div className="small muted">{new Date(a.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} → {new Date(a.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                          <button onClick={()=>deleteAvailability(a.id)} className="btn btn-danger btn-sm" type="button">Remove</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })()}
      </section>

      <section style={{ marginTop: 12 }}>
        <div className="section-head">
          <h3 className="h3">Appointments</h3>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <div className="field" style={{ minWidth: 220 }}>
              <div className="small muted" style={{ fontWeight: 800 }}>Filter date</div>
              <input
                type="date"
                className="input"
                value={appointmentsDateFilter}
                onChange={e => setAppointmentsDateFilter(e.target.value)}
              />
            </div>
            <div style={{ flex: '0 0 auto', minWidth: 0, alignSelf: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setAppointmentsDateFilter('')}
                disabled={!appointmentsDateFilter}
              >
                Clear
              </button>
            </div>
          </div>
        </div>
        {appointmentsDateFilter && (
          <div className="small muted" style={{ marginTop: 6 }}>
            Showing {filteredAppointments.length} appointment{filteredAppointments.length === 1 ? '' : 's'} for {appointmentsDateFilter}.
          </div>
        )}
        <div className="grid" style={{ marginTop: 10 }}>
          {filteredAppointments.map(ap=> (
            <div key={ap.id} className="card card-pad">
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 800 }}>{ap.service?.title || '—'}</div>
                  <div className="small muted">{new Date(ap.start).toLocaleString()} — {new Date(ap.end).toLocaleString()}</div>
                  <div className="small muted">
                    User: {ap.user?.isGuest ? '(Guest) ' : ''}{ap.user?.email || '—'}
                  </div>
                  <div className="small muted">
                    Paid: {typeof ap.amountPaidCents === 'number'
                      ? `$${(ap.amountPaidCents/100).toFixed(2)}`
                      : ap.service?.depositCents
                        ? `$${(Number(ap.service.depositCents)/100).toFixed(2)}`
                        : '—'
                    }{ap.paidType === 'DEPOSIT' ? ' (deposit)' : ap.paidType === 'FULL' ? ' (full)' : ''}
                  </div>
                </div>
                <div style={{ display: 'grid', gap: 8, justifyItems: 'end' }}>
                  <span className="pill">{ap.status}</span>
                  <div className="row" style={{ justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className={(refundModes[ap.id] || 'FULL') === 'FULL' ? 'btn btn-sm' : 'btn btn-secondary btn-sm'}
                      onClick={() => {
                        setRefundModes(prev => ({ ...prev, [ap.id]: 'FULL' }))
                        setRefundAmounts(prev => ({ ...prev, [ap.id]: '' }))
                      }}
                    >
                      Full amount
                    </button>
                    <button
                      type="button"
                      className={(refundModes[ap.id] || 'FULL') === 'CUSTOM' ? 'btn btn-sm' : 'btn btn-secondary btn-sm'}
                      onClick={() => setRefundModes(prev => ({ ...prev, [ap.id]: 'CUSTOM' }))}
                    >
                      Custom amount
                    </button>
                  </div>

                  {(refundModes[ap.id] || 'FULL') === 'CUSTOM' && (
                    <div className="field" style={{ width: 160 }}>
                      <div className="small muted" style={{ fontWeight: 800 }}>Refund $</div>
                      <input
                        className="input"
                        inputMode="decimal"
                        placeholder="25.00"
                        value={refundAmounts[ap.id] ?? ''}
                        onChange={e => setRefundAmounts(prev => ({ ...prev, [ap.id]: e.target.value }))}
                      />
                    </div>
                  )}

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
