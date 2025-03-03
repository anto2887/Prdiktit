#!/bin/bash
# frontend/deploy/deploy.sh - Script to deploy the frontend to AWS S3 and invalidate CloudFront cache

# Exit if any command fails
set -e

# Configuration
S3_BUCKET=${S3_BUCKET:-"your-s3-bucket-name"}
CLOUDFRONT_DISTRIBUTION_ID=${CLOUDFRONT_DISTRIBUTION_ID:-"your-cloudfront-distribution-id"}
ENVIRONMENT=${ENVIRONMENT:-"production"}
BUILD_DIR="./dist"

# Check for AWS CLI
if ! command -v aws &> /dev/null; then
    echo "AWS CLI could not be found. Please install it before running this script."
    exit 1
fi

# Check for required environment variables
if [ "$S3_BUCKET" = "your-s3-bucket-name" ]; then
    echo "Please set the S3_BUCKET environment variable."
    exit 1
fi

if [ "$CLOUDFRONT_DISTRIBUTION_ID" = "your-cloudfront-distribution-id" ]; then
    echo "Please set the CLOUDFRONT_DISTRIBUTION_ID environment variable."
    exit 1
fi

# Build the application
echo "Building the application for $ENVIRONMENT environment..."
npm run build

# Check if build directory exists
if [ ! -d "$BUILD_DIR" ]; then
    echo "Build directory '$BUILD_DIR' does not exist. Build may have failed."
    exit 1
fi

# Upload to S3
echo "Uploading files to S3 bucket: $S3_BUCKET"
aws s3 sync $BUILD_DIR s3://$S3_BUCKET/ --delete --cache-control "max-age=31536000,public"

# Set caching based on file types
echo "Setting cache control headers..."
# HTML files - no cache (must revalidate)
aws s3 cp s3://$S3_BUCKET/ s3://$S3_BUCKET/ --recursive --exclude "*" --include "*.html" --metadata-directive REPLACE --cache-control "max-age=0,no-cache,no-store,must-revalidate" --content-type "text/html"

# Special treatment for index.html
aws s3 cp s3://$S3_BUCKET/index.html s3://$S3_BUCKET/index.html --metadata-directive REPLACE --cache-control "max-age=0,no-cache,no-store,must-revalidate" --content-type "text/html"

# JavaScript files - cache for 1 year with immutable
aws s3 cp s3://$S3_BUCKET/ s3://$S3_BUCKET/ --recursive --exclude "*" --include "*.js" --metadata-directive REPLACE --cache-control "max-age=31536000,public,immutable" --content-type "application/javascript"

# CSS files - cache for 1 year with immutable
aws s3 cp s3://$S3_BUCKET/ s3://$S3_BUCKET/ --recursive --exclude "*" --include "*.css" --metadata-directive REPLACE --cache-control "max-age=31536000,public,immutable" --content-type "text/css"

# Images - cache for 1 year
aws s3 cp s3://$S3_BUCKET/ s3://$S3_BUCKET/ --recursive --exclude "*" --include "*.jpg" --include "*.jpeg" --include "*.png" --include "*.gif" --include "*.svg" --metadata-directive REPLACE --cache-control "max-age=31536000,public"

# Fonts - cache for 1 year with immutable
aws s3 cp s3://$S3_BUCKET/ s3://$S3_BUCKET/ --recursive --exclude "*" --include "*.woff" --include "*.woff2" --include "*.ttf" --include "*.eot" --metadata-directive REPLACE --cache-control "max-age=31536000,public,immutable"

# Create CloudFront invalidation
echo "Creating CloudFront invalidation for distribution: $CLOUDFRONT_DISTRIBUTION_ID"
aws cloudfront create-invalidation --distribution-id $CLOUDFRONT_DISTRIBUTION_ID --paths "/*"

echo "Deployment complete!"