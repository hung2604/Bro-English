import { supabase } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)
  const { word, englishDefinition, vietnameseMeaning, exampleSentence } = body

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Vocabulary ID is required'
    })
  }

  try {
    // Get existing vocabulary
    const { data: existing, error: fetchError } = await supabase
      .from('vocabulary')
      .select('*')
      .eq('id', parseInt(id))
      .single()

    if (fetchError || !existing) {
      throw createError({
        statusCode: 404,
        message: 'Vocabulary not found'
      })
    }

    // Update vocabulary
    const { data: vocabulary, error: updateError } = await supabase
      .from('vocabulary')
      .update({
        word: word?.trim() || existing.word,
        english_definition: englishDefinition?.trim() || existing.english_definition,
        vietnamese_meaning: vietnameseMeaning?.trim() || existing.vietnamese_meaning,
        example_sentence: exampleSentence?.trim() || existing.example_sentence,
        updated_at: new Date().toISOString(),
      })
      .eq('id', parseInt(id))
      .select(`
        *,
        persons!vocabulary_created_by_fkey(name)
      `)
      .single()

    if (updateError) throw updateError

    return {
      ...vocabulary,
      created_by_name: vocabulary.persons?.name || null,
    }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }
    throw createError({
      statusCode: 500,
      message: 'Failed to update vocabulary'
    })
  }
})
