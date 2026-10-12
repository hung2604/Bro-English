<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
    <div class="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">
          Zalo Agent
        </h1>
        <p class="text-sm text-gray-600 mt-1">
          Reads the class group chat sent over by smax.ai, keeps class days in sync and records bill photos as expenses.
        </p>
      </div>

      <!-- Locked -->
      <div
        v-if="!settings"
        class="bg-white rounded-lg shadow-md p-6 space-y-3"
      >
        <h2 class="font-semibold text-gray-800">
          Admin password
        </h2>
        <p class="text-sm text-gray-600">
          This page holds API keys, so it needs the password set in <code>AGENT_ADMIN_PASSWORD</code>.
        </p>
        <form
          class="flex gap-2"
          @submit.prevent="unlock"
        >
          <UInput
            v-model="password"
            type="password"
            autocomplete="current-password"
            placeholder="Password"
            class="flex-1"
          />
          <UButton
            type="submit"
            color="primary"
            :loading="loading"
            :disabled="!password"
          >
            Unlock
          </UButton>
        </form>
        <p
          v-if="loadError"
          class="text-sm text-red-600"
        >
          {{ loadError }}
        </p>
      </div>

      <template v-else>
        <!-- Status -->
        <div class="bg-white rounded-lg shadow-md p-6 space-y-4">
          <div class="flex items-center justify-between gap-4">
            <div>
              <div class="flex items-center gap-2 font-semibold text-gray-800">
                Agent
                <UBadge
                  :color="settings.active ? 'success' : 'neutral'"
                  variant="subtle"
                >
                  {{ statusLabel }}
                </UBadge>
              </div>
              <p class="text-sm text-gray-600">
                When on, every new message in the chosen group is read as it arrives.
              </p>
            </div>
            <USwitch
              v-model="form.enabled"
              aria-label="Agent on"
            />
          </div>
          <div class="flex items-center justify-between gap-4 border-t pt-4">
            <div>
              <div class="font-medium text-gray-800">
                Dry run
              </div>
              <p class="text-sm text-gray-600">
                Only log what the agent would do. Class days and expenses are not touched.
              </p>
            </div>
            <USwitch
              v-model="form.dryRun"
              aria-label="Dry run"
            />
          </div>
        </div>

        <!-- Zalo -->
        <div class="bg-white rounded-lg shadow-md p-6 space-y-4">
          <h2 class="font-semibold text-gray-800">
            Zalo group (smax.ai)
          </h2>
          <UFormField
            label="Webhook URL"
            help="Set this as the webhook in smax.ai. Anyone with this URL can feed the agent messages, so keep it private."
          >
            <div class="flex gap-2">
              <UInput
                :model-value="webhookUrl"
                readonly
                class="flex-1 font-mono"
              />
              <UButton
                color="neutral"
                variant="subtle"
                @click="copyWebhook"
              >
                {{ copied ? 'Copied' : 'Copy' }}
              </UButton>
            </div>
          </UFormField>
          <UFormField
            label="Group to read"
            help="Chats show up here after their first message reaches the webhook. Only the chosen group's messages are stored."
          >
            <USelect
              v-model="form.threadId"
              :items="threadOptions"
              value-key="value"
              placeholder="No chat received yet"
              class="w-full"
            />
          </UFormField>
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField
              label="Your chat_by value"
              help="What smax.ai puts in chat_by for messages you send yourself."
            >
              <UInput
                v-model="form.selfChatBy"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="You are"
              help="Your name in this app."
            >
              <USelect
                v-model="form.selfPerson"
                :items="persons"
                class="w-full"
              />
            </UFormField>
          </div>
        </div>

        <!-- Provider -->
        <div class="bg-white rounded-lg shadow-md p-6 space-y-4">
          <h2 class="font-semibold text-gray-800">
            AI provider
          </h2>
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <button
              v-for="item in settings.providers"
              :key="item.id"
              type="button"
              class="flex flex-col items-start gap-1 rounded-lg border p-3 text-left text-sm transition-colors"
              :class="editing === item.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'"
              @click="editing = item.id"
            >
              <span class="font-medium text-gray-900">{{ item.label }}</span>
              <span
                class="text-xs"
                :class="item.keyWarning ? 'text-red-600' : item.hasKey ? 'text-green-600' : 'text-gray-500'"
              >
                {{ item.keyWarning ? 'Wrong key' : item.hasKey ? 'Has key' : 'No key' }}
              </span>
              <UBadge
                v-if="form.provider === item.id"
                color="primary"
                variant="subtle"
                size="sm"
              >
                In use
              </UBadge>
            </button>
          </div>

          <div
            v-if="current"
            class="space-y-4 rounded-lg border border-gray-200 p-4"
          >
            <div class="flex flex-wrap items-center justify-between gap-2">
              <h3 class="font-medium text-gray-900">
                {{ current.label }}
              </h3>
              <UButton
                v-if="form.provider !== current.id"
                size="sm"
                variant="subtle"
                @click="form.provider = current.id"
              >
                Use {{ current.label }}
              </UButton>
            </div>
            <p
              v-if="!current.vision"
              class="text-sm text-amber-600"
            >
              This provider cannot read images, so bill photos will not be recorded while it is in use.
            </p>

            <UFormField label="API key">
              <template #hint>
                <a
                  :href="current.keyUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-blue-600 hover:underline"
                >Get a key</a>
              </template>
              <UInput
                v-model="draft.apiKey"
                type="password"
                autocomplete="new-password"
                data-1p-ignore
                data-lpignore="true"
                :name="`api-key-${current.id}`"
                class="w-full"
                :placeholder="current.hasKey && !draft.clearKey ? `Saved ${current.keyHint}, type to replace` : 'Paste API key'"
                @update:model-value="draft.clearKey = false"
              />
              <template #help>
                <span
                  v-if="current.keyWarning && !draft.clearKey && !draft.apiKey.trim()"
                  class="text-red-600"
                >{{ current.keyWarning }}</span>
                <span v-else-if="draft.clearKey">The key will be removed when you save.</span>
                <span v-else-if="current.keySource === 'env'">Using the key from the server environment. Enter one here to override it.</span>
                <span v-else-if="current.keySource === 'saved'">
                  Stored encrypted.
                  <button
                    type="button"
                    class="text-red-600 hover:underline"
                    @click="draft.clearKey = true; draft.apiKey = ''"
                  >Remove key</button>
                </span>
                <span v-else>Stored encrypted; it is never shown again.</span>
              </template>
            </UFormField>

            <UFormField
              label="Model"
              :help="`Default: ${current.defaultModel}. Type any model name or load the list from ${current.label}.`"
            >
              <div class="flex gap-2">
                <UInput
                  v-model="draft.model"
                  class="min-w-0 flex-1"
                  :list="`models-${current.id}`"
                  :placeholder="current.defaultModel"
                  autocomplete="off"
                />
                <UButton
                  color="neutral"
                  variant="subtle"
                  :loading="loadingModels"
                  :disabled="!current.hasKey && !draft.apiKey.trim()"
                  @click="loadModels"
                >
                  Load list
                </UButton>
              </div>
              <datalist :id="`models-${current.id}`">
                <option
                  v-for="model in models[current.id]"
                  :key="model"
                  :value="model"
                />
              </datalist>
            </UFormField>

            <div class="flex flex-wrap items-center gap-3">
              <UButton
                color="neutral"
                variant="subtle"
                :loading="testing"
                :disabled="!current.hasKey && !draft.apiKey.trim()"
                @click="saveAndTest"
              >
                Save and test
              </UButton>
              <p
                v-if="testResult"
                class="min-w-0 flex-1 text-sm"
                :class="testResult.ok ? 'text-green-600' : 'text-red-600'"
              >
                <template v-if="testResult.ok">
                  Works with {{ testResult.model }} ({{ (testResult.latencyMs / 1000).toFixed(1) }}s).
                </template>
                <template v-else>
                  Error: {{ testResult.error }}
                </template>
              </p>
            </div>
          </div>

          <UFormField
            label="Thinking effort"
            help="Higher is slower and costs more. DeepSeek ignores this."
          >
            <div class="grid grid-cols-3 gap-2">
              <button
                v-for="item in efforts"
                :key="item.value"
                type="button"
                class="rounded-lg border p-2 text-sm transition-colors"
                :class="form.effort === item.value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'"
                @click="form.effort = item.value"
              >
                {{ item.label }}
              </button>
            </div>
          </UFormField>
        </div>

        <!-- Rules -->
        <div class="bg-white rounded-lg shadow-md p-6 space-y-4">
          <h2 class="font-semibold text-gray-800">
            Names and bills
          </h2>
          <UFormField
            label="Chat names"
            help="How people are called in the chat, and who they are in this app."
          >
            <div class="space-y-2">
              <div
                v-for="(item, index) in form.aliases"
                :key="index"
                class="flex items-center gap-2"
              >
                <UInput
                  v-model="item.alias"
                  placeholder="Name in chat"
                  class="flex-1"
                />
                <span class="text-gray-400">→</span>
                <USelect
                  v-model="item.person"
                  :items="persons"
                  placeholder="Person"
                  class="flex-1"
                />
                <UButton
                  color="neutral"
                  variant="ghost"
                  icon="i-heroicons-x-mark"
                  aria-label="Remove"
                  @click="form.aliases.splice(index, 1)"
                />
              </div>
              <UButton
                size="sm"
                color="neutral"
                variant="subtle"
                @click="form.aliases.push({ alias: '', person: '' })"
              >
                + Add name
              </UButton>
            </div>
          </UFormField>
          <UFormField
            label="Who shares a bill by default"
            help="Used when the chat does not say who shares it. Whoever sends the photo is recorded as the payer."
          >
            <div class="flex flex-wrap gap-2">
              <button
                v-for="name in persons"
                :key="name"
                type="button"
                class="rounded-full border px-3 py-1 text-sm transition-colors"
                :class="form.billParticipants.includes(name) ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'"
                @click="toggleParticipant(name)"
              >
                {{ name }}
              </button>
            </div>
          </UFormField>
          <UFormField
            label="Runs per day, at most"
            help="A safety cap on how many times the AI is called in a day."
          >
            <UInput
              v-model="form.dailyRunLimit"
              type="number"
              min="1"
              class="w-32"
            />
          </UFormField>
        </div>

        <div class="flex justify-end">
          <UButton
            color="primary"
            :loading="saving"
            @click="save()"
          >
            Save
          </UButton>
        </div>
        <p
          v-if="saveMessage"
          class="text-right text-sm"
          :class="saveOk ? 'text-green-600' : 'text-red-600'"
        >
          {{ saveMessage }}
        </p>

        <!-- Activity -->
        <div class="bg-white rounded-lg shadow-md p-6 space-y-4">
          <div class="flex items-center justify-between gap-2">
            <h2 class="font-semibold text-gray-800">
              Activity
            </h2>
            <div class="flex gap-2">
              <UButton
                size="sm"
                color="neutral"
                variant="subtle"
                :loading="activityLoading"
                @click="loadActivity"
              >
                Refresh
              </UButton>
              <UButton
                v-if="waitingCount > 0"
                size="sm"
                color="primary"
                variant="subtle"
                :loading="retrying"
                @click="retry"
              >
                Read {{ waitingCount }} waiting
              </UButton>
            </div>
          </div>
          <p
            v-if="activity.messages.length === 0"
            class="text-sm text-gray-500"
          >
            No messages from the group yet.
          </p>
          <div
            v-for="entry in timeline"
            :key="entry.key"
            class="rounded-lg border border-gray-200 p-4 space-y-3"
          >
            <div class="space-y-1">
              <div
                v-for="message in entry.messages"
                :key="message.id"
                class="text-sm"
              >
                <span class="mr-2 text-gray-400">#{{ message.id }} {{ formatTime(message.at) }}</span>
                <span class="mr-1 font-medium text-gray-900">{{ message.sender }}:</span>
                <span class="text-gray-700">{{ message.text }}</span>
                <a
                  v-for="(url, index) in message.imageUrls"
                  :key="url"
                  :href="url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="ml-1 text-blue-600 hover:underline"
                >[image {{ index + 1 }}]</a>
                <details class="text-xs text-gray-500">
                  <summary class="cursor-pointer">
                    Raw payload
                  </summary>
                  <pre class="mt-1 overflow-x-auto rounded bg-gray-50 p-2">{{ JSON.stringify(message.raw, null, 2) }}</pre>
                </details>
              </div>
            </div>
            <div
              v-if="entry.run"
              class="border-t pt-3 space-y-2"
            >
              <div class="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                <span>{{ entry.run.model }}</span>
                <span>{{ (entry.run.duration_ms / 1000).toFixed(1) }}s</span>
                <span>{{ entry.run.usage.input + entry.run.usage.output }} tokens</span>
                <UBadge
                  v-if="entry.run.dry_run"
                  color="warning"
                  variant="subtle"
                  size="sm"
                >
                  Dry run
                </UBadge>
              </div>
              <div
                v-for="(action, index) in entry.run.actions"
                :key="index"
                class="flex items-start gap-2 text-sm"
              >
                <UBadge
                  :color="action.type === 'session' ? 'info' : 'success'"
                  variant="subtle"
                  size="sm"
                >
                  {{ actionLabels[action.type] }}
                </UBadge>
                <span class="text-gray-800">{{ action.summary }}</span>
              </div>
              <p
                v-if="entry.run.note"
                class="text-sm text-gray-700"
              >
                {{ entry.run.note }}
              </p>
              <p
                v-if="entry.run.error"
                class="text-sm text-red-600"
              >
                {{ entry.run.error }}
              </p>
              <details
                v-if="entry.run.steps.length"
                class="text-xs text-gray-500"
              >
                <summary class="cursor-pointer">
                  {{ entry.run.steps.length }} tool call(s)
                </summary>
                <pre class="mt-1 overflow-x-auto rounded bg-gray-50 p-2">{{ JSON.stringify(entry.run.steps, null, 2) }}</pre>
              </details>
            </div>
            <div
              v-else
              class="border-t pt-3 text-sm"
              :class="entry.messages[0]?.status === 'error' ? 'text-red-600' : 'text-gray-500'"
            >
              {{ statusLabels[entry.messages[0]?.status ?? 'pending'] }}
              <span v-if="entry.messages[0]?.note">— {{ entry.messages[0].note }}</span>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
