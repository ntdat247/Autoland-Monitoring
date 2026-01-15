# Autoland Monitoring System - Production Deployment Guide

**Vietjet AMO - Hệ thống giám sát Autoland**

Hướng dẫn deploy hệ thống Autoland Monitoring lên Google Cloud Platform (Production).

> **Lưu ý:** 
> - Để setup môi trường development local, xem [DEVELOPMENT.md](./DEVELOPMENT.md)
> - **Production deployment KHÔNG cần file `.env`** - Tất cả config được quản lý qua Secret Manager và Cloud Run environment variables
> - **File `.env` CHỈ cần cho local development** - Xem [DEVELOPMENT.md](./DEVELOPMENT.md) để biết cách tạo

---

## 🚀 PRODUCTION DEPLOYMENT - THỨ TỰ THỰC HIỆN

**⚠️ QUAN TRỌNG:** Thực hiện theo đúng thứ tự để tránh lỗi `redirect_uri_mismatch`:

```
┌─────────────────────────────────────────────────────────────────┐
│  PHẦN A: INFRASTRUCTURE (Bước 1-9)                              │
│  ├── Google Cloud Account & CLI                                 │
│  ├── Project & Enable APIs                                      │
│  ├── Service Account & Document AI                              │
│  ├── Cloud Storage & Cloud SQL                                  │
│  └── Secret Manager (DB password ONLY)                          │
├─────────────────────────────────────────────────────────────────┤
│  PHẦN B: DEPLOY APPLICATION (Bước 10-13)                        │
│  ├── Build Docker Image                                         │
│  ├── Deploy to Cloud Run                                        │
│  ├── ⭐ MAP CUSTOM DOMAIN (VD: autoland.yourdomain.com)         │
│  └── Run Database Migrations                                    │
├─────────────────────────────────────────────────────────────────┤
│  PHẦN C: GMAIL INTEGRATION (Bước 14-17)                         │
│  ├── Setup OAuth2 (redirect URI = custom domain đã map)         │
│  ├── Setup Pub/Sub Topic                                        │
│  ├── Setup Gmail Watch                                          │
│  └── Deploy Cloud Functions                                     │
├─────────────────────────────────────────────────────────────────┤
│  PHẦN D: VERIFY & AUTOMATION (Bước 18-19)                       │
│  ├── Verify Deployment                                          │
│  └── Setup Gmail Watch Renewal Automation                       │
└─────────────────────────────────────────────────────────────────┘
```

**Tại sao phải deploy Cloud Run trước khi setup OAuth2?**
- OAuth2 yêu cầu **redirect URI** chính xác (VD: `https://autoland.yourdomain.com/api/test/gmail/callback`)
- Redirect URI phải là domain đã hoạt động
- Nếu setup OAuth2 trước khi có domain → Phải quay lại update OAuth2 → Dễ gây lỗi

---

## 📋 Mục Lục

