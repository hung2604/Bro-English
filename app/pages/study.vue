<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
    <div class="max-w-4xl mx-auto">
      <!-- Header Stats -->
      <div class="mb-6">
        <h1 class="text-3xl font-bold text-gray-900 mb-4">Study Vocabulary</h1>
        <div v-if="stats" class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div class="bg-white rounded-lg shadow p-4">
            <div class="text-sm text-gray-600">New Words</div>
            <div class="text-2xl font-bold text-blue-600">{{ stats.newWordsCount }}</div>
          </div>
          <div class="bg-white rounded-lg shadow p-4">
            <div class="text-sm text-gray-600">Due Today</div>
            <div class="text-2xl font-bold text-orange-600">{{ stats.reviewWordsCount }}</div>
          </div>
          <div class="bg-white rounded-lg shadow p-4">
            <div class="text-sm text-gray-600">Total</div>
            <div class="text-2xl font-bold text-gray-900">{{ stats.totalCount }}</div>
          </div>
          <div class="bg-white rounded-lg shadow p-4">
            <div class="text-sm text-gray-600">Progress</div>
            <div class="text-2xl font-bold text-green-600">
              {{ currentIndex + 1 }}/{{ words.length }}
            </div>
          </div>
        </div>
      </div>

      <!-- Study Card -->
      <div v-if="loading" class="text-center py-12">
        <div class="text-gray-500">Loading words...</div>
      </div>
      <div v-else-if="words.length === 0" class="text-center py-12">
        <div class="text-gray-500 mb-4">No words to study today! 🎉</div>
        <UButton @click="loadDailyWords" color="primary">Refresh</UButton>
      </div>
      <div v-else-if="currentWord" class="bg-white rounded-lg shadow-lg p-8 mb-6">
        <!-- Word Display -->
        <div class="text-center mb-8">
          <div class="flex items-center justify-center gap-4 mb-4">
            <h2 class="text-4xl font-bold text-gray-900">{{ currentWord.word }}</h2>
            <UButton
              @click="playPronunciation(currentWord.word)"
              variant="ghost"
              color="primary"
              icon="i-heroicons-speaker-wave"
              size="lg"
              title="Pronounce"
            />
          </div>
          <div v-if="showAnswer" class="space-y-4 mt-6">
            <div v-if="currentWord.english_definition" class="text-lg text-gray-700">
              <span class="font-semibold">EN:</span> {{ currentWord.english_definition }}
            </div>
            <div v-if="currentWord.vietnamese_meaning" class="text-lg text-gray-700">
              <span class="font-semibold">VI:</span> {{ currentWord.vietnamese_meaning }}
            </div>
            <div v-if="currentWord.example_sentence" class="text-sm text-gray-600 italic">
              <span class="font-semibold">Example:</span> "{{ currentWord.example_sentence }}"
            </div>
          </div>
          <UButton
            v-else
            @click="showAnswer = true"
            color="primary"
            variant="outline"
            class="mt-4"
          >
            Show Answer
          </UButton>
        </div>

        <!-- Progress Bar -->
        <div class="mb-6">
          <div class="w-full bg-gray-200 rounded-full h-2">
            <div
              class="bg-blue-600 h-2 rounded-full transition-all duration-300"
              :style="{ width: `${((currentIndex + 1) / words.length) * 100}%` }"
            ></div>
          </div>
        </div>

        <!-- Rating Buttons -->
        <div v-if="showAnswer" class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <UButton
            @click="rateWord(1)"
            color="error"
            variant="solid"
            size="lg"
            :disabled="rating"
            class="flex flex-col items-center py-4"
          >
            <span class="text-2xl mb-1">😞</span>
            <span class="text-sm font-semibold">Don't Remember</span>
          </UButton>
          <UButton
            @click="rateWord(2)"
            color="warning"
            variant="solid"
            size="lg"
            :disabled="rating"
            class="flex flex-col items-center py-4"
          >
            <span class="text-2xl mb-1">😕</span>
            <span class="text-sm font-semibold">Hard</span>
          </UButton>
          <UButton
            @click="rateWord(3)"
            color="primary"
            variant="solid"
            size="lg"
            :disabled="rating"
            class="flex flex-col items-center py-4"
          >
            <span class="text-2xl mb-1">😊</span>
            <span class="text-sm font-semibold">Normal</span>
          </UButton>
          <UButton
            @click="rateWord(4)"
            color="success"
            variant="solid"
            size="lg"
            :disabled="rating"
            class="flex flex-col items-center py-4"
          >
            <span class="text-2xl mb-1">😄</span>
            <span class="text-sm font-semibold">Easy</span>
          </UButton>
        </div>
      </div>

      <!-- Settings Panel -->
      <div class="bg-white rounded-lg shadow-md p-6 mb-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-gray-900">Study Settings</h3>
          <UButton
            @click="showSettings = !showSettings"
            variant="ghost"
            :icon="showSettings ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
          />
        </div>
        <div v-if="showSettings" class="space-y-4">
          <UFormField label="New Words Per Day">
            <div class="flex items-center gap-2">
              <UInput
                v-model.number="settingsForm.newWordsPerDay"
                type="number"
                min="1"
                max="100"
                class="w-32"
              />
              <span class="text-sm text-gray-500">
                (Default: {{ defaultNewWordsPerDay }})
              </span>
            </div>
          </UFormField>
          <UFormField label="Max Reviews Per Day">
            <div class="flex items-center gap-2">
              <UInput
                v-model.number="settingsForm.maxReviewsPerDay"
                type="number"
                min="1"
                max="500"
                class="w-32"
              />
              <span class="text-sm text-gray-500">
                (Default: {{ defaultMaxReviewsPerDay }})
              </span>
            </div>
          </UFormField>
          <div class="flex gap-2">
            <UButton
              @click="saveSettings"
              color="primary"
              :disabled="savingSettings"
            >
              {{ savingSettings ? 'Saving...' : 'Save Settings' }}
            </UButton>
            <UButton
              @click="resetSettings"
              variant="outline"
              color="neutral"
            >
              Reset to Default
            </UButton>
          </div>
        </div>
      </div>

      <!-- Stats Section -->
      <div v-if="studyStats" class="bg-white rounded-lg shadow-md p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Your Progress</h3>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div class="text-gray-600">Studied Words</div>
            <div class="text-xl font-bold text-gray-900">{{ studyStats.studiedWords }}</div>
          </div>
          <div>
            <div class="text-gray-600">Mastered</div>
            <div class="text-xl font-bold text-green-600">{{ studyStats.masteredWords }}</div>
          </div>
          <div>
            <div class="text-gray-600">Total Reviews</div>
            <div class="text-xl font-bold text-blue-600">{{ studyStats.totalReviews }}</div>
          </div>
          <div>
            <div class="text-gray-600">Avg Ease</div>
            <div class="text-xl font-bold text-purple-600">
              {{ studyStats.averageEaseFactor || 'N/A' }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { selectedPersonId } = useSelectedPerson()
const router = useRouter()

interface Word {
  id?: number
  vocabulary_id?: number
  word: string
  english_definition?: string
  vietnamese_meaning?: string
  example_sentence?: string
  class_date?: string
  study_type?: 'new' | 'review'
  days_since_last_review?: number
}

interface DailyWordsResponse {
  words: Word[]
  stats: {
    newWordsCount: number
    reviewWordsCount: number
    totalCount: number
  }
}

interface StudySettings {
  id: number
  person_id: number
  new_words_per_day: number
  max_reviews_per_day: number
  defaultNewWordsPerDay?: number
  defaultMaxReviewsPerDay?: number
}

interface StudyStats {
  totalVocabulary: number
  studiedWords: number
  newWords: number
  dueToday: number
  totalReviews: number
  reviewsToday: number
  averageEaseFactor: number | null
  masteredWords: number
}

const words = ref<Word[]>([])
const currentIndex = ref(0)
const showAnswer = ref(false)
const loading = ref(false)
const rating = ref(false)
const showSettings = ref(false)
const savingSettings = ref(false)
const stats = ref<DailyWordsResponse['stats'] | null>(null)
const studyStats = ref<StudyStats | null>(null)
const settings = ref<StudySettings | null>(null)
const defaultNewWordsPerDay = 10
const defaultMaxReviewsPerDay = 50

const settingsForm = ref({
  newWordsPerDay: defaultNewWordsPerDay,
  maxReviewsPerDay: defaultMaxReviewsPerDay,
})

const currentWord = computed(() => {
  return words.value[currentIndex.value] || null
})

const playPronunciation = (word: string) => {
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(word)
    utterance.lang = 'en-US'
    utterance.rate = 0.9
    speechSynthesis.speak(utterance)
  }
}

