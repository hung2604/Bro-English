<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
    <div class="max-w-7xl mx-auto">
      <!-- Header -->
      <div class="mb-6">
        <div class="flex items-center justify-between mb-4">
          <h1 class="text-2xl font-bold text-gray-900">Expense Management</h1>
          <UButton
            @click="resetForm(); showAddModal = true"
            color="primary"
          >
            + Add Expense
          </UButton>
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

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Left Column: Expenses List -->
        <div class="lg:col-span-2">
          <div class="bg-white rounded-lg shadow-md p-6">
            <h3 class="font-semibold text-gray-800 mb-4">Expenses</h3>
            <div v-if="loading" class="text-center text-gray-500 py-4">
              Loading...
            </div>
            <div v-else-if="expenses.length === 0" class="text-center text-gray-500 py-4">
              No expenses for this month
            </div>
            <div v-else class="space-y-3">
              <div
                v-for="expense in expenses"
                :key="expense.id"
                class="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
              >
                <div class="flex items-start justify-between">
                  <div class="flex-1">
                    <div class="flex items-center gap-2 mb-2">
                      <span class="font-semibold text-gray-900">{{ expense.description }}</span>
                      <span class="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                        {{ expense.expense_type }}
                      </span>
                    </div>
                    <div class="text-sm text-gray-600 mb-2">
                      <span class="font-semibold text-green-600">
                        {{ formatCurrency(expense.amount) }}
                      </span>
                      <span class="mx-2">•</span>
                      <span class="text-xs text-purple-600 font-medium">
                        {{ formatCurrency(expense.amount / expense.participant_names.length) }}/person
                      </span>
                      <span class="mx-2">•</span>
                      <span>{{ formatDate(expense.date) }}</span>
                      <span v-if="expense.paid_by_name" class="mx-2">•</span>
                      <span v-if="expense.paid_by_name" class="text-xs text-blue-600">
                        Paid by: {{ expense.paid_by_name }}
                      </span>
                    </div>
                    <div class="flex flex-wrap gap-1">
                      <span
                        v-for="name in expense.participant_names"
                        :key="name"
                        class="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded"
                      >
                        {{ name }}
                      </span>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <UButton
                      @click="showQRCode(expense)"
                      variant="ghost"
                      color="primary"
                      icon="i-heroicons-qr-code"
                      size="sm"
                      title="Show QR Code"
                    />
                    <UButton
                      @click="editExpense(expense)"
                      variant="ghost"
                      color="neutral"
                      icon="i-heroicons-pencil"
                      size="sm"
                    />
                    <UButton
                      @click="deleteExpense(expense.id)"
                      variant="ghost"
                      color="error"
                      icon="i-heroicons-trash"
                      size="sm"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Column: Summary -->
        <div class="lg:col-span-1">
          <div class="bg-white rounded-lg shadow-md p-6 sticky top-8">
            <h3 class="font-semibold text-gray-800 mb-4">Monthly Summary</h3>
            <div v-if="summaryLoading" class="text-center text-gray-500 py-4">
              Loading summary...
            </div>
            <div v-else-if="summary">
              <div class="mb-4 p-3 bg-blue-50 rounded-lg">
                <div class="text-sm text-gray-600 mb-1">Total Classes</div>
                <div class="text-2xl font-bold text-blue-600">{{ summary.total_classes }}</div>
                <div class="text-xs text-gray-500 mt-1">
                  Tuition: {{ formatCurrency(summary.total_tuition) }}
                </div>
              </div>
              <div class="mb-4 p-3 bg-green-50 rounded-lg">
                <div class="text-sm text-gray-600 mb-1">Total to Collect</div>
                <div class="text-2xl font-bold text-green-600">
                  {{ formatCurrency(summary.total_amount) }}
                </div>
                <div v-if="summary.total_to_pay && summary.total_to_pay > 0" class="text-xs text-gray-500 mt-1">
                  To pay out: {{ formatCurrency(summary.total_to_pay) }}
                </div>
              </div>
              <div class="border-t pt-4">
                <div class="text-sm font-semibold text-gray-700 mb-3">By Person</div>
                <div class="space-y-2 max-h-[400px] overflow-y-auto">
                  <div
                    v-for="person in summary.by_person"
                    :key="person.person_id"
                    class="p-2 rounded"
                    :class="person.total_amount > 0 ? 'bg-red-50' : person.total_amount < 0 ? 'bg-green-50' : 'bg-gray-50'"
                  >
                    <div class="flex items-center justify-between mb-1">
                      <span class="text-sm font-semibold text-gray-900">{{ person.person_name }}</span>
                      <div class="flex items-center gap-2">
                        <span
                          class="text-sm font-semibold"
                          :class="person.total_amount > 0 ? 'text-red-600' : person.total_amount < 0 ? 'text-green-600' : 'text-gray-600'"
                        >
                          <span v-if="person.total_amount < 0">+</span>{{ formatCurrency(Math.abs(person.total_amount)) }}
                          {{ person.total_amount > 0 ? 'to pay' : person.total_amount < 0 ? 'to receive' : 'balanced' }}
                        </span>
                        <UButton
                          v-if="person.total_amount !== 0"
                          @click="showQRCodeForPerson(person)"
                          variant="ghost"
                          color="primary"
                          icon="i-heroicons-qr-code"
                          size="xs"
                          title="Show QR Code"
                        />
                      </div>
                    </div>
                    <div class="text-xs space-y-0.5" :class="person.total_amount > 0 ? 'text-red-700' : person.total_amount < 0 ? 'text-green-700' : 'text-gray-700'">
                      <div>Should pay: {{ formatCurrency(person.should_pay) }}</div>
                      <div v-if="person.already_paid !== 0">
                        <span v-if="person.already_paid > 0">Already paid: {{ formatCurrency(person.already_paid) }}</span>
                        <span v-else>To receive: +{{ formatCurrency(Math.abs(person.already_paid)) }}</span>
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

    <!-- Add/Edit Expense Modal -->
    <UModal v-model:open="showAddModal" :title="editingExpense ? 'Edit Expense' : 'Add New Expense'">
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
                  :id="`person-${person.id}`"
                  :model-value="newExpense.participantIds.includes(person.id)"
                  @update:model-value="toggleParticipant(person.id)"
                />
                <label :for="`person-${person.id}`" class="text-sm text-gray-700 cursor-pointer">
                  {{ person.name }}
                </label>
              </div>
            </div>
          </UFormField>
          <UFormField label="Paid By">
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
            @click="resetForm(); showAddModal = false"
            variant="ghost"
            color="neutral"
          >
            Cancel
          </UButton>
          <UButton
            @click="saveExpense"
            color="primary"
            :disabled="!canAddExpense || adding"
          >
            {{ adding ? (editingExpense ? 'Updating...' : 'Adding...') : (editingExpense ? 'Update' : 'Add') }}
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- QR Code Modal -->
    <UModal v-model:open="showQRModal" title="Payment QR Code">
      <template #body>
        <div v-if="qrData" class="space-y-4">
          <div class="text-center">
            <p class="text-sm text-gray-600 mb-2">
              Amount: <span class="font-semibold text-green-600">{{ formatCurrency(qrData.amount) }}</span>
            </p>
            <p class="text-xs text-gray-500 mb-4">{{ qrData.description }}</p>
            
            <!-- QR Code for Seb -->
            <div v-if="qrData.isSeb" class="space-y-3">
              <div class="flex justify-center">
                <img
                  :src="`https://qr.sepay.vn/img?acc=1300206294671&bank=AGRIBANK&amount=${qrData.amount}&des=${encodeURIComponent(qrData.description)}`"
                  alt="QR Code"
                  class="w-64 h-64 border border-gray-200 rounded-lg"
                />
              </div>
              <div class="bg-green-50 border border-green-200 rounded-lg p-3">
                <p class="text-xs text-green-800 mb-1">
                  <span class="font-semibold">Bank:</span> AGRIBANK
                </p>
                <p class="text-xs text-green-800">
                  <span class="font-semibold">Account:</span> 1300206294671
                </p>
                <p class="text-xs text-green-700 mt-1">Account Name: Seb</p>
              </div>
              <div class="text-xs text-gray-500">
                Scan QR code or transfer {{ formatCurrency(qrData.amount) }} to the account above
              </div>
            </div>
            
            <!-- QR Code for others -->
            <div v-else class="space-y-3">
              <div class="flex justify-center">
                <img
                  :src="`https://qr.sepay.vn/img?acc=86354080798&bank=VPBank&amount=${qrData.amount}&des=${encodeURIComponent(qrData.description)}`"
                  alt="QR Code"
                  class="w-64 h-64 border border-gray-200 rounded-lg"
                />
              </div>
              <div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p class="text-xs text-blue-800 mb-1">
                  <span class="font-semibold">Bank:</span> VPBank
                </p>
                <p class="text-xs text-blue-800">
                  <span class="font-semibold">Account:</span> 86354080798
                </p>
              </div>
              <div class="text-xs text-gray-500">
                Scan QR code or transfer {{ formatCurrency(qrData.amount) }} to the account above
              </div>
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end">
          <UButton
            @click="showQRModal = false"
            color="primary"
          >
            Close
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
const { selectedPersonId, setSelectedPerson } = useSelectedPerson()
const router = useRouter()

