import { randomBytes } from 'node:crypto'
import { createError } from 'h3'
import { col } from '../utils/db'
import { getProviders } from './providers/registry'
import {
  PROVIDER_IDS,
  PROVIDERS,
  type Effort,
  type ProviderId,
} from './providers/types'
import { hint, open, safeEqual, seal } from './secret-box'

const KEY = 'agent'
const EFFORTS: readonly Effort[] = ['low', 'medium', 'high']
const MODEL_PATTERN = /^[\w.:/@-]{1,120}$/

export type NameAlias = { alias: string, person: string }

type ProviderSettings = {
  /** Sealed with `seal`, never returned to the client. */
  apiKey?: string
  model?: string
}

/** The single document (`key: 'agent'`) holding everything set on the Agent page. */
export type AgentSettingsDoc = {
  key: string
  enabled?: boolean
  /** Log what the agent would do without changing sessions or expenses. */
  dryRun?: boolean
  provider?: ProviderId
  effort?: Effort
  providers?: Partial<Record<ProviderId, ProviderSettings>>
  /** Sealed token expected on the webhook URL. */
  webhookToken?: string
  /** Only messages from this Zalo thread are stored and read. */
  threadId?: string
  threadName?: string
  /** The `chat_by` value smax.ai puts on the account owner's own messages. */
  selfChatBy?: string
  /** Who the account owner is in the app. */
  selfPerson?: string
  /** Names used in the chat mapped to names in the app. */
  aliases?: NameAlias[]
  /** Who shares a bill when the chat does not say otherwise. */
  billParticipants?: string[]
  dailyRunLimit?: number
}

export const DEFAULT_ALIASES: NameAlias[] = [
  { alias: 'Hải', person: 'Ania' },
  { alias: 'Kha', person: 'David' },
  { alias: 'Hùng', person: 'Simon' },
  { alias: 'Nam', person: 'James' },
]
export const DEFAULT_BILL_PARTICIPANTS = ['Ania', 'James', 'David', 'Simon']
const DEFAULT_DAILY_RUN_LIMIT = 100

export type ResolvedSettings = {
  enabled: boolean
  /** Enabled, a thread is chosen and the selected provider has a key. */
  active: boolean
  dryRun: boolean
  provider: ProviderId
  model: string
  apiKey: string
  effort: Effort
  threadId: string
  threadName: string
  selfChatBy: string
  selfPerson: string
  aliases: NameAlias[]
  billParticipants: string[]
  dailyRunLimit: number
}

export type ProviderView = {
  id: ProviderId
  label: string
  keyUrl: string
  model: string
  defaultModel: string
  vision: boolean
  hasKey: boolean
  keySource: 'saved' | 'env' | null
  keyHint: string
  /** The key in use does not look like this provider's key (pasted into the wrong box). */
  keyWarning: string
}

export type SettingsView = Omit<ResolvedSettings, 'apiKey' | 'model'> & {
  providers: ProviderView[]
  webhookToken: string
}

export type SettingsInput = {
  enabled?: unknown
  dryRun?: unknown
  provider?: unknown
  effort?: unknown
  threadId?: unknown
  threadName?: unknown
  selfChatBy?: unknown
  selfPerson?: unknown
  aliases?: unknown
  billParticipants?: unknown
  dailyRunLimit?: unknown
  providers?: Record<string, { apiKey?: unknown, model?: unknown }>
}

async function settingsCol() {
  return col<AgentSettingsDoc>('agent_settings')
}

export async function loadSettings(): Promise<AgentSettingsDoc> {
  const doc = await (await settingsCol()).findOne({ key: KEY })
  return doc ?? { key: KEY }
}

function keyFor(doc: AgentSettingsDoc, provider: ProviderId): { apiKey: string, source: 'saved' | 'env' | null } {
  const sealed = doc.providers?.[provider]?.apiKey
  const saved = sealed ? open(sealed) : null
  if (saved) return { apiKey: saved, source: 'saved' }
  const env = process.env[PROVIDERS[provider].keyEnv]?.trim()
  return env ? { apiKey: env, source: 'env' } : { apiKey: '', source: null }
}

function modelFor(doc: AgentSettingsDoc, provider: ProviderId): string {
  return doc.providers?.[provider]?.model || PROVIDERS[provider].defaultModel
}

/** Nothing chosen yet: use the first provider that already has a key. */
function providerFor(doc: AgentSettingsDoc): ProviderId {
  if (doc.provider) return doc.provider
  return PROVIDER_IDS.find(id => keyFor(doc, id).apiKey) ?? 'anthropic'
}

