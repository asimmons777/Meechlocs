import React from 'react'
import { Link, useSearchParams } from 'react-router-dom'

export default function BookingSuccess() {
  const [params] = useSearchParams()
  const sessionId = params.get('session_id')

  return (
    <div className="card card-pad" style={{ maxWidth: 520, margin: '0 auto' }}>
      <h2 className="h2">Payment successful</h2>
      <p className="p">
        Thanks! Your payment went through.
        {sessionId ? <span style={{ display: 'block', marginTop: 8 }}><strong>Session:</strong> {sessionId}</span> : null}
      </p>
      <p className="p">If your appointment isn’t visible yet, check again in a moment.</p>

      <div className="row" style={{ marginTop: 12 }}>
        <Link className="btn" to="/dashboard">Go to Dashboard</Link>
        <Link className="btn btn-secondary" to="/services">Back to Gallery</Link>
      </div>
    </div>
  )
}
