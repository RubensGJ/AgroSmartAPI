const AppError = require("../../errors/AppError");
const {
  buildComparison,
  filterQuotes,
  findHighestPriceQuote,
  quotesToCsv,
  sanitizeQuote,
  sanitizeQuotes,
} = require("../../utils/cotacoes");
const { cleanFilters, normalizeRequestedSource } = require("./cotacaoCommon");
const { getCurrentQuotes } = require("./currentCotacaoService");

// Aplica filtros nas cotacoes atuais e monta a resposta da rota /filtro.
async function getFilteredQuotes({ source = "all", force = false, filters = {} } = {}) {
  const normalizedSource = normalizeRequestedSource(source);
  const appliedFilters = cleanFilters(filters);
  const quotes = await getCurrentQuotes(normalizedSource, force);
  const filteredQuotes = filterQuotes(quotes, appliedFilters);

  return {
    fonte: normalizedSource,
    total: filteredQuotes.length,
    filtros: appliedFilters,
    itens: sanitizeQuotes(filteredQuotes),
  };
}

// Busca a maior cotacao dentro do conjunto filtrado para a rota /melhor-preco.
async function getBestPrice({ source = "all", force = false, filters = {} } = {}) {
  const normalizedSource = normalizeRequestedSource(source);
  const appliedFilters = cleanFilters(filters);

  if (!appliedFilters.grao) {
    throw new AppError("Informe o parametro grao para consultar o melhor preco.", 400);
  }

  const quotes = await getCurrentQuotes(normalizedSource, force);
  const filteredQuotes = filterQuotes(quotes, appliedFilters);
  const bestQuote = findHighestPriceQuote(filteredQuotes);

  if (!bestQuote) {
    throw new AppError("Nenhuma cotacao encontrada para o filtro informado.", 404);
  }

  return {
    fonte: normalizedSource,
    criterio: "maior_preco",
    totalConsiderado: filteredQuotes.length,
    filtros: appliedFilters,
    item: {
      ...sanitizeQuote(bestQuote),
      precoNumerico: bestQuote.precoNumerico,
    },
  };
}

// Compara a melhor cotacao entre Coamo, C.Vale e LAR para o grao informado.
async function getComparisonBySource({ force = false, filters = {} } = {}) {
  const appliedFilters = cleanFilters(filters);

  if (!appliedFilters.grao) {
    throw new AppError("Informe o parametro grao para consultar o comparativo.", 400);
  }

  const [coamoQuotes, cvaleQuotes, larQuotes] = await Promise.all([
    getCurrentQuotes("coamo", force),
    getCurrentQuotes("cvale", force),
    getCurrentQuotes("lar", force),
  ]);
  const bestCoamo = findHighestPriceQuote(filterQuotes(coamoQuotes, appliedFilters));
  const bestCvale = findHighestPriceQuote(filterQuotes(cvaleQuotes, appliedFilters));
  const bestLar = findHighestPriceQuote(filterQuotes(larQuotes, appliedFilters));

  if (!bestCoamo && !bestCvale && !bestLar) {
    throw new AppError("Nenhuma cotacao encontrada para o comparativo informado.", 404);
  }

  const comparison = buildComparison(bestCoamo, bestLar, appliedFilters);

  // Adiciona C.Vale ao comparativo se houver cotacao disponivel.
  if (bestCvale) {
    comparison.cvale = {
      ...bestCvale,
      precoNumerico: bestCvale.precoNumerico,
    };
  } else {
    comparison.cvale = null;
  }

  return comparison;
}

// Gera o CSV usado pela rota /exportar a partir das cotacoes filtradas.
async function exportQuotes({ source = "all", force = false, filters = {} } = {}) {
  const normalizedSource = normalizeRequestedSource(source);
  const appliedFilters = cleanFilters(filters);
  const quotes = await getCurrentQuotes(normalizedSource, force);
  const filteredQuotes = filterQuotes(quotes, appliedFilters);

  if (filteredQuotes.length === 0) {
    throw new AppError("Nenhuma cotacao encontrada para exportacao.", 404);
  }

  return quotesToCsv(filteredQuotes);
}

module.exports = {
  exportQuotes,
  getBestPrice,
  getComparisonBySource,
  getFilteredQuotes,
};
