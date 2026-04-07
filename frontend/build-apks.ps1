$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:PATH = "$env:JAVA_HOME\bin;" + $env:PATH

$apps = @(
    @{ appId = "com.vexel.pts.consumer"; appName = "PTS Sentinel"; startUrl = "/consumer/home"; outApk = "PTS-Sentinel-debug.apk" },
    @{ appId = "com.vexel.pts.vendor"; appName = "PTS Merchant"; startUrl = "/vendor/dashboard"; outApk = "PTS-Merchant-debug.apk" },
    @{ appId = "com.vexel.pts.police"; appName = "PTS Command"; startUrl = "/police/login"; outApk = "PTS-Command-debug.apk" },
    @{ appId = "com.vexel.pts.admin"; appName = "PTS Admin Hub"; startUrl = "/admin/dashboard"; outApk = "PTS-Admin-debug.apk" }
)

$outputDir = "C:\Users\COMPUTER 13\.gemini\antigravity\scratch\pts\APKs"
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

foreach ($app in $apps) {
    Write-Host ""
    Write-Host "=== Building $($app.appName) ===" -ForegroundColor Cyan

    $config = "import type { CapacitorConfig } from '@capacitor/cli';" + "`n`n"
    $config += "const config: CapacitorConfig = {" + "`n"
    $config += "  appId: '" + $app.appId + "'," + "`n"
    $config += "  appName: '" + $app.appName + "'," + "`n"
    $config += "  webDir: 'out'," + "`n"
    $config += "  server: { url: 'https://pts-vexel.vercel.app" + $app.startUrl + "', cleartext: true }" + "`n"
    $config += "};" + "`n`n"
    $config += "export default config;"
    Set-Content -Path "capacitor.config.ts" -Value $config

    Write-Host "Syncing to Android..." -ForegroundColor Yellow
    npx cap sync android --no-build 2>&1 | Out-Null

    $stringsPath = "android\app\src\main\res\values\strings.xml"
    $stringsContent = Get-Content $stringsPath -Raw
    $stringsContent = $stringsContent -replace '<string name="app_name">.*?</string>', ('<string name="app_name">' + $app.appName + '</string>')
    Set-Content -Path $stringsPath -Value $stringsContent

    Write-Host "Running Gradle build..." -ForegroundColor Yellow
    Push-Location android
    .\gradlew assembleDebug --no-daemon -q
    Pop-Location

    $apkSrc = "android\app\build\outputs\apk\debug\app-debug.apk"
    if (Test-Path $apkSrc) {
        Copy-Item $apkSrc "$outputDir\$($app.outApk)"
        $size = [math]::Round((Get-Item "$outputDir\$($app.outApk)").Length / 1MB, 2)
        Write-Host ("Done: " + $app.outApk + " (" + $size + " MB)") -ForegroundColor Green
    }
    else {
        Write-Host ("FAILED: " + $app.appName) -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=== ALL BUILDS COMPLETE ===" -ForegroundColor Cyan
Write-Host "APKs saved to: $outputDir"
Get-ChildItem $outputDir | Format-Table Name, Length
