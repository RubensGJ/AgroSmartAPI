const {
  bootstrapCotacoesCache,
  getAll,
  getAllPartial,
  getCoamo,
  getCvale,
  getLar,
  refreshScheduled,
} = require("./cotacoes/currentCotacaoService");
const {
  exportQuotes,
  getBestPrice,
  getComparisonBySource,
  getFilteredQuotes,
} = require("./cotacoes/analysisCotacaoService");
const { getHistory, getHistoryByPeriod, getVariation } = require("./cotacoes/historyCotacaoService");

// Reexporta os services de cotacoes em um ponto unico para simplificar os imports.
module.exports = {
  bootstrapCotacoesCache,
  exportQuotes,
  getAll,
  getAllPartial,
  getBestPrice,
  getCoamo,
  getComparisonBySource,
  getCvale,
  getFilteredQuotes,
  getHistory,
  getHistoryByPeriod,
  getLar,
  getVariation,
  refreshScheduled,
};
