<template>
  <div class="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md mx-auto space-y-6">
      <!-- Study Card (only show if person is selected) -->
      <div v-if="selectedPersonId && studyStats" class="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
        <h2 class="text-xl font-bold mb-4">📚 Start Learning</h2>
        <div class="grid grid-cols-2 gap-4 mb-4">
          <div>
            <div class="text-sm opacity-90">New Words</div>
            <div class="text-2xl font-bold">{{ studyStats.newWords }}</div>
          </div>
          <div>
            <div class="text-sm opacity-90">Due Today</div>
            <div class="text-2xl font-bold">{{ studyStats.dueToday }}</div>
          </div>
        </div>
        <UButton
          to="/study"
          color="primary"
          variant="solid"
          class="w-full bg-white text-blue-600 hover:bg-gray-100"
          size="lg"
        >
          Start Learning
        </UButton>
        <div v-if="studySettings" class="mt-4 text-xs opacity-75">
          Settings: {{ studySettings.new_words_per_day }} new/{{ studySettings.max_reviews_per_day }} review per day
        </div>
      </div>

      <div class="bg-white rounded-lg shadow-md p-6">
        <div class="mb-6">
          <h1 class="text-2xl font-bold text-gray-900 text-center">
            Select Person
          </h1>
        </div>

        <!-- Default persons list -->
        <div class="mb-6">
          <h2 class="text-sm font-medium text-gray-700 mb-3">Default List</h2>
          <div class="space-y-2">
            <button
              v-for="person in defaultPersons"
              :key="person.id"
              @click="selectPerson(person)"
              class="w-full text-left px-4 py-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
            >
              <span class="font-medium text-gray-900">{{ person.name }}</span>
            </button>
          </div>
        </div>

        <!-- Custom persons list -->
        <div v-if="customPersons.length > 0" class="mb-6">
          <h2 class="text-sm font-medium text-gray-700 mb-3">Custom List</h2>
          <div class="space-y-2">
            <button
              v-for="person in customPersons"
              :key="person.id"
              @click="selectPerson(person)"
              class="w-full text-left px-4 py-3 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition-colors"
            >
              <span class="font-medium text-gray-900">{{ person.name }}</span>
            </button>
          </div>
        </div>

        <!-- Add new person -->
        <div class="border-t pt-6">
          <h2 class="text-sm font-medium text-gray-700 mb-3">Add New Person</h2>
          <div class="flex gap-2">
            <UInput
              v-model="newPersonName"
              placeholder="Enter name..."
              class="flex-1"
              @keyup.enter="addPerson"
            />
            <UButton
              @click="addPerson"
              :disabled="!newPersonName.trim() || loading"
              color="primary"
            >
              Add
            </UButton>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Person {
  id: number
  name: string
  created_at: string
}

const router = useRouter()
const { selectedPersonId } = useSelectedPerson()
const newPersonName = ref('')
const loading = ref(false)
const allPersons = ref<Person[]>([])
const defaultPersonNames = ['Ania', 'Simon', 'Hairy', 'James', 'David']
const studyStats = ref<{ newWords: number; dueToday: number } | null>(null)
const studySettings = ref<{ new_words_per_day: number; max_reviews_per_day: number } | null>(null)

const defaultPersons = computed(() => {
  return allPersons.value.filter(p => defaultPersonNames.includes(p.name))
})

const customPersons = computed(() => {
  return allPersons.value.filter(p => !defaultPersonNames.includes(p.name))
})

const { setSelectedPerson } = useSelectedPerson()

const selectPerson = (person: Person) => {
  setSelectedPerson(person)
  router.push('/calendar')
}

const addPerson = async () => {
  if (!newPersonName.value.trim() || loading.value) return

  loading.value = true
  try {
    const response = await $fetch<Person>('/api/persons', {
      method: 'POST',
      body: { name: newPersonName.value.trim() }
    })
    await loadPersons()
    newPersonName.value = ''
  } catch (error: any) {
    if (error.statusCode === 409) {
      alert('This person already exists')
    } else {
      alert('An error occurred while adding person')
    }
  } finally {
    loading.value = false
  }
}

const loadPersons = async () => {
  try {
    allPersons.value = await $fetch<Person[]>('/api/persons')
  } catch (error) {
    console.error('Failed to load persons:', error)
  }
}

const loadStudyData = async () => {
  if (!selectedPersonId.value) {
    studyStats.value = null
    studySettings.value = null
    return
  }

  try {
    const [stats, settings] = await Promise.all([
      $fetch('/api/study/stats', { query: { userId: selectedPersonId.value } }),
      $fetch('/api/study/settings', { query: { userId: selectedPersonId.value } }),
    ])
    studyStats.value = {
      newWords: stats.newWords,
      dueToday: stats.dueToday,
    }
    studySettings.value = settings
  } catch (error) {
    console.error('Failed to load study data:', error)
  }
}

watch(selectedPersonId, () => {
  loadStudyData()
})

onMounted(async () => {
  await loadPersons()
  await loadStudyData()
})
</script>

