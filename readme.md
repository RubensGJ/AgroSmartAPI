# AgroSmart API

API Node.js/Express para coletar, salvar e consultar cotacoes de graos das fontes Coamo, C.Vale e LAR.

A aplicacao usa Puppeteer para scraping, cache em memoria para respostas rapidas e Neon/Postgres para manter historico e ultimo snapshot valido por fonte.

## Funcionalidades

- Coleta de cotacoes via scraping com Puppeteer.
- Consulta atual por fonte: Coamo, C.Vale e LAR.
- Consulta consolidada com contrato parcial por fonte em `/api/cotacoes/todos`.
- Filtros por grao, local, descricao, fornecedor e unidade.
- Melhor preco, comparativo entre fontes, variacao historica e exportacao CSV.
- Persistencia em Neon/Postgres com historico e ultima cotacao por fonte.
- Cache em memoria aquecido a partir do banco na subida da API.
- Scheduler automatico com `node-cron`.
- Health check simples para uptime e health check profundo para operacao.
- Documentacao OpenAPI servida via Swagger UI.

## Stack

- Node.js 18+
- Express
- Puppeteer
- node-cron
- PostgreSQL/Neon via `pg`
- Swagger UI + OpenAPI

## Requisitos

- Node.js `>=18`
- npm
- Banco PostgreSQL/Neon acessivel por `DATABASE_URL`
- Chrome do Puppeteer instalado ou disponivel no ambiente

## Instalacao

```bash
git clone <URL_DO_REPOSITORIO>
cd AgroSmartAPI
npm install
```

Crie o `.env` com base no exemplo:

```powershell
Copy-Item .env.example .env
```

No Linux/macOS:

```bash
cp .env.example .env
```

Depois valide o Chrome usado pelo Puppeteer:

```bash
npm run check:chrome
```

## Variaveis de ambiente

