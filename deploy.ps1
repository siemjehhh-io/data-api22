Write-Host "=== Starting PIN88 Auto-Deployment to VPS ===" -ForegroundColor Green

# 1. Copy Frontend static files
Write-Host "Copying frontend static assets to VPS..." -ForegroundColor Cyan
scp index.html style.css app.js crypto-js.min.js logo.png siemjeh-vps:/home/kuyaba/pin88-app/public/

# 2. Copy Backend code
Write-Host "Copying backend server scripts to VPS..." -ForegroundColor Cyan
scp server.js package.json siemjeh-vps:/home/kuyaba/pin88-app/

# 3. Install packages & restart PM2 process
Write-Host "Installing NPM packages and restarting PM2 process on VPS..." -ForegroundColor Cyan
ssh siemjeh-vps "cd /home/kuyaba/pin88-app && npm install --production && (pm2 restart pin88-app || pm2 start server.js --name pin88-app)"

Write-Host "=== Auto-Deployment Completed Successfully! ===" -ForegroundColor Green
