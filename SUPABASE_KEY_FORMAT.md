# Supabase Key Format

## SUPABASE_SERVICE_ROLE_KEY Format

`SUPABASE_SERVICE_ROLE_KEY` là một **JWT (JSON Web Token)** có cấu trúc như sau:

### Format
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4eHh4eHh4eHh4eHgiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNjQxMjM0NTY3LCJleHAiOjE5NTY4MTA1Njd9.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Cấu trúc JWT (3 phần, ngăn cách bởi dấu chấm `.`)

```
[HEADER].[PAYLOAD].[SIGNATURE]
```

### 1. Header (Phần đầu)
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
```
- Base64 encoded
- Decode ra sẽ là:
```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

### 2. Payload (Phần thân)
```
eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4eHh4eHh4eHh4eHgiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNjQxMjM0NTY3LCJleHAiOjE5NTY4MTA1Njd9
```
- Base64 encoded
- Decode ra sẽ là:
```json
{
  "iss": "supabase",
  "ref": "xxxxx",           // Project reference ID
  "role": "service_role",   // Quan trọng: role là service_role
  "iat": 1641234567,        // Issued at (timestamp)
  "exp": 1956810567         // Expiration (timestamp)
}
```

### 3. Signature (Chữ ký)
```
xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```
- HMAC SHA256 signature
- Dùng để verify token

## SUPABASE_ANON_KEY Format

Tương tự như Service Role Key, nhưng payload khác:

```json
{
  "iss": "supabase",
  "ref": "xxxxx",
  "role": "anon",           // Quan trọng: role là anon (không phải service_role)
  "iat": 1641234567,
  "exp": 1956810567
}
```

## Đặc điểm

### Service Role Key
- ✅ **Dài:** Thường 200-300 ký tự
- ✅ **Bắt đầu bằng:** `eyJ` (Base64 của `{"`)
- ✅ **Có 3 phần:** Ngăn cách bởi 2 dấu chấm `.`
- ✅ **Role:** `service_role` trong payload
- ✅ **Quyền:** Full access, bypass RLS

### Anon Key
- ✅ **Dài:** Tương tự Service Role Key
- ✅ **Bắt đầu bằng:** `eyJ`
- ✅ **Có 3 phần:** Ngăn cách bởi 2 dấu chấm `.`
- ✅ **Role:** `anon` trong payload
- ✅ **Quyền:** Limited, tuân theo RLS

## Ví dụ thực tế

### Service Role Key (ví dụ)
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNzA5ODc2NTQzLCJleHAiOjIwMjU0NTI1NDN9.abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ
```

### Anon Key (ví dụ)
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTcwOTg3NjU0MywiZXhwIjoyMDI1NDUyNTQzfQ.abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ
```

## Cách nhận biết

1. **Độ dài:** Rất dài (200-300+ ký tự)
2. **Format:** `eyJ...` (Base64 encoded JSON)
3. **Có 2 dấu chấm:** `.` ngăn cách 3 phần
4. **Không có khoảng trắng:** Toàn bộ là một chuỗi liền
5. **Chỉ có:** Chữ cái, số, và các ký tự: `-`, `_`, `.`

## Lưu ý khi copy

- ✅ Copy **toàn bộ** key (không bỏ sót ký tự nào)
- ✅ Không có khoảng trắng ở đầu/cuối
- ✅ Không xuống dòng
- ✅ Đảm bảo có đủ 2 dấu chấm `.`

## Kiểm tra key hợp lệ

### Trong code (test):
```typescript
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

// Kiểm tra format cơ bản
if (!key || !key.startsWith('eyJ')) {
  console.error('Invalid key format')
}

// Kiểm tra có 3 phần
const parts = key.split('.')
if (parts.length !== 3) {
  console.error('Key should have 3 parts separated by dots')
}

// Decode payload để check role
const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString())
if (payload.role !== 'service_role') {
  console.error('This is not a service_role key')
}
```

## Tóm tắt

**SUPABASE_SERVICE_ROLE_KEY:**
- Format: JWT token (3 phần, ngăn cách bởi `.`)
- Độ dài: ~200-300 ký tự
- Bắt đầu: `eyJ`
- Payload chứa: `"role": "service_role"`
- Quyền: Full access

**Lưu ý:**
- Copy đầy đủ, không thiếu ký tự
- Không có khoảng trắng
- Giữ bí mật, không share public

