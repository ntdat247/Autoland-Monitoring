# Autoland Monitoring System

**Vietjet AMO - Hệ thống giám sát Autoland**

Dashboard giám sát tình trạng thực hiện Autoland của đội tàu bay VietJet Air.

---

## 📋 Tổng quan

**Autoland Monitoring System** là hệ thống tự động giám sát tình trạng thực hiện Autoland của đội tàu bay VietJet:

- ✈️ Tự động đọc email từ Gmail và extract PDF báo cáo Autoland
- 📊 Parse và lưu trữ dữ liệu vào PostgreSQL database
- 📈 Hiển thị dashboard với thống kê, alerts, và reports
- ⏰ Track deadline autoland (mỗi 30 ngày/lần)
- 💾 Lưu trữ PDF files trên Cloud Storage
- 💰 **PDF Parser System** sử dụng pdf2json (FREE) - tiết kiệm 100% chi phí

---

## 🛠️ Tech Stack

| Component | Technology |
|-----------|------------|
| **Frontend** | Next.js 14, React 18, TypeScript, Tailwind CSS |
| **Backend** | Next.js API Routes |
| **Database** | PostgreSQL 15 (Cloud SQL) |
| **Storage** | Google Cloud Storage |
| **Deployment** | Google Cloud Run |
| **Functions** | Cloud Run Functions (Node.js 24) |
| **APIs** | Gmail API, Pub/Sub |
| **PDF Processing** | pdf2json (FREE) |

### Runtime Support (Feb 2026)

| Runtime | Status | Notes |
|---------|--------|-------|
| **Node.js 24** | ✅ **GA (Recommended)** | Phiên bản mới nhất |
| Node.js 22 | GA | LTS |
| Node.js 20 | Maintenance | Sắp hết hạn |
| Node.js 18 | Deprecated | Không khuyến nghị |

---

## 📁 Project Structure

```
autoland-monitoring/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/                # API Routes
│   │   ├── dashboard/          # Dashboard pages
│   │   └── ...
│   ├── components/             # React components
│   ├── lib/                    # Utility functions
│   │   ├── parsers/            # PDF parsing (pdf2json)
│   │   └── ...
│   └── hooks/                  # Custom React hooks
├── cloud-functions/            # Google Cloud Functions
│   ├── gmail-pubsub-processor/ # Process Gmail notifications
│   └── renew-gmail-watch/      # Auto-renew Gmail Watch
├── database/                   # SQL migrations
├── docs/                       # Documentation
├── docker/                     # Dockerfile (Node.js 24)
└── scripts/                    # Setup scripts
```

---

## 📚 Tài liệu

| Document | Description |
|----------|-------------|
| [DEVELOPMENT.md](./DEVELOPMENT.md) | Hướng dẫn setup môi trường development local |
| [MEMORY_BANK.md](./MEMORY_BANK.md) | Lịch sử thay đổi và context của dự án |
| [docs/PDF_PARSER.md](./docs/PDF_PARSER.md) | Chi tiết PDF Parser System |

---

## 🚀 Quick Start

### Development Local

```bash
# Clone repository
git clone <repository-url>
cd Autoland-Monitoring

# Install dependencies (requires Node.js 24+)
npm install

# Copy environment file
cp .env.example .env
# Edit .env với các giá trị thực tế

# Run development server
npm run dev
```

Truy cập: http://localhost:3000

### Production Deployment

