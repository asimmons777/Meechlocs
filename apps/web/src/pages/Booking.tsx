import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { apiFetch } from '../api'
import AuthGateModal from '../components/AuthGateModal'

export default function Booking(){
  const { id } = useParams()
  const nav = useNavigate()
  const [service, setService] = useState<any>(null)
  const [date, setDate] = useState('')
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [availabilities, setAvailabilities] = useState<any[]>([])
  const [slots, setSlots] = useState<string[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [methods, setMethods] = useState<any[]>([])
  const [selectedMethodId, setSelectedMethodId] = useState<string>('')
  const [pmBusy, setPmBusy] = useState(false)
  const [payBusy, setPayBusy] = useState(false)

  const [authOpen, setAuthOpen] = useState(false)
  const [postAuthAction, setPostAuthAction] = useState<'CONTINUE' | 'SUBMIT' | null>(null)

  useEffect(() => {
    const handler = () => {
      // noop; just triggers rerender if needed
      setAuthOpen(v => v)
    }
    window.addEventListener('auth-changed', handler as EventListener)
    return () => window.removeEventListener('auth-changed', handler as EventListener)
  }, [])

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

  useEffect(()=>{
    // load availability blocks for month rendering
    apiFetch('/api/availability').then((a:any) => setAvailabilities(a || [])).catch(console.error)
  },[])

  function toYmdLocal(d: Date) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  function startOfMonthGrid(d: Date) {
    const first = new Date(d.getFullYear(), d.getMonth(), 1)
    const start = new Date(first)
    start.setDate(first.getDate() - first.getDay()) // Sunday start
    start.setHours(0, 0, 0, 0)
    return start
  }

  async function performSubmit(){
    if(!service || !selected) return
    const token = localStorage.getItem('token')
    if(!token) {
      setPostAuthAction('SUBMIT')
      setAuthOpen(true)
      return
    }
    const startDate = new Date(selected)
    const endDate = new Date(startDate.getTime() + service.durationMins*60000)
    const res = await apiFetch('/api/appointments', { method: 'POST', body: { serviceId: service.id, start: startDate.toISOString(), end: endDate.toISOString(), paymentMethodId: selectedMethodId || undefined }, token })
    if(res.checkoutUrl){
      window.location.href = res.checkoutUrl
    } else {
      const requiresDeposit = typeof service.depositCents === 'number' && service.depositCents > 0
      if (requiresDeposit) {
        throw new Error('Payments are not configured. Please try again later.')
      }
      alert('Appointment requested')
      nav('/dashboard')
    }
  }

  async function submit(e: React.FormEvent){
    e.preventDefault()
    setPayBusy(true)
    try{
      await performSubmit()
    }catch(err:any){
      setError(err.message || 'Booking failed')
    }
    setPayBusy(false)
  }

  async function loadMethods(){
    const token = localStorage.getItem('token')
    if(!token) return
    try{
      const res:any = await apiFetch('/api/payments/methods', { token })
      const list = res.methods || []
      setMethods(list)
      const def = list.find((m:any) => m.isDefault)
      if(def) setSelectedMethodId(def.id)
      else if(list[0]?.id) setSelectedMethodId(list[0].id)
    }catch(e){
      console.error(e)
    }
  }

  async function startSetup(){
    const token = localStorage.getItem('token')
    if(!token) { nav('/'); return }
    setPmBusy(true)
    try{
      const returnPath = `${window.location.pathname}${window.location.search}`
      const res:any = await apiFetch('/api/payments/setup-session', { method: 'POST', body: { returnPath }, token })
      if(res.url) window.location.href = res.url
      else alert('Could not start card setup')
    }catch(e:any){
      alert(e.message || 'Could not start card setup')
    }
    setPmBusy(false)
  }

  if(!service) return <div>Loading...</div>

  return (
    <>
      {authOpen && (
        <AuthGateModal
          initialMode="guest"
          onRequestClose={() => { setAuthOpen(false); setPostAuthAction(null) }}
          onAuthed={() => {
            setAuthOpen(false)
            const action = postAuthAction
            setPostAuthAction(null)
            if (action === 'CONTINUE') {
              setShowConfirm(true)
              loadMethods()
            }
            if (action === 'SUBMIT') {
              // Retry automatically now that we have a token.
              performSubmit().catch((err:any) => setError(err?.message || 'Booking failed'))
            }
          }}
        />
      )}

      <div className="card card-pad" style={{ maxWidth: 520, margin: '0 auto' }}>
        <h2 className="h2">Book: {service.title}</h2>
        <p className="p">Select a date and an available time to request your appointment.</p>

      {error && <div className="alert alert-danger">{error}</div>}

      <form onSubmit={submit}>
        <div className="card card-pad" style={{ marginTop: 12 }}>
          {(() => {
            const year = calMonth.getFullYear()
            const month = calMonth.getMonth()
            const daysInMonth = new Date(year, month + 1, 0).getDate()
            const days: Date[] = []
            for (let d = 1; d <= daysInMonth; d++) {
              days.push(new Date(year, month, d))
            }
            const monthLabel = calMonth.toLocaleString(undefined, { month: 'long', year: 'numeric' })
            const today = toYmdLocal(new Date())
            return (
              <div>
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

                  {days.map((d, idx) => {
                    const ymd = toYmdLocal(d)
                    const isSelected = ymd === date
                    const isPast = ymd < today

                    // compute day start/end (local) to check availability overlap
                    const dayStart = new Date(d)
                    dayStart.setHours(0,0,0,0)
                    const dayEnd = new Date(dayStart.getTime() + 24*60*60*1000)

                    const hasAvail = availabilities.some((a:any) => {
                      const aStart = new Date(a.start)
                      const aEnd = new Date(a.end)
                      // overlaps day
                      if (!(aStart < dayEnd && aEnd > dayStart)) return false
                      // if today, ensure there is time remaining after now
                      if (ymd === today) {
                        const now = new Date()
                        if (aEnd <= now) return false
                      }
                      return true
                    })

                    const classes = ['calendar-day']
                    if (isSelected) classes.push('is-selected')
                    if (isPast) classes.push('past')
                    if (hasAvail) classes.push('has-availability')

                    // Align the first day of the month under its proper weekday column
                    const style: React.CSSProperties = {}
                    if (idx === 0) {
                      style.gridColumnStart = d.getDay() + 1
                    }

                    return (
                      <button
                        key={ymd}
                        type="button"
                        className={classes.join(' ')}
                        onClick={() => setDate(ymd)}
                        disabled={isPast}
                        aria-label={`Select ${ymd}`}
                        style={style}
                      >
                        <div className="calendar-daynum">{d.getDate()}</div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })()}
        </div>

        <div className="field" style={{ marginTop: 12 }}>
          <div className="label">Available times</div>
          {date && slots.length === 0 && <div className="small muted">No available slots for this date.</div>}
          <div className="slot-scroll" style={{ marginTop: 8 }}>
            <div className="slot-row">
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
        </div>

        <div className="divider" />

        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="small muted">Duration: {service.durationMins} mins</div>
          <div className="small muted">Deposit ${(service.depositCents/100).toFixed(2)}</div>
        </div>

        {!showConfirm && (
          <div style={{ marginTop: 12 }}>
            <button
              type="button"
              onClick={() => {
                if (!selected) return
                setShowConfirm(true)
                if (localStorage.getItem('token')) loadMethods()
              }}
              className="btn"
              disabled={!selected}
            >
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

            <div className="divider" />

            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <div className="label">Payment method</div>
                {selectedMethodId ? (
                  (() => {
                    const m:any = methods.find((x:any) => x.id === selectedMethodId)
                    return (
                      <div className="small muted">
                        Saved card: {m?.brand || 'Card'} •••• {m?.last4 || '????'}{m?.exp_month ? ` (exp ${m.exp_month}/${m.exp_year})` : ''}
                      </div>
                    )
                  })()
                ) : (
                  <div className="small muted">Stripe Checkout (you can enter a new card)</div>
                )}
              </div>
              <button className="btn btn-sm" type="button" onClick={startSetup} disabled={pmBusy || payBusy}>
                Change / Add Card
              </button>
            </div>

            {methods.length > 0 && (
              <div className="field" style={{ marginTop: 12 }}>
                <div className="label">Pay with saved card (optional)</div>
                <select className="input" value={selectedMethodId} onChange={(e)=>setSelectedMethodId(e.target.value)}>
                  {methods.map((m:any) => (
                    <option key={m.id} value={m.id}>
                      {m.brand} •••• {m.last4} (exp {m.exp_month}/{m.exp_year}){m.isDefault ? ' — default' : ''}
                    </option>
                  ))}
                </select>
                <div className="small muted" style={{ marginTop: 6 }}>
                  If this fails (bank/3DS), you’ll be sent to checkout.
                </div>
              </div>
            )}

            {methods.length === 0 && (
              <div className="small muted" style={{ marginTop: 10 }}>
                No saved card found. You’ll be redirected to Stripe Checkout to pay.
              </div>
            )}

            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn btn-secondary" type="button" onClick={()=>setShowConfirm(false)}>Back</button>
              <button className="btn" type="submit" disabled={payBusy}>{selectedMethodId ? 'Pay with Saved Card' : 'Confirm & Pay'}</button>
            </div>
          </div>
        )}
        </form>
      </div>
    </>
  )
}
