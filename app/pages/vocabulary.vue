<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
    <div class="max-w-7xl mx-auto">
      <!-- Header -->
      <div class="mb-6">
        <div class="flex items-center justify-between mb-4">
          <h1 class="text-2xl font-bold text-gray-900">Vocabulary Library</h1>
          <UButton
            @click="resetForm(); showAddModal = true"
            color="primary"
          >
            + Add Word
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

      <!-- Vocabulary List -->
      <div class="bg-white rounded-lg shadow-md p-6">
        <div v-if="loading" class="text-center text-gray-500 py-8">
          Loading vocabulary...
        </div>
        <div v-else-if="vocabulary.length === 0" class="text-center text-gray-500 py-8">
          No vocabulary for this month
        </div>
        <div v-else class="space-y-4">
          <!-- Group by date -->
          <div
            v-for="(words, date) in groupedVocabulary"
            :key="date"
            class="border-b border-gray-200 pb-4 last:border-b-0 last:pb-0"
          >
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-lg font-semibold text-gray-900">
                {{ formatDate(date) }}
              </h3>
              <span class="text-sm text-gray-500">
                {{ words.length }} {{ words.length === 1 ? 'word' : 'words' }}
              </span>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div
                v-for="word in words"
                :key="word.id"
                class="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div class="flex items-start justify-between mb-2">
                  <div class="flex-1">
                    <div class="flex items-center gap-2 mb-2">
                      <h4 class="text-lg font-bold text-blue-600">{{ word.word }}</h4>
                      <UButton
                        @click="playPronunciation(word.word)"
                        variant="ghost"
                        color="primary"
                        icon="i-heroicons-speaker-wave"
                        size="xs"
                        title="Pronounce"
                      />
                    </div>
                    <div v-if="word.english_definition" class="text-sm text-gray-700 mb-2">
                      <span class="font-semibold">EN:</span> {{ word.english_definition }}
                    </div>
                    <div v-if="word.vietnamese_meaning" class="text-sm text-gray-700 mb-2">
                      <span class="font-semibold">VI:</span> {{ word.vietnamese_meaning }}
                    </div>
                    <div v-if="word.example_sentence" class="text-sm text-gray-600 italic mb-2">
                      <span class="font-semibold">Example:</span> "{{ word.example_sentence }}"
                    </div>
                    <div class="text-xs text-gray-500">
                      Added by: {{ word.created_by_name }}
                    </div>
                  </div>
                  <div class="flex items-center gap-1">
                    <UButton
                      @click="editWord(word)"
                      variant="ghost"
                      color="neutral"
                      icon="i-heroicons-pencil"
                      size="sm"
                    />
                    <UButton
                      @click="deleteWord(word.id)"
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
      </div>
    </div>

    <!-- Add/Edit Word Modal -->
    <UModal v-model:open="showAddModal" :title="editingWord ? 'Edit Word' : 'Add New Word'">
      <template #body>
        <div class="space-y-4">
          <UFormField label="Word (English)" required>
            <UInput
              v-model="newWord.word"
              placeholder="Enter English word"
              :disabled="!isSeb && !editingWord"
              class="w-full"
            />
          </UFormField>
          <UFormField label="English Definition">
            <UTextarea
              v-model="newWord.englishDefinition"
              placeholder="Enter English definition"
              :disabled="!isSeb && !editingWord"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Vietnamese Meaning">
            <UTextarea
              v-model="newWord.vietnameseMeaning"
              placeholder="Enter Vietnamese meaning"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Example Sentence">
            <UTextarea
              v-model="newWord.exampleSentence"
              placeholder="Enter example sentence"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Class Date" required>
            <UInput
              v-model="newWord.classDate"
              type="date"
              required
              class="w-full"
            />
          </UFormField>
          <div v-if="!isSeb && !editingWord" class="text-sm text-gray-500 bg-blue-50 p-3 rounded">
            <strong>Note:</strong> Only Seb can add new words. You can add Vietnamese meaning and example sentences to existing words.
          </div>
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
            @click="saveWord"
            color="primary"
            :disabled="!canSaveWord || saving"
          >
            {{ saving ? (editingWord ? 'Updating...' : 'Adding...') : (editingWord ? 'Update' : 'Add') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
const { selectedPersonId, selectedPerson } = useSelectedPerson()
const router = useRouter()

interface Vocabulary {
  id: number
  word: string
  english_definition: string | null
  vietnamese_meaning: string | null
  example_sentence: string | null
  class_date: string
  created_by: number
  created_by_name: string
  created_at: string
  updated_at: string
}

const currentDate = ref(new Date())
const vocabulary = ref<Vocabulary[]>([])
const loading = ref(false)
const saving = ref(false)
const showAddModal = ref(false)
const editingWord = ref<Vocabulary | null>(null)
const allPersons = ref<Array<{ id: number; name: string }>>([])

const newWord = ref({
  word: '',
  englishDefinition: '',
  vietnameseMeaning: '',
  exampleSentence: '',
  classDate: new Date().toISOString().split('T')[0]
})

const isSeb = computed(() => {
  return selectedPerson.value?.name === 'Seb'
})

const currentMonthYear = computed(() => {
  return currentDate.value.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  })
})

