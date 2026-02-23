#!/usr/bin/env pwsh
# Script de preparação para deploy no Vercel

Write-Host "🚀 Preparando projeto para deploy no Vercel..." -ForegroundColor Cyan

# 1. Build do frontend
Write-Host "`n📦 Fazendo build do frontend..." -ForegroundColor Yellow
Push-Location frontend
npm install
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erro no build do frontend" -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location
Write-Host "✅ Frontend buildado com sucesso!" -ForegroundColor Green

# 2. Verificar arquivos de configuração
Write-Host "`n📋 Verificando arquivos de configuração..." -ForegroundColor Yellow

$files = @(
    "vercel.json",
    ".vercelignore",
    "frontend/.env.example",
    "VERCEL_DEPLOY.md"
)

foreach ($file in $files) {
    if (Test-Path $file) {
        Write-Host "  ✅ $file" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $file não encontrado!" -ForegroundColor Red
    }
}

# 3. Instruções finais
Write-Host "`n📝 Próximos passos:" -ForegroundColor Cyan
Write-Host "  1. Faça commit das alterações:" -ForegroundColor White
Write-Host "     git add ." -ForegroundColor Gray
Write-Host "     git commit -m 'Preparar para deploy no Vercel'" -ForegroundColor Gray
Write-Host "     git push" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. Faça deploy do backend primeiro (Railway/Render/Fly.io)" -ForegroundColor White
Write-Host "     Consulte VERCEL_DEPLOY.md para instruções" -ForegroundColor Gray
Write-Host ""
Write-Host "  3. Deploy no Vercel:" -ForegroundColor White
Write-Host "     - Via CLI: vercel --prod" -ForegroundColor Gray
Write-Host "     - Via Web: https://vercel.com/new" -ForegroundColor Gray
Write-Host ""
Write-Host "  4. Configure a variável de ambiente no Vercel:" -ForegroundColor White
Write-Host "     VITE_API_URL=https://seu-backend.railway.app" -ForegroundColor Gray
Write-Host ""
Write-Host "📖 Leia VERCEL_DEPLOY.md para instruções completas!" -ForegroundColor Yellow
Write-Host ""
Write-Host "✨ Preparação concluída!" -ForegroundColor Green
