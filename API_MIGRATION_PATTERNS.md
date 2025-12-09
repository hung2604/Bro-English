# API Migration Patterns: SQLite → Supabase

## Common Patterns

### 1. Simple SELECT

**Before (SQLite):**
```typescript
const persons = db.prepare('SELECT * FROM persons ORDER BY name').all()
```

**After (Supabase):**
```typescript
const { data, error } = await supabase
  .from('persons')
  .select('*')
  .order('name')

if (error) throw error
return data || []
```

### 2. SELECT with WHERE

**Before:**
```typescript
const session = db.prepare('SELECT * FROM class_sessions WHERE date = ?').get(date)
```

**After:**
```typescript
const { data, error } = await supabase
  .from('class_sessions')
  .select('*')
  .eq('date', date)
  .single()

if (error) throw error
return data
```

### 3. SELECT with LIKE

**Before:**
```typescript
const expenses = db.prepare('SELECT * FROM expenses WHERE date LIKE ?').all(`${monthPrefix}%`)
```

**After:**
```typescript
const { data, error } = await supabase
  .from('expenses')
  .select('*')
  .like('date', `${monthPrefix}%`)
```

### 4. INSERT

**Before:**
```typescript
const insert = db.prepare('INSERT INTO persons (name) VALUES (?)')
const result = insert.run(name)
const person = db.prepare('SELECT * FROM persons WHERE id = ?').get(result.lastInsertRowid)
```

**After:**
```typescript
const { data, error } = await supabase
  .from('persons')
  .insert({ name })
  .select()
  .single()

if (error) throw error
return data
```

### 5. UPDATE

**Before:**
```typescript
const update = db.prepare('UPDATE expenses SET amount = ? WHERE id = ?')
update.run(newAmount, expenseId)
```

**After:**
```typescript
const { data, error } = await supabase
  .from('expenses')
  .update({ amount: newAmount })
  .eq('id', expenseId)
  .select()

if (error) throw error
return data
```

### 6. DELETE

**Before:**
```typescript
db.prepare('DELETE FROM expenses WHERE id = ?').run(expenseId)
```

**After:**
```typescript
const { error } = await supabase
  .from('expenses')
  .delete()
  .eq('id', expenseId)

if (error) throw error
```

### 7. JOIN Queries

**Before:**
```typescript
const expenses = db.prepare(`
  SELECT e.*, p.name as paid_by_name
  FROM expenses e
  LEFT JOIN persons p ON e.paid_by = p.id
  WHERE e.date LIKE ?
`).all(`${monthPrefix}%`)
```

**After:**
```typescript
const { data, error } = await supabase
  .from('expenses')
  .select(`
    *,
    persons!expenses_paid_by_fkey(name)
  `)
  .like('date', `${monthPrefix}%`)

// Note: Supabase automatically handles foreign key relationships
// You may need to adjust the foreign key name in the select
```

### 8. GROUP_CONCAT → STRING_AGG

**Before:**
```typescript
const expenses = db.prepare(`
  SELECT e.*, 
         GROUP_CONCAT(ep.person_id) as participant_ids
  FROM expenses e
  LEFT JOIN expense_participants ep ON e.id = ep.expense_id
  GROUP BY e.id
`).all()
```

**After:**
```typescript
// Option 1: Use Supabase's relationship feature
const { data, error } = await supabase
  .from('expenses')
  .select(`
    *,
    expense_participants(person_id)
  `)

// Then map in code:
const expenses = data?.map(expense => ({
  ...expense,
  participant_ids: expense.expense_participants?.map((ep: any) => ep.person_id) || []
}))

// Option 2: Use RPC function with STRING_AGG
```

### 9. Date Calculations

**Before (SQLite julianday):**
```typescript
const words = db.prepare(`
  SELECT *,
    CAST((julianday('now') - julianday(last_reviewed_at)) AS INTEGER) as days_since
  FROM vocabulary_study
`).all()
```

**After (PostgreSQL):**
```typescript
// Calculate in JavaScript instead
const { data } = await supabase
  .from('vocabulary_study')
  .select('*')

const words = data?.map(word => ({
  ...word,
  days_since: word.last_reviewed_at 
    ? Math.floor((Date.now() - new Date(word.last_reviewed_at).getTime()) / (1000 * 60 * 60 * 24))
    : 999
}))
```

### 10. Transactions

**Before:**
```typescript
const transaction = db.transaction(() => {
  const result = insertExpense.run(...)
  // more operations
  return result
})
const expense = transaction()
```

**After:**
```typescript
// Supabase doesn't have built-in transactions in JS client
// For simple cases, execute sequentially
// For complex transactions, use Supabase RPC functions

const { data: expense, error } = await supabase
  .from('expenses')
  .insert({...})
  .select()
  .single()

if (error) throw error

// Then insert participants
for (const personId of participantIds) {
  await supabase
    .from('expense_participants')
    .insert({ expense_id: expense.id, person_id: personId })
}
```

## Error Handling

**Before:**
```typescript
try {
  const result = db.prepare('...').run()
} catch (error: any) {
  if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    // handle unique constraint
  }
}
```

**After:**
```typescript
const { data, error } = await supabase.from('...').insert(...)

if (error) {
  if (error.code === '23505') { // PostgreSQL unique constraint
    throw createError({ statusCode: 409, message: 'Already exists' })
  }
  throw createError({ statusCode: 500, message: error.message })
}
```

## Files to Update

Update all files in `server/api/` to use Supabase query builder:
- [ ] persons/index.get.ts ✅
- [ ] persons/index.post.ts ✅
- [ ] sessions/index.get.ts ✅
- [ ] sessions/index.post.ts
- [ ] sessions/[personId].get.ts
- [ ] sessions/history.get.ts
- [ ] sessions/initialize.post.ts
- [ ] sessions/batch.post.ts
- [ ] expenses/index.get.ts
- [ ] expenses/index.post.ts
- [ ] expenses/[id].put.ts
- [ ] expenses/[id].delete.ts
- [ ] expenses/summary.get.ts
- [ ] vocabulary/index.get.ts
- [ ] vocabulary/index.post.ts
- [ ] vocabulary/[id].put.ts
- [ ] vocabulary/[id].delete.ts
- [ ] vocabulary/stats.get.ts
- [ ] study/daily-words.get.ts
- [ ] study/progress.get.ts
- [ ] study/review.post.ts
- [ ] study/settings.get.ts
- [ ] study/settings.put.ts
- [ ] study/stats.get.ts

