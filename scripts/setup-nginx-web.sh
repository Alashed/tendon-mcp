#!/usr/bin/env bash
# Run on EC2 to configure Nginx + SSL for tracker.alashed.kz
# Prerequisite: DNS A record for tracker.alashed.kz must point to 13.62.193.249

set -euo pipefail

DOMAIN="tracker.alashed.kz"

echo "==> Installing Nginx config…"
sudo cp /home/ubuntu/apps/alashed-tracker/infra/nginx-tracker.conf \
         /etc/nginx/sites-available/tracker.alashed.kz

sudo ln -sf /etc/nginx/sites-available/tracker.alashed.kz \
             /etc/nginx/sites-enabled/tracker.alashed.kz

echo "==> Testing Nginx config…"
sudo nginx -t

echo "==> Obtaining SSL certificate…"
sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos \
  --email admin@alashed.kz --redirect

echo "==> Reloading Nginx…"
sudo systemctl reload nginx

echo "==> Done! https://${DOMAIN} is live."