const { loadSelectedPerson } = useSelectedPerson()

// Check if user is selected, redirect if not
onMounted(async () => {
  // Wait for client-side hydration to complete
  await nextTick()
  
  // Load person data if we have personId but not person object
  if (selectedPersonId.value) {
    await loadSelectedPerson()
  }
  
  if (!selectedPersonId.value) {
    router.push('/')
  }
})

interface Person {
  id: number
  name: string
}

interface Expense {
  id: number
  description: string
  amount: number
  date: string
  expense_type: string
  paid_by: number | null
  paid_by_name: string | null
  participant_ids: number[]
  participant_names: string[]
}

interface Summary {
  month: string
  total_classes: number
  total_tuition: number
  total_amount: number
  total_to_pay?: number
  by_person: Array<{
    person_id: number
    person_name: string
    total_amount: number
    should_pay: number
    already_paid: number
  }>
}

const route = useRoute()

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
const expenses = ref<Expense[]>([])
const summary = ref<Summary | null>(null)
const loading = ref(false)
const summaryLoading = ref(false)
const adding = ref(false)
const showAddModal = ref(false)
const editingExpense = ref<Expense | null>(null)
const allPersons = ref<Person[]>([])
const showQRModal = ref(false)
const qrData = ref<{ amount: number; description: string; isSeb: boolean } | null>(null)

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

