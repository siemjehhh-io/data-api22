Write-Host "=== API22 Auto-Deploy Watcher Started ===" -ForegroundColor Green
Write-Host "Watching for file changes in local workspace..." -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop the watcher." -ForegroundColor Yellow

$folder = Get-Location
$filter = '*.*'

$fsw = New-Object IO.FileSystemWatcher $folder, $filter
$fsw.IncludeSubdirectories = $false
$fsw.EnableRaisingEvents = $true

$action = {
    $name = $Event.SourceEventArgs.Name
    
    # Ignore temp, git, and irrelevant files
    if ($name -match 'db\.json|\.git|nginx_config|deploy\.ps1|watch-deploy\.ps1') {
        return
    }
    
    Write-Host "Change detected in: $name. Auto-deploying..." -ForegroundColor Yellow
    
    try {
        if ($name -match 'index\.html|style\.css|app\.js|crypto-js\.min\.js|logo\.png') {
            scp $name siemjeh-vps:/home/kuyaba/api22-app/public/
            Write-Host "Successfully deployed $name to public web folder!" -ForegroundColor Green
        } elseif ($name -match 'server\.js|package\.json') {
            scp $name siemjeh-vps:/home/kuyaba/api22-app/
            ssh siemjeh-vps "cd /home/kuyaba/api22-app && pm2 restart api22-app"
            Write-Host "Successfully deployed $name and restarted PM2 backend!" -ForegroundColor Green
        }
    } catch {
        Write-Host "Error deploying ${name}: $_" -ForegroundColor Red
    }
}

$onChanged = Register-ObjectEvent $fsw Changed -SourceIdentifier "FileChanged" -Action $action

try {
    while ($true) {
        Start-Sleep -Seconds 1
    }
} finally {
    Unregister-Event -SourceIdentifier "FileChanged"
    $fsw.Dispose()
    Write-Host "`n=== Watcher Stopped ===" -ForegroundColor Red
}
