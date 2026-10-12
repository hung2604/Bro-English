import { randomUUID } from 'node:crypto'
import { ensureMonthSessions } from '../utils/class-sessions'
import { col, nextId } from '../utils/db'
import { isDuplicateKey } from '../utils/mongo-helpers'
import { fetchImage } from './images'
import { buildSystemPrompt, buildUserMessage, type StoredMessage } from './prompt'
import { getProviders } from './providers/registry'
import type { ChatMessage, ImageInput } from './providers/types'
import { errorMessage, groupIds, resolvedSettings, type ResolvedSettings } from './settings'
import { addDays, vnDate, vnDayStartIso } from './time'
import { expensesBetween, runTool, scheduleBetween, TOOL_SPECS, type AgentAction, type Person, type ToolContext } from './tools'

const MAX_STEPS = 8
const MAX_TOKENS = 16_000
const MAX_BATCH = 30
const MAX_IMAGES = 6
const EARLIER_MESSAGES = 30
const EARLIER_DAYS = 4
/** A photo and its caption arrive as two webhooks: wait a moment so they are read together. */
const DEBOUNCE_MS = 2_500
const LOCK_TTL_MS = 150_000
const MAX_ROUNDS = 5
const SCHEDULE_AHEAD_DAYS = 21

export type AgentRun = {
  id: number
  created_at: string
  message_ids: number[]
  model: string
  dry_run: boolean
  steps: Array<{ tool: string, input: Record<string, unknown>, result: string }>
  actions: AgentAction[]
  note: string
  error: string
  usage: { input: number, output: number }
  duration_ms: number
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function messagesCol() {
  return col<StoredMessage>('agent_messages')
}

/** One run at a time across all server instances, so two webhooks never act on the same message. */
async function acquireLock(owner: string): Promise<boolean> {
  const state = await col('agent_state')
  const now = Date.now()
  try {
    const result = await state.findOneAndUpdate(
      { _id: 'lock' as any, $or: [{ locked_until: { $lt: now } }, { locked_until: { $exists: false } }] },
      { $set: { locked_until: now + LOCK_TTL_MS, owner } },
      { upsert: true, returnDocument: 'after' },
    )
    return result?.owner === owner
  }
  catch (error: unknown) {
    // The lock document exists and is held: the upsert collides on `_id`.
    if (isDuplicateKey(error)) return false
    throw error
  }
}

async function releaseLock(owner: string): Promise<void> {
  await (await col('agent_state')).updateOne({ _id: 'lock' as any, owner }, { $set: { locked_until: 0 } })
}

async function pendingMessages(threadIds: string[]): Promise<StoredMessage[]> {
  return (await messagesCol())
    .find({ thread_id: { $in: threadIds }, status: 'pending' })
    .sort({ id: 1 })
    .limit(MAX_BATCH)
    .toArray()
}

/**
 * Reads every pending message of the class groups. Safe to call from each webhook:
 * if another call is already working, this one returns and that one picks the message up.
 */
export async function processPending(options: { debounce?: boolean } = {}): Promise<void> {
  const owner = randomUUID()
  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    if (!(await acquireLock(owner))) return
    let threadIds: string[] = []
    try {
      threadIds = groupIds(await resolvedSettings())
      if (threadIds.length) {
        if (options.debounce !== false) await sleep(DEBOUNCE_MS)
        const pending = await pendingMessages(threadIds)
        // Settings are read again after the wait so a change made meanwhile applies.
        if (pending.length) await runOnce(await resolvedSettings(), pending)
      }
    }
    catch (error: unknown) {
      console.error('Agent run failed:', error)
    }
    finally {
      await releaseLock(owner)
    }
    // A message may have arrived while the lock was held; its own call gave up on the lock.
    if (!threadIds.length || !(await pendingMessages(threadIds)).length) return
  }
}

async function finish(messages: StoredMessage[], status: StoredMessage['status'], extra: { run_id?: number, note?: string }) {
  await (await messagesCol()).updateMany(
    { id: { $in: messages.map(message => message.id) } },
    { $set: { status, ...extra } },
  )
}

