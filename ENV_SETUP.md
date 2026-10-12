# Environment Variables Setup

## Các Environment Variables cần thiết

### 1. MongoDB Configuration (BẮT BUỘC)

```env
MONGODB_URI=mongodb://USER:PASSWORD@HOST:PORT/broenglish?authSource=broenglish
```

> **Lưu ý:** URI chứa username/password — chỉ đặt trong `.env` local hoặc Vercel Environment Variables. Không commit lên git.

### 2. Gemini AI Configuration (TÙY CHỌN - Cho tính năng AI)

```env
GEMINI_API_KEY=your-gemini-api-key-here
```

> **Lưu ý:** Gemini API key chỉ cần thiết nếu bạn muốn sử dụng tính năng tự động điền từ loại và nghĩa bằng AI. Nếu không có key này, tính năng AI sẽ không hoạt động nhưng các tính năng khác vẫn bình thường.

### 3. Zalo Agent (TÙY CHỌN - Cho trang `/agent`)

```env
# Mã PIN 6 số mở trang /agent (nơi nhập API key, chọn nhóm Zalo). Bắt buộc nếu dùng agent.
# Sai 5 lần thì khoá đăng nhập 15 phút, mỗi lần khoá sau gấp đôi, tối đa 24 giờ.
AGENT_ADMIN_PIN=123456
# Khóa mã hoá API key lưu trong Mongo. Bỏ trống thì dùng MONGODB_URI.
# Đổi khóa này (hoặc đổi MONGODB_URI khi không đặt khóa) thì phải nhập lại API key trên trang /agent.
SETTINGS_SECRET=
```

Agent chỉ nghe đúng 2 nhóm Zalo, chọn trên trang `/agent`: nhóm **internal** (chỉ học viên) và nhóm **external** (có thầy giáo). Tin từ các chat khác không được lưu.

Agent đọc tin nhắn nhóm Zalo do smax.ai gửi về webhook `/api/webhooks/zalo?token=…` (URL đầy đủ hiện ở trang `/agent`), rồi:

- Tự đánh dấu buổi học / nghỉ học khi nhóm báo nghỉ, dời lịch hoặc học bù.
- Tự thêm khoản chi khi có ảnh hóa đơn / bill chuyển khoản. Người gửi ảnh là người trả tiền.

Nhà cung cấp AI, model và API key nhập trên trang `/agent` (key được mã hoá trước khi lưu). Các biến dưới đây chỉ là giá trị dự phòng khi chưa nhập trên giao diện:

```env
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GEMINI_API_KEY=
DEEPSEEK_API_KEY=
# Token trên URL webhook, nếu không muốn dùng token tự sinh trên trang /agent
ZALO_WEBHOOK_TOKEN=
# Cho phép tải ảnh từ host khác ngoài CDN của Zalo (zdn.vn, zadn.vn), cách nhau bằng dấu phẩy
AGENT_IMAGE_HOSTS=
# Dùng proxy tương thích OpenAI thay cho api.openai.com
OPENAI_BASE_URL=
```

> **Lưu ý:** webhook smax.ai không cho biết ai trong nhóm vừa nhắn, chỉ phân biệt tin của chính bạn (`chat_by`) với người khác. Với ảnh do người khác gửi, agent lấy tên người trả từ bill chuyển khoản hoặc nội dung chat; không xác định được thì để trống người trả và ghi chú lại ở mục Activity. Nếu body webhook có thêm trường `sender` (tên người gửi) thì agent dùng trường đó.

## Setup cho Local Development

### Tạo file `.env` trong root directory:

```env
# MongoDB
MONGODB_URI=mongodb://broenglish_usr:PASSWORD@mongo8-shared.vtechcomlabs.com:27018/broenglish?authSource=broenglish

# Gemini AI (Optional - for AI-powered vocabulary meanings)
GEMINI_API_KEY=your-gemini-api-key-here
```

> ⚠️ **QUAN TRỌNG:**
> - File `.env` đã được gitignore, không commit lên git
> - Không share URI/password với ai
> - Sau khi lộ connection string, nên đổi password trên Mongo host

## Setup cho Vercel

### Cách 1: Qua Vercel Dashboard
1. Vào Vercel Dashboard → Chọn project
2. Click **Settings** → **Environment Variables**
3. Thêm:
   - **Key:** `MONGODB_URI`
   - **Value:** connection string đầy đủ
   - **Environment:** Production, Preview, Development
4. (Tùy chọn) Thêm `GEMINI_API_KEY`
5. Xóa các biến cũ `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_ANON_KEY` sau khi verify app chạy ổn
6. Redeploy

### Cách 2: Qua Vercel CLI
```bash
vercel env add MONGODB_URI
vercel env add GEMINI_API_KEY  # Optional
```

### Bước: Lấy Gemini API Key (Tùy chọn)

1. Truy cập https://aistudio.google.com/app/apikey
2. Đăng nhập bằng Google account
3. Click **"Create API Key"** hoặc **"Get API Key"**
4. Copy API key → Thêm vào `.env` với tên `GEMINI_API_KEY`

## Migrate data từ Supabase (one-shot)

Nếu còn dữ liệu trên Supabase cần copy sang MongoDB:

1. Giữ tạm `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` trong `.env`
2. Đảm bảo đã có `MONGODB_URI`
3. Chạy:

```bash
node scripts/migrate-supabase-to-mongo.mjs
```

Script sẽ:
- Copy 10 collections (giữ nguyên integer `id`)
- Set `counters.seq = max(id)` từng collection
- Tạo indexes

Sau khi verify xong có thể xóa biến Supabase khỏi `.env`.

## Troubleshooting

### Lỗi: "Missing MongoDB environment variable"
- ✅ Kiểm tra file `.env` có tồn tại trong root directory
- ✅ Kiểm tra tên biến đúng: `MONGODB_URI`
- ✅ Restart dev server sau khi thêm `.env`

### Lỗi kết nối MongoDB
- ✅ Kiểm tra host/port/authSource đúng
- ✅ Kiểm tra username/password
- ✅ Firewall / IP allowlist trên Mongo host

### Lỗi trên Vercel
- ✅ Kiểm tra `MONGODB_URI` đã set trong Vercel dashboard
- ✅ Redeploy sau khi thêm environment variables

## Security Best Practices

1. ✅ **KHÔNG** commit `.env` file lên git
2. ✅ **KHÔNG** hardcode password trong source code
3. ✅ Rotate password nếu URI bị lộ
4. ✅ Chỉ dùng Mongo credentials trên server-side

## Tóm tắt

**Cần set 1 biến (bắt buộc):**
1. `MONGODB_URI` - MongoDB connection string (database `broenglish`)

**Tùy chọn (cho tính năng AI):**
2. `GEMINI_API_KEY` - Gemini API key từ Google AI Studio

**Nơi set:**
- Local: File `.env` trong root directory
- Vercel: Environment Variables trong Vercel dashboard
