const { criarLogger } = require("../logs/logger");
const { saveRequestLog } = require("../database/requestLogsRepository");

const logger = criarLogger("HTTP");

function requestLogger(req, res, next) {
  const startedAt = Date.now();

  res.on("finish", () => {
    if (req.path === "/health") {
      return;
    }

    const durationMs = Date.now() - startedAt;
    logger.info(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${durationMs}ms)`);

    Promise.resolve(
      saveRequestLog({
        metodo: req.method,
        rota: req.originalUrl,
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