type ProviderId = 'anthropic' | 'openai' | 'gemini' | 'deepseek'
type Effort = 'low' | 'medium' | 'high'

interface ProviderView {
  id: ProviderId
  label: string
  keyUrl: string
  model: string
  defaultModel: string
  vision: boolean
  hasKey: boolean
  keySource: 'saved' | 'env' | null
  keyHint: string
  keyWarning: string
}

interface AgentSettings {
  enabled: boolean
  active: boolean
  dryRun: boolean
  provider: ProviderId
  effort: Effort
  threadId: string
  threadName: string
  selfChatBy: string
  selfPerson: string
  aliases: Array<{ alias: string, person: string }>
  billParticipants: string[]
  dailyRunLimit: number
  webhookToken: string
  providers: ProviderView[]
}

interface Thread {
  id: string
  name: string
  isGroup: boolean
  lastSeenAt: string
  count: number
}

interface ActivityMessage {
  id: number
  sender: string
  text: string
  imageUrls: string[]
  at: string
  status: 'pending' | 'done' | 'skipped' | 'error'
  runId: number | null
  note: string
  raw: unknown
}

interface ActivityRun {
  id: number
  created_at: string
  model: string
  dry_run: boolean
  steps: unknown[]
  actions: Array<{ type: 'session' | 'expense_add' | 'expense_update' | 'expense_delete', summary: string }>
  note: string
  error: string
  usage: { input: number, output: number }
  duration_ms: number
}

