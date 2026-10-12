import { requireAgentAdmin } from '../../../../agent/admin'
import { listProviderModels, parseProvider } from '../../../../agent/settings'

export default defineEventHandler(async (event) => {
  requireAgentAdmin(event)
  return listProviderModels(parseProvider(getRouterParam(event, 'provider')))
})
