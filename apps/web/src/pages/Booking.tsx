import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { apiFetch } from '../api'

export default function Booking(){
  const { id } = useParams()
  const nav = useNavigate()
  const [service, setService] = useState<any>(null)
  const [date, setDate] = useState('')
  const [slots, setSlots] = useState<string[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(()=>{
    if(!id) return
    apiFetch(`/api/services/${id}`).then(setService).catch(console.error)
  },[id])

  useEffect(()=>{
    async function loadSlots(){
      if(!id || !date) return
      try{
        const res = await apiFetch(`/api/availability/slots?serviceId=${id}&date=${date}`)
        setSlots(res.slots || [])
      }catch(err){
        console.error(err)
      }
    }
    loadSlots()
  },[id,date])

  async function submit(e: React.FormEvent){
    e.preventDefault()
    try{
      if(!service || !selected) return
      const user = JSON.parse(localStorage.getItem('user')||'null')
      if(!user) { nav('/login'); return }
      const startDate = new Date(selected)
      const endDate = new Date(startDate.getTime() + service.durationMins*60000)
      const token = localStorage.getItem('token')
      const res = await apiFetch('/api/appointments', { method: 'POST', body: { serviceId: service.id, start: startDate.toISOString(), end: endDate.toISOString() }, token })
      if(res.checkoutUrl){
        window.location.href = res.checkoutUrl
      } else {
        alert('Appointment created (no Stripe configured)')
        nav('/dashboard')
      }
    }catch(err:any){
      setError(err.message || 'Booking failed')
    }
  }

  if(!service) return <div>Loading...</div>

  return (
    <div className="card card-pad" style={{ maxWidth: 520, margin: '0 auto' }}>
      <h2 className="h2">Book: {service.title}</h2>
      <p className="p">Select a date and an available time. You’ll pay the deposit (simulated in demo mode).</p>

      {error && <div className="alert alert-danger">{error}</div>}

      <form onSubmit={submit}>
        <div className="field" style={{ marginTop: 12 }}>
          <div className="label">Pick date</div>
          <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="input" />
        </div>

        <div className="field" style={{ marginTop: 12 }}>
          <div className="label">Available times</div>
          {date && slots.length === 0 && <div className="small muted">No available slots for this date.</div>}
          <div className="row" style={{ marginTop: 8, justifyContent: 'flex-start' }}>
            {slots.map(s => {
              const active = selected === s
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSelected(s)}
                  className={active ? 'btn btn-sm' : 'btn btn-secondary btn-sm'}
                >
                  {new Date(s).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}
                </button>
              )
            })}
          </div>
        </div>

        <div className="divider" />

        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="small muted">Duration: {service.durationMins} mins</div>
          <div className="small muted">Deposit ${(service.depositCents/100).toFixed(2)}</div>
        </div>

        {!showConfirm && (
          <div style={{ marginTop: 12 }}>
            <button type="button" onClick={()=>setShowConfirm(true)} className="btn" disabled={!selected}>
              Continue
            </button>
          </div>
        )}

        {showConfirm && selected && (
          <div className="card card-pad" style={{ marginTop: 12 }}>
            <h3 className="h3">Review & Confirm</h3>
            <div className="small muted">Start: {new Date(selected).toLocaleString()}</div>
            <div className="small muted">End: {new Date(new Date(selected).getTime() + service.durationMins*60000).toLocaleString()}</div>
            <div className="small muted">Total: {service.priceCents ? `$${(service.priceCents/100).toFixed(2)}` : '—'}</div>
            <div className="small muted">Deposit: {service.depositCents ? `$${(service.depositCents/100).toFixed(2)}` : '—'}</div>
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn btn-secondary" type="button" onClick={()=>setShowConfirm(false)}>Back</button>
              <button className="btn" type="submit">Confirm & Pay</button>
            </div>
          </div>
        )}
      </form>
    </div>
  )
}
