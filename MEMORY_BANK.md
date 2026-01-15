# Memory Bank - Autoland Monitoring Project

**Last Updated:** 2026-01-15 (Deployment Session)
**Purpose:** Central repository for important project context, decisions, and changes

---

## 📋 Project Overview

**Project Name:** Autoland Monitoring System  
**Organization:** Vietjet AMO ICT Department  
**Purpose:** Hệ thống giám sát Autoland của đội tàu bay VietJet  
**Tech Stack:** Next.js 14, React 18, TypeScript, Tailwind CSS, PostgreSQL, Google Cloud Platform

---

## 🎨 Design System & Branding

### Colors
- **Primary Red:** `#E31837` (VietJet Red)
- **Success Green:** `#10B981`
- **Warning Yellow:** `#F59E0B`
- **Error Red:** `#EF4444`
- **Info Blue:** `#3B82F6`

### Typography
- **Font Family:** Inter (via Next.js Google Fonts)
- **Base Size:** 16px
- **Responsive:** Mobile-first approach

### Components
- **UI Library:** shadcn/ui (Radix UI + Tailwind CSS)
- **Charts:** Chart.js with react-chartjs-2
- **Icons:** Lucide React
- **Forms:** React Hook Form + Zod validation

---

## 📧 Contact Information

### Current Contact Details (as of 2025-12-28)
- **Email:** `moc@vietjetair.com`
- **Website:** `https://www.amoict.com`
- **Department:** Vietjet AMO - ICT Department
- **Company:** Vietjet Aviation Joint Stock Company

### Previous Contact Details (for reference)
- **Previous Email:** `datnguyentien@vietjetair.com`
- **Previous Website:** `https://www.vietjetair.com`
- **Previous Department:** IT Department

---

## 🏗️ Architecture Decisions

### Dashboard Layout (2025-12-28)
- **Top Row:** Success Rate Card (left, 1 column) + Combined Stats Cards (right, 3 columns)
- **Middle Section:** Filters + Autoland Reports Table (minimum 10 results)
- **Bottom Grid:** 2x2 layout (No Alerts, Aircraft Distribution, Success Rate Trend, Recent Autolands)

### Component Structure
- **Dashboard Components:** Located in `src/components/dashboard/`
- **Layout Components:** Located in `src/components/layout/`
- **API Routes:** Located in `src/app/api/`
- **Hooks:** Located in `src/hooks/`

### Data Fetching Strategy
- **Custom Hooks:** All data fetching via custom React hooks
- **Auto-refresh:** 
  - Dashboard stats: 60 seconds
  - Alerts: 30 seconds
  - Recent autolands: 60 seconds
- **Error Handling:** Auto-retry with exponential backoff

---

## 🐛 Critical Bug Fixes

### PDF Download (2025-12-28)
**Issue:** Variable `file` was defined twice causing compilation error

**Solution:**
- Renamed file reference: `file` → `fileRef`
- Renamed buffer: `file` → `fileBuffer`
- Added `@google-cloud/storage` package
- Improved error handling and file existence checks

**Files:**
- `src/app/api/reports/[id]/pdf/route.ts`
- `package.json`

---

## 📦 Dependencies

### Core Dependencies
- `next: ^14.2.15`
- `react: ^18.3.1`
- `typescript: ^5.6.2`
- `tailwindcss: ^3.4.14`
- `pg: ^8.11.5` (PostgreSQL client)

### UI Dependencies
- `@radix-ui/*` (Dialog, Dropdown, Select, etc.)
- `lucide-react: ^0.462.0` (Icons)
- `chart.js: ^4.4.4` + `react-chartjs-2: ^5.2.0`
- `zustand: ^4.5.7` (State management)

### Cloud Dependencies
- `@google-cloud/storage: ^7.7.0` (Added 2025-12-28)
- `@google-cloud/documentai: ^8.0.0` (PDF text extraction - NOW FALLBACK ONLY)
- `@google-cloud/pubsub: ^4.0.0` (Cloud Function dependencies)
- `googleapis: ^144.0.0` (Gmail API, OAuth2)

### PDF Processing Dependencies (Added 2025-12-30)
- `pdf2json: ^2.1.2` (PRIMARY - FREE PDF text extraction library)
  - Event-based parsing compatible with Next.js webpack
  - No runtime dependencies, lighter weight
  - Successfully extracts text from 100% of test PDFs
  - **Cost:** $0 per PDF

---

