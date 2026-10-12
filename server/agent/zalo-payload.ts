import { createHash } from 'node:crypto'
import { fold } from './time'

export type ZaloMessage = {
  externalId: string
  threadId: string
  threadName: string
  isGroup: boolean
  /** The account owner's own message (smax.ai marks it with `chat_by`). */
  isSelf: boolean
  /** Name of whoever sent it, when the payload carries one. Empty for other group members on smax.ai. */
  senderName: string
  text: string
  imageUrls: string[]
  sentAt: string | null
}

const IMAGE_URL = /https?:\/\/[^\s"'<>]+/gi
const IMAGE_EXT = /\.(?:jpe?g|png|gif|webp)$/i
/** Zalo serves chat photos from these CDNs, often without a file extension. */
const ZALO_PHOTO_HOST = /(?:^|\.)(?:zdn|zadn)\.vn$/i

/**
 * Maps a smax.ai (Zalo) webhook body to one message. The body shape is whatever the smax.ai
 * trigger sends, so every field is looked up under several names, and a custom body can use
 * the plain ones: `thread_id`, `thread_name`, `sender`, `text`, `image_url` / `images`.
 */
export function mapZaloPayload(payload: unknown, selfChatBy: string): ZaloMessage {
  const root = asRecord(payload)
  const nested = asRecord(root?.data) ?? asRecord(root?.message) ?? asRecord(root?.event) ?? root
  const pick = (keys: string[]) => pickString(nested, keys) ?? pickString(root, keys)

  const threadId = pick([
    'thread_id',
    'conversationId',
    'threadId',
    'thread_tid',
    'chatId',
    'pid',
    'zaloweb_id',
    'fromUid',
    'uidFrom',
    'uid',
  ]) ?? 'unknown'
  const threadName = pick(['thread_name', 'zaloweb_name', 'group_name', 'name']) ?? threadId

  const content = pick(['text', 'content', 'message', 'msg']) ?? ''
  const userText = pick(['last_content_by_user'])
  const pageText = pick(['last_content_by_page'])
  const chatBy = pick(['chat_by']) ?? ''
  const isSelf = Boolean(chatBy) && fold(chatBy) === fold(selfChatBy || 'HUNGLT')
  const updatedAt = pick(['sent_at', 'last_inbox_updated', 'timestamp', 'created_at'])

  const rawText = isSelf ? textFromSelf(pageText, content, userText) : content || userText || ''
  const imageUrls = unique([...imagesFromFields(nested), ...imagesFromFields(root), ...imagesFromText(rawText)])
  // Photo links were already picked up as images: drop them from the text.
  const text = imageUrls.reduce((value, url) => value.split(url).join(' '), rawText).replace(/[ \t]+/g, ' ').trim()

  return {
    externalId: externalId({ nested, root, payload, threadId, text: rawText, updatedAt, isSelf }),
    threadId,
    threadName,
    isGroup: pick(['zaloweb_chat_type', 'chat_type']) === 'group',
    isSelf,
    // `zaloweb_name` / `name` are the thread's name in a group, so they are not used here.
    senderName: pick(['sender', 'sender_name', 'senderName', 'fromDisplayName', 'dName', 'from_name']) ?? '',
    text,
    imageUrls,
    sentAt: parseDate(updatedAt),
  }
}

function textFromSelf(pageText: string | undefined, content: string, userText: string | undefined): string {
  if (pageText && pageText !== userText) return pageText
  if (content && content !== userText) return content
  return ''
}

function imagesFromText(text: string): string[] {
  return (text.match(IMAGE_URL) ?? []).filter(isImageUrl)
}

function imagesFromFields(obj: Record<string, unknown> | null | undefined): string[] {
  if (!obj) return []
  const found: string[] = []
  const add = (value: unknown) => {
    if (typeof value === 'string' && /^https?:\/\//i.test(value)) found.push(value)
    else if (Array.isArray(value)) value.forEach(add)
    else if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>
      add(record.url ?? record.href ?? record.src ?? asRecord(record.payload)?.url)
    }
  }
  for (const key of ['image_url', 'imageUrl', 'image', 'images', 'photo', 'photos', 'attachments']) add(obj[key])
  return found
}

function isImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return IMAGE_EXT.test(parsed.pathname) || ZALO_PHOTO_HOST.test(parsed.hostname)
  }
  catch {
    return false
  }
}

function externalId(input: {
  nested: Record<string, unknown> | null
  root: Record<string, unknown> | null
  payload: unknown
  threadId: string
  text: string
  updatedAt?: string
  isSelf: boolean
}): string {
  const messageId = pickString(input.nested, ['msgId', 'message_id', 'messageId', 'mid'])
    ?? pickString(input.root, ['msgId', 'message_id', 'messageId', 'mid'])
  if (messageId) return messageId
  // smax.ai uses `id` for the contact/thread, so every message of a group shares it:
  // identify the message by its content and time instead.
  return stableHash({
    thread: input.threadId,
    text: input.text,
    updatedAt: input.updatedAt ?? '',
    ...(input.isSelf ? { source: 'self' } : {}),
    ...(input.text || input.updatedAt ? {} : { payload: input.payload }),
  })
}

function parseDate(value: string | undefined): string | null {
  if (!value) return null
  const numeric = /^\d{10,13}$/.test(value) ? Number(value) * (value.length <= 10 ? 1000 : 1) : null
  const date = numeric === null ? new Date(value) : new Date(numeric)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  return null
}

function pickString(obj: Record<string, unknown> | null | undefined, keys: string[]): string | undefined {
  if (!obj) return undefined
  for (const key of keys) {
    const value = obj[key]
    if (typeof value === 'string' && value) return value
    if (typeof value === 'number') return String(value)
  }
  return undefined
}

function unique(values: string[]): string[] {
  return [...new Set(values)]
}

function stableHash(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload ?? {})).digest('hex')
}
