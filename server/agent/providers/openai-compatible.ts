import {
  ProviderError,
  type ChatMessage,
  type ChatRequest,
  type ChatResponse,
  type FinishReason,
  type LlmProvider,
  type ToolCall,
} from './types'

const REQUEST_TIMEOUT_MS = 120_000
/** OpenAI's model list also has embeddings, speech and image models: leave them out. */
const NON_CHAT = /embed|tts|whisper|dall-e|davinci|babbage|moderation|image|audio|realtime|transcribe|search|computer-use|sora|aqa|veo/i

export type CompatibleOptions = {
  baseUrl: string
  /** Newer OpenAI models want `max_completion_tokens`, others still use `max_tokens`. */
  maxTokensField: 'max_tokens' | 'max_completion_tokens'
  /** Which models accept `reasoning_effort`; sending it to others is a 400. */
  supportsEffort: (model: string) => boolean
  /** The provider's output token ceiling; going over is a 400. */
  maxTokensCap?: number
  /** Providers without vision get a text note instead of the image. */
  vision: boolean
}

type RawToolCall = {
  id?: string
  type?: string
  function?: { name?: string, arguments?: string }
}

type ChatResponseBody = {
  model?: string
  choices?: Array<{
    finish_reason?: string
    message?: {
      content?: string | null
      refusal?: string | null
      tool_calls?: RawToolCall[]
    }
  }>
  usage?: { prompt_tokens?: number, completion_tokens?: number }
  error?: { message?: string }
}

/**
 * OpenAI, Gemini and DeepSeek all expose an OpenAI-style `/chat/completions`,
 * so they share one adapter and differ only in base URL and a few options.
 */
export class OpenAiCompatibleProvider implements LlmProvider {
  constructor(private readonly options: CompatibleOptions) {}

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const body: Record<string, unknown> = {
      model: request.model,
      messages: [
        { role: 'system', content: request.system },
        ...request.messages.map(message => this.toMessage(message)),
      ],
      [this.options.maxTokensField]: Math.min(
        request.maxTokens,
        this.options.maxTokensCap ?? request.maxTokens,
      ),
    }
    if (request.tools.length) {
      body.tools = request.tools.map(tool => ({
        type: 'function',
        function: { name: tool.name, description: tool.description, parameters: tool.parameters },
      }))
    }
    if (this.options.supportsEffort(request.model)) body.reasoning_effort = request.effort

    const data = await this.post(request.apiKey, body)
    const choice = data.choices?.[0]
    const rawCalls = choice?.message?.tool_calls ?? []
    const toolCalls: ToolCall[] = rawCalls.map((call, index) => ({
      id: call.id || `call_${index}`,
      name: call.function?.name ?? '',
      input: parseArguments(call.function?.arguments),
    }))
    const raw = choice?.finish_reason ?? ''
    return {
      text: choice?.message?.content ?? '',
      toolCalls,
      // Sent back as-is on the next step: Gemini attaches a signature to each tool call.
      raw: rawCalls.length ? rawCalls.map((call, index) => ({ ...call, id: call.id || `call_${index}` })) : undefined,
      finish: toolCalls.length ? 'tool_use' : finishOf(raw, Boolean(choice?.message?.refusal)),
      finishRaw: raw,
      model: data.model ?? request.model,
      usage: {
        input: data.usage?.prompt_tokens ?? 0,
        output: data.usage?.completion_tokens ?? 0,
      },
    }
  }

  async listModels(apiKey: string): Promise<string[]> {
    const response = await fetch(`${this.options.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(20_000),
    })
    const data = (await response.json().catch(() => null)) as {
      data?: Array<{ id?: string }>
      error?: { message?: string }
    } | null
    if (!response.ok) {
      throw new ProviderError(response.status, data?.error?.message ?? response.statusText)
    }
    return (data?.data ?? [])
      .map(item => (item.id ?? '').replace(/^models\//, ''))
      .filter(id => id && !NON_CHAT.test(id))
      .sort()
  }

  private toMessage(message: ChatMessage): Record<string, unknown> {
    if (message.role === 'user') {
      const images = message.images ?? []
      if (!images.length) return { role: 'user', content: message.content }
      if (!this.options.vision) {
        return {
          role: 'user',
          content: `${message.content}\n\n(${images.length} image(s) were attached but this model cannot read images.)`,
        }
      }
      return {
        role: 'user',
        content: [
          { type: 'text', text: message.content },
          ...images.map(image => ({
            type: 'image_url',
            image_url: { url: `data:${image.mediaType};base64,${image.data}` },
          })),
        ],
      }
    }
    if (message.role === 'tool') {
      return { role: 'tool', tool_call_id: message.toolCallId, content: message.content }
    }
    const rawCalls = Array.isArray(message.raw) ? (message.raw as RawToolCall[]) : null
    const calls = rawCalls ?? (message.toolCalls ?? []).map(call => ({
      id: call.id,
      type: 'function',
      function: { name: call.name, arguments: JSON.stringify(call.input) },
    }))
    return {
      role: 'assistant',
      content: message.content || null,
      ...(calls.length ? { tool_calls: calls } : {}),
    }
  }

  private async post(apiKey: string, body: Record<string, unknown>): Promise<ChatResponseBody> {
    const response = await fetch(`${this.options.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    const data = (await response.json().catch(() => null)) as ChatResponseBody | ChatResponseBody[] | null
    // Gemini wraps errors in an array.
    const parsed = Array.isArray(data) ? data[0] : data
    if (!response.ok || !parsed) {
      throw new ProviderError(response.status, parsed?.error?.message ?? response.statusText)
    }
    return parsed
  }
}

function finishOf(raw: string, refused: boolean): FinishReason {
  if (refused || raw === 'content_filter') return 'refusal'
  if (raw === 'stop') return 'stop'
  if (raw === 'length') return 'length'
  if (raw === 'tool_calls') return 'tool_use'
  return 'other'
}

/** Tool arguments arrive as a JSON string; if broken, treat as empty so the tool reports what is missing. */
function parseArguments(value: string | undefined): Record<string, unknown> {
  if (!value) return {}
  try {
    const parsed = JSON.parse(value) as unknown
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  }
  catch {
    return {}
  }
}