export function resolve(doc: AgentSettingsDoc): ResolvedSettings {
  const provider = providerFor(doc)
  const { apiKey } = keyFor(doc, provider)
  const enabled = doc.enabled === true
  const threadId = doc.threadId ?? ''
  return {
    enabled,
    active: enabled && Boolean(apiKey) && Boolean(threadId),
    dryRun: doc.dryRun === true,
    provider,
    model: modelFor(doc, provider),
    apiKey,
    effort: doc.effort ?? 'medium',
    threadId,
    threadName: doc.threadName ?? '',
    selfChatBy: doc.selfChatBy ?? 'HUNGLT',
    selfPerson: doc.selfPerson ?? 'Simon',
    aliases: doc.aliases ?? DEFAULT_ALIASES,
    billParticipants: doc.billParticipants ?? DEFAULT_BILL_PARTICIPANTS,
    dailyRunLimit: doc.dailyRunLimit ?? DEFAULT_DAILY_RUN_LIMIT,
  }
}

export async function resolvedSettings(): Promise<ResolvedSettings> {
  return resolve(await loadSettings())
}

/** The webhook token: saved one first, `ZALO_WEBHOOK_TOKEN` as a fallback. */
export function webhookTokenOf(doc: AgentSettingsDoc): string {
  const saved = doc.webhookToken ? open(doc.webhookToken) : null
  return saved || process.env.ZALO_WEBHOOK_TOKEN?.trim() || ''
}

export function matchesWebhookToken(doc: AgentSettingsDoc, token: string | undefined): boolean {
  const expected = webhookTokenOf(doc)
  return Boolean(expected && token && safeEqual(token, expected))
}

export async function settingsView(): Promise<SettingsView> {
  let doc = await loadSettings()
  if (!webhookTokenOf(doc)) {
    // First visit: create the token the smax.ai webhook URL has to carry.
    const token = randomBytes(24).toString('base64url')
    await (await settingsCol()).updateOne(
      { key: KEY },
      { $set: { webhookToken: seal(token) } },
      { upsert: true },
    )
    doc = await loadSettings()
  }
  const { apiKey: _apiKey, model: _model, ...resolved } = resolve(doc)
  return {
    ...resolved,
    webhookToken: webhookTokenOf(doc),
    providers: PROVIDER_IDS.map((id) => {
      const key = keyFor(doc, id)
      return {
        id,
        label: PROVIDERS[id].label,
        keyUrl: PROVIDERS[id].keyUrl,
        model: modelFor(doc, id),
        defaultModel: PROVIDERS[id].defaultModel,
        vision: PROVIDERS[id].vision,
        hasKey: Boolean(key.apiKey),
        keySource: key.source,
        keyHint: key.apiKey ? hint(key.apiKey) : '',
        keyWarning: key.apiKey ? keyProblem(id, key.apiKey) : '',
      }
    }),
  }
}

