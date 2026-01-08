import { GoogleGenerativeAI } from '@google/generative-ai'

interface MeaningResponse {
  wordType?: string
  word_type?: string
  englishDefinition?: string
  english_definition?: string
  vietnameseMeaning?: string
  vietnamese_meaning?: string
  exampleSentence?: string
  example_sentence?: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { word } = body

  if (!word || !word.trim()) {
    throw createError({
      statusCode: 400,
      message: 'Word is required',
    })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw createError({
      statusCode: 500,
      message: 'Gemini API key is not configured',
    })
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey)

    // Try different model names in order of preference
    const modelNames = ['gemini-1.5-pro', 'gemini-pro', 'gemini-1.5-flash', 'gemini-2.0-flash-exp']
    const prompt = `You are an English vocabulary assistant. For the word "${word.trim()}", provide all possible word types (parts of speech) with their meanings and example sentences.

Return the response as a JSON array. Each item should have:
- wordType: one of: noun, verb, adjective, adverb, pronoun, preposition, conjunction, interjection, article, determiner, modal_verb, auxiliary_verb, phrasal_verb, idiom, other
- englishDefinition: English definition/meaning
- vietnameseMeaning: Vietnamese translation
- exampleSentence: An example sentence using this word in this meaning

Format:
[
  {
    "wordType": "noun",
    "englishDefinition": "...",
    "vietnameseMeaning": "...",
    "exampleSentence": "..."
  },
  {
    "wordType": "verb",
    "englishDefinition": "...",
    "vietnameseMeaning": "...",
    "exampleSentence": "..."
  }
]

Only return valid JSON, no additional text or markdown. Include all common word types for this word.`

    let result = null
    let lastError: Error | null = null

    // Try each model until one works
    for (const modelName of modelNames) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName })
        result = await model.generateContent(prompt)
        break // Success, exit loop
      }
      catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        console.warn(`Model ${modelName} failed, trying next...`, lastError.message)
        continue
      }
    }

    if (!result) {
      throw new Error(`No available model found. Tried: ${modelNames.join(', ')}. Last error: ${lastError?.message || 'Unknown'}`)
    }
    const response = await result.response
    const text = response.text()

    // Parse JSON from response (might have markdown code blocks)
    let jsonText = text.trim()

    // Remove markdown code blocks if present
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }

    // Parse JSON
    const meanings = JSON.parse(jsonText) as MeaningResponse[]

    // Validate and format the response
    if (!Array.isArray(meanings)) {
      throw new TypeError('Invalid response format: expected array')
    }

    // Map to our format
    const formattedMeanings = meanings.map((m: MeaningResponse) => ({
      wordType: m.wordType || m.word_type || 'other',
      englishDefinition: m.englishDefinition || m.english_definition || '',
      vietnameseMeaning: m.vietnameseMeaning || m.vietnamese_meaning || '',
      exampleSentence: m.exampleSentence || m.example_sentence || '',
    }))

    return {
      meanings: formattedMeanings,
    }
  }
  catch (error: unknown) {
    console.error('Gemini API error:', error)

    // If it's a JSON parse error, try to extract JSON from the response
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    if (errorMessage.includes('JSON') || error instanceof SyntaxError) {
      throw createError({
        statusCode: 500,
        message: 'Failed to parse AI response. Please try again.',
      })
    }

    throw createError({
      statusCode: 500,
      message: 'Failed to get meanings from AI: ' + errorMessage,
    })
  }
})
