# Bro-English — Deploy lên VPS

Chạy chung VPS với ShareMoney. Không có CI/CD: push lên GitHub rồi vào server pull code và build lại image.

```
VPS:  nginx (host, SSL Let's Encrypt) ─► 127.0.0.1:3200 ─► broenglish_app_prod (Nuxt SSR) ─► Mongo shared cũ (MONGODB_URI)
```

| Thành phần | Giá trị |
|---|---|
| VPS | `htc` — 103.109.186.73 (chạy chung với HTC và ShareMoney) |
| Thư mục trên server | `/opt/broenglish` (bản clone của repo, `.env` nằm ở đây và không commit) |
| App | container `broenglish_app_prod`, `127.0.0.1:3200`, image build trên server (`broenglish-app:latest`) |
| Domain | `english.share-money.vn` (DNS ở Tenten: bản ghi A `english` → 103.109.186.73) |
| Nginx | `/etc/nginx/sites-available/english.conf` (bản trong `docker/nginx/`) |

## Deploy bản mới

```bash
ssh htc
cd /opt/broenglish
git pull
docker compose -f docker-compose.deploy.yml up -d --build
docker image prune -f
curl -s http://127.0.0.1:3200/api/health
```

## Setup server lần đầu

```bash
git clone https://github.com/hung2604/Bro-English.git /opt/broenglish
cd /opt/broenglish
cp .env.deploy.example .env   # điền MONGODB_URI, GEMINI_API_KEY, ...
docker compose -f docker-compose.deploy.yml up -d --build
```

Nginx + SSL:

```bash
cp docker/nginx/english.http-only.conf /etc/nginx/sites-available/english.conf
ln -sf /etc/nginx/sites-available/english.conf /etc/nginx/sites-enabled/english.conf
nginx -t && systemctl reload nginx

# Khi DNS english.share-money.vn đã trỏ về VPS:
certbot certonly --webroot -w /var/www/certbot -d english.share-money.vn
cp docker/nginx/english.conf /etc/nginx/sites-available/english.conf
nginx -t && systemctl reload nginx
```

URL webhook trên smax.ai: `https://english.share-money.vn/api/webhooks/zalo?token=…` (URL đầy đủ ở trang `/agent`).

## Vận hành

```bash
cd /opt/broenglish
docker compose -f docker-compose.deploy.yml ps
docker logs -f --tail 100 broenglish_app_prod

# Đổi biến môi trường: sửa .env rồi
docker compose -f docker-compose.deploy.yml up -d --force-recreate app
```
