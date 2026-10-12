import { requireAgentAdmin } from '../../../../agent/admin'
import { parseProvider, testProvider } from '../../../../agent/settings'

export default defineEventHandler(async (event) => {
  requireAgentAdmin(event)
  const body = await readBody<{ model?: unknown }>(event).catch(() => null)
  return testProvider(
    parseProvider(getRouterParam(event, 'provider')),
    typeof body?.model === 'string' ? body.model : undefined,
  )
})
