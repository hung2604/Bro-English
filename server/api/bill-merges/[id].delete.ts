import { col } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const id = Number.parseInt(getRouterParam(event, 'id') || '')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Bill merge ID is required',
    })
  }

  try {
    await (await col('bill_merges')).deleteOne({ id })
    return { success: true }
  } catch {
    throw createError({
      statusCode: 500,
      message: 'Failed to remove bill merge',
    })
  }
})
