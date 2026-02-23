# 🚀 Deploy Rápido - Vercel + Railway

## Resumo da Arquitetura
- **Frontend (React):** Vercel ✅
- **Backend (FastAPI):** Railway ✅

---

## 📦 Passo 1: Deploy do Backend (Railway)

1. Acesse https://railway.app e crie uma conta
2. Clique em **"New Project"** → **"Deploy from GitHub repo"**
3. Selecione o repositório e a pasta `backend`
4. Configure as variáveis de ambiente:
   ```
   FIREBASE_DISABLED=1
   GEMINI_API_KEY=sua-chave-aqui
   PORT=8001
   ```
5. Aguarde o deploy e copie a URL (ex: `https://seu-app.railway.app`)

---

## 🌐 Passo 2: Deploy do Frontend (Vercel)

### Via GitHub (Automático):

1. Acesse https://vercel.com e faça login
2. Clique em **"Add New"** → **"Project"**
3. Importe o repositório do GitHub
4. Configure:
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
5. Adicione a variável de ambiente:
   - `VITE_API_URL` = URL do Railway (ex: `https://seu-app.railway.app`)
6. Clique em **"Deploy"**

### Via CLI:

```bash
# Instalar Vercel CLI
npm install -g vercel

# Preparar projeto
powershell -ExecutionPolicy Bypass -File prepare_deploy.ps1

# Deploy
vercel --prod
```

---

## ⚙️ Passo 3: Configurar Backend

Edite `backend/config.py` e adicione a URL do Vercel:

```python
FRONTEND_URLS = [
    "http://localhost:5173",
    "http://localhost:8001",
    "https://seu-app.vercel.app",  # ← Adicione aqui
]
```

Faça commit e push. O Railway fará redeploy automaticamente.

---

## ✅ Testar

1. Acesse `https://seu-app.vercel.app`
2. Faça upload de um PDF
3. Verifique se a análise funciona

---

## 🔧 Comandos Úteis

```bash
# Ver logs do Vercel
vercel logs

# Atualizar variáveis de ambiente
vercel env add VITE_API_URL production

# Forçar novo deploy
vercel --prod --force
```

---

## 📖 Documentação Completa

Consulte [VERCEL_DEPLOY.md](./VERCEL_DEPLOY.md) para instruções detalhadas e troubleshooting.
