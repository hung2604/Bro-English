# Supabase Migration - Quick Start Guide

## ✅ Đã hoàn thành

1. ✅ Cài đặt `@supabase/supabase-js`
2. ✅ Tạo Supabase client trong `server/utils/db.ts`
3. ✅ Viết lại 3 API endpoints làm ví dụ:
   - `persons/index.get.ts`
   - `persons/index.post.ts`
   - `sessions/index.get.ts`

## 📋 Các bước tiếp theo

### 1. Tạo Supabase Project

1. Truy cập https://supabase.com
2. Đăng ký/Đăng nhập
3. Tạo project mới
4. Lưu lại:
   - Project URL (ví dụ: `https://xxxxx.supabase.co`)
   - Service Role Key (từ Settings → API)

### 2. Setup Environment Variables

**Local development:**
Tạo file `.env` trong root directory:
```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Vercel:**
1. Vào Vercel Dashboard → Project Settings → Environment Variables
2. Thêm 2 biến:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

### 3. Chạy Database Migration

1. Vào Supabase Dashboard → SQL Editor
2. Copy toàn bộ SQL từ file `SUPABASE_MIGRATION.md`
3. Paste và chạy trong SQL Editor
4. Kiểm tra các tables đã được tạo

### 4. Cài đặt Dependencies

```bash
npm install
```

### 5. Viết lại các API endpoints còn lại

Xem file `API_MIGRATION_PATTERNS.md` để biết cách convert từ SQLite sang Supabase.

**Danh sách files cần update:**
- [x] persons/index.get.ts ✅
- [x] persons/index.post.ts ✅
- [x] sessions/index.get.ts ✅
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

## 🔑 Key Differences

### Import Statement
**Before:**
```typescript
import db from '../../utils/db'
```

**After:**
```typescript
import { supabase } from '../../utils/db'
```

### Queries
- SQLite: `db.prepare('SELECT ...').all()` (sync)
- Supabase: `await supabase.from('table').select()` (async)

### Error Codes
- SQLite: `SQLITE_CONSTRAINT_UNIQUE`
- PostgreSQL: `23505`

## 🚀 Deploy

Sau khi hoàn thành migration:
1. Test local: `npm run dev`
2. Deploy lên Vercel
3. Kiểm tra logs nếu có lỗi

## 📚 Tài liệu tham khảo

- Supabase Docs: https://supabase.com/docs
- Supabase JS Client: https://supabase.com/docs/reference/javascript/introduction
- Migration Patterns: Xem `API_MIGRATION_PATTERNS.md`

