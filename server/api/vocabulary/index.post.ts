import db from '../../utils/db'

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
    const user = db.prepare('SELECT name FROM persons WHERE id = ?').get(parseInt(userId)) as { name: string } | undefined
    const isSeb = user?.name === 'Seb'

    // Seb can add word + English definition
    // Others can add Vietnamese meaning and example sentence
    // But for simplicity, we'll allow anyone to add, but Seb typically adds new words
    const insert = db.prepare(`
      INSERT INTO vocabulary (word, english_definition, vietnamese_meaning, example_sentence, class_date, created_by, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `)

    const result = insert.run(
      word.trim(),
      englishDefinition?.trim() || null,
      vietnameseMeaning?.trim() || null,
      exampleSentence?.trim() || null,
      classDate,
      parseInt(userId)
    )

    // Get the created vocabulary with creator name
    const vocabulary = db.prepare(`
      SELECT v.*, p.name as created_by_name
      FROM vocabulary v
      LEFT JOIN persons p ON v.created_by = p.id
      WHERE v.id = ?
    `).get(result.lastInsertRowid) as any

    return vocabulary
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: 'Failed to create vocabulary'
    })
  }
})

