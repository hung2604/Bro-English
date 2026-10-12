import { runInBackground } from '../../agent/background'
import { processPending } from '../../agent/runner'
import { loadSettings, matchesWebhookToken, resolve } from '../../agent/settings'
import { mapZaloPayload } from '../../agent/zalo-payload'
import { col, nextId } from '../../utils/db'
import { isDuplicateKey } from '../../utils/mongo-helpers'

/** smax.ai posts each Zalo message here: `/api/webhooks/zalo?token=…`. */
export default defineEventHandler(async (event) => {
  const doc = await loadSettings()
  const token = getQuery(event).token ?? getHeader(event, 'x-webhook-token')
  if (!matchesWebhookToken(doc, typeof token === 'string' ? token : undefined)) {
    throw createError({ statusCode: 401, message: 'Invalid webhook token' })
  }

  const payload = await readBody(event).catch(() => null)
  const settings = resolve(doc)
  const message = mapZaloPayload(payload, settings.selfChatBy)
  const now = new Date().toISOString()

  // Every thread is remembered by name only, so the group can be picked on the Agent page.
  await (await col('agent_threads')).updateOne(
    { thread_id: message.threadId },
    {
      $set: { name: message.threadName, is_group: message.isGroup, last_seen_at: now },
      $inc: { count: 1 },
    },
    { upsert: true },
  )

  // Message content is kept for the chosen group only; other chats of the account are dropped.
  if (!settings.threadId || message.threadId !== settings.threadId) return { ok: true, stored: false }
  if (!message.text && !message.imageUrls.length) return { ok: true, stored: false }

  try {
    await (await col('agent_messages')).insertOne({
      id: await nextId('agent_messages'),
      external_id: message.externalId,
      thread_id: message.threadId,
      sender_name: message.senderName,
      is_self: message.isSelf,
      text: message.text,
      image_urls: message.imageUrls,
      sent_at: message.sentAt,
      created_at: now,
      status: 'pending',
      raw: payload,
    } as any)
  }
  catch (error: unknown) {
    // smax.ai retried a message that is already stored.
    if (isDuplicateKey(error)) return { ok: true, stored: false, duplicate: true }
    throw error
  }

  await runInBackground(event, processPending())
  return { ok: true, stored: true }
})
