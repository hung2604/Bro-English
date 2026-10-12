import type { ImageInput, ImageMediaType } from './providers/types'

const MAX_BYTES = 4_500_000
const MAX_REDIRECTS = 3
const TIMEOUT_MS = 15_000
/** Zalo's photo CDNs. More host suffixes can be allowed with `AGENT_IMAGE_HOSTS` (comma separated). */
const DEFAULT_HOSTS = ['zdn.vn', 'zadn.vn']

function allowedHosts(): string[] {
  const extra = (process.env.AGENT_IMAGE_HOSTS ?? '')
    .split(',')
    .map(host => host.trim().toLowerCase())
    .filter(Boolean)
  return [...DEFAULT_HOSTS, ...extra]
}

/**
 * Image links come from chat messages, so the server only downloads from known photo hosts
 * (never an arbitrary or internal address), over https, and re-checks every redirect hop.
 */
function isAllowed(url: URL): boolean {
  if (url.protocol !== 'https:') return false
  const host = url.hostname.toLowerCase()
  return allowedHosts().some(suffix => host === suffix || host.endsWith(`.${suffix}`))
}

/** Downloads a chat photo for the model. Returns the reason as a string when it cannot. */
export async function fetchImage(source: string): Promise<ImageInput | string> {
  let url: URL
  try {
    url = new URL(source)
  }
  catch {
    return 'invalid URL'
  }
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      if (!isAllowed(url)) return `host ${url.hostname} is not an allowed image host`
      const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS) })
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location')
        if (!location) return 'redirect without a location'
        url = new URL(location, url)
        continue
      }
      if (!response.ok) return `HTTP ${response.status}`
      if (Number(response.headers.get('content-length') ?? 0) > MAX_BYTES) return 'image too large'
      const bytes = Buffer.from(await response.arrayBuffer())
      if (bytes.length > MAX_BYTES) return 'image too large'
      // The CDN's content type is unreliable (`image/jpg`, `application/octet-stream`): read the signature.
      const mediaType = sniff(bytes)
      if (!mediaType) return 'not a supported image'
      return { mediaType, data: bytes.toString('base64') }
    }
    return 'too many redirects'
  }
  catch (error: unknown) {
    return error instanceof Error ? error.message : String(error)
  }
}

function sniff(bytes: Buffer): ImageMediaType | null {
  if (bytes.length < 12) return null
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return 'image/jpeg'
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) return 'image/png'
  const head = bytes.subarray(0, 6).toString('latin1')
  if (head === 'GIF87a' || head === 'GIF89a') return 'image/gif'
  if (bytes.subarray(0, 4).toString('latin1') === 'RIFF' && bytes.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp'
  return null
}
