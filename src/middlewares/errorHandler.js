const AppError = require("../errors/AppError");
const { criarLogger } = require("../logs/logger");

const logger = criarLogger("API");

function notFoundHandler(req, res, next) {
  next(new AppError("Rota nao encontrada", 404));
}

function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const response = {
    error: err.message || "Erro interno do servidor",
  };

  if (err.details) {
    response.details = err.details;
  }

  if (statusCode >= 500) {
    logger.erro(`Erro interno em ${req.method} ${req.originalUrl}.`, err);
  } else {
    logger.aviso(`Erro de requisicao em ${req.method} ${req.originalUrl}: ${err.message}`);
  }

  res.status(statusCode).json(response);
}

module.exports = { notFoundHandler, errorHandler };
