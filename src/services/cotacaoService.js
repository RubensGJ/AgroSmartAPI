const {
  bootstrapCotacoesCache,
  getAll,
  getCoamo,
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
  getBestPrice,
  getCoamo,
  getComparisonBySource,
  getFilteredQuotes,
  getHistory,
  getHistoryByPeriod,
  getLar,
  getVariation,
  refreshScheduled,
};
