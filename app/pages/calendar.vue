<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
    <div class="max-w-7xl mx-auto">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Left Column: Calendar -->
        <div class="lg:col-span-2">
          <div class="bg-white rounded-lg shadow-md p-6">
            <!-- Header -->
            <div class="mb-6">
              <div class="flex items-center justify-between mb-4">
                <h1 class="text-2xl font-bold text-gray-900">
                  Class Schedule
                </h1>
              </div>
              <div class="flex items-center gap-4">
                <UButton
                  @click="previousMonth"
                  variant="ghost"
                  icon="i-heroicons-chevron-left"
                />
                <h2 class="text-xl font-semibold text-gray-800">
                  {{ currentMonthYear }}
                </h2>
                <UButton
                  @click="nextMonth"
                  variant="ghost"
                  icon="i-heroicons-chevron-right"
                />
              </div>
            </div>

            <!-- Calendar -->
            <div class="grid grid-cols-7 gap-2 mb-4">
              <!-- Weekday headers -->
              <div
                v-for="day in weekDays"
                :key="day"
                class="text-center font-semibold text-gray-600 py-2"
              >
                {{ day }}
              </div>
            </div>

            <div class="grid grid-cols-7 gap-2">
              <!-- Empty cells for days before month starts -->
              <div
                v-for="i in startDay"
                :key="`empty-${i}`"
                class="aspect-square"
              ></div>

              <!-- Calendar days -->
              <div
                v-for="day in daysInMonth"
                :key="day"
                role="button"
                tabindex="0"
                :class="[
                  'aspect-square rounded-lg border-2 transition-all cursor-pointer relative flex flex-col items-center justify-center',
                  getDayClass(day),
                ]"
                @click="openAddExpenseModal(day)"
                @keydown.enter.prevent="openAddExpenseModal(day)"
                @keydown.space.prevent="openAddExpenseModal(day)"
              >
                <button
                  type="button"
                  class="absolute top-0.5 right-0.5 z-10 flex h-6 w-6 items-center justify-center rounded-md border border-gray-300/80 bg-white/90 text-[10px] font-bold shadow-sm hover:bg-white disabled:opacity-50"
                  :disabled="loading"
                  title="Bật/tắt có học (không mở form chi phí)"
                  @click.stop="toggleClass(day)"
                >
                  <span v-if="getClassStatus(day) === true">✓</span>
                  <span v-else-if="getClassStatus(day) === false">✗</span>
                  <span v-else class="text-gray-400">—</span>
                </button>
                <div class="flex flex-col items-center justify-center h-full px-1 pb-1 pt-5">
                  <span class="text-sm font-medium">{{ day }}</span>
                  <span
                    v-if="getVocabularyCount(day) > 0"
                    class="text-xs mt-0.5 px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded-full font-semibold max-w-full truncate"
                    :title="`${getVocabularyCount(day)} new word${getVocabularyCount(day) > 1 ? 's' : ''}`"
                  >
                    {{ getVocabularyCount(day) }} 📚
                  </span>
                  <span
                    v-if="getExpenseDailyTotal(day) > 0"
                    class="text-[10px] mt-0.5 px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded-full font-semibold max-w-full truncate"
                    :title="`Tổng chi: ${formatCurrency(getExpenseDailyTotal(day))}`"
                  >
                    {{ formatCurrencyCompact(getExpenseDailyTotal(day)) }} 💰
                  </span>
                </div>
              </div>
            </div>

            <!-- Legend -->
            <div class="mt-6">
              <p class="text-sm text-gray-600 mb-3">
                <strong>Note:</strong> Monday and Thursday are marked as having class by default. Click a day to add an expense (paid by defaults to you). Use the small corner button on a day to toggle class on/off.
              </p>
              <div class="flex items-center gap-6 text-sm">
                <div class="flex items-center gap-2">
                  <div class="w-4 h-4 bg-green-200 border-2 border-green-400 rounded"></div>
                  <span>Has Class</span>
                </div>
                <div class="flex items-center gap-2">
                  <div class="w-4 h-4 bg-red-200 border-2 border-red-400 rounded"></div>
                  <span>No Class</span>
                </div>
                <div class="flex items-center gap-2">
                  <div class="w-4 h-4 bg-gray-100 border-2 border-gray-300 rounded"></div>
                  <span>Not Marked</span>
                </div>
                <div class="flex items-center gap-2">
                  <div class="w-4 h-4 bg-blue-100 border-2 border-blue-300 rounded"></div>
                  <span>Mon, Thu (default)</span>
                </div>
              </div>
            </div>

            <!-- Summary -->
            <div class="mt-6 p-4 bg-blue-50 rounded-lg">
              <h3 class="font-semibold text-gray-800 mb-2">Monthly Summary</h3>
              <div class="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span class="text-gray-600">Total classes:</span>
                  <span class="font-semibold text-green-600 ml-2">{{ classCount }}</span>
                </div>
                <div>
                  <span class="text-gray-600">Total no classes:</span>
                  <span class="font-semibold text-red-600 ml-2">{{ noClassCount }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Column: History Timeline Sidebar -->
        <div class="lg:col-span-1">
          <div class="bg-white rounded-lg shadow-md p-6 sticky top-8">
            <h3 class="font-semibold text-gray-800 mb-4">Edit History</h3>
            <div v-if="historyLoading" class="text-center text-gray-500 py-4">
              Loading history...
            </div>
            <div v-else-if="history.length === 0" class="text-center text-gray-500 py-4">
              No edit history for this month
            </div>
            <div v-else class="relative max-h-[calc(100vh-12rem)] overflow-y-auto pr-2">
              <!-- Timeline line -->
              <div class="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>
              
              <!-- Timeline items -->
              <div class="space-y-4">
                <div
                  v-for="(item, index) in history"
                  :key="item.id"
                  class="relative pl-10"
                >
                  <!-- Timeline dot -->
                  <div
                    class="absolute left-0 top-1 w-3 h-3 rounded-full border-2 border-white shadow-sm z-10"
                    :class="item.has_class === 1 ? 'bg-green-500' : 'bg-red-500'"
                    style="margin-left: 2.5px;"
                  ></div>
                  
                  <!-- Timeline content -->
                  <div class="bg-gray-50 rounded-lg p-3 border border-gray-100">
                    <div class="flex flex-col gap-1 mb-2">
                      <div class="flex items-center justify-between">
                        <span class="text-xs font-semibold text-gray-900">
                          {{ formatDate(item.date) }}
                        </span>
                        <span class="text-xs text-gray-500 font-medium">
                          {{ formatTime(item.created_at) }}
                        </span>
                      </div>
                      <span class="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded w-fit">
                        {{ item.user_name || 'Unknown' }}
                      </span>
                    </div>
                    <div class="flex flex-col gap-1 text-xs">
                      <div class="flex items-center gap-2">
                        <span
                          class="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium"
                          :class="getStatusClass(item.previous_has_class)"
                        >
                          <span v-if="item.previous_has_class === null">Not set</span>
                          <span v-else>{{ item.previous_has_class === 1 ? 'Has Class' : 'No Class' }}</span>
                        </span>
                        <span class="text-gray-400">→</span>
                        <span
                          class="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium"
                          :class="getStatusClass(item.has_class)"
                        >
                          {{ item.has_class === 1 ? 'Has Class' : 'No Class' }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Add expense (from calendar day click) -->
    <UModal v-model:open="showExpenseModal" title="Add expense">
      <template #body>
        <div class="space-y-4">
          <UFormField label="Description" required>
            <UInput v-model="newExpense.description" placeholder="Enter description" />
          </UFormField>
          <UFormField label="Amount" required>
            <UInput
              v-model="newExpense.amount"
              type="number"
              placeholder="Enter amount"
            />
          </UFormField>
          <UFormField label="Date" required>
            <UInput
              v-model="newExpense.date"
              type="date"
            />
          </UFormField>
          <UFormField label="Type">
            <USelect
              v-model="newExpense.expenseType"
              :options="expenseTypes"
            />
          </UFormField>
          <UFormField label="Participants" required>
            <div class="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded p-3">
              <div
                v-for="person in allPersons"
                :key="person.id"
                class="flex items-center gap-2"
              >
                <UCheckbox
                  :id="`cal-person-${person.id}`"
                  :model-value="newExpense.participantIds.includes(person.id)"
                  @update:model-value="toggleParticipant(person.id)"
                />
                <label :for="`cal-person-${person.id}`" class="text-sm text-gray-700 cursor-pointer">
                  {{ person.name }}
                </label>
              </div>
            </div>
          </UFormField>
          <UFormField label="Paid by">
            <USelect
              :model-value="newExpense.paidBy ?? undefined"
              :items="personOptions"
              value-key="value"
              option-attribute="label"
              placeholder="Select who paid"
              @update:model-value="newExpense.paidBy = $event ?? null"
            />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton
            variant="ghost"
            color="neutral"
            @click="resetExpenseForm(); showExpenseModal = false"
          >
            Cancel
          </UButton>
          <UButton
            color="primary"
            :disabled="!canAddExpense || addingExpense"
            @click="saveExpenseFromCalendar"
          >
            {{ addingExpense ? 'Adding...' : 'Add' }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
interface ClassSession {
  id: number
  date: string
  has_class: number
  created_at: string
  updated_at: string
}

interface SessionHistory {
  id: number
  user_id: number
  user_name: string
  date: string
  has_class: number
  previous_has_class: number | null
  created_at: string
}

interface Person {
  id: number
  name: string
}

const route = useRoute()
const router = useRouter()
const { selectedPerson, selectedPersonId, loadSelectedPerson } = useSelectedPerson()

// Load saved month from URL query, cookie, or use current month
// Use shared cookie for both expenses and calendar pages
const selectedMonthCookie = useCookie<string>('selectedMonth', {
  default: () => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  },
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
})

// Initialize currentDate from URL query, cookie, or current month
const initializeCurrentDate = () => {
  // Priority 1: URL query parameter
  const monthParam = route.query.month as string | undefined
  if (monthParam) {
    const [year, month] = monthParam.split('-').map(Number)
    if (year && month && month >= 1 && month <= 12) {
      return new Date(year, month - 1, 1)
    }
  }
  
  // Priority 2: Shared cookie (works for both expenses and calendar)
  if (selectedMonthCookie.value) {
    const [year, month] = selectedMonthCookie.value.split('-').map(Number)
    if (year && month) {
      return new Date(year, month - 1, 1)
    }
  }
  
  // Priority 3: Current month
  return new Date()
}

const currentDate = ref(initializeCurrentDate())

// Sync URL when currentDate changes
watch(currentDate, (newDate) => {
  const year = newDate.getFullYear()
  const month = newDate.getMonth() + 1
  const monthStr = `${year}-${String(month).padStart(2, '0')}`
  
  // Update shared cookie
  selectedMonthCookie.value = monthStr
  
  // Update URL without reload
  router.replace({
    query: { ...route.query, month: monthStr },
  })
}, { immediate: false })
const sessions = ref<Map<string, ClassSession>>(new Map())
const loading = ref(false)
const history = ref<SessionHistory[]>([])
const historyLoading = ref(false)
const vocabularyStats = ref<Map<string, number>>(new Map())
const expenseDailyTotals = ref<Map<string, number>>(new Map())

const showExpenseModal = ref(false)
const addingExpense = ref(false)
const allPersons = ref<Person[]>([])
const expenseTypes = [
  { label: 'Tuition', value: 'tuition' },
  { label: 'Other', value: 'other' }
]
const newExpense = ref({
  description: '',
  amount: '',
  date: new Date().toISOString().split('T')[0],
  expenseType: 'other',
  participantIds: [] as number[],
  paidBy: null as number | null
})

const personOptions = computed(() =>
  allPersons.value.map(p => ({ label: p.name, value: p.id }))
)

const canAddExpense = computed(() => (
  newExpense.value.description.trim() &&
  newExpense.value.amount &&
  parseFloat(newExpense.value.amount) > 0 &&
  newExpense.value.date &&
  newExpense.value.participantIds.length > 0
))

// Removed - no longer needed since sessions are global

const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const currentMonthYear = computed(() => {
  return currentDate.value.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  })
})