interface ProviderTest {
  ok: boolean
  model: string
  latencyMs: number
  error: string
}

interface Draft {
  apiKey: string
  clearKey: boolean
  model: string
}

const STORAGE_KEY = 'agentAdminPassword'
const efforts: Array<{ value: Effort, label: string }> = [
  { value: 'low', label: 'Fast' },
  { value: 'medium', label: 'Balanced' },
  { value: 'high', label: 'Thorough' },
]
const actionLabels = {
  session: 'Class day',
  expense_add: 'Expense added',
  expense_update: 'Expense changed',
  expense_delete: 'Expense removed',
}
const statusLabels = {
  pending: 'Waiting to be read',
  done: 'Read',
  skipped: 'Skipped',
  error: 'Failed',
}

const password = ref('')
const loading = ref(false)
const loadError = ref('')
const settings = ref<AgentSettings | null>(null)
const threads = ref<Thread[]>([])
const persons = ref<string[]>([])

const form = reactive({
  enabled: false,
  dryRun: false,
  provider: 'anthropic' as ProviderId,
  effort: 'medium' as Effort,
  threadId: '',
  selfChatBy: '',
  selfPerson: '',
  aliases: [] as Array<{ alias: string, person: string }>,
  billParticipants: [] as string[],
  dailyRunLimit: 100,
})
/** The provider open for editing; may differ from the one in use. */
const editing = ref<ProviderId>('anthropic')
const emptyDraft = (): Draft => ({ apiKey: '', clearKey: false, model: '' })
const drafts = reactive<Record<ProviderId, Draft>>({
  anthropic: emptyDraft(),
  openai: emptyDraft(),
  gemini: emptyDraft(),
  deepseek: emptyDraft(),
})
const models = reactive<Record<ProviderId, string[]>>({ anthropic: [], openai: [], gemini: [], deepseek: [] })