async function runOnce(settings: ResolvedSettings, fresh: StoredMessage[]): Promise<void> {
  if (!settings.active) {
    await finish(fresh, 'skipped', { note: settings.enabled ? 'No API key for the selected provider' : 'Agent is off' })
    return
  }
  const runsCol = await col<AgentRun>('agent_runs')
  const today = await runsCol.countDocuments({ created_at: { $gte: vnDayStartIso() } })
  if (today >= settings.dailyRunLimit) {
    await finish(fresh, 'skipped', { note: `Daily limit of ${settings.dailyRunLimit} runs reached` })
    return
  }

  const started = Date.now()
  const run: AgentRun = {
    id: await nextId('agent_runs'),
    created_at: new Date().toISOString(),
    message_ids: fresh.map(message => message.id),
    model: `${settings.provider}:${settings.model}`,
    dry_run: settings.dryRun,
    steps: [],
    actions: [],
    note: '',
    error: '',
    usage: { input: 0, output: 0 },
    duration_ms: 0,
  }

  try {
    const persons = (await (await col('persons')).find({}).sort({ id: 1 }).toArray())
      .map(person => ({ id: person.id as number, name: person.name as string })) satisfies Person[]
    const day = vnDate()
    // The model reads the schedule below, so the regular class days of this month and of the
    // month the window reaches into must exist (the calendar page creates them the same way).
    for (const month of new Set([day.slice(0, 7), addDays(day, SCHEDULE_AHEAD_DAYS).slice(0, 7)])) {
      const [year, monthNumber] = month.split('-').map(Number)
      await ensureMonthSessions(year!, monthNumber!)
    }
    const firstId = fresh[0]!.id
    const earlier = (await (await messagesCol())
      .find({
        thread_id: { $in: groupIds(settings) },
        id: { $lt: firstId },
        created_at: { $gte: new Date(Date.now() - EARLIER_DAYS * 86_400_000).toISOString() },
      })
      .sort({ id: -1 })
      .limit(EARLIER_MESSAGES)
      .toArray()).reverse()

    const earlierRunIds = [...new Set(earlier.flatMap(message => (message.run_id === undefined ? [] : [message.run_id])))]
    const earlierRuns = earlierRunIds.length
      ? await runsCol.find({ id: { $in: earlierRunIds } }).toArray()
      : []
    const earlierActions = new Map(earlierRuns.map(item => [
      item.id,
      item.dry_run ? [] : item.actions.map(action => action.summary),
    ]))

    const images: ImageInput[] = []
    const imageInfo = new Map<number, { loaded: number, failed: string[] }>()
    for (const message of fresh) {
      const info = { loaded: 0, failed: [] as string[] }
      for (const url of message.image_urls) {
        if (images.length >= MAX_IMAGES) {
          info.failed.push('too many images in one batch')
          continue
        }
        const image = await fetchImage(url)
        if (typeof image === 'string') {
          info.failed.push(image)
        }
        else {
          images.push(image)
          info.loaded += 1
        }
      }
      imageInfo.set(message.id, info)
    }

    const context: ToolContext = { settings, persons, actions: run.actions }
    const history: ChatMessage[] = [{
      role: 'user',
      content: buildUserMessage({
        settings,
        persons,
        schedule: await scheduleBetween({ from: addDays(day, -10), to: addDays(day, SCHEDULE_AHEAD_DAYS) }),
        expenses: await expensesBetween({ from: addDays(day, -7), to: addDays(day, 7) }, persons),
        earlier,
        earlierActions,
        fresh,
        images: imageInfo,
      }),
      ...(images.length ? { images } : {}),
    }]
    const system = buildSystemPrompt(settings, persons)
    const provider = getProviders()[settings.provider]

    for (let step = 0; step < MAX_STEPS; step += 1) {
      const response = await provider.chat({
        model: settings.model,
        apiKey: settings.apiKey,
        system,
        messages: history,
        tools: TOOL_SPECS,
        effort: settings.effort,
        maxTokens: MAX_TOKENS,
      })
      run.model = `${settings.provider}:${response.model}`
      run.usage.input += response.usage.input
      run.usage.output += response.usage.output
      history.push({
        role: 'assistant',
        content: response.text,
        ...(response.toolCalls.length ? { toolCalls: response.toolCalls } : {}),
        ...(response.raw ? { raw: response.raw } : {}),
      })

      if (response.finish === 'refusal' || response.finish === 'length') {
        run.error = `The model stopped early (${response.finishRaw || response.finish})`
        break
      }
      if (!response.toolCalls.length) {
        run.note = response.text.trim()
        break
      }
      for (const call of response.toolCalls) {
        const result = await runTool(call.name, call.input, context)
        run.steps.push({ tool: call.name, input: call.input, result })
        history.push({ role: 'tool', toolCallId: call.id, name: call.name, content: result })
      }
      if (step === MAX_STEPS - 1) run.error = 'Stopped after too many steps'
    }
  }
  catch (error: unknown) {
    run.error = errorMessage(error)
  }

  run.duration_ms = Date.now() - started
  await runsCol.insertOne(run as any)
  // A failed run stays visible as an error and is retried only when asked to from the Agent page.
  await finish(fresh, run.error && !run.actions.length ? 'error' : 'done', {
    run_id: run.id,
    ...(run.error ? { note: run.error } : {}),
  })
}

/** Puts failed messages back in the queue (the "Retry" button). */
export async function retryFailed(): Promise<number> {
  const result = await (await messagesCol()).updateMany(
    { status: 'error' },
    { $set: { status: 'pending' }, $unset: { note: '' } },
  )
  return result.modifiedCount
}