## 💰 Cost Optimization - Hybrid PDF Parser (2025-12-30)

### Overview
Implemented cost-saving hybrid PDF parser system to reduce Document AI costs by 80-90%

### Architecture
```
PDF File → pdf2json (FREE) → Regex Parser → SUCCESS ✅
              ↓ FAIL
         Document AI (PAID) → Regex Parser → SUCCESS ✅
```

### Components

#### 1. PDF Text Extractor (FREE)
- **File:** `src/lib/parsers/pdf-text-extractor.ts`
- **Library:** pdf2json (open-source, FREE)
- **Features:**
  - Event-based parsing with error handling
  - Text normalization regex patterns (fixes spacing/encoding issues)
  - Compatible with Next.js 14 webpack
  - Success rate: 100% on test PDFs

#### 2. Hybrid Parser with Fallback
- **File:** `src/lib/parsers/hybrid-pdf-parser.ts`
- **Logic:**
  1. Try pdf2json (FREE) first
  2. If parsing fails or insufficient data, fallback to Document AI (PAID)
  3. Track metrics: method used, actual cost, cost saved
- **Metrics:**
  - `extraction_method`: 'pdf2json' or 'document-ai'
  - `extraction_cost`: Actual cost in USD
  - `extraction_cost_saved`: Cost saved by using free method

#### 3. Cost Savings Analytics API
- **Endpoint:** `/api/dashboard/cost-savings`
- **Features:**
  - Overall statistics (total processed, free/paid breakdown)
  - Daily breakdown (last 30 days)
  - Method breakdown with percentages
  - Cost comparison and savings percentage

#### 4. Test Endpoint
- **Endpoint:** `/api/test/pdf/hybrid-test`
- **Purpose:** Test hybrid parser with sample PDFs
- **Test Results (2025-12-30):**
  - Total PDFs: 3
  - Success Rate: 100%
  - Free Method (pdf2json): 3/3 (100%)
  - Paid Fallback (Document AI): 0/3 (0%)
  - Cost Without Hybrid: $0.0450
  - Actual Cost: $0.0000
  - **Savings: $0.0450 (100%)**

### Database Changes (Migration 005)
- **File:** `database/migrations/005_add_extraction_metrics.sql`
- **New Columns:**
  ```sql
  ALTER TABLE autoland_reports
  ADD COLUMN extraction_method VARCHAR(20) DEFAULT 'document-ai',
  ADD COLUMN extraction_cost DECIMAL(10, 4) DEFAULT 0.0000 NOT NULL,
  ADD COLUMN extraction_cost_saved DECIMAL(10, 4) DEFAULT 0.0000 NOT NULL;
  ```

### Cost Comparison

| Scenario | PDFs/Month | Document AI Only | Hybrid System | Savings |
|----------|------------|------------------|---------------|---------|
| Low      | 100        | $1.50            | $0.15-0.30    | 80-90%   |
| Medium   | 500        | $7.50            | $0.75-1.50    | 80-90%   |
| High     | 1000       | $15.00           | $1.50-3.00    | 80-90%   |

*Assuming 85-95% success rate with pdf2json*

### Process Route Updates
- **File:** `src/app/api/reports/process/route.ts`
- **Changes:**
  - Replaced Document AI-only extraction with hybrid parser
  - Added extraction metrics to database insert
  - Returns warnings and cost metrics in response

### Bug Fixes (2025-12-30)
**Issue:** Undefined variable `parseResult.warnings` in process route
- **Location:** `src/app/api/reports/process/route.ts:274`
- **Cause:** Variable name not updated after switching to hybrid parser
- **Fix:** Changed `parseResult.warnings` → `hybridResult.warnings`

### Previous Attempts (Failed)
1. **pdf-parse**: Failed due to webpack compatibility issues with Next.js 14
2. **pdfjs-dist**: Failed with `TypeError: Object.defineProperty called on non-object`
3. **Solution:** Settled on pdf2json which works perfectly with Next.js

---

## 🔄 Recent Changes

### Production Deployment Session (2026-01-15)

**Project:** `autoland-monitoring-test`
**Region:** `asia-southeast1`

**Deployed Components:**

