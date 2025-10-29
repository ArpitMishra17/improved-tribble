# Google Cloud Storage Migration Guide

## Overview
This project has migrated from Cloudinary to Google Cloud Storage (GCS) for resume file storage.

## Benefits of GCS
- **Cost Efficient**: ~$0.020/GB/month vs Cloudinary's higher rates
- **Better Control**: Full IAM permissions and access control
- **Scalability**: No upload/transformation limits
- **Security**: Signed URLs with expiration for temporary access
- **Perfect for PDFs**: No need for image transformation features

## Environment Variables

### Required GCS Variables
Add these to your .env and Railway:

```bash
# Google Cloud Storage Configuration
GCS_PROJECT_ID=ealmatch-railway
GCS_BUCKET_NAME=vantahire
GCS_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"ealmatch-railway",...}'
```

### Remove Old Cloudinary Variables
These are no longer needed:
- CLOUDINARY_CLOUD_NAME
- CLOUDINARY_API_KEY
- CLOUDINARY_API_SECRET

## Files Changed

### New Files
- `server/gcs-storage.ts` - GCS storage service with upload/download/delete functions

### Modified Files
- `server/routes.ts` - Updated to use GCS functions instead of Cloudinary
  - Line 10: Import changed from cloudinary to gcs-storage
  - Line 493: uploadToCloudinary → uploadToGCS
  - Line 628: uploadToCloudinary → uploadToGCS
  - Line 790: rewriteCloudinaryUrlForDownload → getSignedDownloadUrl

## Key Differences

### Storage Path Format
- **Cloudinary**: HTTPS URLs (https://res.cloudinary.com/...)
- **GCS**: gs:// URLs (gs://vantahire/resumes/...)

### Download URLs
- **Cloudinary**: Permanent URLs with fl_attachment transformation
- **GCS**: Signed URLs with 60-minute expiration (more secure)

## Testing

### Upload Test
```bash
curl -X POST http://localhost:5000/api/jobs/1/apply \
  -F "name=Test User" \
  -F "email=test@example.com" \
  -F "phone=+1234567890" \
  -F "resume=@test-resume.pdf"
```

### Download Test
1. Apply to a job with resume
2. Get the application ID
3. Access: http://localhost:5000/api/applications/{id}/resume

## Deployment Checklist

- [ ] Add GCS environment variables to Railway
- [ ] Test file upload locally
- [ ] Test file download locally
- [ ] Deploy to Railway
- [ ] Test in production
- [ ] Remove Cloudinary env vars from Railway
- [ ] Uninstall cloudinary package (optional cleanup)

## Rollback Plan
If issues occur, you can rollback by:
1. Restore `server/cloudinary.ts` import in routes.ts
2. Revert uploadToGCS calls back to uploadToCloudinary
3. Revert getSignedDownloadUrl back to rewriteCloudinaryUrlForDownload
4. Restore Cloudinary environment variables

## Support
- GCS Documentation: https://cloud.google.com/storage/docs
- Service Account Setup: https://cloud.google.com/iam/docs/service-accounts
