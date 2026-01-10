import React from 'react'
import { Link } from 'react-router-dom'

export default function BookingCancel() {
  return (
    <div className="card card-pad" style={{ maxWidth: 520, margin: '0 auto' }}>
      <h2 className="h2">Payment canceled</h2>
      <p className="p">No charge was made. You can try booking again.</p>

      <div className="row" style={{ marginTop: 12 }}>
        <Link className="btn" to="/services">Back to Gallery</Link>
        <Link className="btn btn-secondary" to="/dashboard">Dashboard</Link>
      </div>
    </div>
  )
}
