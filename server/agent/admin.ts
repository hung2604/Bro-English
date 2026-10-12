import { createError, getHeader, type H3Event } from 'h3'
import { safeEqual } from './secret-box'

/**
 * The Agent page holds API keys and decides what may change money data, so unlike the
 * rest of the app it sits behind a password: `AGENT_ADMIN_PASSWORD`, sent as `x-agent-admin`.
 */
export function requireAgentAdmin(event: H3Event): void {
  const expected = process.env.AGENT_ADMIN_PASSWORD?.trim()
  if (!expected) {
    throw createError({
      statusCode: 503,
      message: 'Set AGENT_ADMIN_PASSWORD in the environment to use the agent settings',
    })
  }
  const given = getHeader(event, 'x-agent-admin')
  if (!given || !safeEqual(given, expected)) {
    throw createError({ statusCode: 401, message: 'Wrong admin password' })
  }
}
