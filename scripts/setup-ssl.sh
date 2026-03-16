#!/bin/bash
# One-time SSL setup on a fresh EC2 instance.
# Requires DNS to already point to this server.
# Run: bash scripts/setup-ssl.sh your@email.com

set -e

EMAIL=${1:-"admin@tendon.alashed.kz"}

echo "==> Copying nginx configs..."
sudo cp infra/nginx-api.conf /etc/nginx/sites-available/api.tendon.alashed.kz
sudo cp infra/nginx-tendon.conf /etc/nginx/sites-available/tendon.alashed.kz
sudo ln -sf /etc/nginx/sites-available/api.tendon.alashed.kz /etc/nginx/sites-enabled/
sudo ln -sf /etc/nginx/sites-available/tendon.alashed.kz /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

echo "==> Setting up HTTP-only blocks for cert verification..."
sudo tee /etc/nginx/sites-available/api.tendon.alashed.kz > /dev/null <<'NGINX'
server {
    listen 80;
    server_name api.tendon.alashed.kz;
    location / { proxy_pass http://127.0.0.1:3001; }
}
NGINX

sudo tee /etc/nginx/sites-available/tendon.alashed.kz > /dev/null <<'NGINX'
server {
    listen 80;
    server_name tendon.alashed.kz;
    location / { proxy_pass http://127.0.0.1:3030; }
}
NGINX

sudo nginx -t && sudo systemctl reload nginx

echo "==> Obtaining SSL certificates..."
sudo certbot --nginx \
  --non-interactive \
  --agree-tos \
  --email "$EMAIL" \
  -d api.tendon.alashed.kz \
  -d tendon.alashed.kz

echo "==> Installing final nginx configs with SSL..."
sudo cp infra/nginx-api.conf /etc/nginx/sites-available/api.tendon.alashed.kz
sudo cp infra/nginx-tendon.conf /etc/nginx/sites-available/tendon.alashed.kz
sudo nginx -t && sudo systemctl reload nginx

echo ""
echo "Done! Test:"
echo "  curl https://api.tendon.alashed.kz/health"
echo "  curl https://tendon.alashed.kz"
