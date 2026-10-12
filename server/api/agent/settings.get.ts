import { requireAgentAdmin } from '../../agent/admin'
import { settingsView } from '../../agent/settings'
import { col } from '../../utils/db'

export default defineEventHandler(async (event) => {
  requireAgentAdmin(event)
  const [settings, threads, persons] = await Promise.all([
    settingsView(),
    (await col('agent_threads')).find({}).sort({ last_seen_at: -1 }).limit(50).toArray(),
    (await col('persons')).find({}).sort({ name: 1 }).toArray(),
  ])
  return {
    settings,
    threads: threads.map(thread => ({
      id: thread.thread_id as string,
      name: thread.name as string,
      isGroup: Boolean(thread.is_group),
      lastSeenAt: thread.last_seen_at as string,
      count: Number(thread.count ?? 0),
    })),
    persons: persons.map(person => person.name as string),
  }
})