const loadSettings = async () => {
  if (!selectedPersonId.value) return

  try {
    settings.value = await $fetch<StudySettings>('/api/study/settings', {
      query: { userId: selectedPersonId.value },
    })
    settingsForm.value = {
      newWordsPerDay: settings.value.new_words_per_day,
      maxReviewsPerDay: settings.value.max_reviews_per_day,
    }
  } catch (error) {
    console.error('Failed to load settings:', error)
  }
}

const saveSettings = async () => {
  if (!selectedPersonId.value) return

  savingSettings.value = true
  try {
    await $fetch('/api/study/settings', {
      method: 'PUT',
      body: {
        userId: selectedPersonId.value,
        newWordsPerDay: settingsForm.value.newWordsPerDay,
        maxReviewsPerDay: settingsForm.value.maxReviewsPerDay,
      },
    })
    await loadSettings()
    await loadDailyWords()
  } catch (error) {
    console.error('Failed to save settings:', error)
    alert('Failed to save settings')
  } finally {
    savingSettings.value = false
  }
}

const resetSettings = () => {
  settingsForm.value = {
    newWordsPerDay: defaultNewWordsPerDay,
    maxReviewsPerDay: defaultMaxReviewsPerDay,
  }
}

const loadDailyWords = async () => {
  if (!selectedPersonId.value) return

  loading.value = true
  try {
    const response = await $fetch<DailyWordsResponse>('/api/study/daily-words', {
      query: { userId: selectedPersonId.value },
    })
    words.value = response.words
    stats.value = response.stats
    currentIndex.value = 0
    showAnswer.value = false
  } catch (error) {
    console.error('Failed to load daily words:', error)
  } finally {
    loading.value = false
  }
}

