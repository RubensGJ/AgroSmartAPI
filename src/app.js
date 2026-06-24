require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const swaggerUi = require("swagger-ui-express");
const YAML = require("yamljs");
const cotacoesRoutes = require("./routes/cotacoesRoutes");
const { notFoundHandler, errorHandler } = require("./middlewares/errorHandler");
const { requestLogger } = require("./middlewares/requestLogger");
const { authenticateToken, validateAuthConfig } = require("./middlewares/authToken");
const { initDatabase } = require("./database/db");
const { bootstrapCotacoesCache } = require("./services/cotacaoService");
const { getDeepHealth } = require("./services/healthService");
const { startCotacaoScheduler } = require("./jobs/cotacaoScheduler");
const { criarLogger } = require("./logs/logger");
const { assertChromeAvailable, formatChromeDiagnostics } = require("./utils/puppeteer");

const app = express();
const OPENAPI_FILE = path.resolve(__dirname, "..", "openapi.yaml");
const openApiDocument = YAML.load(OPENAPI_FILE);
const logger = criarLogger("API");

// Habilita middlewares globais usados por toda a aplicacao.
app.use(cors());
app.use(express.json());
app.use(requestLogger);

// Rota simples para monitoramento e health check.
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    servico: "AgroSmart API",
    timestamp: new Date().toISOString(),
  });
});

// Diagnostico operacional completo, sem executar scraping ou expor segredos.
app.get("/health/deep", async (req, res, next) => {
  try {
    const health = await getDeepHealth();
    res.status(health.status === "fail" ? 503 : 200).json(health);
  } catch (error) {
    next(error);
  }
});

// Rota inicial para indicar rapidamente se a API esta online.
app.get("/", (req, res) => {
  res.status(200).json({
    status: "ok",
    mensagem: "AgroSmart API online",
    health: "/health",
    docs: "/docs",
  });
});

// Entrega o arquivo OpenAPI bruto para quem quiser baixar ou integrar.
app.get("/openapi.yaml", (req, res) => {
  res.sendFile(OPENAPI_FILE);
});

// Publica a documentacao Swagger da API.
app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));

// Registra as rotas protegidas de cotacoes.
app.use("/api/cotacoes", authenticateToken, cotacoesRoutes);

// Trata rotas inexistentes e erros da API.
app.use(notFoundHandler);
app.use(errorHandler);

// Inicializa os recursos obrigatorios antes de a API aceitar requisicoes.
async function bootstrap() {
  logger.info("Iniciando aplicacao.");
  validateAuthConfig();
  const chromeDiagnostics = assertChromeAvailable();
  logger.info(`Chrome do Puppeteer validado. ${formatChromeDiagnostics(chromeDiagnostics)}`);
  await initDatabase();
  await bootstrapCotacoesCache();
  logger.sucesso("Aplicacao pronta para receber requisicoes.");
}

// Sobe o servidor HTTP e inicia o scheduler de coletas automaticas.
async function startServer() {
  await bootstrap();

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    logger.sucesso(`Servidor rodando na porta ${PORT}.`);
  });

  startCotacaoScheduler();
}

// Encerra o processo se a aplicacao falhar ainda na subida.
startServer().catch((error) => {
  logger.erro("Falha ao iniciar aplicacao.", error);
  process.exit(1);
});
