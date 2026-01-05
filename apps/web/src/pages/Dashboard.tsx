import React, { useEffect, useState } from 'react'
import { apiFetch } from '../api'

export default function Dashboard(){
  const [appointments, setAppointments] = useState<any[]>([])
  const [methods, setMethods] = useState<any[]>([])
  const [defaultPaymentMethodId, setDefaultPaymentMethodId] = useState<string | null>(null)
  const [pmBusy, setPmBusy] = useState(false)
  const [cancelBusyId, setCancelBusyId] = useState<number | null>(null)

  useEffect(()=>{
    const user = JSON.parse(localStorage.getItem('user')||'null')
    if(!user) return
    apiFetch(`/api/appointments?userId=${user.id}`).then(setAppointments).catch(console.error)
    const token = localStorage.getItem('token')
    if(token){
      apiFetch('/api/payments/methods', { token }).then((res:any)=> {
        setMethods(res.methods || [])
        setDefaultPaymentMethodId(res.defaultPaymentMethodId || null)
      }).catch(console.error)
    }
  },[])

  async function refreshAppointments(){
    const user = JSON.parse(localStorage.getItem('user')||'null')
    if(!user) return
    const list = await apiFetch(`/api/appointments?userId=${user.id}`)
    setAppointments(list)
  }

  async function cancelAppointment(appt: any){
    if(!appt?.id) return
    const startMs = appt?.start ? new Date(appt.start).getTime() : NaN
    const hoursUntil = Number.isFinite(startMs) ? (startMs - Date.now()) / (60 * 60 * 1000) : NaN
    const within24 = Number.isFinite(hoursUntil) ? hoursUntil <= 24 : false

    const msg = within24
      ? 'Canceling within 24 hours forfeits your deposit. Do you want to cancel anyway?'
      : 'Cancel this appointment? (Canceling within 24 hours forfeits your deposit.)'

    if(!confirm(msg)) return
    setCancelBusyId(appt.id)
    try{
      const res:any = await apiFetch(`/api/appointments/${appt.id}/cancel`, { method: 'POST' })
      await refreshAppointments()
      if(res?.refunded) {
        alert(res?.refundSimulated ? 'Appointment canceled. Deposit refund simulated (demo mode).' : 'Appointment canceled. Deposit refunded.')
      } else if(res?.depositForfeited) {
        alert('Appointment canceled. Deposit forfeited (within 24 hours).')
      } else {
        alert('Appointment canceled.')
      }
    }catch(e:any){
      alert(e.message || 'Cancel failed')
    }
    setCancelBusyId(null)
  }

  async function refreshMethods(){
    const token = localStorage.getItem('token')
    if(!token) return
    const res:any = await apiFetch('/api/payments/methods', { token })
    setMethods(res.methods || [])
    setDefaultPaymentMethodId(res.defaultPaymentMethodId || null)
  }

  async function startSetup(){
    const token = localStorage.getItem('token')
    if(!token) return
    setPmBusy(true)
    try{
      const res:any = await apiFetch('/api/payments/setup-session', { method: 'POST', token })
      if(res.url) window.location.href = res.url
      else alert('Could not start card setup')
    }catch(e:any){
      alert(e.message || 'Could not start card setup')
    }
    setPmBusy(false)
  }

  async function setDefault(pmId: string){
    const token = localStorage.getItem('token')
    if(!token) return
    setPmBusy(true)
    try{
      await apiFetch('/api/payments/set-default', { method: 'POST', body: { paymentMethodId: pmId }, token })
      await refreshMethods()
    }catch(e:any){
      alert(e.message || 'Failed')
    }
    setPmBusy(false)
  }

  async function removePm(pmId: string){
    const token = localStorage.getItem('token')
    if(!token) return
    if(!confirm('Remove this saved card?')) return
    setPmBusy(true)
    try{
      await apiFetch('/api/payments/detach', { method: 'POST', body: { paymentMethodId: pmId }, token })
      await refreshMethods()
    }catch(e:any){
      alert(e.message || 'Failed')
    }
    setPmBusy(false)
  }

  return (
    <div>
      <h2 className="h2">Your Appointments</h2>
      <div className="small muted" style={{ marginTop: 6 }}>
        Note: canceling within 24 hours of your appointment forfeits your deposit.
      </div>
      {appointments.length === 0 && <div className="card card-pad muted">No appointments yet.</div>}
      <div className="grid" style={{ marginTop: 12 }}>
        {appointments.map(a => (
          <div key={a.id} className="card card-pad">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 800 }}>{a.service?.title || a.serviceId}</div>
                <div className="small muted">{new Date(a.start).toLocaleString()}</div>
              </div>
              <div style={{ display: 'grid', gap: 8, justifyItems: 'end' }}>
                <span className="pill">{a.status}</span>
                {(() => {
                  const startMs = a?.start ? new Date(a.start).getTime() : NaN
                  const isUpcoming = Number.isFinite(startMs) && startMs > Date.now()
                  const canCancel = isUpcoming && (a.status === 'PENDING' || a.status === 'CONFIRMED')
                  if (!canCancel) return null
                  return (
                    <button
                      className="btn btn-secondary btn-sm"
                      type="button"
                      onClick={() => cancelAppointment(a)}
                      disabled={cancelBusyId === a.id}
                    >
                      Cancel
                    </button>
                  )
                })()}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 18 }}>
        <h3 className="h3">Saved Cards</h3>
        {methods.length===0 && <div className="card card-pad muted">No saved cards (demo mode).</div>}

        <div style={{ marginTop: 10 }}>
          <button className="btn btn-sm" type="button" onClick={startSetup} disabled={pmBusy}>
            Add / Change Card
          </button>
        </div>

        <div className="grid" style={{ marginTop: 10 }}>
          {methods.map((m:any)=> (
            <div key={m.id} className="card card-pad">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div style={{ fontWeight: 800 }}>{m.brand} •••• {m.last4}</div>
                {(m.isDefault || m.id === defaultPaymentMethodId) && <span className="pill">Default</span>}
              </div>
              <div className="small muted">Exp {m.exp_month}/{m.exp_year}</div>

              <div className="row" style={{ marginTop: 10, justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary btn-sm" type="button" onClick={()=>setDefault(m.id)} disabled={pmBusy}>
                  Make default
                </button>
                <button className="btn btn-danger btn-sm" type="button" onClick={()=>removePm(m.id)} disabled={pmBusy}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