const saving = ref(false)
const saveMessage = ref('')
const saveOk = ref(true)
const testing = ref(false)
const testResult = ref<ProviderTest | null>(null)
const loadingModels = ref(false)
const copied = ref(false)

const activity = ref<{ messages: ActivityMessage[], runs: ActivityRun[] }>({ messages: [], runs: [] })
const activityLoading = ref(false)
const retrying = ref(false)

const current = computed(() => settings.value?.providers.find(item => item.id === editing.value))
const draft = computed(() => drafts[editing.value])

const statusLabel = computed(() => {
  const value = settings.value
  if (!value) return ''
  if (value.active) return value.dryRun ? 'Running (dry run)' : 'Running'
  if (!value.enabled) return 'Off'
  return value.threadId ? 'Missing API key' : 'No group chosen'
})

const webhookUrl = computed(() => {
  const origin = import.meta.client ? window.location.origin : ''
  return `${origin}/api/webhooks/zalo?token=${settings.value?.webhookToken ?? ''}`
})

const threadOptions = computed(() => {
  const options = threads.value.map(thread => ({
    label: `${thread.name}${thread.isGroup ? ' (group)' : ''} · ${thread.count} msg`,
    value: thread.id,
  }))
  // The saved group stays selectable even if it is not in the recent list.
  if (form.threadId && !options.some(option => option.value === form.threadId)) {
    options.unshift({ label: settings.value?.threadName || form.threadId, value: form.threadId })
  }
  return options
})

