Write-Host "=== Starting API22 Auto-Deployment to VPS ===" -ForegroundColor Green

# 1. Copy Frontend static files
Write-Host "Copying frontend static assets to VPS..." -ForegroundColor Cyan
scp public/index.html public/style.css public/app.js public/crypto-js.min.js public/logo.png siemjeh-vps:/home/kuyaba/api22-app/public/

# 2. Copy Backend code
Write-Host "Copying backend server scripts to VPS..." -ForegroundColor Cyan
scp server.js package.json siemjeh-vps:/home/kuyaba/api22-app/

# 3. Install packages & restart PM2 process
Write-Host "Installing NPM packages and restarting PM2 process on VPS..." -ForegroundColor Cyan
ssh siemjeh-vps "cd /home/kuyaba/api22-app && npm install --production && (pm2 restart api22-app || pm2 start server.js --name api22-app)"

Write-Host "=== Auto-Deployment Completed Successfully! ===" -ForegroundColor Green
