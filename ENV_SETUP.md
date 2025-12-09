# Environment Variables Setup

## Các Environment Variables cần thiết

### 1. Supabase Configuration (BẮT BUỘC)

```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

**Hoặc** (nếu không có Service Role Key):

```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
```

> **Lưu ý:** Service Role Key có quyền cao hơn và bypass Row Level Security (RLS). Nên dùng cho server-side. Anon Key có quyền hạn chế hơn nhưng an toàn hơn.

## Cách lấy các keys

### Bước 1: Tạo Supabase Project
1. Truy cập https://supabase.com
2. Đăng ký/Đăng nhập
3. Click "New Project"
4. Điền thông tin:
   - Project Name: `bro-english` (hoặc tên bạn muốn)
   - Database Password: (tạo password mạnh)
   - Region: Chọn gần nhất
   - Pricing Plan: Free tier

### Bước 2: Lấy API Keys
1. Vào Project Dashboard
2. Click **Settings** (icon bánh răng) ở sidebar
3. Click **API** trong Settings menu
4. Bạn sẽ thấy:
   - **Project URL** → Copy vào `SUPABASE_URL`
   - **service_role key** (Secret) → Copy vào `SUPABASE_SERVICE_ROLE_KEY`
   - **anon public key** → Copy vào `SUPABASE_ANON_KEY` (nếu dùng)

## Setup cho Local Development

### Tạo file `.env` trong root directory:

```env
# Supabase Configuration
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4eHh4eHh4eHh4eHgiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNjQxMjM0NTY3LCJleHAiOjE5NTY4MTA1Njd9.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

> ⚠️ **QUAN TRỌNG:** 
> - File `.env` đã được gitignore, không commit lên git
> - Không share keys này với ai
> - Service Role Key có quyền full access, giữ bí mật

## Setup cho Vercel

### Cách 1: Qua Vercel Dashboard
1. Vào Vercel Dashboard → Chọn project
2. Click **Settings** → **Environment Variables**
3. Thêm từng biến:
   - **Key:** `SUPABASE_URL`
   - **Value:** `https://your-project-id.supabase.co`
   - **Environment:** Production, Preview, Development (chọn tất cả)
   - Click **Save**

4. Lặp lại cho `SUPABASE_SERVICE_ROLE_KEY`

### Cách 2: Qua Vercel CLI
```bash
vercel env add SUPABASE_URL
vercel env add SUPABASE_SERVICE_ROLE_KEY
```

## Kiểm tra Environment Variables

### Local:
```bash
# Kiểm tra file .env có tồn tại
cat .env

# Hoặc test trong code
node -e "require('dotenv').config(); console.log(process.env.SUPABASE_URL)"
```

### Vercel:
- Vào Vercel Dashboard → Settings → Environment Variables
- Xem danh sách các biến đã set

## Troubleshooting

### Lỗi: "Missing Supabase environment variables"
- ✅ Kiểm tra file `.env` có tồn tại trong root directory
- ✅ Kiểm tra tên biến đúng: `SUPABASE_URL` và `SUPABASE_SERVICE_ROLE_KEY`
- ✅ Không có khoảng trắng thừa trong `.env` file
- ✅ Restart dev server sau khi thêm `.env`

### Lỗi: "Invalid API key"
- ✅ Kiểm tra key được copy đầy đủ (không bị cắt)
- ✅ Đảm bảo dùng đúng key (service_role vs anon)
- ✅ Kiểm tra project URL đúng format: `https://xxx.supabase.co`

### Lỗi trên Vercel:
- ✅ Kiểm tra environment variables đã được set trong Vercel dashboard
- ✅ Đảm bảo chọn đúng environment (Production/Preview/Development)
- ✅ Redeploy sau khi thêm environment variables

## Security Best Practices

1. ✅ **KHÔNG** commit `.env` file lên git
2. ✅ **KHÔNG** share Service Role Key public
3. ✅ Dùng **Service Role Key** chỉ cho server-side
4. ✅ Dùng **Anon Key** cho client-side (nếu cần)
5. ✅ Rotate keys định kỳ nếu bị lộ

## Example .env file

```env
# Supabase
SUPABASE_URL=https://abcdefghijklmnop.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNjQxMjM0NTY3LCJleHAiOjE5NTY4MTA1Njd9.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## Tóm tắt

**Cần set 2 biến:**
1. `SUPABASE_URL` - Project URL từ Supabase dashboard
2. `SUPABASE_SERVICE_ROLE_KEY` - Service role key từ Supabase API settings

**Nơi set:**
- Local: File `.env` trong root directory
- Vercel: Environment Variables trong Vercel dashboard