const loadStudyStats = async () => {
  if (!selectedPersonId.value) return

  try {
    studyStats.value = await $fetch<StudyStats>('/api/study/stats', {
      query: { userId: selectedPersonId.value },
    })
  } catch (error) {
    console.error('Failed to load study stats:', error)
  }
}

const rateWord = async (ratingValue: 1 | 2 | 3 | 4) => {
  if (!selectedPersonId.value || !currentWord.value || rating.value) return

  rating.value = true
  try {
    const vocabId = currentWord.value.vocabulary_id || currentWord.value.id
    if (!vocabId) return

    await $fetch('/api/study/review', {
      method: 'POST',
      body: {
        userId: selectedPersonId.value,
        vocabularyId: vocabId,
        rating: ratingValue,
      },
    })

    // Move to next word
    if (currentIndex.value < words.value.length - 1) {
      currentIndex.value++
      showAnswer.value = false
    } else {
      // Finished all words
      await loadDailyWords()
      await loadStudyStats()
    }
  } catch (error) {
    console.error('Failed to rate word:', error)
    alert('Failed to save rating')
  } finally {
    rating.value = false
  }
}

onMounted(async () => {
  if (!selectedPersonId.value) {
    router.push('/')
    return
  }

  await loadSettings()
  await loadDailyWords()
  await loadStudyStats()
})
</script>

