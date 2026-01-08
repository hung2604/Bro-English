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
                    <!-- Show meanings grouped by word type -->
                    <div v-if="word.meanings && word.meanings.length > 0" class="space-y-3 mb-2">
                      <div
                        v-for="meaning in word.meanings"
                        :key="meaning.id"
                        class="border-l-2 border-blue-300 pl-3 py-1"
                      >
                        <div class="flex items-center gap-2 mb-1">
                          <span class="text-xs font-semibold text-blue-600 uppercase bg-blue-50 px-2 py-0.5 rounded">
                            {{ meaning.word_type }}
                          </span>
                        </div>
                        <div v-if="meaning.english_definition" class="text-sm text-gray-700 mb-1">
                          <span class="font-semibold">EN:</span> {{ meaning.english_definition }}
                        </div>
                        <div v-if="meaning.vietnamese_meaning" class="text-sm text-gray-700 mb-1">
                          <span class="font-semibold">VI:</span> {{ meaning.vietnamese_meaning }}
                        </div>
                        <div v-if="meaning.example_sentence" class="text-sm text-gray-600 italic">
                          <span class="font-semibold">Example:</span> "{{ meaning.example_sentence }}"
                        </div>
                      </div>
                    </div>
                    <!-- Fallback to old format if no meanings -->
                    <template v-else>
                      <div v-if="word.english_definition" class="text-sm text-gray-700 mb-2">
                        <span class="font-semibold">EN:</span> {{ word.english_definition }}
                      </div>
                      <div v-if="word.vietnamese_meaning" class="text-sm text-gray-700 mb-2">
                        <span class="font-semibold">VI:</span> {{ word.vietnamese_meaning }}
                      </div>
                      <div v-if="word.example_sentence" class="text-sm text-gray-600 italic mb-2">
                        <span class="font-semibold">Example:</span> "{{ word.example_sentence }}"
                      </div>
                    </template>
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
            <div class="flex gap-2">
              <UInput
                v-model="newWord.word"
                placeholder="Enter English word"
                :disabled="!isSeb && !editingWord || loadingAI"
                class="flex-1"
              />
              <UButton
                @click="getMeaningsFromAI"
                :disabled="!newWord.word.trim() || loadingAI"
                :loading="loadingAI"
                color="primary"
                variant="solid"
                icon="i-heroicons-sparkles"
                title="Get meanings from AI"
              >
                {{ loadingAI ? 'Loading...' : 'AI' }}
              </UButton>
            </div>
            <p v-if="loadingAI" class="text-xs text-gray-500 mt-1">
              AI is analyzing the word and generating meanings...
            </p>
          </UFormField>

          <!-- Meanings Section -->
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <label class="text-sm font-medium text-gray-700">Meanings (by Word Type)</label>
              <UButton
                @click="addMeaning"
                variant="ghost"
                color="primary"
                size="sm"
                icon="i-heroicons-plus"
              >
                Add Meaning
              </UButton>
            </div>

            <div v-if="newWord.meanings.length === 0" class="text-sm text-gray-500 bg-gray-50 p-3 rounded">
              No meanings added yet. Click "Add Meaning" to add a word type and its meaning.
            </div>

            <div
              v-for="(meaning, index) in newWord.meanings"
              :key="index"
              class="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50"
            >
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm font-semibold text-gray-700">Meaning {{ index + 1 }}</span>
                <UButton
                  @click="removeMeaning(index)"
                  variant="ghost"
                  color="error"
                  size="xs"
                  icon="i-heroicons-trash"
                >
                  Remove
                </UButton>
              </div>

              <UFormField label="Word Type" required>
                <USelect
                  v-model="meaning.wordType"
                  :items="wordTypes"
                  value-key="value"
                  option-attribute="label"
                  placeholder="Select word type"
                  class="w-full"
                />
              </UFormField>

              <UFormField label="English Definition">
                <UTextarea
                  v-model="meaning.englishDefinition"
                  placeholder="Enter English definition"
                  :disabled="!isSeb && !editingWord"
                  class="w-full"
                  :rows="2"
                />
              </UFormField>

              <UFormField label="Vietnamese Meaning">
                <UTextarea
                  v-model="meaning.vietnameseMeaning"
                  placeholder="Enter Vietnamese meaning"
                  class="w-full"
                  :rows="2"
                />
              </UFormField>

              <UFormField label="Example Sentence">
                <UTextarea
                  v-model="meaning.exampleSentence"
                  placeholder="Enter example sentence"
                  class="w-full"
                  :rows="2"
                />
              </UFormField>
            </div>
          </div>

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

interface VocabularyMeaning {
  id: number
  vocabulary_id: number
  word_type: string
  english_definition: string | null
  vietnamese_meaning: string | null
  example_sentence: string | null
  created_at: string
  updated_at: string
}

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
  meanings?: VocabularyMeaning[]
}

const currentDate = ref(new Date())
const vocabulary = ref<Vocabulary[]>([])
const loading = ref(false)
const saving = ref(false)
const loadingAI = ref(false)
const showAddModal = ref(false)
const editingWord = ref<Vocabulary | null>(null)
const allPersons = ref<Array<{ id: number; name: string }>>([])

interface WordMeaning {
  wordType: string
  englishDefinition: string
  vietnameseMeaning: string
  exampleSentence: string
}

