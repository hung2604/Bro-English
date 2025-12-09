import db from '../../utils/db'

export default defineEventHandler(async (event) => {
  const persons = db.prepare('SELECT * FROM persons ORDER BY name').all()
  return persons
})