const waitingCount = computed(() =>
  activity.value.messages.filter(message => message.status === 'pending' || message.status === 'error').length,
)

/** Messages grouped by the run that read them, newest first. */
const timeline = computed(() => {
  const runs = new Map(activity.value.runs.map(run => [run.id, run]))
  const entries: Array<{ key: string, run: ActivityRun | null, messages: ActivityMessage[] }> = []
  for (const message of activity.value.messages) {
    const run = message.runId !== null ? runs.get(message.runId) ?? null : null
    const last = entries[entries.length - 1]
    if (run && last?.run?.id === run.id) last.messages.unshift(message)
    else entries.push({ key: run ? `run-${run.id}` : `message-${message.id}`, run, messages: [message] })
  }
  return entries
})

function api<T>(url: string, options: { method?: 'GET' | 'POST' | 'PUT', body?: Record<string, unknown> } = {}) {
  return $fetch<T>(url, { ...options, headers: { 'x-agent-admin': password.value } })
}

function errorText(error: unknown): string {
  const value = error as { data?: { message?: string }, message?: string }
  return value?.data?.message || value?.message || 'Something went wrong'
}

function fill(view: AgentSettings) {
  settings.value = view
  form.enabled = view.enabled
  form.dryRun = view.dryRun
  form.provider = view.provider
  form.effort = view.effort
  form.threadId = view.threadId
  form.selfChatBy = view.selfChatBy
  form.selfPerson = view.selfPerson
  form.aliases = view.aliases.map(item => ({ ...item }))
  form.billParticipants = [...view.billParticipants]
  form.dailyRunLimit = view.dailyRunLimit
  for (const item of view.providers) drafts[item.id] = { apiKey: '', clearKey: false, model: item.model }
}

