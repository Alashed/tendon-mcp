#!/bin/bash
# One-time setup: install nginx configs + get SSL certs for API and MCP.
# Run on the EC2 instance as ubuntu user:
#   bash scripts/setup-ssl.sh your@email.com

set -e

EMAIL=${1:-"admin@tendon.alashed.kz"}

echo "==> Copying nginx configs..."
sudo cp infra/nginx-api.conf /etc/nginx/conf.d/api.tendon.alashed.kz.conf
sudo cp infra/nginx-mcp.conf /etc/nginx/conf.d/mcp.tendon.alashed.kz.conf

# Temporarily serve HTTP so certbot can verify
echo "==> Setting up HTTP-only blocks for cert verification..."
sudo tee /etc/nginx/conf.d/api.tendon.alashed.kz.conf > /dev/null <<'NGINX'
server {
    listen 80;
    server_name api.tendon.alashed.kz;
    location / { proxy_pass http://127.0.0.1:3001; }
}
NGINX

sudo tee /etc/nginx/conf.d/mcp.tendon.alashed.kz.conf > /dev/null <<'NGINX'
server {
    listen 80;
    server_name mcp.tendon.alashed.kz;
    location / { proxy_pass http://127.0.0.1:3002; }
}
NGINX

sudo nginx -t && sudo systemctl reload nginx

echo "==> Obtaining SSL certificates..."
sudo certbot --nginx \
  --non-interactive \
  --agree-tos \
  --email "$EMAIL" \
  -d api.tendon.alashed.kz \
  -d mcp.tendon.alashed.kz

echo "==> Installing final nginx configs with SSL..."
sudo cp /home/ubuntu/alashed-tracker/../infra/nginx-api.conf /etc/nginx/conf.d/api.tendon.alashed.kz.conf 2>/dev/null || true
# certbot already updated the configs with ssl blocks, just reload
sudo nginx -t && sudo systemctl reload nginx

echo ""
echo "Done! Test:"
echo "  curl https://api.tendon.alashed.kz/health"
echo "  curl https://mcp.tendon.alashed.kz/health"
