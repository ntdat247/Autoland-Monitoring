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
- 💰 **Hybrid PDF Parser System** (pdf2json FREE → Document AI PAID fallback) để tiết kiệm chi phí

---

## 🛠️ Tech Stack

| Component | Technology |
|-----------|------------|
| **Frontend** | Next.js 14, React 18, TypeScript, Tailwind CSS |
| **Backend** | Next.js API Routes |
| **Database** | PostgreSQL (Cloud SQL) |
| **Storage** | Google Cloud Storage |
| **Deployment** | Google Cloud Run |
| **APIs** | Gmail API, Document AI (fallback), Pub/Sub |
| **PDF Processing** | pdf2json (primary, FREE), Document AI (fallback, PAID) |

---

## 📚 Tài liệu

| Document | Description |
|----------|-------------|
| [DEVELOPMENT.md](./DEVELOPMENT.md) | Hướng dẫn setup môi trường development local |
| [DEPLOY_PUBSUB_GUIDE.md](./docs/DEPLOY_PUBSUB_GUIDE.md) | **Hướng dẫn deploy Pub/Sub lên Google Cloud** |
| [MEMORY_BANK.md](./MEMORY_BANK.md) | Lịch sử thay đổi và context của dự án |

---

## 🚀 Quick Start

### Development Local

```bash
# Clone repository
git clone <repository-url>
cd Autoland-Monitoring

# Install dependencies
npm install

# Copy environment file
cp .env.example .env
# Edit .env với các giá trị thực tế

# Run development server
npm run dev
```

Truy cập: http://localhost:3000

### Production Deployment

> **📖 Xem hướng dẫn chi tiết:** [DEPLOY_PUBSUB_GUIDE.md](./docs/DEPLOY_PUBSUB_GUIDE.md)

**Tóm tắt các bước chính:**

1. **Setup Infrastructure** - Tạo Google Cloud Project, enable APIs, tạo database
2. **Deploy Cloud Run** - Build Docker image và deploy Next.js app
3. **Deploy Cloud Functions** - gmail-pubsub-processor và renew-gmail-watch
4. **Setup Gmail Watch** - Cấu hình OAuth2 và Gmail notifications
5. **Verify** - Test end-to-end flow

---

## 📊 Hybrid PDF Parser System

Hệ thống sử dụng **Hybrid PDF Parser** với chiến lược tối ưu chi phí:

```
PDF File → pdf2json (FREE) → Regex Parser → SUCCESS ✅
              ↓ FAIL
         Document AI (PAID) → Regex Parser → SUCCESS ✅
```

### Chi phí & Tiết kiệm

| Scenario | PDFs/Tháng | Document AI Only | Hybrid System | Tiết kiệm |
|----------|------------|------------------|---------------|-----------|
| Low | 100 | $1.50 | $0.15-0.30 | **80-90%** |
| Medium | 500 | $7.50 | $0.75-1.50 | **80-90%** |
| High | 1000 | $15.00 | $1.50-3.00 | **80-90%** |

### API Endpoint để xem metrics

```bash
curl https://YOUR_DOMAIN/api/dashboard/cost-savings
```

---

## 🔧 Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Gmail notifications not received | Check Gmail Watch expiration (7 days), run `renew-gmail-watch` |
| PDF processing fails | Check Cloud Run logs for timestamp/VARCHAR errors |
| OAuth2 `invalid_grant` | Re-run `setup-gmail-watch.js` to get new refresh token |
| Pub/Sub message parsing error | Verify Cloud Function is using nodejs20 runtime |

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

> **📖 Chi tiết troubleshooting:** Xem [DEPLOY_PUBSUB_GUIDE.md](./docs/DEPLOY_PUBSUB_GUIDE.md#-troubleshooting)

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
│   │   ├── parsers/            # PDF parsing (hybrid system)
│   │   └── ...
│   └── hooks/                  # Custom React hooks
├── cloud-functions/            # Google Cloud Functions
│   ├── gmail-pubsub-processor/ # Process Gmail notifications
│   └── renew-gmail-watch/      # Auto-renew Gmail Watch
├── database/                   # SQL migrations
├── docs/                       # Documentation
├── docker/                     # Dockerfile
└── scripts/                    # Setup scripts
```

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

**Last Updated:** 2026-02-02
