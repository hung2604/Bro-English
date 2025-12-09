import { supabase } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { word, englishDefinition, vietnameseMeaning, exampleSentence, classDate, userId } = body

  if (!word || !classDate || !userId) {
    throw createError({
      statusCode: 400,
      message: 'Word, class date, and user ID are required'
    })
  }

  try {
    // Check if user is Seb (teacher)
    const { data: user } = await supabase
      .from('persons')
      .select('name')
      .eq('id', parseInt(userId))
      .single()

    // Insert vocabulary
    const { data: vocabulary, error: insertError } = await supabase
      .from('vocabulary')
      .insert({
        word: word.trim(),
        english_definition: englishDefinition?.trim() || null,
        vietnamese_meaning: vietnameseMeaning?.trim() || null,
        example_sentence: exampleSentence?.trim() || null,
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

    return {
      ...vocabulary,
      created_by_name: vocabulary.persons?.name || null,
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: 'Failed to create vocabulary'
    })
  }
})
