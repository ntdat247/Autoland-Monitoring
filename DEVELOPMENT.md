# Autoland Monitoring System - Local Development Guide

**Vietjet AMO - Hướng dẫn phát triển local**

Hướng dẫn setup môi trường development local cho Autoland Monitoring System.

> **Lưu ý:** Để deploy lên production, xem [README.md](./README.md)

---

## 📋 Mục Lục

1. [Prerequisites](#prerequisites)
2. [Setup Local Development](#setup-local-development)
3. [Cấu hình OAuth2 cho Local Development](#cấu-hình-oauth2-cho-local-development)
4. [Cấu hình Environment Variables](#cấu-hình-environment-variables)
5. [Run Database Migrations](#run-database-migrations)
6. [Run Development Server](#run-development-server)
7. [Setup Gmail Watch (Local)](#setup-gmail-watch-local)
8. [Testing](#testing)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Yêu cầu hệ thống:
- ✅ Node.js 18+ và npm
- ✅ Docker và Docker Compose (cho local database)
- ✅ PostgreSQL client (psql) - optional
- ✅ Git
- ✅ Google Cloud account (để lấy credentials)

### Yêu cầu kiến thức:
- Cơ bản về command line (Bash/Linux)
- Hiểu cơ bản về Next.js và React
- Cơ bản về PostgreSQL

---

## Setup Local Development

### Clone repository:

```bash
git clone <repository-url>
cd autoland-monitoring
```

### Install dependencies:

```bash
npm install
```

### Setup local database (Docker):

```bash
# Run PostgreSQL container
docker run -d \
  --name autoland-db \
  -e POSTGRES_DB=autoland \
  -e POSTGRES_USER=autoland \
  -e POSTGRES_PASSWORD=autoland123 \
  -p 5432:5432 \
  postgres:15
```

**Lưu ý:** 
- Database password mặc định: `autoland123`
- Port: `5432`
- Container name: `autoland-db`

### Verify database connection:

```bash
# Test connection
export PGPASSWORD=autoland123
psql -h localhost -U autoland -d autoland -c "SELECT version();"
```

---

## Cấu hình OAuth2 cho Local Development

**⚠️ QUAN TRỌNG:** Để test OAuth2 flow trên local, cần cấu hình OAuth2 credentials với localhost redirect URIs.

### Bước 1: Tạo OAuth Consent Screen (nếu chưa có)

Xem hướng dẫn trong [README.md](./README.md) - Bước 8.1 để tạo OAuth consent screen.

### Bước 2: Tạo OAuth Client ID với Localhost Redirect URIs

1. Vào [Google Cloud Console](https://console.cloud.google.com/)
2. Chọn project `autoland-monitoring`
3. Vào **APIs & Services** > **Credentials**
4. Click vào OAuth Client ID đã tạo (hoặc tạo mới)
5. Trong phần **Authorized redirect URIs**, thêm các URIs sau:
   ```
   http://localhost:3000/api/test/gmail/callback
   http://localhost:3000/oauth2callback
   ```
6. Click **SAVE**

**Lưu ý:**
- ✅ Copy-paste để tránh lỗi đánh máy
- ✅ Phải dùng `http://` (không phải `https://` cho localhost)
- ✅ Port phải là `3000` (hoặc port mà server đang chạy)
- ✅ Không có dấu `/` ở cuối
- ✅ Không có khoảng trắng thừa
- ✅ `http://localhost:3000/api/test/gmail/callback` - Cho Next.js API routes
- ✅ `http://localhost:3000/oauth2callback` - Cho script setup-gmail-watch.js

### Bước 3: Lưu Client ID và Client Secret

Sau khi tạo OAuth Client ID, lưu lại:
- **Client ID** (ví dụ: `123456789-abc.apps.googleusercontent.com`)
- **Client Secret** (ví dụ: `GOCSPX-xxxxx`)

**⚠️ Lưu ý:** Copy chính xác, không có khoảng trắng thừa!

---

## Cấu hình Environment Variables

### ⚠️ Khi nào cần tạo file `.env`?

**File `.env` CHỈ cần cho local development:**
- ✅ Khi chạy ứng dụng trên máy local (`npm run dev`)
- ✅ Khi test và develop features mới
- ✅ Khi chạy migrations trên local database

**File `.env` KHÔNG cần cho production:**
- ❌ Production deployment sử dụng Secret Manager và Cloud Run environment variables
- ❌ Không cần tạo `.env` khi deploy lên Cloud Run
- ❌ Xem [README.md](./README.md) để biết cách deploy production

### Tạo file `.env`:

Tạo file `.env` trong thư mục root của project (cùng cấp với `package.json`):

```bash
# Database Configuration (Local)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=autoland
DB_USER=autoland
DB_PASSWORD=autoland123

# Google Cloud Configuration
GCP_PROJECT_ID=autoland-monitoring
GCP_KEY_FILE=./gcp-key.json
GCP_STORAGE_BUCKET=autoland-reports

# OAuth2 Configuration (Gmail)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/test/gmail/callback
# Lưu ý: Cần thêm cả http://localhost:3000/oauth2callback vào OAuth2 redirect URIs trong Google Cloud Console

# Application Configuration
APP_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Lấy credentials:

**1. Service Account Key (`gcp-key.json`):**

Xem hướng dẫn trong [README.md](./README.md) - Bước 5 để tạo và download service account key.

**2. OAuth2 Credentials:**

Xem hướng dẫn trong [README.md](./README.md) - Bước 8 để tạo OAuth2 Client ID và Client Secret.

**Lưu ý:**
- Thay `your-client-id` và `your-client-secret` bằng OAuth2 credentials thực tế
- **KHÔNG commit file `.env` lên Git!** (đã có trong `.gitignore`)
- **KHÔNG commit file `gcp-key.json` lên Git!** (đã có trong `.gitignore`)

---

## Run Database Migrations

### Run migrations:

```bash
# Set password
export PGPASSWORD=autoland123

# Run migration 1
psql -h localhost -U autoland -d autoland -f database/migrations/001_create_autoland_tables.sql

# Run migration 2
psql -h localhost -U autoland -d autoland -f database/migrations/002_create_dashboard_tables.sql

# Run migration 3
psql -h localhost -U autoland -d autoland -f database/migrations/003_fix_calculate_autoland_to_go.sql

# Run migration 4
psql -h localhost -U autoland -d autoland -f database/migrations/004_change_visibility_rvr_to_varchar.sql

# Run migration 5 (Hybrid PDF Parser metrics)
psql -h localhost -U autoland -d autoland -f database/migrations/005_add_extraction_metrics.sql
```

### Verify migrations:

```bash
# List all tables
psql -h localhost -U autoland -d autoland -c "\dt"

# Verify new columns from migration 5
psql -h localhost -U autoland -d autoland -c "
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'autoland_reports'
  AND column_name IN ('extraction_method', 'extraction_cost', 'extraction_cost_saved');
"
```

---

## Run Development Server

### Start development server:

```bash
npm run dev
```

Mở browser: `http://localhost:3000`

### Development commands:

```bash
# Run development server
npm run dev

# Build for production (local test)
npm run build

# Start production server (local test)
npm start

# Run linting
npm run lint

# Run type checking
npm run type-check
```

---

## Testing

### Test OAuth2 Flow:

1. Mở browser: `http://localhost:3000/api/test/gmail`
2. Click "Authorize Gmail" để bắt đầu OAuth2 flow
3. Đăng nhập và cấp quyền
4. Kiểm tra kết quả

### Test PDF Processing:

```bash
# Test hybrid PDF parser
curl http://localhost:3000/api/test/pdf/hybrid-test

# Test với PDF file cụ thể
curl -X POST http://localhost:3000/api/test/pdf/parse \
  -F "file=@path/to/your/file.pdf"
```

### Test Database Connection:

```bash
# Test connection
psql -h localhost -U autoland -d autoland -c "SELECT COUNT(*) FROM autoland_reports;"
```

---

## Setup Gmail Watch (Local)

### Cách 1: Automatic Flow (Khuyến nghị cho local)

**Yêu cầu:** Development server phải đang chạy trên `http://localhost:3000`

```bash
# Export environment variables
export GCP_PROJECT_ID="autoland-monitoring"
export GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
export GOOGLE_CLIENT_SECRET="GOCSPX-your-client-secret"
export GOOGLE_REDIRECT_URI="http://localhost:3000/oauth2callback"
export PUBSUB_TOPIC="gmail-notifications"

# Không set MANUAL_FLOW (hoặc set MANUAL_FLOW=false)
# Chạy script
node scripts/setup-gmail-watch.js
```

**Quy trình:**
1. Script sẽ tự động mở browser với authorization URL
2. Đăng nhập và cấp quyền cho ứng dụng
3. Browser sẽ redirect về `http://localhost:3000/oauth2callback`
4. Script sẽ tự động nhận callback và setup Gmail Watch

### Cách 2: Manual Flow (Cho Cloud Shell hoặc khi không có local server)

```bash
# Export environment variables
export GCP_PROJECT_ID="autoland-monitoring"
export GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
export GOOGLE_CLIENT_SECRET="GOCSPX-your-client-secret"
export GOOGLE_REDIRECT_URI="http://localhost:3000/oauth2callback"
export PUBSUB_TOPIC="gmail-notifications"
export MANUAL_FLOW=true  # Bật manual flow

# Chạy script
node scripts/setup-gmail-watch.js
```

**Quy trình Manual Flow:**
1. Script sẽ hiển thị URL authorization
2. Copy URL và mở trong browser
3. Đăng nhập và cấp quyền cho ứng dụng
4. Sau khi authorize, browser sẽ redirect về URL có dạng:
   ```
   http://localhost:3000/oauth2callback?code=4/0A...
   ```
5. Copy toàn bộ URL này (hoặc chỉ phần `code=...`)
6. Paste vào terminal khi script hỏi
7. Script sẽ tự động extract code và setup Gmail Watch

**Lưu ý:** 
- Gmail Watch expires sau 7 ngày, cần renew định kỳ
- Refresh token sẽ được lưu để có thể refresh access token khi cần

---

## Troubleshooting

### Database connection issues:

```bash
# Check if container is running
docker ps | grep autoland-db

# Check container logs
docker logs autoland-db

# Restart container
docker restart autoland-db

# Remove and recreate container
docker stop autoland-db
docker rm autoland-db
# Then run setup again
```

### OAuth2 issues:

**Lỗi "redirect_uri_mismatch":**
- Đảm bảo redirect URI trong OAuth2 credentials khớp chính xác với `GOOGLE_REDIRECT_URI` trong `.env`
- Kiểm tra trong Google Cloud Console > APIs & Services > Credentials > OAuth Client ID
- Đảm bảo có cả 2 redirect URIs:
  - `http://localhost:3000/api/test/gmail/callback`
  - `http://localhost:3000/oauth2callback`
- Copy-paste để tránh lỗi đánh máy
- Không có dấu `/` ở cuối
- Không có khoảng trắng thừa

**Lỗi "unauthorized_client":**
- Đảm bảo OAuth consent screen đã được cấu hình đúng
- Kiểm tra test users đã được thêm vào OAuth consent screen (nếu dùng External)
- Đảm bảo email của bạn đã được thêm vào test users list

**Lỗi "connection refused" khi chạy script:**
- Đảm bảo development server đang chạy trên port 3000 (nếu dùng Automatic Flow)
- Hoặc sử dụng Manual Flow (`export MANUAL_FLOW=true`)

### Port conflicts:

```bash
# Check if port 3000 is in use
lsof -i :3000

# Kill process using port 3000
kill -9 $(lsof -t -i:3000)

# Or change port in package.json scripts
```

---

## Useful Commands

```bash
# View database logs
docker logs -f autoland-db

# Connect to database
psql -h localhost -U autoland -d autoland

# View all tables
psql -h localhost -U autoland -d autoland -c "\dt"

# View table structure
psql -h localhost -U autoland -d autoland -c "\d autoland_reports"

# Clear database (⚠️ DANGER - deletes all data)
psql -h localhost -U autoland -d autoland -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
# Then run migrations again
```

---

**Maintained by:** Vietjet AMO ICT Department  
**Contact:** moc@vietjetair.com  
**Last Updated:** 2026-01-15

