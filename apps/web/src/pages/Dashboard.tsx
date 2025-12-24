import React, { useEffect, useState } from 'react'
import { apiFetch } from '../api'

export default function Dashboard(){
  const [appointments, setAppointments] = useState<any[]>([])
  const [methods, setMethods] = useState<any[]>([])

  useEffect(()=>{
    const user = JSON.parse(localStorage.getItem('user')||'null')
    if(!user) return
    apiFetch(`/api/appointments?userId=${user.id}`).then(setAppointments).catch(console.error)
    const token = localStorage.getItem('token')
    if(token){
      apiFetch('/api/payments/methods', { token }).then((res:any)=> setMethods(res.methods || [])).catch(console.error)
    }
  },[])

  return (
    <div>
      <h2 className="h2">Your Appointments</h2>
      {appointments.length === 0 && <div className="card card-pad muted">No appointments yet.</div>}
      <div className="grid" style={{ marginTop: 12 }}>
        {appointments.map(a => (
          <div key={a.id} className="card card-pad">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 800 }}>{a.service?.title || a.serviceId}</div>
                <div className="small muted">{new Date(a.start).toLocaleString()}</div>
              </div>
              <span className="pill">{a.status}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 18 }}>
        <h3 className="h3">Saved Cards</h3>
        {methods.length===0 && <div className="card card-pad muted">No saved cards (demo mode).</div>}
        <div className="grid" style={{ marginTop: 10 }}>
          {methods.map((m:any)=> (
            <div key={m.id} className="card card-pad">
              <div style={{ fontWeight: 800 }}>{m.brand} •••• {m.last4}</div>
              <div className="small muted">Exp {m.exp_month}/{m.exp_year}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
