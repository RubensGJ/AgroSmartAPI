# Repository Guidelines

## Idioma e colaboracao

- Responda sempre em portugues para este repositorio.
- Antes de mudancas relevantes em codigo, fluxo, contrato de API ou documentacao principal, apresente um plano curto.
- Tome decisoes pequenas e seguras sozinho, mas explique o que foi alterado.
- Nunca faca commit sem pedido explicito do usuario.
- Sempre que uma mudanca alterar comportamento, fluxo, organizacao ou implementacao relevante, atualize este `AGENTS.md` e a documentacao afetada.

## Visao do projeto

Esta e uma API Node.js/Express para scraping, persistencia e consulta de cotacoes de graos. As fontes atuais sao `coamo`, `cvale` e `lar`.

O codigo principal fica em `src/`.

- `src/app.js`: bootstrap da API, middlewares, Swagger, health checks e rotas.
- `src/routes/`: definicoes HTTP.
- `src/services/`: regras de cotacao atual, historico, analises e health profundo.
- `src/scrapers/`: scrapers Puppeteer da Coamo, C.Vale, LAR e fontes experimentais.
- `src/database/`: conexao PostgreSQL/Neon, schema inicial e repositorios.
- `src/utils/`: normalizacao, filtros, datas, CSV, relatorios e Puppeteer.
- `src/middlewares/`, `src/errors/`, `src/logs/`, `src/jobs/`: request handling, erros, logging e scheduler.
- `scripts/`: scripts operacionais de instalacao e verificacao do Chrome.
- `docs/`: documentacao tecnica e relatorios.
- `openapi.yaml`: contrato publico da API.
- `readme.md`: guia principal de instalacao, uso e operacao.

## Decisoes de comportamento

- `GET /api/cotacoes/todos` deve tolerar falha parcial de fonte. Retorne o contrato parcial versionado com `version`, `partial`, `coamo`, `cvale` e `larAgro`; cada envelope deve conter `ok`, `data`, `stale` e `error`.
- `stale=true` significa que a resposta usa o ultimo dado valido conhecido porque a coleta atual falhou.
- `GET /health` deve permanecer simples e rapido para uptime checks.
- `GET /health/deep` e o health operacional completo. Ele verifica Neon/Postgres, snapshots recentes de `coamo`, `cvale` e `lar`, frescor de 24h, Chrome do Puppeteer e scheduler. Deve retornar `ok`, `degraded` ou `fail`, sem executar scraping e sem expor segredos.
- Consultas sem `force=true` devem priorizar cache em memoria, depois `cotacoes_ultima`, e so entao scraping.
- Consultas com `force=true` podem iniciar navegador, gerar trafego externo e escrever no banco. Trate isso como operacao sensivel.
- Coletas bem-sucedidas salvam em `cotacoes_historico`, atualizam `cotacoes_ultima` e atualizam cache.
- Coletas com erro, payload invalido ou payload vazio nao devem salvar novo snapshot.
- Fontes validas em parametros: `all`, `coamo`, `cvale`, `lar`.
- O comparativo inclui C.Vale quando houver dado, mas a diferenca principal ainda e calculada pelo helper historico de Coamo x LAR. Se isso mudar, atualize README e OpenAPI.
- A C.Vale pode retornar indisponibilidade fora da janela aceita pelo site de origem.

## Comandos de build e desenvolvimento

- `npm install`: instala dependencias e executa `postinstall` para instalar Chrome do Puppeteer.
- `npm start`: inicia a API com `node src/app.js`.
- `npm run dev`: inicia a API com Node watch mode.
- `npm run check:chrome`: valida se o Chrome usado pelo Puppeteer esta disponivel.
- `npm test`: atualmente falha de proposito com `no test specified`; nao trate como suite valida.
- `npm audit`: verifica vulnerabilidades de dependencias.

Use Node.js `>=18`.

## Estilo de codigo

Use CommonJS (`require`, `module.exports`) e mantenha arquivos focados por responsabilidade. Prefira services/helpers pequenos em vez de route handlers grandes.

Padroes atuais:

- indentacao de 2 espacos;
- ponto e virgula;
- `camelCase` para variaveis e funcoes;
- `PascalCase` para classes como `AppError`;
- nomes de fonte em minusculo: `coamo`, `cvale`, `lar`;
- comentarios curtos, apenas quando ajudam a entender regra ou fluxo.

Evite codigo morto, scripts inutilizados e refactors grandes sem necessidade.

## Testes

Ainda nao ha framework de testes configurado.

Quando testes forem adicionados, mantenha em `tests/` ou `testes/`. Priorize:

- parsing de preco e normalizacao textual;
- filtros e comparacao de melhor preco;
- persistencia dos repositorios;
- tratamento de erro e retry dos scrapers;
- contrato parcial de `/api/cotacoes/todos`;
- health profundo sem scraping.

Sugestoes de nomes: `normalization.test.js`, `currentCotacaoService.test.js`, `healthService.test.js`.

## Documentacao

Atualize `readme.md` e `openapi.yaml` quando mudar:

- rota, parametro ou contrato de resposta;
- variavel de ambiente;
- fonte de dados;
- comportamento de cache, retry, scheduler ou persistencia;
- regra de autenticacao;
- health checks.

Docs auxiliares e relatorios ficam em `docs/`. Nao gere relatorios grandes sem necessidade ou pedido.

## MCPs disponiveis

Neon e Render MCPs podem ser usados quando houver necessidade de contexto de banco, hospedagem, deploy ou variaveis de ambiente. Nao use MCP para tarefas que podem ser resolvidas com leitura local do codigo.

## Pull requests e commits

Historico recente usa commits curtos em estilo convencional:

- `feat: adiciona scraper da C.Vale...`
- `docs: levantamento tecnico Codex`
- `feat: refatora middleware...`

So commite quando o usuario pedir. Se pedir commit, prefira commits pequenos e informativos.

PRs devem incluir:

- o que mudou;
- por que mudou;
- endpoints ou variaveis afetadas;
- passos de verificacao;
- exemplos de resposta quando contrato de API mudar.

## Seguranca e configuracao

Nunca commite `.env` ou credenciais. Use `.env.example` para documentar variaveis.

Valores sensiveis incluem:

- `DATABASE_URL`;
- `API_TOKEN`;
- tokens de plataforma;
- flags de scheduler;
- configuracoes de Puppeteer quando revelarem caminho ou ambiente interno.

Tenha cuidado com `force=true`: ele pode disparar scraping real, abrir navegador, acessar sites externos e gravar no banco.