async function unlock() {
  loading.value = true
  loadError.value = ''
  try {
    const data = await api<{ settings: AgentSettings, threads: Thread[], persons: string[] }>('/api/agent/settings')
    threads.value = data.threads
    persons.value = data.persons
    fill(data.settings)
    editing.value = data.settings.provider
    localStorage.setItem(STORAGE_KEY, password.value)
    await loadActivity()
  }
  catch (error) {
    loadError.value = errorText(error)
    localStorage.removeItem(STORAGE_KEY)
  }
  finally {
    loading.value = false
  }
}

/** Only changed provider fields are sent, so another provider's key is never overwritten. */
function buildPatch() {
  const providers: Record<string, { apiKey?: string | null, model?: string | null }> = {}
  for (const view of settings.value?.providers ?? []) {
    const item = drafts[view.id]
    const changes: { apiKey?: string | null, model?: string | null } = {}
    if (item.clearKey) changes.apiKey = null
    else if (item.apiKey.trim()) changes.apiKey = item.apiKey.trim()
    if (item.model.trim() !== view.model) changes.model = item.model.trim() || null
    if (Object.keys(changes).length) providers[view.id] = changes
  }
  const thread = threads.value.find(item => item.id === form.threadId)
  return {
    enabled: form.enabled,
    dryRun: form.dryRun,
    provider: form.provider,
    effort: form.effort,
    threadId: form.threadId,
    ...(thread ? { threadName: thread.name } : {}),
    selfChatBy: form.selfChatBy,
    selfPerson: form.selfPerson,
    aliases: form.aliases.filter(item => item.alias.trim() && item.person),
    billParticipants: form.billParticipants,
    dailyRunLimit: Number(form.dailyRunLimit),
    providers,
  }
}

async function save(options: { quiet?: boolean } = {}): Promise<boolean> {
  saving.value = true
  saveMessage.value = ''
  try {
    fill(await api<AgentSettings>('/api/agent/settings', { method: 'PUT', body: buildPatch() }))
    if (!options.quiet) {
      saveOk.value = true
      saveMessage.value = 'Saved'
    }
    return true
  }
  catch (error) {
    saveOk.value = false
    saveMessage.value = errorText(error)
    return false
  }
  finally {
    saving.value = false
  }
}

async function saveAndTest() {
  testResult.value = null
  if (!(await save({ quiet: true }))) return
  testing.value = true
  try {
    testResult.value = await api<ProviderTest>(`/api/agent/providers/${editing.value}/test`, {
      method: 'POST',
      body: { model: drafts[editing.value].model },
    })
  }
  catch (error) {
    testResult.value = { ok: false, model: draft.value.model, latencyMs: 0, error: errorText(error) }
  }
  finally {
    testing.value = false
  }
}

async function loadModels() {
  const id = editing.value
  loadingModels.value = true
  try {
    // A key that was just pasted is saved first: the list is fetched with the key on the server.
    if (drafts[id].apiKey.trim() && !(await save({ quiet: true }))) return
    models[id] = await api<string[]>(`/api/agent/providers/${id}/models`)
  }
  catch (error) {
    saveOk.value = false
    saveMessage.value = errorText(error)
  }
  finally {
    loadingModels.value = false
  }
}

function toggleParticipant(name: string) {
  const index = form.billParticipants.indexOf(name)
  if (index > -1) form.billParticipants.splice(index, 1)
  else form.billParticipants.push(name)
}

async function copyWebhook() {
  await navigator.clipboard.writeText(webhookUrl.value)
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 1500)
}

async function loadActivity() {
  activityLoading.value = true
  try {
    activity.value = await api<{ messages: ActivityMessage[], runs: ActivityRun[] }>('/api/agent/activity')
  }
  catch (error) {
    console.error('Failed to load agent activity:', error)
  }
  finally {
    activityLoading.value = false
  }
}

async function retry() {
  retrying.value = true
  try {
    await api('/api/agent/run', { method: 'POST' })
    await loadActivity()
  }
  catch (error) {
    saveOk.value = false
    saveMessage.value = errorText(error)
  }
  finally {
    retrying.value = false
  }
}

function formatTime(value: string): string {
  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

watch(editing, () => {
  testResult.value = null
})

onMounted(() => {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) {
    password.value = saved
    unlock()
  }
})
</script>