const daysInMonth = computed(() => {
  const year = currentDate.value.getFullYear()
  const month = currentDate.value.getMonth()
  return new Date(year, month + 1, 0).getDate()
})

const startDay = computed(() => {
  const year = currentDate.value.getFullYear()
  const month = currentDate.value.getMonth()
  const firstDay = new Date(year, month, 1)
  return firstDay.getDay() // 0 = Sunday, 1 = Monday, etc.
})

const classCount = computed(() => {
  let count = 0
  for (let day = 1; day <= daysInMonth.value; day++) {
    const status = getClassStatus(day)
    if (status === true) {
      count++
    }
  }
  return count
})

const noClassCount = computed(() => {
  let count = 0
  for (let day = 1; day <= daysInMonth.value; day++) {
    const status = getClassStatus(day)
    if (status === false) {
      count++
    }
  }
  return count
})

const getDateString = (day: number): string => {
  const year = currentDate.value.getFullYear()
  const month = currentDate.value.getMonth() + 1
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

const getVocabularyCount = (day: number): number => {
  const dateStr = getDateString(day)
  return vocabularyStats.value.get(dateStr) || 0
}

const getExpenseDailyTotal = (day: number): number => {
  const dateStr = getDateString(day)
  return expenseDailyTotals.value.get(dateStr) || 0
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND'
  }).format(amount)
}