Xem chi tiết bên dưới phần **[🚀 Production Deployment Guide](#-production-deployment-guide)**

---

## 📊 PDF Parser System

Hệ thống sử dụng **pdf2json** (FREE) để extract text từ PDF:

```
PDF File → pdf2json (FREE) → Regex Parser → SUCCESS ✅
              ↓ FAIL
         Log Error & Skip
```

### Chi phí

| Scenario | PDFs/Tháng | Cost |
|----------|------------|------|
| Low | 100 | $0.00 |
| Medium | 500 | $0.00 |
| High | 1000 | $0.00 |

**Lưu ý:** PDFs không parse được với pdf2json sẽ bị bỏ qua và log lỗi.

---

## 🔄 Gmail Watch Renewal

Gmail Watch expires every **7 days**. The system includes automatic renewal:

- **Cloud Function:** `renew-gmail-watch` - Renews Gmail Watch
- **Cloud Scheduler:** Runs every 6 days to trigger the function

```bash
# Manual renewal (if needed)
curl -X POST https://asia-southeast1-$PROJECT_ID.cloudfunctions.net/renew-gmail-watch
```

---

## 👥 Team & Contact

**Maintained by:** Vietjet AMO ICT Department  
**Email:** moc@vietjetair.com  
**Website:** https://www.amoict.com

---

## 📜 License

MIT License - See [LICENSE](./LICENSE) for details.

---

# 🚀 Production Deployment Guide

Hướng dẫn deploy hệ thống Autoland Monitoring lên Google Cloud Platform (Production).

> **Lưu ý:** 
> - Để setup môi trường development local, xem [DEVELOPMENT.md](./DEVELOPMENT.md)
> - **Production deployment KHÔNG cần file `.env`** - Tất cả config được quản lý qua Secret Manager và Cloud Run environment variables

---

## 📋 Deployment Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  PHẦN A: INFRASTRUCTURE (Bước 1-8)                              │
│  ├── Google Cloud Account & CLI                                 │
│  ├── Project & Enable APIs                                      │
│  ├── Service Account & Permissions                              │
│  ├── Cloud Storage & Cloud SQL                                  │
│  └── Secret Manager (DB password)                               │
├─────────────────────────────────────────────────────────────────┤
│  PHẦN B: DEPLOY APPLICATION (Bước 9-12)                         │
│  ├── Build Docker Image (Node.js 24)                            │
│  ├── Deploy to Cloud Run                                        │
│  ├── ⭐ MAP CUSTOM DOMAIN                                       │
│  └── Run Database Migrations                                    │
├─────────────────────────────────────────────────────────────────┤
│  PHẦN C: GMAIL INTEGRATION (Bước 13-15)                         │
│  ├── Setup OAuth2                                               │
│  ├── Setup Pub/Sub & Gmail Watch                                │
│  └── Deploy Cloud Functions (Node.js 24)                        │
├─────────────────────────────────────────────────────────────────┤
│  PHẦN D: VERIFY & AUTOMATION (Bước 16-17)                       │
│  ├── Verify Deployment                                          │
│  └── Setup Gmail Watch Renewal Automation                       │
└─────────────────────────────────────────────────────────────────┘
```

**Tại sao phải deploy Cloud Run trước khi setup OAuth2?**
- OAuth2 yêu cầu **redirect URI** chính xác (VD: `https://autoland.yourdomain.com/api/test/gmail/callback`)
- Redirect URI phải là domain đã hoạt động
- Nếu setup OAuth2 trước khi có domain → Phải quay lại update OAuth2 → Dễ gây lỗi

---

## PHẦN A: INFRASTRUCTURE

### Bước 1: Tạo Google Cloud Account

1. Truy cập [Google Cloud Console](https://console.cloud.google.com/)
2. Đăng nhập với Google account
3. Click **Get started for free** hoặc **Try free trial**
4. Điền thông tin billing (cần credit card, nhưng có $300 free credit)
5. Chấp nhận terms và conditions
6. Click **Start my free trial**

**Lưu ý:** Free trial có $300 credit trong 90 ngày.

---

### Bước 2: Cài đặt Google Cloud CLI

```bash
# Download và cài đặt
curl https://sdk.cloud.google.com | bash

# Restart shell
exec -l $SHELL

# Initialize
gcloud init

# Authenticate
gcloud auth login

# Verify
gcloud --version
```

---

### Bước 3: Tạo Project

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

### Enable Billing

**⚠️ BẮT BUỘC:** Link billing account trước khi tạo Cloud SQL, Cloud Run.

1. Vào [Billing](https://console.cloud.google.com/billing)
2. Click **LINK A BILLING ACCOUNT**
3. Link với project `autoland-vj`

---

### Bước 4: Enable APIs

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
  pubsub.googleapis.com \
  cloudfunctions.googleapis.com \
  eventarc.googleapis.com \
  secretmanager.googleapis.com \
  cloudscheduler.googleapis.com \
  --project=$PROJECT_ID
```

### Enable Gmail API (qua Console)

1. Vào **APIs & Services** > **Library**
2. Tìm "Gmail API" → Click **ENABLE**

### Verify APIs

```bash
gcloud services list --enabled --project=$PROJECT_ID | grep -E "(gmail|storage|run|cloudbuild|sql|pubsub|functions|secretmanager|scheduler|eventarc)"
```

---

### Bước 5: Tạo Service Account

```bash
export PROJECT_ID="autoland-vj"

# Tạo Service Account
gcloud iam service-accounts create autoland-service \
    --display-name="Autoland Monitoring Service Account" \
    --project=$PROJECT_ID
```

### Grant Permissions

```bash
# Storage Admin (để upload/download PDF)
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:autoland-service@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/storage.admin"

# Cloud SQL Client (để kết nối database)
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:autoland-service@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/cloudsql.client"

# Secret Manager Secret Accessor (để đọc secrets)
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:autoland-service@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"

# Cloud Build Builder (cho Cloud Functions)
export PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member=serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com \
  --role=roles/cloudbuild.builds.builder 
```

### Download Service Account Key

```bash
gcloud iam service-accounts keys create ./gcp-key.json \
    --iam-account=autoland-service@$PROJECT_ID.iam.gserviceaccount.com \
    --project=$PROJECT_ID
```

**⚠️ KHÔNG commit file này lên Git!** (đã có trong `.gitignore`)

---

### Bước 6: Tạo Cloud Storage Bucket

```bash
export PROJECT_ID="autoland-vj"
export BUCKET_NAME="autoland-reports"

# Tạo bucket để lưu PDF files
gsutil mb -p $PROJECT_ID -c STANDARD -l asia-southeast1 gs://$BUCKET_NAME

# Verify bucket đã được tạo
gsutil ls gs://$BUCKET_NAME
```

---

### Bước 7: Setup Database (Cloud SQL)

```bash
export PROJECT_ID="autoland-vj"
export DB_PASSWORD="YOUR_SECURE_PASSWORD"  # LƯU LẠI password này!

# Tạo PostgreSQL instance
gcloud sql instances create autoland-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=asia-southeast1 \
  --storage-auto-increase \
  --storage-size=10GB \
  --project=$PROJECT_ID

# Tạo database
gcloud sql databases create autoland \
  --instance=autoland-db \
  --project=$PROJECT_ID

# Tạo user
gcloud sql users create autoland \
  --instance=autoland-db \
  --password=$DB_PASSWORD \
  --project=$PROJECT_ID

# Lấy connection name
gcloud sql instances describe autoland-db \
  --project=$PROJECT_ID \
  --format='value(connectionName)'
```

---

### Bước 8: Cấu hình Secret Manager

```bash
export PROJECT_ID="autoland-vj"
export DB_PASSWORD="your-db-password"  # Password đã tạo ở Bước 7

# Tạo secret cho database password
echo -n "$DB_PASSWORD" | gcloud secrets create autoland-db-password \
  --data-file=- \
  --project=$PROJECT_ID

# Tạo Service Account cho Cloud Run
gcloud iam service-accounts create autoland-vj-runner \
  --display-name="Autoland Monitoring Cloud Run Service Account" \
  --project=$PROJECT_ID

export SA_EMAIL="autoland-vj-runner@$PROJECT_ID.iam.gserviceaccount.com"

# Grant permissions
gcloud secrets add-iam-policy-binding autoland-db-password \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/secretmanager.secretAccessor" \
  --project=$PROJECT_ID

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/cloudsql.client"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/storage.admin"
```

---

## PHẦN B: DEPLOY APPLICATION

### Bước 9: Build Docker Image

```bash
export PROJECT_ID="autoland-vj"
export REGION="asia-southeast1"
export REPO_NAME="autoland-vj"

# Tạo Artifact Registry repository
gcloud artifacts repositories create $REPO_NAME \
  --repository-format=docker \
  --location=$REGION \
  --description="Docker repository for Autoland Monitoring" \
  --project=$PROJECT_ID

# Configure Docker authentication
gcloud auth configure-docker $REGION-docker.pkg.dev --project=$PROJECT_ID

# Build và push Docker image
export IMAGE_NAME="$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/autoland-vj"

gcloud builds submit \
  --config cloudbuild.yaml \
  --project=$PROJECT_ID
```

---

### Bước 10: Deploy to Cloud Run

```bash
export PROJECT_ID="autoland-vj"
export REGION="asia-southeast1"
export IMAGE_NAME="$REGION-docker.pkg.dev/$PROJECT_ID/autoland-vj/autoland-vj:latest"
export SA_EMAIL="autoland-vj-runner@$PROJECT_ID.iam.gserviceaccount.com"
export CONNECTION_NAME="$PROJECT_ID:asia-southeast1:autoland-db"

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
  --set-env-vars "NEXT_PUBLIC_APP_URL=https://YOUR_DOMAIN" \
  --memory 1Gi \
  --cpu 1 \
  --timeout 300 \
  --min-instances 0 \
  --max-instances 10 \
  --project=$PROJECT_ID
```

**Lưu ý:** Thay `YOUR_DOMAIN` bằng domain sẽ map (VD: `autoland.blocksync.me`)

---

### Bước 11: Map Custom Domain

#### Cấu hình DNS

| Type | Name | Value |
|------|------|-------|
| **CNAME** | `autoland` | `ghs.googlehosted.com.` |

**Hoặc** A records:

| Type | Name | Value |
|------|------|-------|
| **A** | `autoland` | `216.239.32.21` |
| **A** | `autoland` | `216.239.34.21` |
| **A** | `autoland` | `216.239.36.21` |
| **A** | `autoland` | `216.239.38.21` |

#### Map domain

```bash
export PROJECT_ID="autoland-vj"
export REGION="asia-southeast1"
export DOMAIN="autoland.yourdomain.com"

gcloud beta run domain-mappings create \
  --service=autoland-vj \
  --domain=$DOMAIN \
  --region=$REGION \
  --project=$PROJECT_ID
```

**Lưu ý:** DNS propagation có thể mất 5-30 phút.

---

### Bước 12: Run Database Migrations

```bash
export PROJECT_ID="autoland-vj"

# Connect to Cloud SQL
gcloud sql connect autoland-db --user=autoland --project=$PROJECT_ID
```

Trong psql, chạy các migration:

```sql
\i database/migrations/001_create_autoland_tables.sql
\i database/migrations/002_create_dashboard_tables.sql
\i database/migrations/003_fix_calculate_autoland_to_go.sql
\i database/migrations/004_change_visibility_rvr_to_varchar.sql
\i database/migrations/005_add_extraction_metrics.sql

-- Verify
\dt

-- Exit
\q
```

---

## PHẦN C: GMAIL INTEGRATION

> **⚠️ QUAN TRỌNG:** Thực hiện phần này SAU KHI custom domain đã hoạt động

---

### Bước 13: Setup OAuth2 cho Gmail

#### 13.1: Tạo OAuth Consent Screen

1. Vào **APIs & Services** > **OAuth consent screen**
2. **User Type:** External → **CREATE**
3. **App name:** `Autoland Monitoring`
4. **Developer contact:** Email của bạn
5. **Scopes:** Thêm `https://www.googleapis.com/auth/gmail.readonly`
6. **Test users:** Thêm email Gmail nhận report

#### 13.2: Tạo OAuth Client ID

1. Vào **APIs & Services** > **Credentials**
2. Click **+ CREATE CREDENTIALS** > **OAuth client ID**
3. **Application type:** Web application
4. **Authorized redirect URIs:**
   ```
   https://YOUR_DOMAIN/api/test/gmail/callback
   http://localhost:3000/oauth2callback
   ```
5. **Lưu lại Client ID và Client Secret**

---

### Bước 14: Setup Pub/Sub và Gmail Watch

#### Tạo Pub/Sub Topic

```bash
export PROJECT_ID="autoland-vj"
export TOPIC_NAME="gmail-notifications"

gcloud pubsub topics create $TOPIC_NAME --project=$PROJECT_ID
```

#### Grant Gmail Service Account Permission

```bash
export GMAIL_SA="gmail-api-push@system.gserviceaccount.com"

gcloud pubsub topics add-iam-policy-binding $TOPIC_NAME \
    --member="serviceAccount:$GMAIL_SA" \
    --role="roles/pubsub.publisher" \
    --project=$PROJECT_ID
```

#### Grant Permissions cho Build Service Account

```bash
export PROJECT_ID="autoland-vj"
export PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member=serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com \
  --role=roles/cloudbuild.builds.builder

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member=serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com \
  --role=roles/logging.logWriter

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member=serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com \
  --role=roles/artifactregistry.writer
```

#### Tạo Secrets cho Cloud Function

```bash
export PROJECT_ID="autoland-vj"
export SA_EMAIL="autoland-service@$PROJECT_ID.iam.gserviceaccount.com"
export GOOGLE_CLIENT_SECRET="your-client-secret"

# Google Client Secret
echo -n "$GOOGLE_CLIENT_SECRET" | gcloud secrets create google-client-secret \
  --data-file=- --project=$PROJECT_ID

gcloud secrets add-iam-policy-binding google-client-secret \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/secretmanager.secretAccessor" \
  --project=$PROJECT_ID

# OAuth Refresh Token placeholder
echo -n "placeholder" | gcloud secrets create gmail-oauth-refresh-token \
  --data-file=- --project=$PROJECT_ID

gcloud secrets add-iam-policy-binding gmail-oauth-refresh-token \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/secretmanager.secretAccessor" \
  --project=$PROJECT_ID
```

---

### Bước 15: Deploy Cloud Functions

#### Deploy gmail-pubsub-processor

```bash
cd cloud-functions/gmail-pubsub-processor
npm install

export PROJECT_ID="autoland-vj"
export REGION="asia-southeast1"
export SA_EMAIL="autoland-service@$PROJECT_ID.iam.gserviceaccount.com"

gcloud functions deploy gmail-pubsub-processor \
  --gen2 \
  --runtime=nodejs24 \
  --region=$REGION \
  --source=. \
  --entry-point=processGmailNotification \
  --trigger-topic=gmail-notifications \
  --service-account=$SA_EMAIL \
  --set-env-vars "GCP_PROJECT_ID=$PROJECT_ID" \
  --set-env-vars "GCP_STORAGE_BUCKET=autoland-reports" \
  --set-env-vars "GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com" \
  --set-env-vars "API_BASE_URL=https://YOUR_DOMAIN" \
  --set-secrets "GOOGLE_CLIENT_SECRET=google-client-secret:latest" \
  --set-secrets "OAUTH_REFRESH_TOKEN=gmail-oauth-refresh-token:latest" \
  --memory=2GB \
  --timeout=540s \
  --max-instances=1 \
  --min-instances=0 \
  --allow-unauthenticated \
  --project=$PROJECT_ID
```

#### Setup Gmail Watch

```bash
cd ~/your-project-folder

export GCP_PROJECT_ID="autoland-vj"
export GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
export GOOGLE_CLIENT_SECRET=$(gcloud secrets versions access latest --secret=google-client-secret --project=$GCP_PROJECT_ID)
export GOOGLE_REDIRECT_URI="http://localhost:3000/oauth2callback"
export PUBSUB_TOPIC="gmail-notifications"
export MANUAL_FLOW=true

node scripts/setup-gmail-watch.js
```

Copy refresh token từ output và update Secret Manager:

```bash
export REFRESH_TOKEN="1//0g..."

echo -n "$REFRESH_TOKEN" | gcloud secrets versions add gmail-oauth-refresh-token \
  --data-file=- --project=$PROJECT_ID
```

---

## PHẦN D: VERIFY & AUTOMATION

### Bước 16: Verify Deployment

```bash
export PROJECT_ID="autoland-vj"
export REGION="asia-southeast1"
export DOMAIN="your-domain.com"

# Check service status
gcloud run services describe autoland-vj --region $REGION --project=$PROJECT_ID

# Test dashboard
curl https://$DOMAIN/dashboard

# View logs
gcloud run logs read autoland-vj --region $REGION --limit 100 --project=$PROJECT_ID
```

---

### Bước 17: Setup Gmail Watch Renewal Automation

#### Deploy renew-gmail-watch Cloud Function

```bash
cd cloud-functions/renew-gmail-watch
npm install

export PROJECT_ID="autoland-vj"
export REGION="asia-southeast1"
export SA_EMAIL="autoland-service@$PROJECT_ID.iam.gserviceaccount.com"

gcloud functions deploy renew-gmail-watch \
  --gen2 --runtime=nodejs24 --region=$REGION --source=. \
  --entry-point=renewGmailWatch --trigger-http \
  --service-account=$SA_EMAIL \
  --set-env-vars "GCP_PROJECT_ID=$PROJECT_ID" \
  --set-env-vars "PUBSUB_TOPIC=gmail-notifications" \
  --set-env-vars "GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com" \
  --set-secrets "GOOGLE_CLIENT_SECRET=google-client-secret:latest" \
  --set-secrets "OAUTH_REFRESH_TOKEN=gmail-oauth-refresh-token:latest" \
  --memory=256Mi --timeout=60s --allow-unauthenticated \
  --project=$PROJECT_ID
```

#### Create Cloud Scheduler Job

```bash
gcloud scheduler jobs create http renew-gmail-watch-weekly \
  --location=$REGION --schedule="0 0 */6 * *" \
  --uri="https://$REGION-$PROJECT_ID.cloudfunctions.net/renew-gmail-watch" \
  --http-method=POST --oidc-service-account-email=$SA_EMAIL \
  --project=$PROJECT_ID
```

---

## 🔧 Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Gmail notifications not received | Check Gmail Watch expiration (7 days), run `renew-gmail-watch` |
| PDF processing fails | Check Cloud Run logs for errors |
| OAuth2 `invalid_grant` | Re-run `setup-gmail-watch.js` to get new refresh token |
| Pub/Sub message parsing error | Verify Cloud Function is using nodejs24 runtime |
| Database connection error | Check Cloud SQL connection and Secret Manager |

### Check Logs

```bash
export PROJECT_ID="your-project-id"

# Cloud Function logs
gcloud functions logs read gmail-pubsub-processor \
  --region=asia-southeast1 \
  --limit=50 \
  --project=$PROJECT_ID

# Cloud Run logs
gcloud run logs read autoland-vj \
  --region=asia-southeast1 \
  --limit=50 \
  --project=$PROJECT_ID
```

### Manual Renewal

```bash
curl -X POST https://asia-southeast1-$PROJECT_ID.cloudfunctions.net/renew-gmail-watch
```

---

## 🎉 Hoàn thành!

Hệ thống Autoland Monitoring đã được deploy thành công lên Google Cloud Run!

### Next Steps

1. ✅ Test OAuth2 flow để authorize Gmail access
2. ✅ Test PDF processing với email thật
3. ✅ Verify data được lưu vào database
4. ✅ Setup monitoring và alerts
5. ✅ Verify custom domain hoạt động đúng

---

## 💰 Estimated Monthly Cost

| Service | Estimated Cost |
|---------|---------------|
| Cloud Run (scale to zero) | ~$0-5 |
| Cloud SQL (db-f1-micro) | ~$7-10 |
| Cloud Storage | ~$0-1 |
| Pub/Sub | ~$0 |
| Cloud Functions | ~$0-1 |
| Secret Manager | ~$0 |
| Cloud Scheduler | ~$0 |
| **PDF Processing** | **$0** (pdf2json free) |
| **Total** | **~$8-17/month** |

---

**Last Updated:** 2026-02-22

**Changelog:**
- **2026-02-22:**
  - **Upgraded to Node.js 24** (latest GA release)
  - Updated Dockerfile, Cloud Functions package.json
  - Added Node.js runtime support table
- **2026-02-21:**
  - Combined README.md and README1.md into single file
  - **REMOVED Document AI dependency** - PDF parsing now uses only pdf2json (100% free)
  - Fixed step numbering issues
  - Reorganized content structure
- **2026-01-16:** Added troubleshooting guide for Gmail integration
- **2026-01-15:** Initial production deployment guide
