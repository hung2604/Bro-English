#!/usr/bin/env node
/**
 * One-shot: copy all Bro-English tables from Supabase → MongoDB.
 *
 * Requires in .env (or environment):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY)
 *   MONGODB_URI
 *
 * Usage: node scripts/migrate-supabase-to-mongo.mjs
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MongoClient } from 'mongodb'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

function loadEnv() {
  const envPath = resolve(root, '.env')
  if (!existsSync(envPath)) return
  const text = readFileSync(envPath, 'utf8')
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
}

loadEnv()

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
const MONGODB_URI = process.env.MONGODB_URI
const DB_NAME = 'broenglish'

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
if (!MONGODB_URI) {
  console.error('Missing MONGODB_URI')
  process.exit(1)
}

const TABLES = [
  'persons',
  'class_sessions',
  'expenses',
  'vocabulary',
  'user_study_settings',
  'session_history',
  'expense_participants',
  'vocabulary_meanings',
  'vocabulary_study',
  'vocabulary_reviews',
]

async function fetchTable(table) {
  const rows = []
  const pageSize = 1000
  let offset = 0

  while (true) {
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=*&order=id.asc&limit=${pageSize}&offset=${offset}`
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Prefer: 'count=exact',
      },
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Failed to fetch ${table}: ${res.status} ${body}`)
    }

    const batch = await res.json()
    rows.push(...batch)

    if (batch.length < pageSize) break
    offset += pageSize
  }

  return rows
}

async function main() {
  console.log('Connecting to MongoDB...')
  const client = new MongoClient(MONGODB_URI)
  await client.connect()
  const db = client.db(DB_NAME)

  console.log(`Database: ${DB_NAME}`)
  console.log('Fetching + copying tables...\n')

  for (const table of TABLES) {
    process.stdout.write(`  ${table}... `)
    const rows = await fetchTable(table)

    // Drop collection to clear stale indexes from prior schemas
    try {
      await db.collection(table).drop()
    } catch (err) {
      if (err?.codeName !== 'NamespaceNotFound') throw err
    }
    const collection = db.collection(table)

    if (rows.length === 0) {
      console.log('0 rows')
      await db.collection('counters').updateOne(
        { _id: table },
        { $set: { seq: 0 } },
        { upsert: true },
      )
      continue
    }

    // Ensure numeric ids stay as numbers
    const docs = rows.map((row) => {
      const doc = { ...row }
      if (doc.id != null) doc.id = Number(doc.id)
      return doc
    })

    await collection.insertMany(docs, { ordered: true })

    const maxId = Math.max(...docs.map(d => Number(d.id) || 0))
    await db.collection('counters').updateOne(
      { _id: table },
      { $set: { seq: maxId } },
      { upsert: true },
    )

    console.log(`${rows.length} rows (counter=${maxId})`)
  }

  // Indexes (same as server/utils/db.ts)
  console.log('\nEnsuring indexes...')
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
  ])

  console.log('\nVerifying counts...')
  for (const table of TABLES) {
    const count = await db.collection(table).countDocuments()
    console.log(`  ${table}: ${count}`)
  }

  await client.close()
  console.log('\nDone.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