| Component | Status | Details |
|-----------|--------|---------|
| Cloud Function `gmail-pubsub-processor` | ✅ | Processes Gmail notifications |
| Cloud Function `renew-gmail-watch` | ✅ | Auto-renews Gmail Watch |
| Cloud Scheduler `renew-gmail-watch-weekly` | ✅ | Runs every 6 days |
| Pub/Sub Topic `gmail-notifications` | ✅ | Gmail push notifications |
| Gmail Watch | ✅ | Personal Gmail account |
| Cloud SQL `autoland-db` | ✅ | PostgreSQL 15 |
| Document AI Processor | ✅ | US region, OCR type |
| Cloud Run (Next.js) | 🔄 | Building... |

**Key Learnings:**

1. **Refresh Token vs Authorization Code:**
   - Authorization Code: `4/0Axxxxxx...` (one-time use)
   - Refresh Token: `1//0gxxxxxx...` (save to Secret Manager)

2. **Cloud Function Secret Caching:**
   - Cloud Functions cache secret values
   - Need to redeploy after updating secrets to force refresh
   - Error `invalid_grant` often means cached old secret

3. **OAuth2 localhost redirect:**
   - Can use `http://localhost:3000/oauth2callback` for Cloud Shell
   - Manual flow: browser redirects to localhost (won't load), copy URL and paste

4. **Script Fix:**
   - Updated `setup-gmail-watch.js` to print refresh token
   - Added clear visual output with `━━━` separators

**Resource IDs:**

| Resource | ID |
|----------|-----|
| Project | `autoland-monitoring-test` |
| Document AI Processor | `projects/autoland-monitoring-test/locations/us/processors/ac5cded15d980c63` |
| Service Account | `autoland-service@autoland-monitoring-test.iam.gserviceaccount.com` |
| Cloud SQL Connection | `autoland-monitoring-test:asia-southeast1:autoland-db` |
| Storage Bucket | `autoland-reports` |

---

### Production Deployment Review (2026-01-15)

**Objective:** Rà soát toàn bộ codebase và sửa lỗi trước khi deploy lên Google Cloud

**Critical Issues Fixed:**

| # | Issue | Fix |
|---|-------|-----|
| 1 | `gcp-key.json` not in `.gitignore` | Added to `.gitignore` |
| 2 | Dockerfile missing build step | Rewrote with standalone output |
| 3 | `docker-compose.yml` wrong path | Fixed volumes |
| 4 | `cloudbuild.yaml` using gcr.io | Changed to Artifact Registry |
| 5 | Cloud Function missing OAuth2 | Added OAuth2 token handling |

**README Reorganization:**

New structure for production deployment with custom domain:

```
PHẦN A: INFRASTRUCTURE (Bước 1-9)
├── Google Cloud Account & CLI
├── Project & Enable APIs (including Eventarc)
├── Service Account & Document AI
├── Cloud Storage & Cloud SQL
└── Secret Manager (DB password)

PHẦN B: DEPLOY APPLICATION (Bước 10-13)
├── Build Docker Image
├── Deploy to Cloud Run
├── ⭐ MAP CUSTOM DOMAIN
└── Run Database Migrations

PHẦN C: GMAIL INTEGRATION (Bước 14-17)
├── Setup OAuth2 (redirect URI = custom domain)
├── Setup Pub/Sub Topic
├── Setup Gmail Watch
└── Deploy Cloud Functions

PHẦN D: VERIFY & AUTOMATION (Bước 17-18)
├── Verify Deployment
└── Setup Gmail Watch Renewal Automation
```

**Key Insight:** OAuth2 requires redirect URI that matches a live domain. Must deploy Cloud Run and map custom domain BEFORE setting up OAuth2.

**Files Modified:**
- `.gitignore` - Security fix
- `docker/Dockerfile` - Complete rewrite
- `next.config.js` - Added `output: 'standalone'`
- `docker-compose.yml` - Fixed volumes
- `cloudbuild.yaml` - Artifact Registry
- `cloud-functions/gmail-pubsub-processor/index.js` - OAuth2 handling
- `src/app/api/reports/process-internal/route.ts` - Accept PDF directly
- `README.md` - Major reorganization

**Session Log:** `.beads/deployment-review-session-2026-01-15.md`

---

### Hybrid PDF Parser Implementation (2025-12-30)
**Objective:** Reduce Document AI costs by 80-90%

**Files Created:**
1. `src/lib/parsers/pdf-text-extractor.ts` - PDF text extraction using pdf2json (FREE)
2. `src/lib/parsers/hybrid-pdf-parser.ts` - Hybrid parser with fallback logic
3. `src/app/api/dashboard/cost-savings/route.ts` - Cost savings analytics API
4. `src/app/api/test/pdf/hybrid-test/route.ts` - Hybrid parser test endpoint
5. `database/migrations/005_add_extraction_metrics.sql` - Database schema changes

**Files Modified:**
1. `src/app/api/reports/process/route.ts` - Use hybrid parser instead of Document AI only
2. `README.md` - Added hybrid parser documentation and deployment guide
3. `package.json` - Added pdf2json dependency

**Test Results:**
- 3/3 PDFs parsed successfully (100%)
- 3/3 using free method pdf2json (0% paid fallback)
- $0.045 cost saved (100% savings in test)

**Bug Fixes:**
- Fixed undefined variable reference in process route (line 274)

### Pub/Sub Implementation (2025-12-28)
1. **Cloud Function:** `cloud-functions/gmail-pubsub-processor/`
   - Auto-processes Gmail emails via Pub/Sub notifications
   - Supports both direct processing and HTTP API calls
   - Uses Service Account authentication

2. **Gmail Watch Setup:** `scripts/setup-gmail-watch.js`
   - Configures Gmail to send notifications to Pub/Sub topic
   - Watch expires after 7 days (needs renewal)

3. **Internal API Endpoint:** `src/app/api/reports/process-internal/route.ts`
   - Service Account authenticated endpoint
   - Called by Cloud Function to process PDFs

4. **Documentation:**
   - `docs/PUBSUB_SETUP_GUIDE.md` - Complete setup guide
   - `docs/PUBSUB_IMPLEMENTATION_SUMMARY.md` - Implementation summary

### Previous Changes (2025-12-28)

### Directory Structure
1. **Renamed:** `beads/` → `.beads/` (hidden folder for documentation)
   - All epic documentation files moved to `.beads/`
   - All references updated in documentation

### Dashboard Improvements
1. Success Rate Card moved to left side
2. Height alignment: Success Rate Card matches 2 rows of stats cards
3. Autoland Reports: Minimum 10 results (from 5)

### Footer Updates
1. Email: `moc@vietjetair.com`
2. Website: `https://www.amoict.com`
3. Department: "ICT Department"
4. Description: Removed "CAT 3"

### Site Configuration
1. Updated metadata
2. Updated authors to "ICT Department"
3. Updated descriptions

**Detailed Changes:** See `.beads/ux-ui-improvements-2025-12-28.md`

---

## 📝 Naming Conventions

### Files
- **Components:** PascalCase (e.g., `SuccessRateCard.tsx`)
- **Hooks:** camelCase with `use-` prefix (e.g., `use-dashboard.ts`)
- **API Routes:** lowercase with hyphens (e.g., `dashboard/stats/route.ts`)

### Code
- **Components:** PascalCase
- **Functions:** camelCase
- **Constants:** UPPER_SNAKE_CASE
- **Types/Interfaces:** PascalCase

---

## 🚀 Deployment

### Current Deployment Status (2026-01-15)

**Project:** `autoland-monitoring-test`
**Target Domain:** `autoland.blocksync.me`

| Component | Status |
|-----------|--------|
| Cloud Function `gmail-pubsub-processor` | ✅ Deployed |
| Pub/Sub Topic `gmail-notifications` | ✅ Created |
| Secret `google-client-secret` | ✅ Created |
| Secret `gmail-oauth-refresh-token` | ⚠️ Placeholder (needs update) |
| Cloud Run (Next.js) | ❌ Not deployed |
| Custom Domain Mapping | ❌ Not done |
| OAuth2 Setup | ❌ Not done |
| Gmail Watch | ❌ Not done |
| Database Migrations | ❌ Not run |

**Next Steps:**
1. Deploy Cloud Run
2. Map custom domain
3. Setup OAuth2 with production redirect URI
4. Run Gmail Watch setup
5. Update refresh token in Secret Manager

### Environment Variables
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `GCP_PROJECT_ID`, `GCP_KEY_FILE` (for PDF downloads, Gmail API, Document AI)
- `GCP_STORAGE_BUCKET` (Cloud Storage bucket for PDFs)
- `DOCUMENT_AI_PROCESSOR_ID` (Document AI processor ID)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` (OAuth2 for Gmail)
- `GMAIL_USER` (Optional, for domain-wide delegation)
- `NEXT_PUBLIC_APP_URL`

### Build Process
- Next.js standalone output
- Docker multi-stage build
- Cloud Run deployment ready

---

## 📚 Documentation Files

**Note:** Documentation files are stored in `.beads/` directory (hidden folder, renamed from `beads/` on 2025-12-28)

### Epic Documentation
- `.beads/epic-2-dashboard-ui-complete.md` - Dashboard UI implementation
- `.beads/epic-3-aircraft-pages-complete.md` - Aircraft pages
- `.beads/epic-4-reports-pages-complete.md` - Reports pages
- `.beads/epic-5-fleet-monitoring-complete.md` - Fleet monitoring
- `.beads/epic-6-deployment-complete.md` - Deployment
- `.beads/epic-7-testing-complete.md` - Testing

### Improvement Documentation
- `.beads/ux-ui-improvements-2025-12-28.md` - Recent UX/UI improvements
- `.beads/deployment-review-session-2026-01-15.md` - Production deployment review session

### Other Documentation
- `.beads/implementation-plan.md` - Detailed implementation plan
- `.beads/review_beads.md` - Review documentation
- `.beads/file_beads.md` - File structure documentation

### Planning Documents
- `PLAN_UPDATED.md` - Updated project plan
- `README.md` - Project overview

### Pub/Sub & Cloud Function Documentation
- `docs/PUBSUB_SETUP_GUIDE.md` - Complete Pub/Sub setup guide
- `docs/PUBSUB_IMPLEMENTATION_SUMMARY.md` - Implementation summary
- `cloud-functions/gmail-pubsub-processor/README.md` - Cloud Function documentation

---

## ⚠️ Important Notes

### Removed Features
- "CAT 3" reference removed from descriptions (2025-12-28)
- Navigation menus "Aircraft" and "Reports" removed (functionality moved to Dashboard)

### Deprecated
- Old email: `datnguyentien@vietjetair.com` (use `moc@vietjetair.com`)
- Old website: `https://www.vietjetair.com` (use `https://www.amoict.com`)
- `scripts/test-email-pdf.ps1`, `scripts/test-email-pdf.sh`, `scripts/test-oauth2-gmail.ps1` - Use `COMPLETE_SETUP_GUIDE.md` instead
- `database/seed_data.sql` (duplicate) - Use `database/migrations/seed_data.sql` instead

### Known Limitations
- Chart.js history data: Currently using mock data structure
- Real-time updates: Using polling (60s intervals) instead of WebSocket/SSE
- PDF download: Requires GCP credentials configured
- Gmail Watch: Expires after 7 days, needs renewal (consider Cloud Scheduler)
- Pub/Sub: Requires Pub/Sub API and Cloud Functions API enabled

---

## 🔗 Key File Locations

### Configuration
- `src/config/site.ts` - Site metadata and configuration
- `tailwind.config.ts` - Tailwind CSS configuration
- `next.config.js` - Next.js configuration
- `package.json` - Dependencies

### Components
- `src/components/dashboard/` - Dashboard components
- `src/components/layout/` - Layout components (Navigation, Footer)
- `src/components/ui/` - shadcn/ui components

### API Routes
- `src/app/api/dashboard/` - Dashboard API endpoints
  - `stats/route.ts` - Dashboard statistics
  - `cost-savings/route.ts` - **NEW** (2025-12-30) - PDF extraction cost savings metrics
- `src/app/api/reports/` - Reports API endpoints
  - `process/route.ts` - Process PDF using hybrid parser (OAuth2 authenticated)
  - `process-internal/route.ts` - Process PDF using hybrid parser (Service Account authenticated, for Cloud Function)
- `src/app/api/aircraft/` - Aircraft API endpoints
- `src/app/api/test/` - Test endpoints (Gmail, PDF extraction)
  - `pdf/hybrid-test/route.ts` - **NEW** (2025-12-30) - Test hybrid PDF parser with sample files
- `src/app/api/migrate/` - Temporary migration endpoints

### Hooks
- `src/hooks/use-dashboard.ts` - Dashboard data hook
- `src/hooks/use-alerts.ts` - Alerts data hook
- `src/hooks/use-recent-autolands.ts` - Recent autolands hook

### Parsers (Added 2025-12-30)
- `src/lib/parsers/pdf-text-extractor.ts` - PDF text extraction using pdf2json (FREE)
- `src/lib/parsers/hybrid-pdf-parser.ts` - Hybrid parser with fallback to Document AI (PAID)

---

**Maintained by:** Vietjet AMO ICT Department  
**For questions:** Contact `moc@vietjetair.com`

