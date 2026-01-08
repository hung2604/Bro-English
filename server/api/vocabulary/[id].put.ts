import { supabase } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)
  const { word, meanings } = body

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

    // Update vocabulary word if provided
    if (word) {
      const { error: updateError } = await supabase
        .from('vocabulary')
        .update({
          word: word.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', parseInt(id))

      if (updateError) throw updateError
    }

    // Update meanings if provided
    if (meanings && Array.isArray(meanings)) {
      // Delete all existing meanings
      const { error: deleteError } = await supabase
        .from('vocabulary_meanings')
        .delete()
        .eq('vocabulary_id', parseInt(id))

      if (deleteError) throw deleteError

      // Insert new meanings
      const meaningsToInsert = meanings
        .filter((m: any) => m.wordType && m.wordType.trim())
        .map((m: any) => ({
          vocabulary_id: parseInt(id),
          word_type: m.wordType.trim(),
          english_definition: m.englishDefinition?.trim() || null,
          vietnamese_meaning: m.vietnameseMeaning?.trim() || null,
          example_sentence: m.exampleSentence?.trim() || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }))

      if (meaningsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('vocabulary_meanings')
          .insert(meaningsToInsert)

        if (insertError) throw insertError
      }
    }

    // Fetch updated vocabulary with meanings
    const { data: vocabulary, error: vocabError } = await supabase
      .from('vocabulary')
      .select(`
        *,
        persons!vocabulary_created_by_fkey(name)
      `)
      .eq('id', parseInt(id))
      .single()

    if (vocabError) throw vocabError

    // Fetch meanings
    const { data: vocabularyMeanings, error: meaningsError } = await supabase
      .from('vocabulary_meanings')
      .select('*')
      .eq('vocabulary_id', parseInt(id))
      .order('word_type', { ascending: true })

    if (meaningsError) throw meaningsError

    return {
      ...vocabulary,
      created_by_name: vocabulary.persons?.name || null,
      meanings: vocabularyMeanings || [],
    }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }
    throw createError({
      statusCode: 500,
      message: 'Failed to update vocabulary: ' + (error.message || 'Unknown error')
    })
  }
})
