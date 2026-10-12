import { signInWithPin } from '../../agent/admin'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ pin?: unknown }>(event).catch(() => null)
  return signInWithPin(body?.pin)
})