const formatCurrencyCompact = (amount: number): string => {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    notation: 'compact',
    maximumFractionDigits: 0
  }).format(amount)
}

const getClassStatus = (day: number): boolean | null => {
  const dateStr = getDateString(day)
  const session = sessions.value.get(dateStr)
  if (session) {
    return session.has_class === 1
  }
  // For default class days (Monday/Thursday), show as having class if no session exists yet
  if (isDefaultClassDay(day)) {
    return true
  }
  return null
}

const isDefaultClassDay = (day: number): boolean => {
  const year = currentDate.value.getFullYear()
  const month = currentDate.value.getMonth()
  const date = new Date(year, month, day)
  const dayOfWeek = date.getDay() // 0 = Sunday, 1 = Monday, 2 = Tuesday, 3 = Wednesday, 4 = Thursday
  return dayOfWeek === 1 || dayOfWeek === 4 // Monday (1) or Thursday (4)
}

const getDayClass = (day: number): string => {
  const dateStr = getDateString(day)
  const session = sessions.value.get(dateStr)
  const isDefault = isDefaultClassDay(day)
  
  if (!session) {
    // Default class days (Monday/Thursday) show as having class (green) if not explicitly set
    if (isDefault) {
      return 'bg-green-200 border-green-400 hover:bg-green-300'
    }
    return 'bg-gray-100 border-gray-300 hover:bg-gray-200'
  }
  
  if (session.has_class === 1) {
    return 'bg-green-200 border-green-400 hover:bg-green-300'
  } else {
    return 'bg-red-200 border-red-400 hover:bg-red-300'
  }
}

