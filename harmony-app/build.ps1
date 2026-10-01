$ErrorActionPreference = 'Stop'
$studioPath = [Environment]::GetEnvironmentVariable('DEVECO_CLI_STUDIO_PATH', 'User')
if (!$studioPath) { $studioPath = 'D:\Huawei\DevEcoStudio' }
$env:DEVECO_CLI_STUDIO_PATH = $studioPath
# Hvigor 在中文路径下构建有限制，签名只保存在本机英文构建目录。
$buildRoot = 'D:\Huawei\Projects\PostcardBuild'
New-Item -ItemType Directory -Path $buildRoot -Force | Out-Null
$profilePath = Join-Path $buildRoot 'build-profile.json5'
$localProfile = if (Test-Path -LiteralPath $profilePath) {
    Get-Content -LiteralPath $profilePath -Raw | ConvertFrom-Json
}
robocopy $PSScriptRoot $buildRoot /E /XD .hvigor oh_modules build .idea /XF local.properties /NFL /NDL /NJH /NJS /NP
if ($LASTEXITCODE -ge 8) { throw '工程同步失败' }
if ($localProfile.app.signingConfigs.Count -gt 0) {
    $profile = Get-Content -LiteralPath $profilePath -Raw | ConvertFrom-Json
    $profile.app.signingConfigs = $localProfile.app.signingConfigs
    foreach ($product in $profile.app.products) {
        $product | Add-Member -NotePropertyName signingConfig -NotePropertyValue $localProfile.app.signingConfigs[0].name -Force
    }
    $profile | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $profilePath -Encoding utf8
}
Push-Location $buildRoot
try {
    $env:DEVECO_SDK_HOME = Join-Path $studioPath 'sdk'
    $env:JAVA_HOME = Join-Path $studioPath 'jbr'
    $nodePath = Join-Path $studioPath 'tools\node\node.exe'
    $hvigorPath = Join-Path $studioPath 'tools\hvigor\bin\hvigorw.js'
    & $nodePath $hvigorPath assembleHap --mode module -p 'module=entry@default' -p 'product=default' -p 'buildMode=debug' --parallel --incremental
    if ($LASTEXITCODE -ne 0) { throw '鸿蒙工程编译失败' }
    $outputRoot = Join-Path (Split-Path $PSScriptRoot -Parent) 'dist\harmony'
    New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null
    foreach ($package in Get-ChildItem -Path 'entry\build\default\outputs\default\*.hap') {
        Copy-Item -LiteralPath $package.FullName -Destination $outputRoot -Force
    }
    Get-ChildItem -LiteralPath $outputRoot -Filter '*.hap' | Select-Object FullName, Length
} finally { Pop-Location }
