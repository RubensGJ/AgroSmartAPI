const { criarLogger } = require("../logs/logger");
const { saveRequestLog } = require("../database/requestLogsRepository");

const logger = criarLogger("HTTP");

// Remove a query string para salvar apenas a rota principal da chamada.
function getRoute(req) {
  return (req.originalUrl || req.url || "").split("?")[0];
}

// Ignora rotas tecnicas que so gerariam ruido no historico de logs.
function shouldIgnoreRequest(route) {
  return route === "/health" || route === "/favicon.ico" || route.startsWith("/docs");
}

// Middleware que registra cada requisicao concluida e persiste um resumo no banco.
function requestLogger(req, res, next) {
  const startedAt = Date.now();

  res.on("finish", () => {
    const route = getRoute(req);

    if (shouldIgnoreRequest(route)) {
      return;
    }

    const durationMs = Date.now() - startedAt;
    logger.info(`${req.method} ${route} -> ${res.statusCode} (${durationMs}ms)`);

    Promise.resolve(
      saveRequestLog({
        metodo: req.method,
        rota: route,
        statusCode: res.statusCode,
        duracaoMs: durationMs,
      })
    ).catch((error) => {
      logger.erro("Falha ao salvar log de requisicao no banco.", error);
    });
  });

  next();
}

module.exports = { requestLogger };
