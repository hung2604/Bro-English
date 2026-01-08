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

### 2. Gemini AI Configuration (TÙY CHỌN - Cho tính năng AI)

```env
GEMINI_API_KEY=your-gemini-api-key-here
```

> **Lưu ý:** Gemini API key chỉ cần thiết nếu bạn muốn sử dụng tính năng tự động điền từ loại và nghĩa bằng AI. Nếu không có key này, tính năng AI sẽ không hoạt động nhưng các tính năng khác vẫn bình thường.

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

# Gemini AI (Optional - for AI-powered vocabulary meanings)
GEMINI_API_KEY=your-gemini-api-key-here
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
5. Lặp lại cho `GEMINI_API_KEY` (nếu sử dụng tính năng AI)

### Bước 3: Lấy Gemini API Key (Tùy chọn)

1. Truy cập https://aistudio.google.com/app/apikey
2. Đăng nhập bằng Google account
3. Click **"Create API Key"** hoặc **"Get API Key"**
4. Chọn project hoặc tạo project mới
5. Copy API key → Thêm vào `.env` file với tên `GEMINI_API_KEY`

> **Lưu ý:** 
> - Gemini API có free tier với giới hạn requests
> - API key này chỉ dùng cho server-side, không expose ra client
> - Nếu không có key này, tính năng "Get Meanings from AI" sẽ không hoạt động

### Cách 2: Qua Vercel CLI
```bash
vercel env add SUPABASE_URL
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add GEMINI_API_KEY  # Optional
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

**Cần set 2 biến (bắt buộc):**
1. `SUPABASE_URL` - Project URL từ Supabase dashboard
2. `SUPABASE_SERVICE_ROLE_KEY` - Service role key từ Supabase API settings

**Tùy chọn (cho tính năng AI):**
3. `GEMINI_API_KEY` - Gemini API key từ Google AI Studio

**Nơi set:**
- Local: File `.env` trong root directory
- Vercel: Environment Variables trong Vercel dashboard

**Lưu ý về Gemini AI:**
- Tính năng AI tự động điền từ loại và nghĩa chỉ hoạt động khi có `GEMINI_API_KEY`
- Nếu không có key, bạn vẫn có thể thêm từ và nghĩa thủ công
- Gemini API có free tier với giới hạn requests mỗi phút


