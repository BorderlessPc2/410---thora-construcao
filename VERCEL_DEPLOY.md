# 🚀 Guia de Deploy - Vercel

Este guia explica como fazer o deploy da aplicação Thora Construção no Vercel.

## 📋 Arquitetura de Deploy

A aplicação será deployada em duas partes:

1. **Frontend (React/Vite)** → Vercel
2. **Backend (FastAPI/Python)** → Railway, Render ou Fly.io

> ⚠️ **Nota:** O Vercel é otimizado para frontends e serverless functions. Para o backend FastAPI com processamento de PDFs, recomendamos um serviço dedicado.

---

## 🎯 Opção 1: Deploy Frontend no Vercel (Recomendado)

### Passo 1: Preparar o Backend

Primeiro, faça o deploy do backend em um serviço como:
- **Railway** (https://railway.app) - Recomendado
- **Render** (https://render.com)
- **Fly.io** (https://fly.io)

#### Deploy no Railway:

1. Crie uma conta em https://railway.app
2. Clique em "New Project" → "Deploy from GitHub repo"
3. Conecte seu repositório
4. Configure as variáveis de ambiente:
   ```
   FIREBASE_DISABLED=1
   GEMINI_API_KEY=sua-chave-aqui
   PORT=8001
   ```
5. Railway irá detectar o Python e instalar as dependências
6. Anote a URL do backend (ex: `https://seu-app.railway.app`)

### Passo 2: Deploy Frontend no Vercel

1. **Instale o Vercel CLI** (opcional):
   ```bash
   npm install -g vercel
   ```

2. **Via GitHub (Recomendado):**
   - Acesse https://vercel.com
   - Clique em "Import Project"
   - Conecte seu repositório GitHub
   - Selecione o repositório do projeto
   - Configure as seguintes opções:
     - **Framework Preset:** Vite
     - **Root Directory:** `frontend`
     - **Build Command:** `npm run build`
     - **Output Directory:** `dist`

3. **Configure as Variáveis de Ambiente:**
   - No painel do Vercel, vá em "Settings" → "Environment Variables"
   - Adicione:
     ```
     VITE_API_URL=https://seu-backend.railway.app
     ```

4. **Atualize o vercel.json:**
   - Edite o arquivo `vercel.json` na raiz do projeto
   - Substitua `https://seu-backend-url.railway.app` pela URL real do seu backend

5. **Deploy:**
   - Se usando GitHub: o deploy será automático a cada push
   - Se usando CLI: execute `vercel --prod`

### Passo 3: Configurar CORS no Backend

Atualize o arquivo `backend/config.py` para incluir a URL do Vercel:

```python
FRONTEND_URLS = [
    "http://localhost:5173",
    "http://localhost:8001",
    "https://seu-app.vercel.app",  # Adicione a URL do Vercel aqui
    # ... outras URLs
]
```

---

## 🎯 Opção 2: Deploy Completo no Vercel (Experimental)

⚠️ **Limitações:**
- Serverless functions têm timeout de 10s (Hobby) ou 60s (Pro)
- Limite de tamanho de upload de arquivos
- Processamento pesado de PDFs pode falhar

Se ainda quiser tentar:

### Configurar Backend como Serverless Function

1. Crie o arquivo `api/index.py`:

```python
from fastapi import FastAPI
from mangum import Mangum
import sys
import os

# Adicionar o diretório backend ao path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from backend.main import app

handler = Mangum(app)
```

2. Instale Mangum (adaptador ASGI para AWS Lambda/Vercel):
```bash
pip install mangum
echo "mangum==0.17.0" >> backend/requirements.txt
```

3. Atualize `vercel.json`:
```json
{
  "version": 2,
  "builds": [
    {
      "src": "api/index.py",
      "use": "@vercel/python"
    },
    {
      "src": "frontend/package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "frontend/dist"
      }
    }
  ],
  "routes": [
    { "src": "/api/(.*)", "dest": "api/index.py" },
    { "src": "/(.*)", "dest": "frontend/dist/$1" }
  ]
}
```

---

## ✅ Verificação de Deploy

Após o deploy, teste:

1. **Frontend:** Acesse `https://seu-app.vercel.app`
2. **API:** Teste `https://seu-backend.railway.app/health`
3. **Upload:** Tente fazer upload de um PDF e verificar se funciona

---

## 🔧 Comandos Úteis

```bash
# Deploy no Vercel (via CLI)
vercel --prod

# Ver logs do deploy
vercel logs

# Remover deploy
vercel remove

# Configurar variáveis de ambiente
vercel env add VITE_API_URL
```

---

## 🐛 Troubleshooting

### Erro de CORS
- Verifique se a URL do Vercel está em `FRONTEND_URLS` no backend
- Confirme as configurações de CORS no `backend/config.py`

### API não responde
- Verifique se a variável `VITE_API_URL` está configurada corretamente
- Teste a URL da API diretamente no navegador

### Build falha
- Verifique se todas as dependências estão em `package.json`
- Confirme que o `frontend/dist` está sendo gerado corretamente

### Upload de arquivo falha
- Verifique o tamanho máximo de upload no serviço do backend
- Confirme que o backend está recebendo `multipart/form-data`

---

## 📚 Recursos

- [Vercel Documentation](https://vercel.com/docs)
- [Railway Documentation](https://docs.railway.app)
- [FastAPI Deployment](https://fastapi.tiangolo.com/deployment/)

---

## 🔐 Segurança

⚠️ **Importante:**
- Nunca commite arquivos `.env` ou credenciais
- Use Environment Variables no Vercel e Railway
- Mantenha `GEMINI_API_KEY` e credenciais Firebase seguras
- Configure CORS apenas para domínios específicos em produção

---

## 📞 Suporte

Se encontrar problemas, verifique:
1. Logs do Vercel: https://vercel.com/dashboard
2. Logs do Railway: https://railway.app/dashboard
3. Console do navegador (F12) para erros de frontend
