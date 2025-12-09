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
              <button
                v-for="day in daysInMonth"
                :key="day"
                @click="toggleClass(day)"
                :class="[
                  'aspect-square rounded-lg border-2 transition-all cursor-pointer',
                  getDayClass(day),
                ]"
              >
                <div class="flex flex-col items-center justify-center h-full">
                  <span class="text-sm font-medium">{{ day }}</span>
                  <span
                    v-if="getClassStatus(day) !== null"
                    class="text-xs mt-1"
                  >
                    {{ getClassStatus(day) ? '✓' : '✗' }}
                  </span>
                  <span
                    v-if="getVocabularyCount(day) > 0"
                    class="text-xs mt-0.5 px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded-full font-semibold"
                    :title="`${getVocabularyCount(day)} new word${getVocabularyCount(day) > 1 ? 's' : ''}`"
                  >
                    {{ getVocabularyCount(day) }} 📚
                  </span>
                </div>
              </button>
            </div>

            <!-- Legend -->
            <div class="mt-6">
              <p class="text-sm text-gray-600 mb-3">
                <strong>Note:</strong> Monday and Thursday are marked as having class by default. You can click on any day to toggle on/off for your account.
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

const router = useRouter()
const { selectedPerson, selectedPersonId, loadSelectedPerson } = useSelectedPerson()
const currentDate = ref(new Date())
const sessions = ref<Map<string, ClassSession>>(new Map())
const loading = ref(false)
const history = ref<SessionHistory[]>([])
const historyLoading = ref(false)
const vocabularyStats = ref<Map<string, number>>(new Map())

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
  loadVocabularyStats()
}

const nextMonth = () => {
  currentDate.value = new Date(
    currentDate.value.getFullYear(),
    currentDate.value.getMonth() + 1,
    1
  )
  loadSessions()
  loadVocabularyStats()
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
    // Load vocabulary stats for the month
    await loadVocabularyStats()
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
  await loadSessions()
})
</script>