const currentMonthYear = computed(() => {
  return currentDate.value.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  })
})

const canAddExpense = computed(() => {
  return (
    newExpense.value.description.trim() &&
    newExpense.value.amount &&
    parseFloat(newExpense.value.amount) > 0 &&
    newExpense.value.date &&
    newExpense.value.participantIds.length > 0
  )
})

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND'
  }).format(amount)
}

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

const personOptions = computed(() => {
  return allPersons.value.map(p => ({
    label: p.name,
    value: p.id
  }))
})

const loadPersons = async () => {
  try {
    allPersons.value = await $fetch<Person[]>('/api/persons')
    // Set default participants: Seb + 5 default members
    const defaultNames = ['Seb', 'Ania', 'Simon', 'Hairy', 'James', 'David']
    const defaultPersons = allPersons.value.filter(p => defaultNames.includes(p.name))
    newExpense.value.participantIds = defaultPersons.map(p => p.id)
  } catch (error) {
    console.error('Failed to load persons:', error)
  }
}

const loadExpenses = async () => {
  loading.value = true
  try {
    const year = currentDate.value.getFullYear()
    const month = currentDate.value.getMonth() + 1
    expenses.value = await $fetch<Expense[]>('/api/expenses', {
      query: { year, month }
    })
  } catch (error) {
    console.error('Failed to load expenses:', error)
  } finally {
    loading.value = false
  }
}

const loadSummary = async () => {
  summaryLoading.value = true
  try {
    const year = currentDate.value.getFullYear()
    const month = currentDate.value.getMonth() + 1
    summary.value = await $fetch<Summary>('/api/expenses/summary', {
      query: { year, month }
    })
  } catch (error) {
    console.error('Failed to load summary:', error)
  } finally {
    summaryLoading.value = false
  }
}

