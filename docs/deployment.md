# Bro-English — Deploy lên VPS

Chạy chung VPS với ShareMoney (giống cách deploy của ShareMoney):

```
push master ─► GitHub Actions ─► build Dockerfile.production ─► Docker Hub roseluren26/tnp:be-app (+ be-app-<sha>)
                                   └─► SSH vào VPS: copy docker-compose.deploy.yml → compose pull app → up -d → health check

VPS:  nginx (host, SSL Let's Encrypt) ─► 127.0.0.1:3200 ─► broenglish_app_prod (Nuxt SSR) ─► Mongo shared cũ (MONGODB_URI)
```

| Thành phần | Giá trị |
|---|---|
| VPS | `htc` — 103.109.186.73 (chạy chung với HTC và ShareMoney) |
| Thư mục trên server | `/opt/broenglish` (chỉ có `docker-compose.deploy.yml` và `.env`, không clone repo) |
| App | container `broenglish_app_prod`, `127.0.0.1:3200` |
| Domain | `english.share-money.vn` (DNS ở Tenten: bản ghi A `english` → 103.109.186.73) |
| Nginx | `/etc/nginx/sites-available/english.conf` (bản trong `docker/nginx/`) |

## 1. GitHub Secrets (repo Bro-English → Settings → Secrets and variables → Actions)

Giống ShareMoney:

| Secret | Ghi chú |
|---|---|
| `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN` | Dùng chung với ShareMoney / SimQuocTe |
| `DEPLOY_HOST` | `103.109.186.73` |
| `DEPLOY_USER` | `root` |
| `DEPLOY_PORT` | `22` |
| `DEPLOY_SSH_KEY` | Private key có public key trong `~/.ssh/authorized_keys` của VPS (dùng lại key của ShareMoney được) |

## 2. Setup server lần đầu

```bash
mkdir -p /opt/broenglish
# copy docker-compose.deploy.yml vào /opt/broenglish, tạo .env theo .env.deploy.example
cd /opt/broenglish
docker compose -f docker-compose.deploy.yml up -d app
curl -s http://127.0.0.1:3200/api/health
```

Nginx + SSL:

```bash
cp english.http-only.conf /etc/nginx/sites-available/english.conf
ln -sf /etc/nginx/sites-available/english.conf /etc/nginx/sites-enabled/english.conf
nginx -t && systemctl reload nginx

# Khi DNS english.share-money.vn đã trỏ về VPS:
certbot certonly --webroot -w /var/www/certbot -d english.share-money.vn
cp english.conf /etc/nginx/sites-available/english.conf
nginx -t && systemctl reload nginx
```

Sau khi đổi domain: cập nhật URL webhook trên smax.ai sang `https://english.share-money.vn/api/webhooks/zalo?token=…` (URL đầy đủ ở trang `/agent`).

## 3. Vận hành

```bash
cd /opt/broenglish
docker compose -f docker-compose.deploy.yml ps
docker logs -f --tail 100 broenglish_app_prod

# Đổi biến môi trường: sửa .env rồi
docker compose -f docker-compose.deploy.yml up -d --force-recreate app

# Rollback về 1 commit cũ
BE_APP_TAG=be-app-<git sha> docker compose -f docker-compose.deploy.yml up -d app
```