const canSaveWord = computed(() => {
  if (editingWord.value) {
    // When editing, at least one field should be filled
    return (
      newWord.value.word.trim() ||
      newWord.value.englishDefinition.trim() ||
      newWord.value.vietnameseMeaning.trim() ||
      newWord.value.exampleSentence.trim()
    )
  } else {
    // When adding new word, Seb must provide word
    if (isSeb.value) {
      return newWord.value.word.trim() && newWord.value.classDate
    } else {
      // Others can only add meaning/sentence to existing words (handled differently)
      return false
    }
  }
})

const groupedVocabulary = computed(() => {
  const grouped: Record<string, Vocabulary[]> = {}
  vocabulary.value.forEach(word => {
    const date = word.class_date
    if (!grouped[date]) {
      grouped[date] = []
    }
    grouped[date]!.push(word)
  })
  // Sort dates descending
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))
  const result: Record<string, Vocabulary[]> = {}
  sortedDates.forEach(date => {
    result[date] = grouped[date] || []
  })
  return result
})

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    weekday: 'short'
  })
}

const playPronunciation = (word: string) => {
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(word)
    utterance.lang = 'en-US'
    utterance.rate = 0.9
    speechSynthesis.speak(utterance)
  } else {
    alert('Speech synthesis is not supported in your browser')
  }
}

const loadPersons = async () => {
  try {
    allPersons.value = await $fetch<Array<{ id: number; name: string }>>('/api/persons')
  } catch (error) {
    console.error('Failed to load persons:', error)
  }
}

const loadVocabulary = async () => {
  loading.value = true
  try {
    const year = currentDate.value.getFullYear()
    const month = currentDate.value.getMonth() + 1
    vocabulary.value = await $fetch<Vocabulary[]>('/api/vocabulary', {
      query: { year, month }
    })
  } catch (error) {
    console.error('Failed to load vocabulary:', error)
  } finally {
    loading.value = false
  }
}

const editWord = (word: Vocabulary) => {
  editingWord.value = word
  newWord.value = {
    word: word.word,
    englishDefinition: word.english_definition || '',
    vietnameseMeaning: word.vietnamese_meaning || '',
    exampleSentence: word.example_sentence || '',
    classDate: word.class_date
  }
  showAddModal.value = true
}

const saveWord = async () => {
  if (!canSaveWord.value || !selectedPersonId.value) return

  saving.value = true
  try {
    if (editingWord.value) {
      // Update existing word
      await $fetch(`/api/vocabulary/${editingWord.value.id}`, {
        method: 'PUT',
        body: {
          word: newWord.value.word,
          englishDefinition: newWord.value.englishDefinition,
          vietnameseMeaning: newWord.value.vietnameseMeaning,
          exampleSentence: newWord.value.exampleSentence
        }
      })
    } else {
      // Create new word (only Seb can do this)
      if (!isSeb.value) {
        alert('Only Seb can add new words')
        return
      }
      await $fetch('/api/vocabulary', {
        method: 'POST',
        body: {
          word: newWord.value.word,
          englishDefinition: newWord.value.englishDefinition,
          vietnameseMeaning: newWord.value.vietnameseMeaning,
          exampleSentence: newWord.value.exampleSentence,
          classDate: newWord.value.classDate,
          userId: selectedPersonId.value
        }
      })
    }

    resetForm()
    showAddModal.value = false
    await loadVocabulary()
  } catch (error) {
    console.error('Failed to save word:', error)
    alert('Failed to save word')
  } finally {
    saving.value = false
  }
}

const resetForm = () => {
  editingWord.value = null
  newWord.value = {
    word: '',
    englishDefinition: '',
    vietnameseMeaning: '',
    exampleSentence: '',
    classDate: new Date().toISOString().split('T')[0]
  }
}

const deleteWord = async (id: number) => {
  if (!confirm('Are you sure you want to delete this word?')) return

  try {
    await $fetch(`/api/vocabulary/${id}`, {
      method: 'DELETE'
    })
    await loadVocabulary()
  } catch (error) {
    console.error('Failed to delete word:', error)
    alert('Failed to delete word')
  }
}

const previousMonth = () => {
  currentDate.value = new Date(
    currentDate.value.getFullYear(),
    currentDate.value.getMonth() - 1,
    1
  )
  loadVocabulary()
}

const nextMonth = () => {
  currentDate.value = new Date(
    currentDate.value.getFullYear(),
    currentDate.value.getMonth() + 1,
    1
  )
  loadVocabulary()
}

// Check if user is selected, redirect if not
onMounted(async () => {
  await nextTick()
  
  if (selectedPersonId.value) {
    const { loadSelectedPerson } = useSelectedPerson()
    await loadSelectedPerson()
  }
  
  if (!selectedPersonId.value) {
    router.push('/')
    return
  }
  
  await loadPersons()
  await loadVocabulary()
})
</script>

