const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

type RequestOptions = {
  method?: string
  body?: any
  token?: string | null
}

export async function apiFetch(path: string, opts: RequestOptions = {}) {
  const headers: Record<string,string> = { 'Content-Type': 'application/json' }
  const token = opts.token ?? (typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null)
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method || 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(txt || res.statusText)
  }
  return res.json()
}

export default apiFetch
