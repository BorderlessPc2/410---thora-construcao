# Deploy Firebase-first + Cloud Run (Thora)

## Arquitetura

- **Frontend:** Netlify
- **Auth / Firestore / Storage:** Firebase projeto `borderless-5a4c8`
- **API (PDF + IA):** Cloud Run (`thora-api`) — FastAPI Python

O Render Free **não** é mais o alvo de produção.

## Pré-requisitos

1. Plano **Blaze** no Firebase (`borderless-5a4c8`)
2. `gcloud` CLI autenticado na mesma conta Google do projeto
3. Secrets no Secret Manager (recomendado):
   - `OPENAI_API_KEY`
   - `FIREBASE_CREDENTIALS` (JSON da service account, se não usar ADC)

```bash
# Exemplo — criar secrets
printf '%s' "$OPENAI_API_KEY" | gcloud secrets create OPENAI_API_KEY --data-file=- --project=borderless-5a4c8
printf '%s' "$FIREBASE_CREDENTIALS" | gcloud secrets create FIREBASE_CREDENTIALS --data-file=- --project=borderless-5a4c8

# Dar acesso à service account do Cloud Run (substitua PROJECT_NUMBER)
gcloud secrets add-iam-policy-binding OPENAI_API_KEY \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project=borderless-5a4c8
```

## 1. Rules Firebase

```bash
cd /path/to/410---thora-construcao
npx -y firebase-tools@latest use borderless-5a4c8
npx -y firebase-tools@latest deploy --only firestore:rules,storage
```

## 2. Deploy API (Cloud Run)

```bash
chmod +x scripts/deploy-cloud-run.sh
./scripts/deploy-cloud-run.sh
```

Variáveis úteis:

| Env | Default |
|-----|---------|
| `CLOUD_RUN_MEMORY` | `2Gi` |
| `CLOUD_RUN_MIN_INSTANCES` | `1` (instância sempre aquecida; CPU always allocated no deploy) |
| `CLOUD_RUN_REGION` | `us-central1` |

URL atual: `https://thora-api-333573409559.us-central1.run.app`

## 3. Frontend (Netlify)

1. `netlify.toml` / `frontend/.env.production` já apontam para o Cloud Run acima
2. Confirme no painel Netlify: Site settings → Environment → `VITE_API_URL` (mesma URL)
3. Redeploy do site Netlify (obrigatório para rebuildar o bundle)
4. Firebase Console → Authentication → Settings → Authorized domains → adicione `410-thora-construcaob.netlify.app`

## 4. Smoke test

```bash
curl -s https://thora-api-333573409559.us-central1.run.app/health
# → {"status":"ok","service":"thora-api","version":"2.0.0"}
```

No app: login → upload PDF → detectar tabelas (progresso) → processar → validação.

## 5. Desligar Render

Após validar:

1. Render Dashboard → serviço `410---thora-construcao` → suspender ou desligar auto-deploy
2. Remova `VITE_API_URL` antiga `*.onrender.com`

## Custos

- Blaze pay-as-you-go
- Cloud Run min=0: barato + cold start
- Cloud Run min=1: ~US$ 10–30/mês, sempre quente
- Storage/Firestore: baixo no volume atual
- OpenAI: igual ao de hoje
