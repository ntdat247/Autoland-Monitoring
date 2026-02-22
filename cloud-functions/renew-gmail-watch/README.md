# Gmail Watch Renewal Cloud Function

Cloud Function để tự động renew Gmail Watch cho Autoland Monitoring System.

**⚠️ Documentation đã được gộp vào README.md chính**

Xem hướng dẫn deploy và setup đầy đủ tại:
- **[Main README.md - Gmail Watch Renewal Automation](../../README.md#setup-gmail-watch-renewal-automation)**

## Quick Reference

Files trong thư mục này:
- **[index.js](./index.js)** - Cloud Function code
- **[package.json](./package.json)** - Dependencies và scripts
- **[.gitignore](./.gitignore)** - Git ignore rules

## Deploy Commands

```bash
cd cloud-functions/renew-gmail-watch
npm install

gcloud functions deploy renew-gmail-watch \
  --gen2 --runtime=nodejs24 --region=asia-southeast1 \
  --source=. --entry-point=renewGmailWatch --trigger-http \
  --service-account=autoland-service@autoland-monitoring.iam.gserviceaccount.com \
  --set-env-vars="GCP_PROJECT_ID=autoland-monitoring" \
  --set-env-vars="PUBSUB_TOPIC=gmail-notifications" \
  --set-secrets="GOOGLE_CLIENT_SECRET=google-client-secret:latest" \
  --set-secrets="OAUTH_REFRESH_TOKEN=gmail-oauth-refresh-token:latest" \
  --memory=256Mi --timeout=60s --allow-unauthenticated \
  --project=autoland-monitoring
```

## Support

Xem [README.md chính](../../README.md) để biết thêm chi tiết về troubleshooting, monitoring, và maintenance.
