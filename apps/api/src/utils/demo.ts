export const DEMO_EMAIL_DOMAIN = 'meechlocs.test'

export const DEMO_SERVICE_TITLES = ['Wash & Style', 'Color Treatment', 'Cut & Trim']

export function shouldHideDemoContent(): boolean {
  // Explicit allow: show demo content even outside development.
  // Useful for staging/test environments where you want seed-demo to be visible.
  const allow = (process.env.ALLOW_DEMO_CONTENT || '').trim().toLowerCase()
  if (allow === 'true') return false

  // Default: hide demo content everywhere except local development.
  // Allow override: set HIDE_DEMO_CONTENT=false
  const override = (process.env.HIDE_DEMO_CONTENT || '').trim().toLowerCase()
  if (override === 'false') return false
  return (process.env.NODE_ENV || '').toLowerCase() !== 'development'
}

export function isDemoEmail(email: string): boolean {
  const normalized = (email || '').trim().toLowerCase()
  return normalized.endsWith(`@${DEMO_EMAIL_DOMAIN}`)
}

export function isDemoService(service: any): boolean {
  const title = String(service?.title || '')
  if (DEMO_SERVICE_TITLES.includes(title)) return true

  const images = service?.images
  // `images` is stored as Json in Prisma; handle array / string defensively.
  if (Array.isArray(images)) {
    return images.some((v) => typeof v === 'string' && v.includes('via.placeholder.com'))
  }
  if (typeof images === 'string') {
    return images.includes('via.placeholder.com')
  }
  return false
}
