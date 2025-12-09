<template>
  <UApp>
    <NuxtRouteAnnouncer />
    <!-- Global Header - Hide on home page -->
    <header
      v-if="showHeader"
      class="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm"
    >
      <div class="max-w-7xl mx-auto">
        <div class="flex items-center justify-between h-16">
          <div class="flex items-center gap-4">
            <NuxtLink
              to="/"
              class="text-xl font-bold text-gray-900"
            >
              Bro English
            </NuxtLink>
            <div class="flex items-center gap-2">
              <span class="text-sm text-gray-600">Person:</span>
              <USelect
                :model-value="selectedPersonId ?? undefined"
                :items="personOptions"
                value-key="value"
                placeholder="Select person"
                class="w-48"
                @update:model-value="handlePersonChange"
              />
            </div>
          </div>
          <nav class="flex items-center gap-2">
            <UButton
              v-if="selectedPersonId"
              to="/study"
              variant="ghost"
              color="neutral"
            >
              🎓 Study
            </UButton>
            <UButton
              v-if="selectedPersonId"
              to="/calendar"
              variant="ghost"
              color="neutral"
            >
              📅 Calendar
            </UButton>
            <UButton
              v-if="selectedPersonId"
              to="/vocabulary"
              variant="ghost"
              color="neutral"
            >
              📚 Vocabulary
            </UButton>
            <UButton
              v-if="selectedPersonId"
              to="/expenses"
              variant="ghost"
              color="neutral"
            >
              💰 Expenses
            </UButton>
          </nav>
        </div>
      </div>
    </header>
    <NuxtPage />
  </UApp>
</template>

<script setup lang="ts">
const route = useRoute()
const { selectedPersonId, setSelectedPerson, loadSelectedPerson } = useSelectedPerson()
const router = useRouter()
const allPersons = ref<Array<{ id: number; name: string }>>([])

// Hide header on home page
const showHeader = computed(() => route.path !== '/')

const personOptions = computed(() => {
  return allPersons.value.map(p => ({
    label: p.name,
    value: p.id
  }))
})

const handlePersonChange = (personId: number | null) => {
  if (personId) {
    const person = allPersons.value.find(p => p.id === personId)
    if (person) {
      setSelectedPerson(person)
      // Navigate to calendar if on a calendar page, otherwise stay on current page
      const route = useRoute()
      if (route.path.startsWith('/calendar')) {
        router.push('/calendar')
      }
    }
  }
  else {
    setSelectedPerson(null)
    // Redirect to home if on protected pages
    const route = useRoute()
    if (route.path.startsWith('/calendar') || route.path.startsWith('/expenses')) {
      router.push('/')
    }
  }
}

const loadPersons = async () => {
  try {
    allPersons.value = await $fetch<Array<{ id: number; name: string }>>('/api/persons')
    await loadSelectedPerson()
  }
  catch (error) {
    console.error('Failed to load persons:', error)
  }
}

onMounted(() => {
  loadPersons()
})
</script>