const toggleClass = async (day: number) => {
  if (loading.value || !selectedPersonId.value) return

  const dateStr = getDateString(day)
  const existingSession = sessions.value.get(dateStr)
  const isDefault = isDefaultClassDay(day)
  
  // Toggle logic: 
  // - For default days (Mon/Thu) without session: currently showing as "on" (default), so toggle to "off" (0)
  // - For non-default days without session: create with has_class = 1 (on)
  // - If session exists with has_class = 1, toggle to 0 (off)
  // - If session exists with has_class = 0, toggle to 1 (on)
  let newHasClass: number
  if (!existingSession) {
    newHasClass = isDefault ? 0 : 1 // Default days: off, others: on
  } else {
    newHasClass = existingSession.has_class === 1 ? 0 : 1
  }

  loading.value = true
  try {
    const session = await $fetch<ClassSession>('/api/sessions', {
      method: 'POST',
      body: {
        userId: selectedPersonId.value,
        date: dateStr,
        hasClass: newHasClass === 1
      }
    })
    sessions.value.set(dateStr, session)
    // Reload history after update
    await loadHistory()
  } catch (error) {
    console.error('Failed to update session:', error)
    alert('An error occurred while updating class session')
  } finally {
    loading.value = false
  }
}

const previousMonth = () => {
  currentDate.value = new Date(
    currentDate.value.getFullYear(),
    currentDate.value.getMonth() - 1,
    1
  )
  loadSessions()
}

const nextMonth = () => {
  currentDate.value = new Date(
    currentDate.value.getFullYear(),
    currentDate.value.getMonth() + 1,
    1
  )
  loadSessions()
}

const loadSessions = async () => {
  if (!selectedPersonId.value) {
    router.push('/')
    return
  }

  try {
    // First, initialize default sessions for the month (Monday and Thursday)
    const year = currentDate.value.getFullYear()
    const month = currentDate.value.getMonth() + 1
    
    try {
      await $fetch('/api/sessions/initialize', {
        method: 'POST',
        body: {
          year,
          month
        }
      })
    } catch (error) {
      // Ignore if already initialized
      console.log('Sessions may already be initialized')
    }
    
    // Load all sessions for the month (global)
    const data = await $fetch<ClassSession[]>(`/api/sessions`, {
      query: {
        year,
        month
      }
    })
    const sessionsMap = new Map<string, ClassSession>()
    
    data.forEach(session => {
      sessionsMap.set(session.date, session)
    })
    
    sessions.value = sessionsMap
    
    // Load history for the month
    await loadHistory()
    // Load vocabulary stats and expense totals for the month
    await loadVocabularyStats()
    await loadExpenseDailyTotals()
  } catch (error) {
    console.error('Failed to load sessions:', error)
  }
}

