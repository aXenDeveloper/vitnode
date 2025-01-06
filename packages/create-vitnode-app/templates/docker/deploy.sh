#!/bin/bash

# Environment variables
DOMAIN_MAIN_NAME="your_website.com"
DOMAIN_FRONTEND_NAME="your_website.com"
DOMAIN_BACKEND_NAME="backend.your_website.com"
EMAIL="contact@your_website.com"
DB_USER=$(openssl rand -base64 8) # Generate a random 8-character username
DB_PASSWORD=$(openssl rand -base64 12)  # Generate a random 12-character password
DB_DATABASE="vitnode"
LOGIN_TOKEN_SECRET=$(openssl rand -base64 32)  # Generate a random 32-character secret

# Other variables (do not change unless you know what you are doing)
SWAP_SIZE="1G"  # Swap size of 1GB

# ================================
# ================================
# ================================

# Update package list and upgrade existing packages
sudo apt update && sudo apt upgrade -y

# Add Swap Space
if ! sudo swapon --show | grep -q '/swapfile'; then
  sudo fallocate -l $SWAP_SIZE /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile

  # Make swap permanent
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
else
  echo "Swap file already exists and is active."
fi

# ================================
# Install Nginx
sudo apt install nginx -y

# Delete the default Nginx configuration file if it exists
if [ -f /etc/nginx/sites-available/default ]; then
  sudo rm -f /etc/nginx/sites-available/default
fi

if [ -L /etc/nginx/sites-enabled/default ]; then
  sudo rm -f /etc/nginx/sites-enabled/default
fi

# Stop Nginx temporarily to allow Certbot to run in standalone mode
sudo systemctl stop nginx

# Obtain SSL certificate using Certbot standalone mode
sudo apt install certbot -y
sudo certbot certonly --standalone -d $DOMAIN_FRONTEND_NAME -d $DOMAIN_BACKEND_NAME --non-interactive --agree-tos -m contact@vitnode.com --cert-name $DOMAIN_MAIN_NAME

# Ensure SSL files exist or generate them
if [ ! -f /etc/letsencrypt/options-ssl-nginx.conf ]; then
  sudo wget https://raw.githubusercontent.com/certbot/certbot/main/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf -P /etc/letsencrypt/
fi

if [ ! -f /etc/letsencrypt/ssl-dhparams.pem ]; then
  sudo openssl dhparam -out /etc/letsencrypt/ssl-dhparams.pem 2048
fi

# Create Nginx config with reverse proxy, SSL support, rate limiting, and streaming support for both frontend and backend
sudo tee /etc/nginx/sites-available/vitnode > /dev/null <<EOL
limit_req_zone \$binary_remote_addr zone=mylimit:10m rate=10r/s;

# Frontend Server Block
server {
    listen 80;
    server_name $DOMAIN_FRONTEND_NAME;

    # Redirect all HTTP requests to HTTPS
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl;
    server_name $DOMAIN_FRONTEND_NAME;

    ssl_certificate /etc/letsencrypt/live/$DOMAIN_MAIN_NAME/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN_MAIN_NAME/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Enable rate limiting
    limit_req zone=mylimit burst=20 nodelay;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;

        # Disable buffering for streaming support
        proxy_buffering off;
        proxy_set_header X-Accel-Buffering no;
    }
}

# Backend Server Block
server {
    listen 80;
    server_name $DOMAIN_BACKEND_NAME;

    # Redirect all HTTP requests to HTTPS
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl;
    server_name $DOMAIN_BACKEND_NAME;

    ssl_certificate /etc/letsencrypt/live/$DOMAIN_MAIN_NAME/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN_MAIN_NAME/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Enable rate limiting
    limit_req zone=mylimit burst=20 nodelay;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;

        # Disable buffering for streaming support
        proxy_buffering off;
        proxy_set_header X-Accel-Buffering no;
    }
}
EOL

# Create symbolic link if it doesn't already exist
if [ ! -f /etc/nginx/sites-enabled/vitnode ]; then
  sudo ln -s /etc/nginx/sites-available/vitnode /etc/nginx/sites-enabled/vitnode
fi

# Restart Nginx to apply the new configuration
sudo systemctl restart nginx

# ================================

# Add Docker's official GPG key:
sudo apt-get update
sudo apt-get install ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# Add the repository to Apt sources:
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Install Docker Compose
sudo rm -f /usr/local/bin/docker-compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose


# Wait for the file to be fully downloaded before proceeding
if [ ! -f /usr/local/bin/docker-compose ]; then
  echo "Docker Compose download failed. Exiting."
  exit 1
fi

sudo chmod +x /usr/local/bin/docker-compose

# Ensure Docker Compose is executable and in path
sudo ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose

# Verify Docker Compose installation
docker-compose --version
if [ $? -ne 0 ]; then
  echo "Docker Compose installation failed. Exiting."
  exit 1
fi

# Ensure Docker starts on boot and start Docker service
sudo systemctl enable docker
sudo systemctl start docker

# Create a .env file
if [ ! -f "./.env" ]; then
  echo "LOGIN_TOKEN_SECRET=$LOGIN_TOKEN_SECRET" > "./.env"
  echo "NEXT_PUBLIC_BACKEND_CLIENT_URL=https://$DOMAIN_BACKEND_NAME" >> "./.env"
  echo "NEXT_PUBLIC_FRONTEND_URL=https://$DOMAIN_FRONTEND_NAME" >> "./.env"
  echo "DB_USER=$DB_USER" >> "./.env"
  echo "DB_PASSWORD=$DB_PASSWORD" >> "./.env"
  echo "DB_DATABASE=$DB_DATABASE" >> "./.env"
  echo "NODE_ENV=production" >> "./.env"
else
  echo ".env file already exists. Skipping creation."
fi

sudo docker-compose -f ./docker-compose.yml -p vitnode up --build -d

sudo chown -R 1001:1001 ./apps/backend/src/plugins/core
sudo chown -R 1001:1001 ./apps/backend/uploads

# Check if Docker Compose started correctly
if ! sudo docker-compose ps | grep "Up"; then
  echo "Docker containers failed to start. Check logs with 'docker-compose logs'."
  exit 1
fi