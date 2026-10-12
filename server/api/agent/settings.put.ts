import { requireAgentAdmin } from '../../agent/admin'
import { updateSettings, type SettingsInput } from '../../agent/settings'

export default defineEventHandler(async (event) => {
  requireAgentAdmin(event)
  const body = await readBody<SettingsInput>(event)
  return updateSettings(body ?? {})
})
