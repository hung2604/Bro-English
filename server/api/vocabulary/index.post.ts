import { supabase } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { word, meanings, classDate, userId } = body

  if (!word || !classDate || !userId) {
    throw createError({
      statusCode: 400,
      message: 'Word, class date, and user ID are required'
    })
  }

  if (!meanings || !Array.isArray(meanings) || meanings.length === 0) {
    throw createError({
      statusCode: 400,
      message: 'At least one meaning is required'
    })
  }

  try {
    // Check if user is Seb (teacher)
    const { data: user } = await supabase
      .from('persons')
      .select('name')
      .eq('id', parseInt(userId))
      .single()

    // Insert vocabulary (without old definition fields)
    const { data: vocabulary, error: insertError } = await supabase
      .from('vocabulary')
      .insert({
        word: word.trim(),
        english_definition: null,
        vietnamese_meaning: null,
        example_sentence: null,
        class_date: classDate,
        created_by: parseInt(userId),
        updated_at: new Date().toISOString(),
      })
      .select(`
        *,
        persons!vocabulary_created_by_fkey(name)
      `)
      .single()

    if (insertError) throw insertError

    // Insert meanings
    const meaningsToInsert = meanings
      .filter((m: any) => m.wordType && m.wordType.trim())
      .map((m: any) => ({
        vocabulary_id: vocabulary.id,
        word_type: m.wordType.trim(),
        english_definition: m.englishDefinition?.trim() || null,
        vietnamese_meaning: m.vietnameseMeaning?.trim() || null,
        example_sentence: m.exampleSentence?.trim() || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }))

    if (meaningsToInsert.length > 0) {
      const { error: meaningsError } = await supabase
        .from('vocabulary_meanings')
        .insert(meaningsToInsert)

      if (meaningsError) throw meaningsError
    }

    // Fetch vocabulary with meanings
    const { data: vocabularyWithMeanings, error: fetchError } = await supabase
      .from('vocabulary_meanings')
      .select('*')
      .eq('vocabulary_id', vocabulary.id)

    if (fetchError) throw fetchError

    return {
      ...vocabulary,
      created_by_name: vocabulary.persons?.name || null,
      meanings: vocabularyWithMeanings || [],
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: 'Failed to create vocabulary: ' + (error.message || 'Unknown error')
    })
  }
})
