import { col, nextId } from '../../utils/db'
import { stripId, isDuplicateKey } from '../../utils/mongo-helpers'

/** One person pays someone else's whole bill for a month: the covered person's share and payments count as the payer's. */
export default defineEventHandler(async (event) => {
  const { month, payerId, coveredId } = await readBody(event)
  const payer = Number(payerId)
  const covered = Number(coveredId)

  if (typeof month !== 'string' || !/^\d{4}-\d{2}$/.test(month) || !payer || !covered) {
    throw createError({
      statusCode: 400,
      message: 'month (YYYY-MM), payerId and coveredId are required',
    })
  }
  if (payer === covered) {
    throw createError({
      statusCode: 400,
      message: 'A person cannot pay for themselves',
    })
  }

  try {
    const persons = await col('persons')
    const found = await persons.countDocuments({ id: { $in: [payer, covered] } })
    if (found !== 2) {
      throw createError({
        statusCode: 400,
        message: 'Person not found',
      })
    }

    // No chains: someone whose bill is paid by another cannot pay for others in the same month, and the reverse.
    const merges = await col('bill_merges')
    const existing = await merges.find({ month }).toArray()
    if (existing.some(m => m.covered_id === covered)) {
      throw createError({
        statusCode: 409,
        message: 'This person\'s bill is already paid by someone this month',
      })
    }
    if (existing.some(m => m.payer_id === covered)) {
      throw createError({
        statusCode: 409,
        message: 'This person already pays for someone else this month',
      })
    }
    if (existing.some(m => m.covered_id === payer)) {
      throw createError({
        statusCode: 409,
        message: 'The payer\'s own bill is already paid by someone this month',
      })
    }

    const doc = {
      id: await nextId('bill_merges'),
      month,
      payer_id: payer,
      covered_id: covered,
      created_at: new Date().toISOString(),
    }
    await merges.insertOne(doc as any)
    return stripId(doc as any)
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }
    if (isDuplicateKey(error)) {
      throw createError({
        statusCode: 409,
        message: 'This person\'s bill is already paid by someone this month',
      })
    }
    console.error('Error in bill-merges/index.post:', error)
    throw createError({
      statusCode: 500,
      message: 'Failed to merge bill',
    })
  }
})
