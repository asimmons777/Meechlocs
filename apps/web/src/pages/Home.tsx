import React from 'react'
import { Link } from 'react-router-dom'

export default function Home(){
  return (
    <div className="card card-pad">
      <h1 className="h1">Welcome to MeechLocs</h1>
      <p className="p">Book services with real-time availability and a deposit payment flow (simulated in this demo).</p>
      <div className="row">
        <Link to="/services" className="btn">Browse Services</Link>
        <Link to="/login" className="btn btn-secondary">Login</Link>
      </div>
    </div>
  )
}
