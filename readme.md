# AgroSmart API

API Node.js para coleta e consulta de cotacoes de graos das cooperativas Coamo e LAR.

DONT FORGET: npm install && npm run check:chrome  / Limpar Build Cache

## Funcionalidades

- Coleta via scraping com Puppeteer.
- Endpoints REST para consulta por fonte e consolidado.
- Documentacao OpenAPI com Swagger UI.
- Agendamento automatico (12:00 e 15:00, horario de Brasilia).
- Retry automatico quando scraping falha ou retorna vazio.
- Cache em memoria para respostas rapidas.
- Persistencia em Neon/Postgres com historico e ultimo snapshot.

## Stack

- Node.js + Express
- Puppeteer
- node-cron
- Postgres (Neon) via `pg`

## Requisitos

- Node.js 18 ou superior
- npm
- URL de conexao do Neon/Postgres

## Instalacao

```bash
git clone <URL_DO_REPOSITORIO>
cd AgroSmartAPI
npm install
copy .env.example .env
```

## Variaveis de ambiente

Use o arquivo `.env.example` como base:

```env
PORT=3000
APP_TIMEZONE=America/Sao_Paulo
AUTH_ENABLED=true
API_TOKEN=troque-este-token-por-um-valor-seguro
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require
DATABASE_SSL=true
PUPPETEER_HEADLESS=true
SCHEDULER_ENABLED=true
SCHEDULER_TIMEZONE=America/Sao_Paulo
SCHEDULER_CRON_1=0 12 * * *
SCHEDULER_CRON_2=0 15 * * *
SCRAPER_PARALLEL_COLLECTION=false
SCRAPER_NAV_TIMEOUT_MS=90000
SCRAPER_SELECTOR_TIMEOUT_MS=45000
SCRAPER_RETRY_MAX_ATTEMPTS=3
SCRAPER_RETRY_DELAY_MS=180000
```

## Execucao

Desenvolvimento:

```bash
npm run dev
```

Producao:

```bash
npm start
```

## Endpoints

Base: `http://localhost:3000`

- `GET /`
- `GET /health`
- `GET /docs` (Swagger UI)
- `GET /openapi.yaml` (spec OpenAPI)
- `GET /api/cotacoes/coamo`
- `GET /api/cotacoes/lar`
- `GET /api/cotacoes/todos`
- `GET /api/cotacoes/historico?fonte=all|coamo|lar&limit=50`

Parametro opcional:

- `force=true` em `coamo`, `lar` e `todos` para ignorar cache e forcar nova coleta.

## Autenticacao por token

- Todas as rotas em `/api/cotacoes/*` exigem token quando `AUTH_ENABLED=true`.
- A rota `/health` permanece publica.
- Envie o token em um dos formatos:
  - `Authorization: Bearer <API_TOKEN>`
  - `x-api-token: <API_TOKEN>`

Exemplo:

```bash
curl -H "Authorization: Bearer SEU_TOKEN" http://localhost:3000/api/cotacoes/todos
```

## Documentacao da API

- Swagger UI: `http://localhost:3000/docs`
- Arquivo OpenAPI: `openapi.yaml` (raiz do projeto)

## Como funciona o salvamento

1. Coleta bem-sucedida (manual ou agendada):
   - insere no historico (`cotacoes_historico`)
   - atualiza o ultimo snapshot por fonte (`cotacoes_ultima`)
   - `coletado_em` e salvo com timezone de Brasilia por padrao (`America/Sao_Paulo`)
2. Coleta com erro ou payload vazio:
   - nao salva
   - mantem o ultimo snapshot valido no banco e no cache

## Estrutura principal

- `src/app.js`: bootstrap da API, banco e scheduler
- `src/routes/cotacoesRoutes.js`: rotas HTTP
- `src/services/cotacaoService.js`: regra de negocio, cache, retry e orquestracao
- `src/jobs/cotacaoScheduler.js`: agendamento das coletas
- `src/scrapers/`: scrapers Coamo e LAR
- `src/database/`: conexao e repositorio Postgres

## Observacoes de deploy

- O scheduler (`node-cron`) roda dentro do processo da API.
- Se o deploy tiver scale-to-zero/sleep, os jobs podem nao disparar enquanto o processo estiver parado.
- Em infraestrutura pequena (ex.: plano free), prefira `SCRAPER_PARALLEL_COLLECTION=false`.
- Se houver timeout de navegacao, aumente `SCRAPER_NAV_TIMEOUT_MS`.

## Licenca

ISC