Use `.env.example` como referencia.

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
SCHEDULER_CRON_1=0 11 * * *
SCHEDULER_CRON_2=0 14 * * *
SCRAPER_PARALLEL_COLLECTION=false
SCRAPER_NAV_TIMEOUT_MS=90000
SCRAPER_SELECTOR_TIMEOUT_MS=45000
SCRAPER_RETRY_MAX_ATTEMPTS=3
SCRAPER_RETRY_DELAY_MS=180000
```

Observacoes importantes:

- `AUTH_ENABLED=true` protege as rotas `/api/cotacoes/*`.
- `DATABASE_SSL=true` e recomendado para Neon.
- `SCHEDULER_ENABLED=false` desliga coletas automaticas.
- `SCRAPER_PARALLEL_COLLECTION=false` e mais conservador para ambientes pequenos.
- `force=true` em rotas de consulta dispara scraping ao vivo, trafego externo e escrita no banco.

## Comandos

```bash
npm start
```

Sobe a API em modo producao com `node src/app.js`.

```bash
npm run dev
```

Sobe a API em modo desenvolvimento com `node --watch`.

```bash
npm run check:chrome
```

Verifica se o Chrome do Puppeteer esta disponivel.

```bash
npm test
```

Atualmente falha de proposito com `no test specified`; ainda nao ha suite de testes configurada.

## Rotas publicas

Base local: `http://localhost:3000`

- `GET /`: status simples da API.
- `GET /health`: health check leve para uptime.
- `GET /health/deep`: diagnostico operacional completo.
- `GET /docs`: Swagger UI.
- `GET /openapi.yaml`: contrato OpenAPI bruto.

`/health/deep` verifica banco, snapshots recentes, Chrome do Puppeteer e scheduler. Ele retorna `ok`, `degraded` ou `fail` e nao executa scraping.

## Autenticacao

Quando `AUTH_ENABLED=true`, todas as rotas em `/api/cotacoes/*` exigem token.

Formatos aceitos:

- `Authorization: Bearer <API_TOKEN>`
- `x-api-token: <API_TOKEN>`

Exemplo:

```bash
curl -H "Authorization: Bearer SEU_TOKEN" http://localhost:3000/api/cotacoes/todos
```

## Rotas de cotacoes

Fontes aceitas em parametros: `all`, `coamo`, `cvale`, `lar`.

- `GET /api/cotacoes/coamo`: cotacoes atuais da Coamo.
- `GET /api/cotacoes/cvale`: cotacoes atuais da C.Vale.
- `GET /api/cotacoes/lar`: cotacoes atuais da LAR.
- `GET /api/cotacoes/todos`: resposta consolidada das tres fontes.
- `GET /api/cotacoes/filtro`: cotacoes atuais filtradas.
- `GET /api/cotacoes/melhor-preco`: maior preco encontrado para um grao.
- `GET /api/cotacoes/comparativo`: comparativo entre fontes para um grao.
- `GET /api/cotacoes/variacao`: variacao historica de uma fonte especifica.
- `GET /api/cotacoes/periodo`: itens historicos dentro de um periodo.
- `GET /api/cotacoes/exportar`: exporta cotacoes filtradas em CSV.
- `GET /api/cotacoes/historico`: snapshots historicos salvos.

Parametros comuns:

- `force=true`: ignora cache e tenta uma nova coleta.
- `fonte=all|coamo|cvale|lar`: seleciona a origem quando a rota permite.
- `grao`, `local`, `descricao`, `fornecedor`, `unidade`: filtros textuais.
- `dataInicio=YYYY-MM-DD` e `dataFim=YYYY-MM-DD`: periodo historico.
- `limit=50`: limite de snapshots ou itens, conforme a rota.

Exemplos:

```bash
curl -H "Authorization: Bearer SEU_TOKEN" "http://localhost:3000/api/cotacoes/filtro?fonte=all&grao=soja"
```

```bash
curl -H "Authorization: Bearer SEU_TOKEN" "http://localhost:3000/api/cotacoes/melhor-preco?fonte=all&grao=milho"
```

```bash
curl -H "Authorization: Bearer SEU_TOKEN" "http://localhost:3000/api/cotacoes/periodo?fonte=coamo&dataInicio=2026-06-01&dataFim=2026-06-24"
```

## Contrato parcial de `/api/cotacoes/todos`

A rota consolidada nao deve derrubar a resposta inteira quando uma fonte falha. Ela retorna `version: 2`, `partial` e um envelope por fonte:

```json
{
  "version": 2,
  "partial": true,
  "coamo": {
    "ok": true,
    "data": [],
    "stale": false,
    "error": null
  },
  "cvale": {
    "ok": true,
    "data": [],
    "stale": true,
    "error": {
      "message": "Falha ao coletar cotacoes da C.Vale",
      "statusCode": 502,
      "details": null
    }
  },
  "larAgro": {
    "ok": false,
    "data": [],
    "stale": false,
    "error": {
      "message": "Falha ao coletar cotacoes da LAR",
      "statusCode": 502,
      "details": null
    }
  }
}
```

`stale=true` significa que a API devolveu o ultimo dado valido conhecido porque a coleta atual falhou.

## Fluxo de dados

1. A API sobe, valida configuracoes, valida Chrome, inicializa o banco e aquece o cache com `cotacoes_ultima`.
2. Uma consulta sem `force=true` usa cache em memoria, depois banco, depois scraping se nao houver dado salvo.
3. Uma consulta com `force=true` executa scraping ao vivo.
4. Coleta bem-sucedida:
   - insere um snapshot em `cotacoes_historico`;
   - atualiza o ultimo snapshot em `cotacoes_ultima`;
   - atualiza o cache em memoria.
5. Coleta com erro ou payload vazio nao salva dado novo.

Tabelas criadas automaticamente na subida:

- `cotacoes_historico`
- `cotacoes_ultima`
- `logs_requisicoes`

## Estrutura principal

- `src/app.js`: bootstrap da API, middlewares, Swagger, health e rotas.
- `src/routes/cotacoesRoutes.js`: definicao das rotas HTTP de cotacoes.
- `src/services/cotacaoService.js`: ponto unico de exportacao dos services.
- `src/services/cotacoes/currentCotacaoService.js`: cache, scraping, retry e snapshots atuais.
- `src/services/cotacoes/analysisCotacaoService.js`: filtros, melhor preco, comparativo e CSV.
- `src/services/cotacoes/historyCotacaoService.js`: historico, periodo e variacao.
- `src/services/healthService.js`: diagnostico operacional profundo.
- `src/scrapers/`: scrapers Puppeteer de Coamo, C.Vale, LAR e fontes experimentais.
- `src/database/`: conexao, schema e repositorios Postgres.
- `src/utils/`: normalizacao, filtros, datas, CSV e utilitarios do Puppeteer.
- `src/jobs/cotacaoScheduler.js`: jobs automaticos de coleta.
- `scripts/`: instalacao e verificacao do Chrome do Puppeteer.
- `openapi.yaml`: contrato publico da API.
- `docs/`: documentacao tecnica e relatorios.

## Operacao e deploy

- O scheduler roda dentro do mesmo processo da API.
- Em plataformas com sleep/scale-to-zero, os jobs nao executam enquanto o processo estiver parado.
- Em ambiente limitado, mantenha `SCRAPER_PARALLEL_COLLECTION=false`.
- Se houver timeout de scraping, ajuste `SCRAPER_NAV_TIMEOUT_MS` e `SCRAPER_SELECTOR_TIMEOUT_MS`.
- A C.Vale pode ficar indisponivel fora dos horarios aceitos pelo site de origem.
- Nao exponha `.env`, `DATABASE_URL`, `API_TOKEN` ou tokens de plataforma.

## Documentacao da API

- Swagger UI: `http://localhost:3000/docs`
- OpenAPI bruto: `http://localhost:3000/openapi.yaml`
- Arquivo fonte: `openapi.yaml`

Quando uma rota, parametro, contrato de resposta ou variavel de ambiente mudar, atualize este README e o `openapi.yaml`.

## Licenca

ISC
