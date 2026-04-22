// Normaliza textos para comparacoes que ignoram acentos e diferenca entre maiusculas/minusculas.
function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

// Converte o preco textual da coleta para numero, independente do formato vindo do site.
function parsePrice(value) {
  const normalized = String(value || "")
    .replace(/\s+/g, "")
    .replace(/[^\d,.-]/g, "");

  if (!normalized) {
    return null;
  }

  const hasComma = normalized.includes(",");
  const hasDot = normalized.includes(".");

  if (hasComma && hasDot) {
    const commaLastIndex = normalized.lastIndexOf(",");
    const dotLastIndex = normalized.lastIndexOf(".");

    if (commaLastIndex > dotLastIndex) {
      return Number.parseFloat(normalized.replace(/\./g, "").replace(",", "."));
    }

    return Number.parseFloat(normalized.replace(/,/g, ""));
  }

  if (hasComma) {
    return Number.parseFloat(normalized.replace(/\./g, "").replace(",", "."));
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

module.exports = {
  normalizeText,
  parsePrice,
};
