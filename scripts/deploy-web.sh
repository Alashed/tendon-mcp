#!/usr/bin/env bash
# Deploy packages/web (Next.js) to EC2 via S3 + SSM
# Usage: ./scripts/deploy-web.sh

set -euo pipefail

REGION="eu-north-1"
INSTANCE_ID="i-08eb56616ddb569bc"
S3_BUCKET="alashed-media"
S3_KEY="deployments/web.tar.gz"
APP_DIR="/home/ubuntu/apps/alashed-tracker/packages/web"

echo "==> Building web…"
cd "$(dirname "$0")/../packages/web"

npm run build

echo "==> Preparing standalone bundle…"
cp -r public .next/standalone/public 2>/dev/null || true
cp -r .next/static .next/standalone/.next/static

echo "==> Packaging…"
tar -czf /tmp/web.tar.gz -C .next/standalone .

echo "==> Uploading to S3…"
aws s3 cp /tmp/web.tar.gz "s3://${S3_BUCKET}/${S3_KEY}" --region "$REGION"

echo "==> Deploying via SSM…"
aws ssm send-command \
  --region "$REGION" \
  --instance-ids "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --parameters "commands=[
    'set -e',
    'mkdir -p ${APP_DIR}',
    'cd ${APP_DIR}',
    'aws s3 cp s3://${S3_BUCKET}/${S3_KEY} web.tar.gz --region ${REGION}',
    'rm -rf server.js .next public',
    'tar -xzf web.tar.gz',
    'rm web.tar.gz',
    'pm2 restart alashed-web || pm2 start server.js --name alashed-web --cwd ${APP_DIR} -- --hostname 0.0.0.0',
    'pm2 save',
    'echo DONE'
  ]" \
  --output text \
  --query "Command.CommandId"

echo "==> Done! Web deploy triggered."
echo "    Check logs: aws ssm get-command-invocation --region ${REGION} --instance-id ${INSTANCE_ID} --command-id <ID>"
