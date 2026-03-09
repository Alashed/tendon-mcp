#!/usr/bin/env bash
# Deploy packages/api to EC2 via S3 + SSM
# Usage: ./scripts/deploy-api.sh

set -euo pipefail

REGION="eu-north-1"
INSTANCE_ID="i-08eb56616ddb569bc"
S3_BUCKET="alashed-media"
S3_KEY="deployments/api.tar.gz"
APP_DIR="/home/ubuntu/alashed-tracker"

echo "==> Building API…"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT/packages/api"

npm run build

echo "==> Packaging dist + migrations + package.json…"
tar -czf /tmp/api.tar.gz dist migrations package.json ecosystem.config.cjs

echo "==> Uploading to S3…"
aws s3 cp /tmp/api.tar.gz "s3://${S3_BUCKET}/${S3_KEY}" --region "$REGION"

echo "==> Deploying via SSM…"
COMMAND_ID=$(aws ssm send-command \
  --region "$REGION" \
  --instance-ids "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --parameters "commands=[
    'set -e',
    'mkdir -p ${APP_DIR}',
    'cd ${APP_DIR}',
    'aws s3 cp s3://${S3_BUCKET}/${S3_KEY} api.tar.gz --region ${REGION}',
    'rm -rf dist migrations ecosystem.config.cjs',
    'tar -xzf api.tar.gz',
    'rm api.tar.gz',
    'npm install --omit=dev --prefer-offline 2>/dev/null || npm install --omit=dev',
    'node dist/scripts/migrate.js 2>&1 || echo migration_failed_check_logs',
    'pm2 restart alashed-tracker-api || pm2 start ecosystem.config.cjs',
    'pm2 save',
    'echo DONE'
  ]" \
  --output text \
  --query "Command.CommandId")

echo "==> SSM command ID: $COMMAND_ID"
echo "    Monitor: aws ssm get-command-invocation --region ${REGION} --instance-id ${INSTANCE_ID} --command-id ${COMMAND_ID} --query '[StandardOutputContent,StandardErrorContent]' --output text"
echo "==> API deploy triggered."
