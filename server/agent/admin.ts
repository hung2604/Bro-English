import { createHash, createHmac } from 'node:crypto'
import { createError, getHeader, type H3Event } from 'h3'
import { col } from '../utils/db'
import { safeEqual, secretMaterial } from './secret-box'

const MAX_FAILS = 5
const FIRST_LOCK_MS = 15 * 60_000
const MAX_LOCK_MS = 24 * 60 * 60_000
const SESSION_MS = 30 * 24 * 60 * 60_000

type PinState = { fails?: number, locked_until?: number, lock_ms?: number }

function configuredPin(): string {
  const pin = process.env.AGENT_ADMIN_PIN?.trim() ?? ''
  if (!/^\d{6}$/.test(pin)) {
    throw createError({
      statusCode: 503,
      message: 'Set AGENT_ADMIN_PIN (6 digits) in the environment to use the agent settings',
    })
  }
  return pin
}

/** Sessions are signed with a key that includes the PIN, so changing the PIN signs everyone out. */
function sign(expiresAt: number, pin: string): string {
  const key = createHash('sha256').update(`bro-english-session:${secretMaterial()}:${pin}`).digest()
  return createHmac('sha256', key).update(String(expiresAt)).digest('base64url')
}

async function pinState() {
  return col<PinState>('agent_state')
}

async function lock(state: PinState | null, now: number): Promise<number> {
  const lockMs = Math.min((state?.lock_ms ?? FIRST_LOCK_MS / 2) * 2, MAX_LOCK_MS)
  await (await pinState()).updateOne(
    { _id: 'pin' as any, $or: [{ locked_until: { $lte: now } }, { locked_until: { $exists: false } }] },
    { $set: { locked_until: now + lockMs, lock_ms: lockMs } },
  )
  return lockMs
}

function locked(ms: number) {
  return createError({
    statusCode: 429,
    message: `Too many wrong PINs. Try again in ${Math.ceil(ms / 60_000)} minute(s).`,
  })
}

/**
 * Exchanges the 6-digit PIN for a long session token. A PIN has only a million values, so
 * wrong attempts are counted globally in Mongo (not per IP, which can be faked, and not in
 * memory, which a serverless function does not keep): 5 wrong ones lock sign-in for
 * 15 minutes, each further lock doubles, up to 24 hours. While locked even the right PIN is
 * refused; a session that is already signed in keeps working.
 */
export async function signInWithPin(given: unknown): Promise<{ token: string, expiresAt: number }> {
  const pin = configuredPin()
  const states = await pinState()
  const now = Date.now()

  const before = await states.findOne({ _id: 'pin' as any })
  if ((before?.locked_until ?? 0) > now) throw locked(before!.locked_until! - now)
  // A lock that has run out gives a fresh set of attempts.
  if (before?.locked_until && (before.fails ?? 0) >= MAX_FAILS) {
    await states.updateOne({ _id: 'pin' as any, locked_until: { $lte: now } }, { $set: { fails: 0 } })
  }

  // Count the attempt before looking at the PIN, so parallel guesses cannot all slip through.
  const attempt = await states.findOneAndUpdate(
    { _id: 'pin' as any },
    { $inc: { fails: 1 } },
    { upsert: true, returnDocument: 'after' },
  )
  const fails = attempt?.fails ?? 1
  if (fails > MAX_FAILS) throw locked(await lock(attempt, now))

  if (typeof given === 'string' && safeEqual(given, pin)) {
    await states.updateOne({ _id: 'pin' as any }, { $set: { fails: 0 }, $unset: { lock_ms: '', locked_until: '' } })
    const expiresAt = now + SESSION_MS
    return { token: `v1.${expiresAt}.${sign(expiresAt, pin)}`, expiresAt }
  }

  if (fails === MAX_FAILS) throw locked(await lock(attempt, now))
  throw createError({ statusCode: 401, message: `Wrong PIN. ${MAX_FAILS - fails} attempt(s) left.` })
}

/**
 * The Agent page holds API keys and decides what may change money data, so unlike the rest
 * of the app it needs a session from `signInWithPin`, sent as `x-agent-admin`.
 */
export function requireAgentAdmin(event: H3Event): void {
  const pin = configuredPin()
  const [version, expires, signature] = (getHeader(event, 'x-agent-admin') ?? '').split('.')
  const expiresAt = Number(expires)
  const valid = version === 'v1'
    && Boolean(signature)
    && Number.isFinite(expiresAt)
    && expiresAt > Date.now()
    && safeEqual(signature!, sign(expiresAt, pin))
  if (!valid) throw createError({ statusCode: 401, message: 'Sign in with the admin PIN' })
}
