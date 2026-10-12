import { requireAgentAdmin } from '../../agent/admin'
import { senderLabel, type StoredMessage } from '../../agent/prompt'
import type { AgentRun } from '../../agent/runner'
import { resolvedSettings } from '../../agent/settings'
import { col } from '../../utils/db'
import { stripId } from '../../utils/mongo-helpers'

/** Recent messages of the group and what the agent did with them, newest first. */
export default defineEventHandler(async (event) => {
  requireAgentAdmin(event)
  const settings = await resolvedSettings()
  const [messages, runs, persons] = await Promise.all([
    (await col<StoredMessage>('agent_messages')).find({}).sort({ id: -1 }).limit(60).toArray(),
    (await col<AgentRun>('agent_runs')).find({}).sort({ id: -1 }).limit(40).toArray(),
    (await col('persons')).find({}).toArray(),
  ])
  const people = persons.map(person => ({ id: person.id as number, name: person.name as string }))
  return {
    messages: messages.map(message => ({
      id: message.id,
      sender: senderLabel(message, settings, people),
      text: message.text,
      imageUrls: message.image_urls,
      at: message.sent_at ?? message.created_at,
      status: message.status,
      runId: message.run_id ?? null,
      note: message.note ?? '',
      raw: (message as StoredMessage & { raw?: unknown }).raw ?? null,
    })),
    runs: stripId(runs),
  }
})
