const crypto = require("crypto");
const AppError = require("../errors/AppError");

function parseBoolean(value, defaultValue = true) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  const normalized = String(value).toLowerCase().trim();
  return ["1", "true", "yes", "y", "on"].includes(normalized);
}

function isAuthEnabled() {
  return parseBoolean(process.env.AUTH_ENABLED, true);
}

function getConfiguredToken() {
  return (process.env.API_TOKEN || "").trim();
}

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

function safeTokenCompare(incomingToken, configuredToken) {
  const incomingBuffer = Buffer.from(incomingToken);
  const configuredBuffer = Buffer.from(configuredToken);

  if (incomingBuffer.length !== configuredBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(incomingBuffer, configuredBuffer);
}

function validateAuthConfig() {
  if (!isAuthEnabled()) {
    return;
  }

  if (!getConfiguredToken()) {
    throw new Error("AUTH_ENABLED=true, mas API_TOKEN nao foi configurado.");
  }
}

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
    return next(
      new AppError("Token obrigatorio. Use Authorization: Bearer <token> ou x-api-token.", 401)
    );
  }

  if (!safeTokenCompare(incomingToken, configuredToken)) {
    return next(new AppError("Token invalido.", 401));
  }

  return next();
}

module.exports = {
  authenticateToken,
  validateAuthConfig,
};