const loadHistory = async () => {
  historyLoading.value = true
  try {
    const year = currentDate.value.getFullYear()
    const month = currentDate.value.getMonth() + 1
    
    const data = await $fetch<SessionHistory[]>(`/api/sessions/history`, {
      query: {
        year,
        month
      }
    })
    
    history.value = data
  } catch (error) {
    console.error('Failed to load history:', error)
    history.value = []
  } finally {
    historyLoading.value = false
  }
}

const loadVocabularyStats = async () => {
  try {
    const year = currentDate.value.getFullYear()
    const month = currentDate.value.getMonth() + 1
    
    const stats = await $fetch<Record<string, number>>('/api/vocabulary/stats', {
      query: { year, month }
    })
    
    vocabularyStats.value = new Map(Object.entries(stats))
  } catch (error) {
    console.error('Failed to load vocabulary stats:', error)
    vocabularyStats.value = new Map()
  }
}

const loadExpenseDailyTotals = async () => {
  try {
    const year = currentDate.value.getFullYear()
    const month = currentDate.value.getMonth() + 1
    const totals = await $fetch<Record<string, number>>('/api/expenses/daily-totals', {
      query: { year, month }
    })
    expenseDailyTotals.value = new Map(Object.entries(totals))
  } catch (error) {
    console.error('Failed to load expense daily totals:', error)
    expenseDailyTotals.value = new Map()
  }
}

const loadPersonsForExpenses = async () => {
  try {
    allPersons.value = await $fetch<Person[]>('/api/persons')
    const defaultNames = ['Seb', 'Ania', 'Simon', 'James', 'David']
    const defaultPersons = allPersons.value.filter(p => defaultNames.includes(p.name))
    newExpense.value.participantIds = defaultPersons.map(p => p.id)
  } catch (error) {
    console.error('Failed to load persons:', error)
  }
}

const resetExpenseForm = () => {
  newExpense.value = {
    description: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    expenseType: 'other',
    participantIds: allPersons.value
      .filter(p => ['Seb', 'Ania', 'Simon', 'James', 'David'].includes(p.name))
      .map(p => p.id),
    paidBy: null
  }
}

const toggleParticipant = (personId: number) => {
  const ids = newExpense.value.participantIds
  const index = ids.indexOf(personId)
  if (index > -1) {
    ids.splice(index, 1)
  } else {
    ids.push(personId)
  }
}

const openAddExpenseModal = (day: number) => {
  resetExpenseForm()
  newExpense.value.date = getDateString(day)
  if (selectedPersonId.value != null) {
    newExpense.value.paidBy = selectedPersonId.value
  }
  showExpenseModal.value = true
}

const saveExpenseFromCalendar = async () => {
  if (!canAddExpense.value) return
  addingExpense.value = true
  try {
    await $fetch('/api/expenses', {
      method: 'POST',
      body: {
        description: newExpense.value.description,
        amount: parseFloat(newExpense.value.amount),
        date: newExpense.value.date,
        expenseType: newExpense.value.expenseType,
        participantIds: newExpense.value.participantIds,
        paidBy: newExpense.value.paidBy
      }
    })
    resetExpenseForm()
    showExpenseModal.value = false
    await loadExpenseDailyTotals()
  } catch (error) {
    console.error('Failed to save expense:', error)
    alert('Failed to save expense')
  } finally {
    addingExpense.value = false
  }
}

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

const formatTime = (dateTimeStr: string): string => {
  const date = new Date(dateTimeStr)
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

const getStatusClass = (hasClass: number | null): string => {
  if (hasClass === null) {
    return 'bg-gray-100 text-gray-600'
  }
  return hasClass === 1
    ? 'bg-green-100 text-green-700'
    : 'bg-red-100 text-red-700'
}

// Check if user is selected, redirect if not
onMounted(async () => {
  // Wait for client-side hydration to complete
  await nextTick()
  
  // Load person data if we have personId but not person object
  if (selectedPersonId.value && !selectedPerson.value) {
    await loadSelectedPerson()
  }
  
  if (!selectedPersonId.value) {
    router.push('/')
    return
  }
  
  // Ensure URL has month parameter (if not, set it to current month)
  if (!route.query.month) {
    const year = currentDate.value.getFullYear()
    const month = currentDate.value.getMonth() + 1
    const monthStr = `${year}-${String(month).padStart(2, '0')}`
    router.replace({
      query: { ...route.query, month: monthStr },
    })
  }
  
  await loadPersonsForExpenses()
  await loadSessions()
})
</script>

