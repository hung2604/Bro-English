import { requireAgentAdmin } from '../../agent/admin'
import { processPending, retryFailed } from '../../agent/runner'

/** Re-queues failed messages and reads everything pending now (the "Retry" button). */
export default defineEventHandler(async (event) => {
  requireAgentAdmin(event)
  const retried = await retryFailed()
  await processPending({ debounce: false })
  return { ok: true, retried }
})
