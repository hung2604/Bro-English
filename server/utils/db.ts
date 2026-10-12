import { MongoClient, type Db, type Collection, type Document } from 'mongodb'

const uri = process.env.MONGODB_URI || ''
const DB_NAME = 'broenglish'

if (!uri) {
  console.error('Missing MongoDB environment variable!')
  console.error('MONGODB_URI:', 'MISSING')
  throw new Error('Missing MongoDB environment variable: MONGODB_URI')
}

declare global {
  // eslint-disable-next-line no-var
  var __mongoClientPromise: Promise<MongoClient> | undefined
  // eslint-disable-next-line no-var
  var __mongoIndexesEnsured: boolean | undefined
  // eslint-disable-next-line no-var
  var __mongoSeedStarted: boolean | undefined
}

function getClientPromise(): Promise<MongoClient> {
  if (!globalThis.__mongoClientPromise) {
    const client = new MongoClient(uri)
    globalThis.__mongoClientPromise = client.connect()
  }
  return globalThis.__mongoClientPromise
}

export async function getDb(): Promise<Db> {
  const client = await getClientPromise()
  const db = client.db(DB_NAME)
  await ensureIndexes(db)
  return db
}

export async function col<T extends Document = Document>(name: string): Promise<Collection<T>> {
  const db = await getDb()
  return db.collection<T>(name)
}

export async function nextId(collectionName: string): Promise<number> {
  const db = await getDb()
  const result = await db.collection('counters').findOneAndUpdate(
    { _id: collectionName as any },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' },
  )
  return result?.seq ?? 1
}

async function ensureIndexes(db: Db) {
  if (globalThis.__mongoIndexesEnsured) return
  globalThis.__mongoIndexesEnsured = true

  await Promise.all([
    db.collection('persons').createIndex({ name: 1 }, { unique: true }),
    db.collection('persons').createIndex({ id: 1 }, { unique: true }),
    db.collection('class_sessions').createIndex({ date: 1 }, { unique: true }),
    db.collection('class_sessions').createIndex({ id: 1 }, { unique: true }),
    db.collection('session_history').createIndex({ id: 1 }, { unique: true }),
    db.collection('session_history').createIndex({ user_id: 1, date: 1 }),
    db.collection('expenses').createIndex({ id: 1 }, { unique: true }),
    db.collection('expenses').createIndex({ date: 1 }),
    db.collection('expense_participants').createIndex({ id: 1 }, { unique: true }),
    db.collection('expense_participants').createIndex(
      { expense_id: 1, person_id: 1 },
      { unique: true },
    ),
    db.collection('vocabulary').createIndex({ id: 1 }, { unique: true }),
    db.collection('vocabulary').createIndex({ class_date: 1 }),
    db.collection('vocabulary').createIndex({ created_by: 1 }),
    db.collection('vocabulary_meanings').createIndex({ id: 1 }, { unique: true }),
    db.collection('vocabulary_meanings').createIndex({ vocabulary_id: 1 }),
    db.collection('vocabulary_study').createIndex({ id: 1 }, { unique: true }),
    db.collection('vocabulary_study').createIndex(
      { person_id: 1, vocabulary_id: 1 },
      { unique: true },
    ),
    db.collection('vocabulary_study').createIndex({ next_review_date: 1 }),
    db.collection('vocabulary_reviews').createIndex({ id: 1 }, { unique: true }),
    db.collection('vocabulary_reviews').createIndex({ vocabulary_study_id: 1 }),
    db.collection('vocabulary_reviews').createIndex({ person_id: 1 }),
    db.collection('user_study_settings').createIndex({ id: 1 }, { unique: true }),
    db.collection('user_study_settings').createIndex({ person_id: 1 }, { unique: true }),
    db.collection('agent_settings').createIndex({ key: 1 }, { unique: true }),
    db.collection('agent_threads').createIndex({ thread_id: 1 }, { unique: true }),
    db.collection('agent_messages').createIndex({ id: 1 }, { unique: true }),
    db.collection('agent_messages').createIndex({ external_id: 1 }, { unique: true }),
    db.collection('agent_messages').createIndex({ thread_id: 1, id: 1 }),
    db.collection('agent_runs').createIndex({ id: 1 }, { unique: true }),
  ])
}

async function initializeDefaultPersons() {
  if (globalThis.__mongoSeedStarted) return
  globalThis.__mongoSeedStarted = true

  try {
    const persons = await col('persons')
    const count = await persons.countDocuments()
    if (count > 0) return

    const defaultPersons = ['Ania', 'Simon', 'Hairy', 'James', 'David']
    const teachers = ['Seb', 'Charlotte']
    const now = new Date().toISOString()

    for (const name of [...defaultPersons, ...teachers]) {
      const id = await nextId('persons')
      await persons.insertOne({
        id,
        name,
        created_at: now,
      } as any)
    }
  } catch (error) {
    console.warn('Failed to seed default persons:', error)
  }
}

initializeDefaultPersons().catch(console.error)