export async function updateSettings(input: SettingsInput): Promise<SettingsView> {
  const $set: Record<string, unknown> = {}
  const $unset: Record<string, 1> = {}

  for (const field of ['enabled', 'dryRun'] as const) {
    if (input[field] === undefined) continue
    if (typeof input[field] !== 'boolean') throw bad(`${field} must be true or false`)
    $set[field] = input[field]
  }
  if (input.provider !== undefined) $set.provider = parseProvider(input.provider)
  if (input.effort !== undefined) {
    if (!EFFORTS.includes(input.effort as Effort)) throw bad('Invalid effort')
    $set.effort = input.effort
  }
  for (const field of ['threadId', 'threadName', 'selfChatBy', 'selfPerson'] as const) {
    const value = input[field]
    if (value === undefined) continue
    if (typeof value !== 'string' || value.length > 200) throw bad(`${field} must be a short string`)
    $set[field] = value.trim()
  }
  if (input.aliases !== undefined) {
    if (!Array.isArray(input.aliases) || input.aliases.length > 50) throw bad('aliases must be a list')
    $set.aliases = input.aliases.map((item) => {
      const alias = typeof item?.alias === 'string' ? item.alias.trim() : ''
      const person = typeof item?.person === 'string' ? item.person.trim() : ''
      if (!alias || !person || alias.length > 60 || person.length > 60) throw bad('Each alias needs a chat name and an app name')
      return { alias, person }
    })
  }
  if (input.billParticipants !== undefined) {
    const list = input.billParticipants
    if (!Array.isArray(list) || list.length > 30 || list.some(name => typeof name !== 'string' || !name.trim())) {
      throw bad('billParticipants must be a list of names')
    }
    $set.billParticipants = (list as string[]).map(name => name.trim())
  }
  if (input.dailyRunLimit !== undefined) {
    const value = input.dailyRunLimit
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 2000) {
      throw bad('dailyRunLimit must be between 1 and 2000')
    }
    $set.dailyRunLimit = value
  }

  for (const [rawId, patch] of Object.entries(input.providers ?? {})) {
    const id = parseProvider(rawId)
    const path = `providers.${id}`
    if (patch.apiKey !== undefined) {
      if (patch.apiKey === null || patch.apiKey === '') {
        $unset[`${path}.apiKey`] = 1
      }
      else if (typeof patch.apiKey === 'string' && patch.apiKey.trim().length >= 8) {
        assertKeyFits(id, patch.apiKey.trim())
        $set[`${path}.apiKey`] = seal(patch.apiKey.trim())
      }
      else {
        throw bad('Invalid API key')
      }
    }
    if (patch.model !== undefined) {
      if (patch.model === null || patch.model === '') {
        $unset[`${path}.model`] = 1
      }
      else if (typeof patch.model === 'string' && MODEL_PATTERN.test(patch.model.trim())) {
        $set[`${path}.model`] = patch.model.trim()
      }
      else {
        throw bad('Invalid model name')
      }
    }
  }

  const update: Record<string, unknown> = { $setOnInsert: { key: KEY } }
  if (Object.keys($set).length) update.$set = $set
  if (Object.keys($unset).length) update.$unset = $unset
  await (await settingsCol()).updateOne({ key: KEY }, update, { upsert: true })
  return settingsView()
}

export async function listProviderModels(provider: ProviderId): Promise<string[]> {
  const { apiKey } = keyFor(await loadSettings(), provider)
  if (!apiKey) throw bad('No API key for this provider yet')
  try {
    return await getProviders()[provider].listModels(apiKey)
  }
  catch (error: unknown) {
    throw bad(`Could not list models: ${errorMessage(error)}`)
  }
}

/** A tiny real request, to be sure the key and the model both work. */
export async function testProvider(provider: ProviderId, modelOverride?: string) {
  const doc = await loadSettings()
  const { apiKey } = keyFor(doc, provider)
  if (!apiKey) throw bad('No API key for this provider yet')
  const model = modelOverride?.trim() || modelFor(doc, provider)
  const started = Date.now()
  try {
    const response = await getProviders()[provider].chat({
      model,
      apiKey,
      system: 'You are a health check. Reply with the single word OK.',
      messages: [{ role: 'user', content: 'ping' }],
      tools: [],
      effort: 'low',
      maxTokens: 2000,
    })
    const ok = response.finish === 'stop' && response.text.trim().length > 0
    return {
      ok,
      model: response.model,
      latencyMs: Date.now() - started,
      error: ok ? '' : `Unexpected reply (${response.finishRaw || response.finish})`,
    }
  }
  catch (error: unknown) {
    return { ok: false, model, latencyMs: Date.now() - started, error: errorMessage(error) }
  }
}

/**
 * Catches a key pasted into the wrong box, or a Claude Code subscription token
 * (`sk-ant-oat…`) used as an API key. Browser autofill often causes this.
 */
function assertKeyFits(provider: ProviderId, key: string): void {
  const label = PROVIDERS[provider].label
  const subscription = key.startsWith('sk-ant-oat')
  if (provider !== 'anthropic' && key.startsWith('sk-ant-')) {
    throw bad(`This is a Claude key, not one for ${label}.`)
  }
  if (subscription) {
    throw bad('This is a Claude Code subscription token, not an API key. Create one at platform.claude.com.')
  }
  if (provider === 'anthropic' && !key.startsWith('sk-ant-')) {
    throw bad('Claude API keys start with sk-ant-.')
  }
  if (provider !== 'gemini' && key.startsWith('AIza')) {
    throw bad(`This is a Gemini key, not one for ${label}.`)
  }
}

function keyProblem(provider: ProviderId, key: string): string {
  try {
    assertKeyFits(provider, key)
    return ''
  }
  catch (error: unknown) {
    return errorMessage(error)
  }
}

export function parseProvider(value: unknown): ProviderId {
  if ((PROVIDER_IDS as readonly unknown[]).includes(value)) return value as ProviderId
  throw bad('Invalid provider')
}

function bad(message: string) {
  return createError({ statusCode: 400, message })
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
