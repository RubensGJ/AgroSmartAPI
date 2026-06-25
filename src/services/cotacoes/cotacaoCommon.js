const AppError = require("../../errors/AppError");

const SOURCE_LABELS = {
  coamo: "Coamo",
  cvale: "C.Vale",
  lar: "LAR",
  granos: "Granos",
};

// Garante que a fonte recebida existe e devolve seu nome amigavel.
function ensureSource(source) {
  if (!SOURCE_LABELS[source]) {
    throw new AppError("Fonte invalida. Use: coamo, cvale, lar, granos ou all.", 400);
  }

  return SOURCE_LABELS[source];
}

// Padroniza o nome da fonte recebido nas rotas da API.
function normalizeRequestedSource(source = "all") {
  const normalizedSource = String(source || "all").toLowerCase().trim();

  if (normalizedSource === "all") {
    return normalizedSource;
  }

  ensureSource(normalizedSource);
  return normalizedSource;
}

// Remove filtros vazios antes de repassar para os services e utilitarios.
function cleanFilters(filters = {}) {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== null && value !== "")
  );
}

module.exports = {
  SOURCE_LABELS,
  cleanFilters,
  ensureSource,
  normalizeRequestedSource,
};