const newWord = ref({
  word: '',
  meanings: [] as WordMeaning[],
  classDate: new Date().toISOString().split('T')[0]
})

const wordTypes = [
  { label: 'Noun (Danh từ)', value: 'noun' },
  { label: 'Verb (Động từ)', value: 'verb' },
  { label: 'Adjective (Tính từ)', value: 'adjective' },
  { label: 'Adverb (Trạng từ)', value: 'adverb' },
  { label: 'Pronoun (Đại từ)', value: 'pronoun' },
  { label: 'Preposition (Giới từ)', value: 'preposition' },
  { label: 'Conjunction (Liên từ)', value: 'conjunction' },
  { label: 'Interjection (Thán từ)', value: 'interjection' },
  { label: 'Article (Mạo từ)', value: 'article' },
  { label: 'Determiner (Từ hạn định)', value: 'determiner' },
  { label: 'Modal Verb (Động từ khuyết thiếu)', value: 'modal_verb' },
  { label: 'Auxiliary Verb (Trợ động từ)', value: 'auxiliary_verb' },
  { label: 'Phrasal Verb (Cụm động từ)', value: 'phrasal_verb' },
  { label: 'Idiom (Thành ngữ)', value: 'idiom' },
  { label: 'Other (Khác)', value: 'other' }
]

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
    // When editing, at least word or one meaning should be filled
    return (
      newWord.value.word.trim() ||
      newWord.value.meanings.some(m => 
        m.englishDefinition.trim() || 
        m.vietnameseMeaning.trim() || 
        m.exampleSentence.trim()
      )
    )
  } else {
    // When adding new word, Seb must provide word and at least one meaning
    if (isSeb.value) {
      return (
        newWord.value.word.trim() && 
        newWord.value.classDate &&
        newWord.value.meanings.length > 0 &&
        newWord.value.meanings.some(m => m.wordType.trim())
      )
    } else {
      // Others can only add meaning/sentence to existing words (handled differently)
      return false
    }
  }
})

const addMeaning = () => {
  newWord.value.meanings.push({
    wordType: '',
    englishDefinition: '',
    vietnameseMeaning: '',
    exampleSentence: ''
  })
}

const removeMeaning = (index: number) => {
  newWord.value.meanings.splice(index, 1)
}

const getMeaningsFromAI = async () => {
  if (!newWord.value.word.trim()) {
    alert('Please enter a word first')
    return
  }

  loadingAI.value = true
  try {
    const response = await $fetch<{ meanings: WordMeaning[] }>('/api/vocabulary/ai-meanings', {
      method: 'POST',
      body: {
        word: newWord.value.word.trim()
      }
    })

    if (response.meanings && response.meanings.length > 0) {
      // Clear existing meanings and add AI-generated ones
      newWord.value.meanings = response.meanings.map(m => ({
        wordType: m.wordType || '',
        englishDefinition: m.englishDefinition || '',
        vietnameseMeaning: m.vietnameseMeaning || '',
        exampleSentence: m.exampleSentence || ''
      }))
    } else {
      alert('No meanings found. Please add manually.')
    }
  } catch (error: any) {
    console.error('Failed to get meanings from AI:', error)
    alert('Failed to get meanings from AI: ' + (error.message || 'Unknown error'))
  } finally {
    loadingAI.value = false
  }
}

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

const editWord = async (word: Vocabulary) => {
  editingWord.value = word
  
  // Load meanings for this word
  let meanings: VocabularyMeaning[] = []
  if (word.meanings && word.meanings.length > 0) {
    meanings = word.meanings
  } else {
    // Try to load meanings from API
    try {
      const loadedMeanings = await $fetch<VocabularyMeaning[]>(`/api/vocabulary/${word.id}/meanings`)
      meanings = loadedMeanings || []
    } catch (error) {
      console.error('Failed to load meanings:', error)
      // If no meanings exist, create one from old format
      if (word.english_definition || word.vietnamese_meaning || word.example_sentence) {
        meanings = [{
          id: 0,
          vocabulary_id: word.id,
          word_type: 'general',
          english_definition: word.english_definition,
          vietnamese_meaning: word.vietnamese_meaning,
          example_sentence: word.example_sentence,
          created_at: '',
          updated_at: ''
        }]
      }
    }
  }
  
  newWord.value = {
    word: word.word,
    meanings: meanings.map(m => ({
      wordType: m.word_type,
      englishDefinition: m.english_definition || '',
      vietnameseMeaning: m.vietnamese_meaning || '',
      exampleSentence: m.example_sentence || ''
    })),
    classDate: word.class_date
  }
  
  // If no meanings, add one empty meaning
  if (newWord.value.meanings.length === 0) {
    addMeaning()
  }
  
  showAddModal.value = true
}

const saveWord = async () => {
  if (!canSaveWord.value || !selectedPersonId.value) return

  saving.value = true
  try {
    if (editingWord.value) {
      // Update existing word and meanings
      await $fetch(`/api/vocabulary/${editingWord.value.id}`, {
        method: 'PUT',
        body: {
          word: newWord.value.word,
          meanings: newWord.value.meanings.filter(m => m.wordType.trim())
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
          meanings: newWord.value.meanings.filter(m => m.wordType.trim()),
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
    meanings: [],
    classDate: new Date().toISOString().split('T')[0]
  }
  // Add one empty meaning by default
  addMeaning()
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

