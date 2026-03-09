#!/usr/bin/env bash
# Deploy packages/web (Next.js) to EC2 via S3 + SSM
# Usage: ./scripts/deploy-web.sh

set -euo pipefail

REGION="eu-north-1"
INSTANCE_ID="i-08eb56616ddb569bc"
S3_BUCKET="alashed-media"
S3_KEY="deployments/web.tar.gz"
# On EC2, we extract the standalone bundle here — server.js lands at $APP_DIR/packages/web/server.js
APP_DIR="/home/ubuntu/apps/alashed-web"

echo "==> Building web…"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT/packages/web"

npm run build

echo "==> Preparing standalone bundle…"
# Copy public assets and static files into the standalone output
cp -r public .next/standalone/public 2>/dev/null || true
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static

echo "==> Packaging…"
tar -czf /tmp/web.tar.gz -C .next/standalone .

echo "==> Uploading to S3…"
aws s3 cp /tmp/web.tar.gz "s3://${S3_BUCKET}/${S3_KEY}" --region "$REGION"

echo "==> Deploying via SSM…"
COMMAND_ID=$(aws ssm send-command \
  --region "$REGION" \
  --instance-ids "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --parameters "commands=[
    'set -e',
    'mkdir -p ${APP_DIR}',
    'cd ${APP_DIR}',
    'aws s3 cp s3://${S3_BUCKET}/${S3_KEY} web.tar.gz --region ${REGION}',
    'rm -rf node_modules packages .next public package.json',
    'tar -xzf web.tar.gz',
    'rm web.tar.gz',
    'pm2 delete alashed-web 2>/dev/null || true',
    'PORT=3030 CLERK_SECRET_KEY=sk_test_wyZOqehcqUmLd4AEbYJEnDtGlaXVljaikbZmwSCMlR pm2 start ${APP_DIR}/packages/web/server.js --name alashed-web --cwd ${APP_DIR}/packages/web',
    'pm2 save',
    'echo DONE'
  ]" \
  --output text \
  --query "Command.CommandId")

echo "==> SSM command ID: $COMMAND_ID"
echo "    Monitor: aws ssm get-command-invocation --region ${REGION} --instance-id ${INSTANCE_ID} --command-id ${COMMAND_ID} --query '[StandardOutputContent,StandardErrorContent]' --output text"
echo "==> Web deploy triggered."
