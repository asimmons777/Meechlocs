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

export function resolveImageUrl(raw: string): string {
  const url = String(raw || '').trim()
  if(!url) return url
  if(url.startsWith('/')) return url
  if(url.startsWith('http://') || url.startsWith('https://')) {
    // If an image was stored with a hard-coded localhost base, rewrite to the current origin.
    try{
      const u = new URL(url)
      if(u.hostname === 'localhost' || u.hostname === '127.0.0.1'){
        return `${window.location.origin}${u.pathname}`
      }
    }catch{
      // ignore
    }
    return url
  }
  return url
}

export default apiFetch