const toggleParticipant = (personId: number) => {
  const index = newExpense.value.participantIds.indexOf(personId)
  if (index > -1) {
    newExpense.value.participantIds.splice(index, 1)
  } else {
    newExpense.value.participantIds.push(personId)
  }
}

const editExpense = (expense: Expense) => {
  editingExpense.value = expense
  newExpense.value = {
    description: expense.description,
    amount: expense.amount.toString(),
    date: expense.date,
    expenseType: expense.expense_type,
    participantIds: [...expense.participant_ids],
    paidBy: expense.paid_by
  }
  showAddModal.value = true
}

const saveExpense = async () => {
  if (!canAddExpense.value) return

  adding.value = true
  try {
    const expenseData = {
      description: newExpense.value.description,
      amount: parseFloat(newExpense.value.amount),
      date: newExpense.value.date,
      expenseType: newExpense.value.expenseType,
      participantIds: newExpense.value.participantIds,
      paidBy: newExpense.value.paidBy
    }

    if (editingExpense.value) {
      // Update existing expense
      await $fetch(`/api/expenses/${editingExpense.value.id}`, {
        method: 'PUT',
        body: expenseData
      })
    } else {
      // Create new expense
      await $fetch('/api/expenses', {
        method: 'POST',
        body: expenseData
      })
    }
    
    // Reset form
    resetForm()
    
    showAddModal.value = false
    await loadExpenses()
    await loadSummary()
  } catch (error) {
    console.error('Failed to save expense:', error)
    alert('Failed to save expense')
  } finally {
    adding.value = false
  }
}

const resetForm = () => {
  editingExpense.value = null
  newExpense.value = {
    description: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    expenseType: 'other',
    participantIds: allPersons.value
      .filter(p => ['Seb', 'Ania', 'Simon', 'Hairy', 'James', 'David'].includes(p.name))
      .map(p => p.id),
    paidBy: null
  }
}

const showQRCode = (expense: Expense) => {
  // Calculate amount per person
  const amountPerPerson = expense.amount / expense.participant_ids.length
  // Check if current user is Seb
  const currentPerson = allPersons.value.find(p => p.id === selectedPersonId.value)
  const isSeb = currentPerson?.name === 'Seb'
  
  qrData.value = {
    amount: amountPerPerson,
    description: expense.description,
    isSeb: isSeb || false
  }
  showQRModal.value = true
}

const showQRCodeForPerson = (person: { person_id: number; person_name: string; total_amount: number }) => {
  // Check if this person is Seb
  const isSeb = person.person_name === 'Seb'
  
  qrData.value = {
    amount: Math.abs(person.total_amount),
    description: isSeb 
      ? `Payment to ${person.person_name} - ${currentMonthYear.value}`
      : `Payment for ${person.person_name} - ${currentMonthYear.value}`,
    isSeb: isSeb
  }
  showQRModal.value = true
}

const deleteExpense = async (id: number) => {
  if (!confirm('Are you sure you want to delete this expense?')) return

  try {
    await $fetch(`/api/expenses/${id}`, {
      method: 'DELETE'
    })
    await loadExpenses()
    await loadSummary()
  } catch (error) {
    console.error('Failed to delete expense:', error)
    alert('Failed to delete expense')
  }
}

const previousMonth = () => {
  currentDate.value = new Date(
    currentDate.value.getFullYear(),
    currentDate.value.getMonth() - 1,
    1
  )
  loadExpenses()
  loadSummary()
}

const nextMonth = () => {
  currentDate.value = new Date(
    currentDate.value.getFullYear(),
    currentDate.value.getMonth() + 1,
    1
  )
  loadExpenses()
  loadSummary()
}

onMounted(async () => {
  // Ensure URL has month parameter (if not, set it to current month)
  if (!route.query.month) {
    const year = currentDate.value.getFullYear()
    const month = currentDate.value.getMonth() + 1
    const monthStr = `${year}-${String(month).padStart(2, '0')}`
    router.replace({
      query: { ...route.query, month: monthStr },
    })
  }
  
  await loadPersons()
  await loadExpenses()
  await loadSummary()
})
</script>

