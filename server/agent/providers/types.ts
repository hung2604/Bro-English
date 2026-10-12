export const PROVIDER_IDS = ['anthropic', 'openai', 'gemini', 'deepseek'] as const

export type ProviderId = (typeof PROVIDER_IDS)[number]

export type Effort = 'low' | 'medium' | 'high'

export type FinishReason = 'stop' | 'length' | 'refusal' | 'tool_use' | 'other'

export type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

export type ImageInput = { mediaType: ImageMediaType, data: string }

export type ToolCall = { id: string, name: string, input: Record<string, unknown> }

/**
 * A chat message in a provider-neutral shape. `raw` keeps what the provider returned
 * (Claude's content blocks including thinking, or the OpenAI-style tool calls) so the
 * next step of the same run can send it back unchanged.
 */
export type ChatMessage
  = | { role: 'user', content: string, images?: ImageInput[] }
    | { role: 'assistant', content: string, toolCalls?: ToolCall[], raw?: unknown }
    | { role: 'tool', toolCallId: string, name: string, content: string }

export type ToolSpec = {
  name: string
  description: string
  /** JSON schema of the parameters. */
  parameters: Record<string, unknown>
}

export type ChatRequest = {
  model: string
  apiKey: string
  system: string
  messages: ChatMessage[]
  tools: ToolSpec[]
  effort: Effort
  maxTokens: number
}

export type ChatResponse = {
  text: string
  toolCalls: ToolCall[]
  raw?: unknown
  finish: FinishReason
  /** The provider's own stop reason, for the log. */
  finishRaw: string
  /** The model that actually answered (may differ when Claude falls back). */
  model: string
  usage: { input: number, output: number }
}

export interface LlmProvider {
  /** One chat turn with tools: either a text answer or a request to call tools. */
  chat(request: ChatRequest): Promise<ChatResponse>
  listModels(apiKey: string): Promise<string[]>
}

export type ProviderMeta = {
  id: ProviderId
  label: string
  defaultModel: string
  /** Environment variable used while no key is saved in the UI. */
  keyEnv: string
  keyUrl: string
  /** Whether the provider's chat models can read images (needed for bill photos). */
  vision: boolean
}

/** The default model is only a starting point; the real list comes from each provider's API. */
export const PROVIDERS: Record<ProviderId, ProviderMeta> = {
  anthropic: {
    id: 'anthropic',
    label: 'Claude (Anthropic)',
    defaultModel: 'claude-opus-5-5',
    keyEnv: 'ANTHROPIC_API_KEY',
    keyUrl: 'https://platform.claude.com/settings/keys',
    vision: true,
  },
  openai: {
    id: 'openai',
    label: 'OpenAI',
    defaultModel: 'gpt-5-mini',
    keyEnv: 'OPENAI_API_KEY',
    keyUrl: 'https://platform.openai.com/api-keys',
    vision: true,
  },
  gemini: {
    id: 'gemini',
    label: 'Gemini (Google)',
    defaultModel: 'gemini-2.5-flash',
    keyEnv: 'GEMINI_API_KEY',
    keyUrl: 'https://aistudio.google.com/apikey',
    vision: true,
  },
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek',
    defaultModel: 'deepseek-chat',
    keyEnv: 'DEEPSEEK_API_KEY',
    keyUrl: 'https://platform.deepseek.com/api_keys',
    vision: false,
  },
}

export class ProviderError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(`${status} ${message}`.trim())
  }
}
