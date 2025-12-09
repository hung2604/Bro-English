# ✅ Migration Complete: SQLite → Supabase

## Tổng kết

Đã hoàn thành migration từ SQLite (better-sqlite3) sang Supabase (PostgreSQL) cho tất cả **24 API endpoints**.

## Files đã được update

### ✅ Core Database
- `server/utils/db.ts` - Supabase client setup

### ✅ Persons (2 files)
- `server/api/persons/index.get.ts`
- `server/api/persons/index.post.ts`

### ✅ Sessions (5 files)
- `server/api/sessions/index.get.ts`
- `server/api/sessions/index.post.ts`
- `server/api/sessions/[personId].get.ts`
- `server/api/sessions/history.get.ts`
- `server/api/sessions/initialize.post.ts`
- `server/api/sessions/batch.post.ts`

### ✅ Expenses (5 files)
- `server/api/expenses/index.get.ts`
- `server/api/expenses/index.post.ts`
- `server/api/expenses/[id].put.ts`
- `server/api/expenses/[id].delete.ts`
- `server/api/expenses/summary.get.ts`

### ✅ Vocabulary (5 files)
- `server/api/vocabulary/index.get.ts`
- `server/api/vocabulary/index.post.ts`
- `server/api/vocabulary/[id].put.ts`
- `server/api/vocabulary/[id].delete.ts`
- `server/api/vocabulary/stats.get.ts`

### ✅ Study (6 files)
- `server/api/study/daily-words.get.ts`
- `server/api/study/progress.get.ts`
- `server/api/study/review.post.ts`
- `server/api/study/settings.get.ts`
- `server/api/study/settings.put.ts`
- `server/api/study/stats.get.ts`

## Thay đổi chính

### 1. Import Statement
**Before:**
```typescript
import db from '../../utils/db'
```

**After:**
```typescript
import { supabase } from '../../utils/db'
```

### 2. Query Pattern
**Before (SQLite - sync):**
```typescript
const result = db.prepare('SELECT * FROM table WHERE id = ?').get(id)
```

**After (Supabase - async):**
```typescript
const { data, error } = await supabase
  .from('table')
  .select('*')
  .eq('id', id)
  .single()
```

### 3. JOINs
**Before:**
```typescript
SELECT e.*, p.name 
FROM expenses e
LEFT JOIN persons p ON e.paid_by = p.id
```

**After:**
```typescript
const { data } = await supabase
  .from('expenses')
  .select(`
    *,
    persons!expenses_paid_by_fkey(name)
  `)
```

### 4. GROUP_CONCAT
**Before:**
```typescript
GROUP_CONCAT(ep.person_id) as participant_ids
```

**After:**
```typescript
// Fetch with relationship
.select(`
  *,
  expense_participants(person_id)
`)
// Then map in JavaScript
participant_ids: participants.map(ep => ep.person_id)
```

## Next Steps

1. **Cài đặt dependencies:**
   ```bash
   npm install
   ```

2. **Setup Supabase:**
   - Tạo project tại https://supabase.com
   - Chạy SQL migration từ `SUPABASE_MIGRATION.md`
   - Thêm environment variables:
     - `SUPABASE_URL`
     - `SUPABASE_SERVICE_ROLE_KEY`

3. **Test locally:**
   ```bash
   npm run dev
   ```

4. **Deploy to Vercel:**
   - Thêm environment variables trong Vercel dashboard
   - Deploy và test

## Notes

- Tất cả queries đã được chuyển sang async/await
- Foreign key relationships được handle qua Supabase's relationship syntax
- Date calculations (julianday) được thay bằng JavaScript calculations
- Transactions được handle bằng sequential async operations

## Lưu ý quan trọng

1. **Foreign Key Names:** Supabase tự động tạo foreign key constraint names. Nếu có lỗi về foreign key names, cần check trong Supabase dashboard và update trong code.

2. **Date Format:** PostgreSQL sử dụng `TIMESTAMPTZ` thay vì SQLite's `DATETIME`. Đảm bảo dates được format đúng.

3. **GROUP BY:** Một số queries với GROUP BY đã được thay bằng JavaScript grouping vì Supabase query builder limitations.

4. **Testing:** Cần test kỹ tất cả endpoints sau khi deploy để đảm bảo data được fetch/insert đúng.

