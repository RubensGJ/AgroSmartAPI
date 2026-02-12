const AppError = require("../errors/AppError");

function notFoundHandler(req, res, next) {
  next(new AppError("Rota não encontrada", 404));
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
    console.error("[API] Erro interno:", err);
  } else {
    console.warn("[API] Erro de requisição:", err.message);
  }

  res.status(statusCode).json(response);
}

module.exports = { notFoundHandler, errorHandler };
