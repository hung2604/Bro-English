import Anthropic from '@anthropic-ai/sdk'
import type {
  ChatMessage,
  ChatRequest,
  ChatResponse,
  FinishReason,
  LlmProvider,
} from './types'

/** Models that take `fallbacks: "default"`: a declined request is re-run server-side on another model. */
const FALLBACK_MODELS = new Set([
  'claude-opus-5-5',
  'claude-opus-5',
  'claude-sonnet-5-5',
  'claude-fable-5-1',
])

/** Older models reject `output_config.effort`. */
const NO_EFFORT = /claude-3|haiku-4-5|sonnet-4-5/

/** Claude through the official SDK, with prompt caching on the system prompt. */
export class AnthropicProvider implements LlmProvider {
  private readonly clients = new Map<string, Anthropic>()

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const fallback = FALLBACK_MODELS.has(request.model)
    const response = await this.client(request.apiKey).beta.messages.create({
      model: request.model,
      max_tokens: request.maxTokens,
      ...(fallback
        ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }
        : {}),
      ...(NO_EFFORT.test(request.model) ? {} : { output_config: { effort: request.effort } }),
      system: [{ type: 'text', text: request.system, cache_control: { type: 'ephemeral' } }],
      ...(request.tools.length
        ? {
            tools: request.tools.map(tool => ({
              name: tool.name,
              description: tool.description,
              input_schema: tool.parameters as Anthropic.Beta.BetaTool['input_schema'],
            })),
          }
        : {}),
      messages: toAnthropicMessages(request.messages),
    })
    const stop = response.stop_reason ?? ''
    return {
      text: response.content.map(block => (block.type === 'text' ? block.text : '')).join(''),
      toolCalls: response.content.flatMap(block =>
        block.type === 'tool_use'
          ? [{ id: block.id, name: block.name, input: (block.input ?? {}) as Record<string, unknown> }]
          : [],
      ),
      // Sent back unchanged (thinking blocks included) on the next step.
      raw: response.content,
      finish: finishOf(stop),
      finishRaw: stop,
      model: response.model || request.model,
      usage: {
        input: (response.usage.input_tokens ?? 0)
          + (response.usage.cache_read_input_tokens ?? 0)
          + (response.usage.cache_creation_input_tokens ?? 0),
        output: response.usage.output_tokens ?? 0,
      },
    }
  }

  async listModels(apiKey: string): Promise<string[]> {
    const ids: string[] = []
    for await (const model of this.client(apiKey).models.list()) ids.push(model.id)
    return ids
  }

  private client(apiKey: string): Anthropic {
    let client = this.clients.get(apiKey)
    if (!client) {
      client = new Anthropic({ apiKey, timeout: 120_000, maxRetries: 1 })
      this.clients.set(apiKey, client)
    }
    return client
  }
}

function finishOf(stop: string): FinishReason {
  if (stop === 'end_turn') return 'stop'
  if (stop === 'tool_use') return 'tool_use'
  if (stop === 'max_tokens') return 'length'
  if (stop === 'refusal') return 'refusal'
  return 'other'
}

/** Consecutive tool results are merged into one `user` message, as Claude requires. */
function toAnthropicMessages(messages: ChatMessage[]): Anthropic.Beta.BetaMessageParam[] {
  const result: Anthropic.Beta.BetaMessageParam[] = []
  for (const message of messages) {
    if (message.role === 'user') {
      const images = message.images ?? []
      result.push({
        role: 'user',
        content: images.length
          ? [
              ...images.map(image => ({
                type: 'image' as const,
                source: { type: 'base64' as const, media_type: image.mediaType, data: image.data },
              })),
              { type: 'text' as const, text: message.content },
            ]
          : message.content,
      })
    }
    else if (message.role === 'assistant') {
      const rebuilt: Anthropic.Beta.BetaContentBlockParam[] = [
        ...(message.content ? [{ type: 'text' as const, text: message.content }] : []),
        ...(message.toolCalls ?? []).map(call => ({
          type: 'tool_use' as const,
          id: call.id,
          name: call.name,
          input: call.input,
        })),
      ]
      result.push({
        role: 'assistant',
        content:
          (message.raw as Anthropic.Beta.BetaContentBlockParam[] | undefined)
          ?? (rebuilt.length ? rebuilt : [{ type: 'text', text: '…' }]),
      })
    }
    else {
      const block: Anthropic.Beta.BetaToolResultBlockParam = {
        type: 'tool_result',
        tool_use_id: message.toolCallId,
        content: message.content,
      }
      const last = result[result.length - 1]
      if (last?.role === 'user' && Array.isArray(last.content)) {
        last.content.push(block)
      }
      else {
        result.push({ role: 'user', content: [block] })
      }
    }
  }
  return result
}
