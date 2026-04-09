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
const { startCotacaoScheduler } = require("./jobs/cotacaoScheduler");
const { criarLogger } = require("./logs/logger");

const app = express();
const OPENAPI_FILE = path.resolve(__dirname, "..", "openapi.yaml");
const openApiDocument = YAML.load(OPENAPI_FILE);
const logger = criarLogger("API");

app.use(cors());
app.use(express.json());
app.use(requestLogger);

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    servico: "AgroSmart API",
    timestamp: new Date().toISOString(),
  });
});

app.get("/", (req, res) => {
  res.status(200).json({
    status: "ok",
    mensagem: "AgroSmart API online",
    health: "/health",
    docs: "/docs",
  });
});

app.get("/openapi.yaml", (req, res) => {
  res.sendFile(OPENAPI_FILE);
});
app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));

app.use("/api/cotacoes", authenticateToken, cotacoesRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

async function bootstrap() {
  logger.info("Iniciando aplicacao.");
  validateAuthConfig();
  await initDatabase();
  await bootstrapCotacoesCache();
  logger.sucesso("Aplicacao pronta para receber requisicoes.");
}

async function startServer() {
  await bootstrap();

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    logger.sucesso(`Servidor rodando na porta ${PORT}.`);
  });

  startCotacaoScheduler();
}

startServer().catch((error) => {
  logger.erro("Falha ao iniciar aplicacao.", error);
  process.exit(1);
});
