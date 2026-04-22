const { normalizeText, parsePrice } = require("./normalization");

// Adiciona metadados calculados em cada cotacao para facilitar filtros e comparacoes.
function enrichQuotes(source, quotes) {
  return quotes.map((quote) => ({
    fonte: source,
    ...quote,
    precoNumerico: parsePrice(quote.preco),
  }));
}

// Compara um campo textual da cotacao com o filtro informado pelo usuario.
function matchesFilter(value, expected) {
  if (!expected) {
    return true;
  }

  return normalizeText(value).includes(normalizeText(expected));
}

// Filtra as cotacoes atuais ou historicas com base nos parametros de texto recebidos na API.
function filterQuotes(quotes, filters = {}) {
  const { grao, local, descricao, fornecedor, unidade } = filters;

  return quotes.filter(
    (quote) =>
      matchesFilter(quote.grao, grao) &&
      matchesFilter(quote.local, local) &&
      matchesFilter(quote.descricao, descricao) &&
      matchesFilter(quote.fornecedor, fornecedor) &&
      matchesFilter(quote.unidade, unidade)
  );
}

// Remove campos internos usados apenas nos calculos antes de devolver a resposta para o cliente.
function sanitizeQuote(quote) {
  const { precoNumerico, ...cleanQuote } = quote;
  return cleanQuote;
}

// Aplica a limpeza de campos internos em uma lista inteira de cotacoes.
function sanitizeQuotes(quotes) {
  return quotes.map(sanitizeQuote);
}

// Encontra a cotacao com maior preco numerico dentro do conjunto filtrado.
function findHighestPriceQuote(quotes) {
  const comparableQuotes = quotes.filter((quote) => Number.isFinite(quote.precoNumerico));

  if (comparableQuotes.length === 0) {
    return null;
  }

  return comparableQuotes.reduce((bestQuote, currentQuote) =>
    currentQuote.precoNumerico > bestQuote.precoNumerico ? currentQuote : bestQuote
  );
}

module.exports = {
  enrichQuotes,
  filterQuotes,
  findHighestPriceQuote,
  matchesFilter,
  sanitizeQuote,
  sanitizeQuotes,
};