**Phần A: Setup Infrastructure**
1. [Tổng quan](#tổng-quan)
2. [Prerequisites](#prerequisites)
3. [Bước 1: Tạo Google Cloud Account](#bước-1-tạo-google-cloud-account)
4. [Bước 2: Cài đặt Google Cloud CLI](#bước-2-cài-đặt-google-cloud-cli)
5. [Bước 3: Tạo Project](#bước-3-tạo-project)
6. [Bước 4: Enable APIs](#bước-4-enable-apis)
7. [Bước 5: Tạo Service Account](#bước-5-tạo-service-account)
8. [Bước 6: Tạo Document AI Processor](#bước-6-tạo-document-ai-processor)
9. [Bước 7: Tạo Cloud Storage Bucket](#bước-7-tạo-cloud-storage-bucket)
10. [Bước 8: Setup Database (Cloud SQL)](#bước-8-setup-database-cloud-sql)
11. [Bước 9: Cấu hình Secret Manager (Database)](#bước-9-cấu-hình-secret-manager-database)

**Phần B: Deploy Application**
1. [Bước 10: Build Docker Image](#bước-10-build-docker-image)
2. [Bước 11: Deploy to Cloud Run](#bước-11-deploy-to-cloud-run)
3. [Bước 12: Map Custom Domain](#bước-12-map-custom-domain)
4. [Bước 13: Run Database Migrations](#bước-13-run-database-migrations)

**Phần C: Setup Gmail Integration** *(Thực hiện SAU KHI có custom domain)*
1. [Bước 14: Setup OAuth2 cho Gmail](#bước-14-setup-oauth2-cho-gmail)
2. [Bước 15: Setup Pub/Sub và Gmail Watch](#bước-15-setup-pubsub-và-gmail-watch)
3. [Bước 16: Deploy Cloud Functions](#bước-16-deploy-cloud-functions)

**Phần D: Verify & Automation**
1. [Bước 17: Verify Deployment](#bước-17-verify-deployment)
2. [Bước 18: Setup Gmail Watch Renewal Automation](#bước-18-setup-gmail-watch-renewal-automation)

---

## Tổng quan

**Autoland Monitoring System** là hệ thống giám sát tình trạng thực hiện Autoland của đội tàu bay VietJet Air. Hệ thống:

- Tự động đọc email từ Gmail và extract PDF báo cáo Autoland
- Parse và lưu trữ dữ liệu vào PostgreSQL database
- Hiển thị dashboard với thống kê, alerts, và reports
- Track deadline autoland (mỗi 30 ngày/lần)
- Lưu trữ PDF files trên Cloud Storage
- **Hybrid PDF Parser System** (pdf2json FREE → Document AI PAID fallback) để tiết kiệm chi phí

**Tech Stack:**
- Frontend: Next.js 14, React 18, TypeScript, Tailwind CSS
- Backend: Next.js API Routes
- Database: PostgreSQL (Cloud SQL)
- Storage: Google Cloud Storage
- Deployment: Google Cloud Run
- APIs: Gmail API, Document AI (fallback), Pub/Sub
- PDF Processing: **pdf2json** (primary, FREE), **Document AI** (fallback, PAID)

---

## Prerequisites

### Yêu cầu hệ thống:
- ✅ Google Cloud account với billing enabled
- ✅ Gmail account để nhận báo cáo Autoland
- ✅ Google Cloud CLI (gcloud) đã được cài đặt và authenticated
- ✅ Docker (để build Docker image, optional - có thể dùng Cloud Build thay thế)

### Yêu cầu kiến thức:
- Cơ bản về command line (Bash/Linux)
- Hiểu cơ bản về Google Cloud Platform
- Cơ bản về PostgreSQL

---

## Bước 1: Tạo Google Cloud Account

1. Truy cập [Google Cloud Console](https://console.cloud.google.com/)
2. Đăng nhập với Google account
3. Click **Get started for free** hoặc **Try free trial**
4. Điền thông tin billing (cần credit card, nhưng có $300 free credit)
5. Chấp nhận terms và conditions
6. Click **Start my free trial**

**Lưu ý:** Free trial có $300 credit trong 90 ngày. Sau khi hết trial, bạn sẽ được charge theo usage.

---

## Bước 2: Cài đặt Google Cloud CLI

### Linux/Mac:

```bash
# Download và cài đặt
curl https://sdk.cloud.google.com | bash

# Restart shell
exec -l $SHELL

# Initialize
gcloud init

# Authenticate
gcloud auth login
```

### Verify installation:

```bash
gcloud --version
```

Bạn sẽ thấy output tương tự:
```
Google Cloud SDK 450.0.0
```

---

## Bước 3: Tạo Project

### Cách 1: Sử dụng gcloud CLI

```bash
# Set biến PROJECT_ID
export PROJECT_ID="autoland-vj"

# Tạo project mới
gcloud projects create $PROJECT_ID --name="Autoland Monitoring"

# Set project vừa tạo
gcloud config set project $PROJECT_ID

# Verify project
gcloud config get-value project
```

### Cách 2: Sử dụng Google Cloud Console

1. Vào [Google Cloud Console](https://console.cloud.google.com/)
2. Click vào dropdown project ở góc trên cùng
3. Click **NEW PROJECT**
4. **Project name:** `Autoland Monitoring`
5. **Project ID:** `autoland-VJ` (hoặc tự chọn)
6. Click **CREATE**
7. Chọn project vừa tạo

### Enable Billing

**⚠️ BẮT BUỘC:** Billing account phải được link trước khi tạo các tài nguyên có phí như Cloud SQL, Cloud Run, Document AI, v.v.

1. Vào [Billing](https://console.cloud.google.com/billing)
2. Click **LINK A BILLING ACCOUNT**
3. Chọn billing account hoặc tạo mới
4. Link với project `autoland-vj`

**Lưu ý:** 
- Free trial có $300 credit trong 90 ngày
- Cloud SQL là dịch vụ có phí, cần billing account để tạo instance
- Nếu chưa link billing, lệnh `gcloud sql instances create` sẽ báo lỗi

---

## Bước 4: Enable APIs

### Enable APIs qua gcloud CLI:

**Cách 1: Enable tất cả trong 1 lệnh (Khuyến nghị - tránh rate limit)**

```bash
export PROJECT_ID="autoland-vj"

# Enable tất cả APIs cần thiết trong 1 lệnh
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  sql-component.googleapis.com \
  sqladmin.googleapis.com \
  storage.googleapis.com \
  documentai.googleapis.com \
  pubsub.googleapis.com \
  cloudfunctions.googleapis.com \
  eventarc.googleapis.com \
  secretmanager.googleapis.com \
  cloudscheduler.googleapis.com \
  --project=$PROJECT_ID
```

**⚠️ Lưu ý:** Nếu chạy từng lệnh riêng lẻ quá nhanh, có thể gặp lỗi **Rate Limit (HTTP 429)**:
```
Quota exceeded for quota metric 'Mutate requests' and limit 'Mutate requests per minute'
```
Trong trường hợp này, đợi 1 phút rồi chạy lại, hoặc sử dụng Cách 1 ở trên.

<details>
<summary><strong>Cách 2: Enable từng API riêng lẻ (Click để xem)</strong></summary>

```bash
export PROJECT_ID="autoland-vj"

# Enable Cloud Run API
gcloud services enable run.googleapis.com --project=$PROJECT_ID

# Enable Cloud Build API
gcloud services enable cloudbuild.googleapis.com --project=$PROJECT_ID

# Enable Artifact Registry API
gcloud services enable artifactregistry.googleapis.com --project=$PROJECT_ID

# Enable Cloud SQL APIs
gcloud services enable sql-component.googleapis.com --project=$PROJECT_ID
gcloud services enable sqladmin.googleapis.com --project=$PROJECT_ID

# Enable Cloud Storage API
gcloud services enable storage.googleapis.com --project=$PROJECT_ID

# Enable Document AI API
gcloud services enable documentai.googleapis.com --project=$PROJECT_ID

# Enable Pub/Sub API
gcloud services enable pubsub.googleapis.com --project=$PROJECT_ID

# Enable Cloud Functions API
gcloud services enable cloudfunctions.googleapis.com --project=$PROJECT_ID

# Enable Eventarc API (BẮT BUỘC cho Cloud Functions Gen2)
gcloud services enable eventarc.googleapis.com --project=$PROJECT_ID

# Enable Secret Manager API
gcloud services enable secretmanager.googleapis.com --project=$PROJECT_ID

# Enable Cloud Scheduler API (để tự động renew Gmail Watch)
gcloud services enable cloudscheduler.googleapis.com --project=$PROJECT_ID
```

</details>

### Enable Gmail API qua Google Cloud Console

Gmail API thường không thể enable qua CLI do permission issues. **Phải enable qua Console:**

1. Vào [Google Cloud Console](https://console.cloud.google.com/)
2. Chọn project `autoland-vj`
3. Vào **APIs & Services** > **Library**
4. Tìm "Gmail API":
   - Gõ "Gmail API" vào search box
   - Click vào "Gmail API" trong kết quả
   - Click **ENABLE**
5. Đợi vài giây để API được enable

### Verify APIs đã được enable:

```bash
gcloud services list --enabled --project=$PROJECT_ID | grep -E "(gmail|storage|documentai|run|cloudbuild|sql|pubsub|functions|secretmanager|scheduler|eventarc)"
```

Hoặc kiểm tra trong Console:
- Vào **APIs & Services** > **Enabled APIs**
- Kiểm tra có các APIs sau:
  - ✅ Gmail API
  - ✅ Cloud Storage API
  - ✅ Document AI API
  - ✅ Cloud Run API
  - ✅ Cloud Build API
  - ✅ Cloud SQL Admin API (sqladmin.googleapis.com)
  - ✅ Cloud SQL Component API (sql-component.googleapis.com)
  - ✅ Pub/Sub API
  - ✅ Cloud Functions API
  - ✅ **Eventarc API** (BẮT BUỘC cho Cloud Functions Gen2)
  - ✅ Secret Manager API
  - ✅ Cloud Scheduler API (để tự động renew Gmail Watch)

---

## Bước 5: Tạo Service Account

### Tạo Service Account:

```bash
export PROJECT_ID="autoland-vj"

# Tạo Service Account
gcloud iam service-accounts create autoland-service \
    --display-name="Autoland Monitoring Service Account" \
    --project=$PROJECT_ID
```

### Grant permissions:

```bash
# Storage Admin (để upload/download PDF)
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:autoland-service@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/storage.admin"

# Document AI API User (để extract text từ PDF)
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:autoland-service@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/documentai.apiUser"

# Cloud SQL Client (để kết nối database)
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:autoland-service@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/cloudsql.client"

# Secret Manager Secret Accessor (để đọc secrets)
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:autoland-service@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"

# Cloud Build Builder (nếu cần deploy Cloud Functions)
# Lấy project number trước
export PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member=serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com \
  --role=roles/cloudbuild.builds.builder 
```

### Download Service Account Key (Cho các services khác):

```bash
# Download key file
gcloud iam service-accounts keys create ./gcp-key.json \
    --iam-account=autoland-service@$PROJECT_ID.iam.gserviceaccount.com \
    --project=$PROJECT_ID
```

**Lưu ý:**
- File `gcp-key.json` sẽ được tạo trong thư mục hiện tại
- Đảm bảo file này nằm trong thư mục root của project
- **KHÔNG commit file này lên Git!** (đã có trong `.gitignore`)

---

## Bước 6: Tạo Document AI Processor

Document AI processors không thể tạo qua gcloud CLI. **Phải tạo qua Google Cloud Console:**

1. Vào [Google Cloud Console](https://console.cloud.google.com/)
2. Chọn project `autoland-vj`
3. Vào **Document AI** (tìm trong menu hoặc search "Document AI")
4. Nếu lần đầu, click **GET STARTED** hoặc **CREATE PROCESSOR**
5. **Processor Type:** Chọn **Document OCR**
6. **Processor name:** `autoland-pdf-processor`
7. **Region:** Chọn **US (United States)**
   
   > ⚠️ **Lưu ý:** Document AI chỉ hỗ trợ 2 regions: `us` và `eu`. Khuyến nghị chọn **US** vì pricing tốt hơn.
   
8. Click **CREATE**

### Lấy Processor ID:

1. Trong Document AI Console, vào **Processors** > **My processors**
2. Click vào processor vừa tạo (`autoland-pdf-processor`)
3. Trong trang **Details**, tìm **Processor ID** hoặc copy từ URL
4. Format sẽ là:
   ```
   projects/autoland-vj/locations/us/processors/abc123def456
   ```
5. **Copy toàn bộ Processor ID này** để dùng trong Cloud Run deployment (Bước 11)

**Lưu ý:** Processor ID cần để cấu hình trong Cloud Run environment variables. Latency từ `asia-southeast1` (Cloud Run) đến `us` (Document AI) là chấp nhận được vì Document AI chỉ được dùng làm fallback (~15% cases).

---

## Bước 7: Tạo Cloud Storage Bucket

```bash
export PROJECT_ID="autoland-vj"
export BUCKET_NAME="autoland-reports"

# Tạo bucket để lưu PDF files
gsutil mb -p $PROJECT_ID -c STANDARD -l asia-southeast1 gs://$BUCKET_NAME

# Verify bucket đã được tạo
gsutil ls gs://$BUCKET_NAME
```

**Lưu ý:** Ghi nhớ `BUCKET_NAME` để dùng trong Cloud Run deployment

---

## Bước 8: Setup Database (Cloud SQL)

**⚠️ QUAN TRỌNG:** Đảm bảo đã link billing account ở Bước 3 trước khi tạo Cloud SQL instance. Cloud SQL là dịch vụ có phí và yêu cầu billing account.

### Tạo Cloud SQL Instance:

```bash
export PROJECT_ID="autoland-vj"
export DB_PASSWORD="YOUR_SECURE_PASSWORD"  # Thay bằng password mạnh

# Tạo PostgreSQL instance
gcloud sql instances create autoland-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=asia-southeast1 \
  --storage-auto-increase \
  --storage-size=10GB \
  --project=$PROJECT_ID

# Đợi instance được tạo (có thể mất 5-10 phút)
# Kiểm tra status:
gcloud sql instances describe autoland-db --project=$PROJECT_ID
```

### Tạo Database:

```bash
# Tạo database
gcloud sql databases create autoland \
  --instance=autoland-db \
  --project=$PROJECT_ID
```

### Tạo User:

```bash
# Tạo user
gcloud sql users create autoland \
  --instance=autoland-db \
  --password=$DB_PASSWORD \
  --project=$PROJECT_ID
```

### Lấy Connection Name:

```bash
# Lấy connection name để dùng trong Cloud Run
gcloud sql instances describe autoland-db \
  --project=$PROJECT_ID \
  --format='value(connectionName)'
```

Output sẽ là: `PROJECT_ID:asia-southeast1:autoland-db`

**Lưu ý:** Ghi nhớ connection name này để dùng trong deployment

---

## Bước 9: Cấu hình Secret Manager (Database)

Tạo secret cho database password trước khi deploy Cloud Run:

```bash
export PROJECT_ID="autoland-vj"
# ⚠️ Sử dụng CÙNG password đã dùng khi tạo Cloud SQL user ở Bước 8
export DB_PASSWORD="your-db-password"  # Thay bằng password đã tạo

# Tạo secret cho database password
echo -n "$DB_PASSWORD" | gcloud secrets create autoland-db-password \
  --data-file=- \
  --project=$PROJECT_ID

# Tạo Service Account cho Cloud Run
gcloud iam service-accounts create autoland-vj-runner \
  --display-name="Autoland Monitoring Cloud Run Service Account" \
  --project=$PROJECT_ID

export SA_EMAIL="autoland-vj-runner@$PROJECT_ID.iam.gserviceaccount.com"

# Grant quyền truy cập secret
gcloud secrets add-iam-policy-binding autoland-db-password \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/secretmanager.secretAccessor" \
  --project=$PROJECT_ID

# Grant Cloud SQL Client role
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/cloudsql.client"

# Grant Storage Admin role
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/storage.admin"

# Grant Document AI API User role
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/documentai.apiUser"
```

---

## Bước 10: Build Docker Image

### Tạo Artifact Registry repository:

```bash
export PROJECT_ID="autoland-vj"
export REGION="asia-southeast1"
export REPO_NAME="autoland-vj"

# Tạo repository
gcloud artifacts repositories create $REPO_NAME \
  --repository-format=docker \
  --location=$REGION \
  --description="Docker repository for Autoland Monitoring" \
  --project=$PROJECT_ID
```

### Configure Docker authentication:

```bash
gcloud auth configure-docker $REGION-docker.pkg.dev --project=$PROJECT_ID
```

### Build và push Docker image:

```bash
export IMAGE_NAME="$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/autoland-vj"

# Cách 1: Build với cloudbuild.yaml (khuyến nghị - có cả SHORT_SHA và latest tags)
gcloud builds submit \
  --config cloudbuild.yaml \
  --project=$PROJECT_ID

# Cách 2: Build trực tiếp với Dockerfile (nhanh hơn, chỉ có latest tag)
gcloud builds submit \
  --tag $IMAGE_NAME:latest \
  --project=$PROJECT_ID \
  --timeout=1200
```

**Lưu ý:** Dockerfile nằm trong `docker/Dockerfile`. Lệnh trên sẽ tự động tìm Dockerfile ở root hoặc dùng cloudbuild.yaml để chỉ định path.

---

## Bước 11: Deploy to Cloud Run

```bash
export PROJECT_ID="autoland-vj"
export REGION="asia-southeast1"
export IMAGE_NAME="$REGION-docker.pkg.dev/$PROJECT_ID/autoland-vj/autoland-vj:latest"
export SA_EMAIL="autoland-vj-runner@$PROJECT_ID.iam.gserviceaccount.com"
export CONNECTION_NAME="$PROJECT_ID:asia-southeast1:autoland-db"

# Deploy
gcloud run deploy autoland-vj \
  --image $IMAGE_NAME \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --service-account $SA_EMAIL \
  --add-cloudsql-instances $CONNECTION_NAME \
  --set-env-vars "APP_ENV=production" \
  --set-env-vars "DB_HOST=/cloudsql/$CONNECTION_NAME" \
  --set-env-vars "DB_PORT=5432" \
  --set-env-vars "DB_NAME=autoland" \
  --set-env-vars "DB_USER=autoland" \
  --set-secrets "DB_PASSWORD=autoland-db-password:latest" \
  --set-env-vars "GCP_PROJECT_ID=$PROJECT_ID" \
  --set-env-vars "GCP_STORAGE_BUCKET=autoland-reports" \
  --set-env-vars "DOCUMENT_AI_PROCESSOR_ID=projects/$PROJECT_ID/locations/us/processors/YOUR_PROCESSOR_ID" \
  --set-env-vars "NEXT_PUBLIC_APP_URL=https://YOUR_DOMAIN" \
  --memory 1Gi \
  --cpu 1 \
  --timeout 300 \
  --min-instances 0 \
  --max-instances 10 \
  --project=$PROJECT_ID
```

**Lưu ý:**
- Thay `YOUR_PROCESSOR_ID` bằng Processor ID từ Bước 6
- Thay `YOUR_DOMAIN` bằng domain sẽ map (VD: `autoland.blocksync.me`)

---

## Bước 12: Map Custom Domain

### Cấu hình DNS trước:

Thêm DNS records cho subdomain của bạn:

| Type | Name | Value |
|------|------|-------|
| **CNAME** | `autoland` | `ghs.googlehosted.com.` |

**Hoặc** nếu dùng A records:

| Type | Name | Value |
|------|------|-------|
| **A** | `autoland` | `216.239.32.21` |
| **A** | `autoland` | `216.239.34.21` |
| **A** | `autoland` | `216.239.36.21` |
| **A** | `autoland` | `216.239.38.21` |

### Map domain với Cloud Run:

```bash
export PROJECT_ID="autoland-vj"
export REGION="asia-southeast1"
export DOMAIN="autoland.yourdomain.com"  # Thay bằng domain của bạn (VD: autoland.blocksync.me)

# Lưu ý: Cần dùng gcloud beta cho domain-mappings
gcloud beta run domain-mappings create \
  --service=autoland-vj \
  --domain=$DOMAIN \
  --region=$REGION \
  --project=$PROJECT_ID
```

### Verify domain mapping:

```bash
gcloud beta run domain-mappings describe \
  --domain=$DOMAIN \
  --region=$REGION \
  --project=$PROJECT_ID
```

**Lưu ý:** DNS propagation có thể mất 5-30 phút. Đợi domain hoạt động trước khi tiếp tục Bước 14.

---

## Bước 13: Run Database Migrations

### Connect to Cloud SQL:

```bash
export PROJECT_ID="autoland-vj"

# Connect to Cloud SQL
gcloud sql connect autoland-db --user=autoland --project=$PROJECT_ID
```

### Run migrations trong psql:

```sql
-- Run migration 1
\i database/migrations/001_create_autoland_tables.sql

-- Run migration 2
\i database/migrations/002_create_dashboard_tables.sql

-- Run migration 3
\i database/migrations/003_fix_calculate_autoland_to_go.sql

-- Run migration 4
\i database/migrations/004_change_visibility_rvr_to_varchar.sql

-- Run migration 5 (Hybrid PDF Parser metrics)
\i database/migrations/005_add_extraction_metrics.sql

-- Verify tables
\dt

-- Exit
\q
```

---

# PHẦN C: SETUP GMAIL INTEGRATION

> **⚠️ QUAN TRỌNG:** Thực hiện phần này SAU KHI custom domain đã hoạt động (Bước 12)

---

## Bước 14: Setup OAuth2 cho Gmail

**⚠️ QUAN TRỌNG:** 
- Gmail API yêu cầu OAuth2 cho personal accounts
- Redirect URI phải là domain đã map ở Bước 12

### Bước 14.1: Tạo OAuth Consent Screen

1. Vào [Google Cloud Console](https://console.cloud.google.com/)
2. Chọn project của bạn
3. Vào **APIs & Services** > **OAuth consent screen**
4. **User Type:** Chọn **External**
5. Click **CREATE**
6. **App information:**
   - **App name:** `Autoland Monitoring`
   - **User support email:** Email của bạn
   - **Developer contact:** Email của bạn
7. Click **SAVE AND CONTINUE**
8. **Scopes:** Click **ADD OR REMOVE SCOPES**
   - Tìm và chọn: `https://www.googleapis.com/auth/gmail.readonly`
   - Click **UPDATE** > **SAVE AND CONTINUE**
9. **Test users:** Click **ADD USERS**
   - Thêm email Gmail sẽ nhận report
   - Click **ADD** > **SAVE AND CONTINUE**
10. Click **BACK TO DASHBOARD**

### Bước 14.2: Tạo OAuth Client ID

1. Vào **APIs & Services** > **Credentials**
2. Click **+ CREATE CREDENTIALS** > **OAuth client ID**
3. **Application type:** Chọn **Web application**
4. **Name:** `Autoland Monitoring Web Client`
5. **Authorized redirect URIs:** Thêm URI sau (thay YOUR_DOMAIN bằng domain đã map):
   ```
   https://YOUR_DOMAIN/api/test/gmail/callback
   ```
   
   **Ví dụ:**
   ```
   https://autoland.blocksync.me/api/test/gmail/callback
   ```

6. Click **CREATE**
7. **Lưu lại Client ID và Client Secret**

---

## Bước 15: Setup Pub/Sub và Gmail Watch

Nếu muốn tự động xử lý email qua Pub/Sub, thực hiện các bước sau:

### Tạo Pub/Sub Topic:

```bash
export PROJECT_ID="autoland-vj"
export TOPIC_NAME="gmail-notifications"

# Tạo Pub/Sub topic
gcloud pubsub topics create $TOPIC_NAME --project=$PROJECT_ID
```

### Grant Gmail Service Account Permission:

**⚠️ BẮT BUỘC - PHẢI LÀM TRƯỚC KHI CHẠY `setup-gmail-watch.js`:**

```bash
# Gmail service account email (của Google, không phải email của bạn)
export GMAIL_SA="gmail-api-push@system.gserviceaccount.com"

# Grant permission để Gmail có thể publish messages vào topic
gcloud pubsub topics add-iam-policy-binding $TOPIC_NAME \
    --member="serviceAccount:$GMAIL_SA" \
    --role="roles/pubsub.publisher" \
    --project=$PROJECT_ID
```

**Lưu ý:** 
- `gmail-api-push@system.gserviceaccount.com` là service account của Google, không cần thay đổi
- Nếu bỏ qua bước này, sẽ gặp lỗi `403 Forbidden: User not authorized to perform this action` khi chạy `setup-gmail-watch.js`

### Grant Permissions cho Build Service Account:

**⚠️ BẮT BUỘC:** Trước khi deploy Cloud Function Gen2, cần grant permissions cho default compute service account:

```bash
export PROJECT_ID="autoland-vj"

# Lấy project number
export PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')

# Grant cloudbuild.builds.builder role (BẮT BUỘC cho Cloud Functions Gen2)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member=serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com \
  --role=roles/cloudbuild.builds.builder

# Grant logging.logWriter để function có thể ghi logs
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member=serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com \
  --role=roles/logging.logWriter

# Grant artifactregistry.writer để push Docker image
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member=serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com \
  --role=roles/artifactregistry.writer
```

**Lưu ý:** Đợi 1-2 phút sau khi grant permissions trước khi deploy.

### Tạo Secrets cho Cloud Function:

**⚠️ BẮT BUỘC:** Tạo các secrets trong Secret Manager trước khi deploy Cloud Function:

```bash
export PROJECT_ID="autoland-vj"
export SA_EMAIL="autoland-service@$PROJECT_ID.iam.gserviceaccount.com"
export GOOGLE_CLIENT_SECRET="GOCSPX-your-client-secret"  # Thay bằng Client Secret thật

# 1. Tạo secret cho Google Client Secret
echo -n "$GOOGLE_CLIENT_SECRET" | gcloud secrets create google-client-secret \
  --data-file=- \
  --project=$PROJECT_ID

# Grant quyền cho service account
gcloud secrets add-iam-policy-binding google-client-secret \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/secretmanager.secretAccessor" \
  --project=$PROJECT_ID

# 2. Tạo placeholder cho OAuth Refresh Token (sẽ update sau khi chạy setup-gmail-watch.js)
echo -n "placeholder-will-update-after-gmail-watch-setup" | gcloud secrets create gmail-oauth-refresh-token \
  --data-file=- \
  --project=$PROJECT_ID

# Grant quyền cho service account
gcloud secrets add-iam-policy-binding gmail-oauth-refresh-token \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/secretmanager.secretAccessor" \
  --project=$PROJECT_ID
```

**Lưu ý:** 
- `google-client-secret`: Lấy từ Google Cloud Console > APIs & Services > Credentials > OAuth 2.0 Client IDs
- `gmail-oauth-refresh-token`: Sẽ được update sau khi chạy `setup-gmail-watch.js` (xem phần Setup Gmail Watch)

### Deploy Cloud Function:

```bash
cd cloud-functions/gmail-pubsub-processor

# Install dependencies
npm install

# Deploy Cloud Function
# Đảm bảo export các biến cần thiết trước
export PROJECT_ID="autoland-vj"
export TOPIC_NAME="gmail-notifications"
export FUNCTION_NAME="gmail-pubsub-processor"
export REGION="asia-southeast1"
export SA_EMAIL="autoland-service@$PROJECT_ID.iam.gserviceaccount.com"

# Deploy với custom service account và Secret Manager
# Lưu ý: Cloud Function gửi PDF đến API endpoint, không cần kết nối trực tiếp Cloud SQL
gcloud functions deploy $FUNCTION_NAME \
  --gen2 \
  --runtime=nodejs20 \
  --region=$REGION \
  --source=. \
  --entry-point=processGmailNotification \
  --trigger-topic=$TOPIC_NAME \
  --service-account=$SA_EMAIL \
  --set-env-vars="GCP_PROJECT_ID=$PROJECT_ID" \
  --set-env-vars="GCP_STORAGE_BUCKET=autoland-reports" \
  --set-env-vars="DOCUMENT_AI_PROCESSOR_ID=projects/$PROJECT_ID/locations/us/processors/YOUR_PROCESSOR_ID" \
  --set-env-vars="GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com" \
  --set-env-vars="API_BASE_URL=https://YOUR_DOMAIN" \
  --set-secrets="GOOGLE_CLIENT_SECRET=google-client-secret:latest" \
  --set-secrets="OAUTH_REFRESH_TOKEN=gmail-oauth-refresh-token:latest" \
  --memory=2GB \
  --timeout=540s \
  --max-instances=1 \
  --min-instances=0 \
  --allow-unauthenticated \
  --project=$PROJECT_ID
```

**Lưu ý:** 
- Thay `YOUR_PROCESSOR_ID` bằng Processor ID từ Bước 6
- Tất cả secrets đã được tạo trong Bước 11 (Secret Manager)
- Cloud Function sẽ sử dụng secrets từ Secret Manager thay vì hardcode trong environment variables

### Setup Gmail Watch:

**⚠️ CHECKLIST TRƯỚC KHI CHẠY `setup-gmail-watch.js`:**

| # | Yêu cầu | Cách kiểm tra |
|---|---------|---------------|
| 1 | ✅ Pub/Sub topic đã được tạo | `gcloud pubsub topics list --project=$PROJECT_ID` |
| 2 | ✅ Gmail SA đã có quyền publish | Đã chạy `gcloud pubsub topics add-iam-policy-binding` ở trên |
| 3 | ✅ Redirect URI đã được thêm vào OAuth Client | Console > APIs & Services > Credentials > OAuth Client > Authorized redirect URIs phải có `http://localhost:3000/oauth2callback` |
| 4 | ✅ Email đã được thêm vào Test Users | Console > APIs & Services > OAuth consent screen > Test users |

**Bước 1: Cài đặt dependencies:**

```bash
npm install googleapis
```

**Bước 2: Chạy script setup Gmail Watch:**

**Cho Cloud Shell hoặc remote servers (Manual Flow - Khuyến nghị):**

```bash
cd ~/your-project-folder  # Thư mục chứa project

# Install dependencies nếu chưa có
npm install

# Export các biến môi trường
export GCP_PROJECT_ID="autoland-vj"
export GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"  # Từ OAuth2 credentials

# Lấy secret từ Secret Manager để đảm bảo credentials khớp nhau
export GOOGLE_CLIENT_SECRET=$(gcloud secrets versions access latest --secret=google-client-secret --project=$GCP_PROJECT_ID)

# Có thể dùng localhost redirect URI cho Cloud Shell (manual flow)
export GOOGLE_REDIRECT_URI="http://localhost:3000/oauth2callback"
export PUBSUB_TOPIC="gmail-notifications"
export MANUAL_FLOW=true  # Bật manual flow cho Cloud Shell

# Chạy script
node scripts/setup-gmail-watch.js
```

**⚠️ QUAN TRỌNG:** 
- `GOOGLE_REDIRECT_URI` phải được thêm vào OAuth2 Client trong Google Cloud Console
- Có thể dùng `http://localhost:3000/oauth2callback` cho Cloud Shell (manual flow)
- `GOOGLE_CLIENT_SECRET` phải khớp với secret trong Secret Manager

**Quy trình Manual Flow:**
1. Script sẽ hiển thị URL authorization
2. Copy URL và mở trong browser
3. Đăng nhập và cấp quyền cho ứng dụng
4. Sau khi authorize, browser sẽ redirect về localhost (sẽ không load được - đây là bình thường)
5. Copy toàn bộ redirect URL từ browser address bar (hoặc chỉ phần `code=...`)
6. Paste vào terminal khi script hỏi
7. Script sẽ tự động extract code và setup Gmail Watch
8. **Script sẽ in ra REFRESH TOKEN** - copy và lưu lại

**🔧 Common Errors và Solutions:**

| Error | Nguyên nhân | Giải pháp |
|-------|-------------|-----------|
| `redirect_uri_mismatch` | Redirect URI chưa được thêm vào OAuth Client | Thêm `http://localhost:3000/oauth2callback` vào Authorized redirect URIs |
| `access_denied` | Email chưa được thêm vào Test Users | Thêm email vào OAuth consent screen > Test users |
| `403 Forbidden: User not authorized` | Gmail SA chưa có quyền publish | Chạy lệnh `gcloud pubsub topics add-iam-policy-binding` ở trên |

<details>
<summary><strong>🔄 Recovery Steps: Nếu Authorization thành công nhưng Gmail Watch thất bại</strong></summary>

Nếu bạn thấy output như sau:
```
✅ Authorization successful!
🔑 REFRESH TOKEN: 1//0gxxxxxx...

Error setting up Gmail Watch: 403 Forbidden: User not authorized to perform this action.
```

**Đừng lo!** Refresh token đã được lấy thành công. Chỉ cần làm theo các bước sau:

**Bước 1: Lưu Refresh Token vào Secret Manager**

```bash
export PROJECT_ID="autoland-vj"
export REFRESH_TOKEN="1//0g..."  # Thay bằng refresh token từ output

# Update secret
echo -n "$REFRESH_TOKEN" | gcloud secrets versions add gmail-oauth-refresh-token \
  --data-file=- \
  --project=$PROJECT_ID
```

**Bước 2: Grant quyền cho Gmail Service Account**

```bash
export GMAIL_SA="gmail-api-push@system.gserviceaccount.com"
export TOPIC_NAME="gmail-notifications"

gcloud pubsub topics add-iam-policy-binding $TOPIC_NAME \
    --member="serviceAccount:$GMAIL_SA" \
    --role="roles/pubsub.publisher" \
    --project=$PROJECT_ID
```

**Bước 3: Chạy lại script**

```bash
node scripts/setup-gmail-watch.js
```

Lần này script sẽ sử dụng refresh token đã lưu và setup Gmail Watch thành công.

</details>

**Output mẫu:**
```
✅ Authorization successful!
Refresh token obtained. You can use this to refresh access tokens.

🔑 REFRESH TOKEN (save this to Secret Manager):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1//0gxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**⚠️ PHÂN BIỆT REFRESH TOKEN vs AUTHORIZATION CODE:**

| Token Type | Format | Mục đích |
|------------|--------|----------|
| **Authorization Code** | `4/0Axxxxxx...` | Dùng 1 lần để đổi lấy tokens |
| **Refresh Token** | `1//0gxxxxxx...` | Lưu vào Secret Manager để refresh access token |

**⚠️ QUAN TRỌNG: Sau khi chạy script, cập nhật refresh token vào Secret Manager:**

```bash
# Copy refresh token từ output của script (BẮT ĐẦU BẰNG "1//")
export REFRESH_TOKEN="1//0g..."  # Thay bằng refresh token thực tế
export PROJECT_ID="autoland-vj"

# Update secret (secret đã được tạo từ bước trước)
echo -n "$REFRESH_TOKEN" | gcloud secrets versions add gmail-oauth-refresh-token \
  --data-file=- \
  --project=$PROJECT_ID

# Verify refresh token đã lưu đúng
gcloud secrets versions access latest --secret=gmail-oauth-refresh-token --project=$PROJECT_ID
# Output phải bắt đầu bằng "1//" - nếu bắt đầu bằng "4/0A" thì SAI!
```

**⚠️ Nếu Cloud Function báo lỗi `invalid_grant` sau khi update secret:**

Cloud Function có thể cache secret values. Cần redeploy để force refresh:

```bash
# Redeploy Cloud Function để force refresh secrets
cd cloud-functions/renew-gmail-watch

gcloud functions deploy renew-gmail-watch \
  --gen2 --runtime=nodejs20 --region=$REGION --source=. \
  --entry-point=renewGmailWatch --trigger-http \
  --service-account=$SA_EMAIL \
  --set-env-vars="GCP_PROJECT_ID=$PROJECT_ID" \
  --set-env-vars="PUBSUB_TOPIC=gmail-notifications" \
  --set-env-vars="GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com" \
  --set-secrets="GOOGLE_CLIENT_SECRET=google-client-secret:latest" \
  --set-secrets="OAUTH_REFRESH_TOKEN=gmail-oauth-refresh-token:latest" \
  --memory=256Mi --timeout=60s --allow-unauthenticated \
  --project=$PROJECT_ID
```

### Setup Gmail Watch Renewal Automation

Gmail Watch API có limitation là **watch request chỉ có hiệu lực trong 7 ngày**. Sau đó, bạn sẽ không nhận được notifications nữa.

**2 Options:**

#### Option 1: Automatic Renewal (Production - Khuyến nghị)

Cloud Scheduler tự động gọi Cloud Function mỗi 6 ngày để renew Gmail Watch.

```bash
# --- Step 1: Get Refresh Token ---
export MANUAL_FLOW=true
export GCP_PROJECT_ID="autoland-vj"
export GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
export GOOGLE_CLIENT_SECRET="GOCSPX-your-client-secret"
export GOOGLE_REDIRECT_URI="http://localhost:3000/oauth2callback"
export PUBSUB_TOPIC="gmail-notifications"

node scripts/setup-gmail-watch.js
# Copy refresh token từ output (bắt đầu bằng "1//0g...")

# --- Step 2: Update Refresh Token in Secret Manager ---
# (Secret đã được tạo từ bước "Tạo Secrets cho Cloud Function")
export PROJECT_ID="autoland-vj"
export REFRESH_TOKEN="1//0g..."  # Thay bằng refresh token thực tế

echo -n "$REFRESH_TOKEN" | gcloud secrets versions add gmail-oauth-refresh-token \
  --data-file=- --project=$PROJECT_ID

# --- Step 3: Deploy Cloud Function ---
cd cloud-functions/renew-gmail-watch
npm install

export REGION="asia-southeast1"
export SA_EMAIL="autoland-service@$PROJECT_ID.iam.gserviceaccount.com"

gcloud functions deploy renew-gmail-watch \
  --gen2 --runtime=nodejs20 --region=$REGION --source=. \
  --entry-point=renewGmailWatch --trigger-http \
  --service-account=$SA_EMAIL \
  --set-env-vars="GCP_PROJECT_ID=$PROJECT_ID" \
  --set-env-vars="PUBSUB_TOPIC=gmail-notifications" \
  --set-env-vars="GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com" \
  --set-secrets="GOOGLE_CLIENT_SECRET=google-client-secret:latest" \
  --set-secrets="OAUTH_REFRESH_TOKEN=gmail-oauth-refresh-token:latest" \
  --memory=256Mi --timeout=60s --allow-unauthenticated \
  --project=$PROJECT_ID

# --- Step 4: Create Cloud Scheduler Job ---
gcloud scheduler jobs create http renew-gmail-watch-weekly \
  --location=$REGION --schedule="0 0 */6 * *" \
  --uri="https://$REGION-$PROJECT_ID.cloudfunctions.net/renew-gmail-watch" \
  --http-method=POST --oidc-service-account-email=$SA_EMAIL \
  --project=$PROJECT_ID
```

**Cron Schedule:**
- `0 0 */6 * *` - Mỗi 6 ngày lúc 00:00 UTC (khuyến nghị)
- `0 2 * * 0` - Mỗi Chủ nhật lúc 02:00 UTC (weekly)
- `0 0 * * 1` - Mỗi Thứ Hai lúc 00:00 UTC (weekly)

#### Option 2: Manual Renewal (Development/Testing)

Chạy thủ công mỗi tuần để renew Gmail Watch:

```bash
export GCP_PROJECT_ID="autoland-vj"
export GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
export GOOGLE_CLIENT_SECRET="GOCSPX-your-client-secret"
export GOOGLE_REDIRECT_URI="http://localhost:3000/oauth2callback"
export PUBSUB_TOPIC="gmail-notifications"
export MANUAL_FLOW=true

node scripts/setup-gmail-watch.js
```

### Monitor & Troubleshoot

```bash
# Test Cloud Function manually
# Thay PROJECT_ID bằng project ID của bạn
curl -X POST https://asia-southeast1-$PROJECT_ID.cloudfunctions.net/renew-gmail-watch

# View Cloud Function logs
gcloud functions logs read renew-gmail-watch --region=asia-southeast1 --limit=50 --project=$PROJECT_ID

# View Cloud Scheduler logs
gcloud scheduler jobs logs describe renew-gmail-watch-weekly --location=asia-southeast1 --project=$PROJECT_ID

# Manually trigger scheduler job
gcloud scheduler jobs run renew-gmail-watch-weekly --location=asia-southeast1 --project=$PROJECT_ID

# Update refresh token (nếu bị revoke)
export NEW_REFRESH_TOKEN="1//0g..."
echo -n "$NEW_REFRESH_TOKEN" | gcloud secrets versions add gmail-oauth-refresh-token \
  --data-file=- --project=$PROJECT_ID
```

**Common Errors:**

| Error | Cause | Solution |
|-------|-------|----------|
| `Invalid Credentials` | Refresh token revoked | Run `setup-gmail-watch.js` again to get new token |
| `Permission Denied` | SA lacks secret access | Grant `roles/secretmanager.secretAccessor` role |
| `redirect_uri_mismatch` | OAuth2 URI not configured | Add `http://localhost:3000/oauth2callback` to OAuth client |

**Architecture:**
```
Cloud Scheduler (every 6 days)
    ↓
Cloud Function (renew-gmail-watch)
    ↓
Gmail API (users.watch)
    ↓
Pub/Sub Topic (gmail-notifications)
```

---

# PHẦN D: VERIFY & AUTOMATION

---

## Bước 17: Verify Deployment

### Check service status:

```bash
gcloud run services describe autoland-vj \
  --region $REGION \
  --project=$PROJECT_ID
```

### Test service:

```bash
# Thay YOUR_DOMAIN bằng domain đã map (VD: autoland.blocksync.me)
export DOMAIN="YOUR_DOMAIN"

# Test health endpoint (nếu có)
curl https://$DOMAIN/api/health

# Test dashboard
curl https://$DOMAIN/dashboard
```

### View logs:

```bash
# Stream logs
gcloud run logs read autoland-vj \
  --region $REGION \
  --follow \
  --project=$PROJECT_ID

# View last 100 lines
gcloud run logs read autoland-vj \
  --region $REGION \
  --limit 100 \
  --project=$PROJECT_ID
```

### Update OAuth2 Redirect URI:

Đảm bảo OAuth2 redirect URI đã được cấu hình với custom domain:

1. Vào [Google Cloud Console](https://console.cloud.google.com/)
2. Chọn project của bạn
3. Vào **APIs & Services** > **Credentials**
4. Click vào OAuth Client ID đã tạo
5. Kiểm tra **Authorized redirect URIs** có:
   ```
   https://YOUR_DOMAIN/api/test/gmail/callback
   ```
   **Ví dụ:** `https://autoland.blocksync.me/api/test/gmail/callback`
   
   Nếu chưa có, thêm vào và click **SAVE**

### Verify Domain Mapping:

```bash
# Kiểm tra domain mapping status
# Thay YOUR_DOMAIN bằng domain đã map
gcloud beta run domain-mappings describe \
  --domain=YOUR_DOMAIN \
  --region=$REGION \
  --project=$PROJECT_ID
```

**Lưu ý:** Nếu domain chưa được map, thực hiện Bước 14 (Map Custom Domain) trước.

---

## 🎉 Hoàn thành!

Hệ thống Autoland Monitoring đã được deploy thành công lên Google Cloud Run!

### Next Steps:

1. ✅ Test OAuth2 flow để authorize Gmail access
2. ✅ Test PDF processing với email thật
3. ✅ Verify data được lưu vào database
4. ✅ Setup monitoring và alerts
5. ✅ Verify custom domain hoạt động đúng
6. ✅ **Monitor cost savings từ Hybrid PDF Parser system**

---

## 📊 Hybrid PDF Parser System

### Tổng quan

Hệ thống sử dụng **Hybrid PDF Parser** với chiến lược tối ưu chi phí:

1. **Primary (FREE):** pdf2json - Thư viện open-source, không tốn chi phí
2. **Fallback (PAID):** Document AI - Chỉ dùng khi pdf2json thất bại (~15% cases)

### Luồng xử lý:

```
PDF File → pdf2json (FREE) → Regex Parser → SUCCESS ✅
              ↓ FAIL
         Document AI (PAID) → Regex Parser → SUCCESS ✅
```

### Chi phí & Tiết kiệm:

| Scenario | PDFs/Tháng | Cost (Document AI) | Cost (Hybrid) | Tiết kiệm |
|----------|------------|--------------------|---------------|-----------|
| Low | 100 | $1.50 | $0.15-0.30 | **80-90%** |
| Medium | 500 | $7.50 | $0.75-1.50 | **80-90%** |
| High | 1000 | $15.00 | $1.50-3.00 | **80-90%** |

*Assuming 85-95% success rate với pdf2json*

### Tracking Cost Savings:

**API Endpoint để xem metrics:**
```bash
# Thay YOUR_DOMAIN bằng domain đã deploy
curl https://YOUR_DOMAIN/api/dashboard/cost-savings
```

**Response:**
```json
{
  "overview": {
    "totalProcessed": 100,
    "freeSuccessCount": 90,
    "paidFallbackCount": 10,
    "freeSuccessRate": "90.0%",
    "costWithoutHybrid": "$1.5000",
    "actualCost": "$0.1500",
    "savedCost": "$1.3500",
    "savingsPercentage": "90.0%"
  }
}
```

### Test Hybrid Parser:

```bash
# Test hybrid parser trên production
# Thay YOUR_DOMAIN bằng domain đã deploy
curl https://YOUR_DOMAIN/api/test/pdf/hybrid-test
```

### Database Schema (Migration 005):

```sql
-- New columns để tracking extraction metrics
ALTER TABLE autoland_reports
ADD COLUMN extraction_method VARCHAR(20) DEFAULT 'document-ai',
ADD COLUMN extraction_cost DECIMAL(10, 4) DEFAULT 0.0000 NOT NULL,
ADD COLUMN extraction_cost_saved DECIMAL(10, 4) DEFAULT 0.0000 NOT NULL;
```

**Giá trị `extraction_method`:**
- `pdf2json` - FREE method (primary)
- `document-ai` - PAID method (fallback)

**Query để xem statistics:**
```sql
-- Extraction method breakdown
SELECT
  extraction_method,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage,
  COALESCE(SUM(extraction_cost), 0) as total_cost
FROM autoland_reports
WHERE extraction_method IS NOT NULL
GROUP BY extraction_method;

-- Cost savings summary
SELECT
  COUNT(*) as total_processed,
  COUNT(*) FILTER (WHERE extraction_method = 'pdf2json') as free_count,
  COUNT(*) FILTER (WHERE extraction_method = 'document-ai') as paid_count,
  COALESCE(SUM(extraction_cost), 0) as actual_cost,
  COALESCE(SUM(extraction_cost_saved), 0) as saved_cost
FROM autoland_reports;
```

### Useful Commands:

```bash
# View service details
gcloud run services describe autoland-vj --region $REGION --project=$PROJECT_ID

# Update service
gcloud run services update autoland-vj --region $REGION --project=$PROJECT_ID

# View logs
gcloud run logs read autoland-vj --region $REGION --follow --project=$PROJECT_ID

# Delete service (nếu cần)
gcloud run services delete autoland-vj --region $REGION --project=$PROJECT_ID

# --- NEW: Cost Savings Tracking ---
# Thay YOUR_DOMAIN bằng domain đã deploy (VD: autoland.blocksync.me)
export DOMAIN="YOUR_DOMAIN"

# View cost savings metrics
curl https://$DOMAIN/api/dashboard/cost-savings | jq '.data.overview'

# Test hybrid parser
curl https://$DOMAIN/api/test/pdf/hybrid-test | jq '.statistics'

# View extraction statistics from database
gcloud sql connect autoland-db --user=autoland --project=$PROJECT_ID --quiet --command="
SELECT
  extraction_method,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage,
  COALESCE(SUM(extraction_cost), 0) as total_cost
FROM autoland_reports
WHERE extraction_method IS NOT NULL
GROUP BY extraction_method;
"

# View overall cost savings from database
gcloud sql connect autoland-db --user=autoland --project=$PROJECT_ID --quiet --command="
SELECT
  COUNT(*) as total_processed,
  COUNT(*) FILTER (WHERE extraction_method = 'pdf2json') as free_count,
  COUNT(*) FILTER (WHERE extraction_method = 'document-ai') as paid_count,
  ROUND(COUNT(*) FILTER (WHERE extraction_method = 'pdf2json') * 100.0 / COUNT(*), 2) as free_success_rate,
  COALESCE(SUM(extraction_cost), 0) as actual_cost,
  COALESCE(SUM(extraction_cost_saved), 0) as saved_cost
FROM autoland_reports;
"

# --- Gmail Watch Renewal Commands ---

# Test Gmail Watch renewal Cloud Function manually
# Thay PROJECT_ID bằng project ID của bạn
curl -X POST https://$REGION-$PROJECT_ID.cloudfunctions.net/renew-gmail-watch

# View Cloud Function logs
gcloud functions logs read renew-gmail-watch \
  --region=asia-southeast1 \
  --limit=50 \
  --project=$PROJECT_ID

# View Cloud Scheduler job status
gcloud scheduler jobs describe renew-gmail-watch-weekly \
  --location=asia-southeast1 \
  --project=$PROJECT_ID

# List all Cloud Scheduler jobs
gcloud scheduler jobs list --project=$PROJECT_ID

# View Cloud Scheduler execution logs
gcloud scheduler jobs logs describe renew-gmail-watch-weekly \
  --location=asia-southeast1 \
  --project=$PROJECT_ID

# Manually trigger Cloud Scheduler job (test)
gcloud scheduler jobs run renew-gmail-watch-weekly \
  --location=asia-southeast1 \
  --project=$PROJECT_ID

# Update refresh token in Secret Manager
export NEW_REFRESH_TOKEN="1//0g..."
echo -n "$NEW_REFRESH_TOKEN" | gcloud secrets versions add gmail-oauth-refresh-token \
  --data-file=- \
  --project=$PROJECT_ID

# View current refresh token version
gcloud secrets versions list gmail-oauth-refresh-token --project=$PROJECT_ID
```

---

---

## 🔧 TROUBLESHOOTING GUIDE

### Common Issues & Solutions

---

### Issue #1: Gmail Notifications Received But Dashboard Empty

**Symptoms:**
- Cloud Function logs show "Received CloudEvent"
- No errors in logs
- But dashboard doesn't show new reports

**Root Cause Analysis:**

Phiên debug 2026-01-16 đã tìm ra **3 bugs liên tiếp**:

#### Bug #1: Pub/Sub Message Parsing Failure

**Error:**
```
Invalid Pub/Sub message format
cloudEvent.data type: object
```

**Nguyên nhân:**
- Cloud Functions Gen2 với Pub/Sub trigger gửi `cloudEvent.data` dưới dạng **Buffer**, không phải string
- Code cũ chỉ check `typeof cloudEvent.data === 'string'`

**Fix đã áp dụng:**
```javascript
// File: cloud-functions/gmail-pubsub-processor/index.js:50-53
} else if (Buffer.isBuffer(cloudEvent.data)) {
  // FIX: Cloud Functions Gen2 may send data as Buffer
  base64Data = cloudEvent.data.toString('base64');
  console.log('Using buffer format: cloudEvent.data (Buffer)');
}
```

**Commits:** `c25569a`, `71da9e0`

---

#### Bug #2: Gmail History API Query Logic Error

**Error:**
```
No new messages found in history
```

**Nguyên nhân:**
- Notification's `historyId` là **current state**, không phải start point
- Code dùng `startHistoryId: currentHistoryId` → query từ current → current = luôn rỗng

**Fix đã áp dụng:**
```javascript
// File: cloud-functions/gmail-pubsub-processor/index.js:113-140
// Strategy:
// 1. Query forward from notification historyId
// 2. If no history, fallback to fetch last 10 INBOX messages directly

if (!history.data.history || history.data.history.length === 0) {
  console.log('No new messages found in history (querying forward from notification historyId)');

  // Fallback: Get recent messages directly from INBOX
  const recentMessages = await gmail.users.messages.list({
    userId: 'me',
    labelIds: ['INBOX'],
    maxResults: 10,
  });

  for (const msg of recentMessages.data.messages) {
    await processMessage(gmail, msg.id);
  }
}
```

**Commits:** `71da9e0`

---

#### Bug #3: PostgreSQL Timestamp Format Error

**Error:**
```
invalid input syntax for type timestamp: "Thu Jan 15 2026 00:00:00 GMT+0000 (Coordinated Universal Time)T15:48:00Z"
```

**Nguyên nhân:**
- PDF parser trả về Date objects cho `date_utc` và `time_utc`
- Khi string concatenation, JavaScript tự convert thành human-readable string
- PostgreSQL không parse được format này

**Fix đã áp dụng:**
```typescript
// File: src/app/api/reports/process-internal/route.ts:137-145
let dateUtcStr = parsedData.date_utc;
let timeUtcStr = parsedData.time_utc;

// Convert Date objects to ISO strings
if (dateUtcStr instanceof Date) {
  dateUtcStr = dateUtcStr.toISOString().split('T')[0] // YYYY-MM-DD
}
if (timeUtcStr instanceof Date) {
  timeUtcStr = timeUtcStr.toTimeString().split(' ')[0].substring(0, 5) // HH:MM
}

// Create datetime_utc in ISO format for PostgreSQL timestamptz
const datetimeUtc = `${dateUtcStr}T${timeUtcStr}:00+00`
```

**Commits:** `f8156f5`

**Deployment Status:**
- ✅ Cloud Function `gmail-pubsub-processor`: Deployed với Bug #1 & #2 fix
- ⏳ Cloud Run `autoland-api`: **CHƯA deploy** Bug #3 fix (pending deploy)

---

### How to Check Cloud Function Logs

```bash
export PROJECT_ID="autoland-vj"

# View logs từ Gmail processor
gcloud functions logs read gmail-pubsub-processor \
  --region=asia-southeast1 \
  --limit=100 \
  --project=$PROJECT_ID

# Stream logs real-time
gcloud functions logs read gmail-pubsub-processor \
  --region=asia-southeast1 \
  --follow \
  --project=$PROJECT_ID
```

**Expected logs (after fixes):**
```
Received CloudEvent: {...}
Using buffer format: cloudEvent.data (Buffer)
Parsed message data: {...}
Access token refreshed successfully
Current notification historyId: 12345678
Gmail profile historyId: 12345678
Found X new message(s)
Processing message: 1234567890abcdef
Message subject: Autoland Report
Found 1 PDF attachment(s)
PDF downloaded: XXXXX bytes
Calling API endpoint to process PDF...
```

---

### Issue #2: Email Sent But No Pub/Sub Notification

**Symptoms:**
- Email arrives in Gmail
- No Pub/Sub message triggered
- Cloud Function logs show nothing

**Possible Causes:**

1. **Gmail Watch expired** (hết hạn 7 ngày)
   ```bash
   # Check expiration
   curl https://$REGION-$PROJECT_ID.cloudfunctions.net/renew-gmail-watch

   # Manually renew
   node scripts/setup-gmail-watch.js
   ```

2. **Pub/Sub topic không có permission**
   ```bash
   # Verify Gmail SA permission
   gcloud pubsub topics get-iam-policy gmail-notifications --project=$PROJECT_ID
   ```

3. **Email filter không match**
   - Cloud Function chỉ process email có subject chứa "Autoland"
   - Check email subject trong logs

---

### Issue #3: PDF Processed But Not Saved to Database

**Symptoms:**
- Cloud Function logs show "PDF downloaded"
- API endpoint returns error
- Dashboard empty

**Check API logs:**
```bash
export PROJECT_ID="autoland-vj"

# View Cloud Run logs
gcloud run logs read autoland-vj \
  --region=asia-southeast1 \
  --limit=100 \
  --project=$PROJECT_ID
```

**Common errors:**

1. **Timestamp format error** → Deploy lại Cloud Run với fix
2. **Duplicate report** → Report number đã tồn tại trong DB
3. **Database connection error** → Check Cloud SQL connection

---

### Issue #4: OAuth2 Authentication Failures

**Error:** `invalid_grant` hoặc `unauthorized_client`

**Solutions:**

1. **Refresh token bị revoke** → Lấy token mới
   ```bash
   node scripts/setup-gmail-watch.js
   ```

2. **Redirect URI mismatch** → Thêm URI vào OAuth Client
   - Vào Google Cloud Console > APIs & Services > Credentials
   - Click vào OAuth Client ID
   - Thêm redirect URI vào "Authorized redirect URIs"

3. **Cloud Function cache old secret** → Redeploy
   ```bash
   gcloud functions deploy gmail-pubsub-processor \
     --gen2 --runtime=nodejs20 \
     --region=asia-southeast1 \
     # ... (các flags khác)
   ```

---

### Quick Troubleshooting Checklist

Khi Gmail integration không hoạt động:

- [ ] Check Cloud Function logs xem có Pub/Sub message không
- [ ] Check Gmail Watch có còn hạn không
- [ ] Test gửi email với subject chứa "Autoland"
- [ ] Check API logs xem có lỗi không
- [ ] Verify database connection
- [ ] Check OAuth2 credentials (refresh token valid?)
- [ ] Test manual trigger Cloud Function

---

## 📚 Tài liệu liên quan

- [DEVELOPMENT.md](./DEVELOPMENT.md) - Hướng dẫn setup môi trường development local
- [Gmail Watch Renewal Automation](#setup-gmail-watch-renewal-automation) - Hướng dẫn setup automatic renewal cho Gmail Watch
- [Hybrid PDF Parser System](#-hybrid-pdf-parser-system) - Chi tiết về hệ thống tối ưu chi phí

---

**Maintained by:** Vietjet AMO ICT Department
**Contact:** moc@vietjetair.com
**Last Updated:** 2026-01-16

**Changelog:**
- **2026-01-16:**
  - Thêm troubleshooting guide cho Gmail integration issues
  - Thêm context về 3 bugs quan trọng đã fix: Pub/Sub parsing, Gmail History API, Timestamp format
- **2026-01-15:**
  - Cập nhật Bước 4 - Enable APIs trong 1 lệnh để tránh rate limit (HTTP 429)
  - Cập nhật Document AI region từ asia-southeast1 → us (chỉ có us/eu available)
  - Thêm checklist và common errors cho setup-gmail-watch.js
  - Thêm recovery steps khi Gmail Watch setup thất bại
- **2025-01-08:** Added Gmail Watch Renewal Automation - Cloud Function + Cloud Scheduler for automatic renewal every 6 days
- **2025-01-02:** Tách phần development sang DEVELOPMENT.md, tập trung vào production deployment với Secret Manager và OAuth2
- **2025-12-30:** Added Hybrid PDF Parser System (pdf2json + Document AI fallback) - Cost optimization feature
- **2025-12-28:** Initial deployment guide
