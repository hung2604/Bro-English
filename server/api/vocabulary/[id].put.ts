import db from '../../utils/db'

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
    const existing = db.prepare('SELECT * FROM vocabulary WHERE id = ?').get(parseInt(id)) as any
    if (!existing) {
      throw createError({
        statusCode: 404,
        message: 'Vocabulary not found'
      })
    }

    // Update vocabulary
    const update = db.prepare(`
      UPDATE vocabulary 
      SET word = ?,
          english_definition = ?,
          vietnamese_meaning = ?,
          example_sentence = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)

    update.run(
      word?.trim() || existing.word,
      englishDefinition?.trim() || existing.english_definition,
      vietnameseMeaning?.trim() || existing.vietnamese_meaning,
      exampleSentence?.trim() || existing.example_sentence,
      parseInt(id)
    )

    // Get updated vocabulary with creator name
    const vocabulary = db.prepare(`
      SELECT v.*, p.name as created_by_name
      FROM vocabulary v
      LEFT JOIN persons p ON v.created_by = p.id
      WHERE v.id = ?
    `).get(parseInt(id)) as any

    return vocabulary
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

