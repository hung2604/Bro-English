import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * The server-side secret everything else is derived from: `SETTINGS_SECRET`, falling back to
 * `MONGODB_URI` (long, private, and always set). The admin PIN is far too short for this.
 */
export function secretMaterial(): string {
  const material = process.env.SETTINGS_SECRET?.trim() || process.env.MONGODB_URI?.trim()
  if (!material) throw new Error('Missing SETTINGS_SECRET or MONGODB_URI to derive a secret key')
  return material
}

/**
 * Encrypts secrets (API keys, webhook token) before they are stored in Mongo, AES-256-GCM.
 * Changing the variable behind `secretMaterial` means the saved keys have to be entered again.
 */
function key(): Buffer {
  return createHash('sha256').update(`bro-english:${secretMaterial()}`).digest()
}

export function seal(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), body.toString('base64')].join('.')
}

/** Returns `null` when the value cannot be decrypted (secret changed or data damaged). */
export function open(sealed: string): string | null {
  const [version, iv, tag, body] = sealed.split('.')
  if (version !== 'v1' || !iv || !tag || !body) return null
  try {
    const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'))
    decipher.setAuthTag(Buffer.from(tag, 'base64'))
    return Buffer.concat([
      decipher.update(Buffer.from(body, 'base64')),
      decipher.final(),
    ]).toString('utf8')
  }
  catch {
    return null
  }
}

/** `sk-…a1b2`, so the UI can show a key exists without exposing it. */
export function hint(secret: string): string {
  const trimmed = secret.trim()
  if (trimmed.length <= 8) return '••••'
  return `${trimmed.slice(0, 3)}…${trimmed.slice(-4)}`
}

export function safeEqual(a: string, b: string): boolean {
  const left = createHash('sha256').update(a).digest()
  const right = createHash('sha256').update(b).digest()
  return timingSafeEqual(left, right)
}
