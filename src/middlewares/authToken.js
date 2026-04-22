const crypto = require("crypto");
const AppError = require("../errors/AppError");
const { criarLogger } = require("../logs/logger");

const logger = criarLogger("AUTH");

// Converte valores do .env para booleano no fluxo de autenticacao.
function parseBoolean(value, defaultValue = true) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  const normalized = String(value).toLowerCase().trim();
  return ["1", "true", "yes", "y", "on"].includes(normalized);
}

// Informa se a validacao de token esta habilitada.
function isAuthEnabled() {
  return parseBoolean(process.env.AUTH_ENABLED, true);
}

// Le o token oficial configurado no servidor.
function getConfiguredToken() {
  return (process.env.API_TOKEN || "").trim();
}

// Tenta encontrar o token enviado pelo cliente nos headers suportados.
function extractToken(req) {
  const authorization = req.headers.authorization || "";
  if (authorization.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length).trim();
  }

  const headerToken = req.headers["x-api-token"];
  if (typeof headerToken === "string") {
    return headerToken.trim();
  }

  return "";
}

// Compara os tokens de forma segura para evitar vazamento por tempo de resposta.
function safeTokenCompare(incomingToken, configuredToken) {
  const incomingBuffer = Buffer.from(incomingToken);
  const configuredBuffer = Buffer.from(configuredToken);

  if (incomingBuffer.length !== configuredBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(incomingBuffer, configuredBuffer);
}

// Valida a configuracao de autenticacao ainda na subida da aplicacao.
function validateAuthConfig() {
  if (!isAuthEnabled()) {
    logger.aviso("Autenticacao desabilitada por configuracao.");
    return;
  }

  if (!getConfiguredToken()) {
    throw new Error("AUTH_ENABLED=true, mas API_TOKEN nao foi configurado.");
  }
}

// Middleware que protege as rotas exigindo um token valido.
function authenticateToken(req, res, next) {
  if (!isAuthEnabled()) {
    return next();
  }

  const configuredToken = getConfiguredToken();
  if (!configuredToken) {
    return next(new AppError("Token da API nao configurado no servidor.", 500));
  }

  const incomingToken = extractToken(req);
  if (!incomingToken) {
    logger.aviso(`Requisicao sem token em ${req.method} ${req.originalUrl}.`);
    return next(
      new AppError("Token obrigatorio. Use Authorization: Bearer <token> ou x-api-token.", 401)
    );
  }

  if (!safeTokenCompare(incomingToken, configuredToken)) {
    logger.aviso(`Token invalido em ${req.method} ${req.originalUrl}.`);
    return next(new AppError("Token invalido.", 401));
  }

  return next();
}

module.exports = {
  authenticateToken,
  validateAuthConfig,
};
