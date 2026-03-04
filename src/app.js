require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cotacoesRoutes = require("./routes/cotacoesRoutes");
const { notFoundHandler, errorHandler } = require("./middlewares/errorHandler");
const { authenticateToken, validateAuthConfig } = require("./middlewares/authToken");
const { initDatabase } = require("./database/db");
const { bootstrapCotacoesCache } = require("./services/cotacaoService");
const { startCotacaoScheduler } = require("./jobs/cotacaoScheduler");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    servico: "AgroSmart API",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/cotacoes", authenticateToken, cotacoesRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

async function bootstrap() {
  validateAuthConfig();
  await initDatabase();
  await bootstrapCotacoesCache();
}

async function startServer() {
  await bootstrap();

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
  });

  startCotacaoScheduler();
}

startServer().catch((error) => {
  console.error("[BOOT] Falha ao iniciar aplicacao:", error);
  process.exit(1);
});
