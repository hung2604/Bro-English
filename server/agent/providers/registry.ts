import { AnthropicProvider } from './anthropic'
import { OpenAiCompatibleProvider } from './openai-compatible'
import type { LlmProvider, ProviderId } from './types'

let providers: Record<ProviderId, LlmProvider> | null = null

/** One adapter per provider. To add a provider: add it to PROVIDERS and here. */
export function getProviders(): Record<ProviderId, LlmProvider> {
  providers ??= {
    anthropic: new AnthropicProvider(),
    openai: new OpenAiCompatibleProvider({
      // Overridable for OpenAI-compatible proxies.
      baseUrl: process.env.OPENAI_BASE_URL?.trim() || 'https://api.openai.com/v1',
      maxTokensField: 'max_completion_tokens',
      supportsEffort: model => /^(?:o\d|gpt-5)/.test(model),
      vision: true,
    }),
    gemini: new OpenAiCompatibleProvider({
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
      maxTokensField: 'max_tokens',
      supportsEffort: model => /^gemini-(?:2\.5|[3-9])/.test(model),
      vision: true,
    }),
    deepseek: new OpenAiCompatibleProvider({
      baseUrl: 'https://api.deepseek.com',
      maxTokensField: 'max_tokens',
      supportsEffort: () => false,
      maxTokensCap: 8192,
      vision: false,
    }),
  }
  return providers
}
