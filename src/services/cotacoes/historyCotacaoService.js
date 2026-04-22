const AppError = require("../../errors/AppError");
const { listSnapshots, listSnapshotsByPeriod } = require("../../database/cotacoesRepository");
const { buildPeriodItems, buildVariationFromSnapshots } = require("../../utils/cotacoes");
const { cleanFilters, normalizeRequestedSource } = require("./cotacaoCommon");

// Converte datas enviadas na query string para ISO e valida o formato.
function parseDateFilter(value, { endOfDay = false } = {}) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const rawValue = String(value).trim();
  const dateValue = /^\d{4}-\d{2}-\d{2}$/.test(rawValue)
    ? `${rawValue}${endOfDay ? "T23:59:59.999Z" : "T00:00:00.000Z"}`
    : rawValue;
  const parsedDate = new Date(dateValue);

  if (Number.isNaN(parsedDate.getTime())) {
    throw new AppError(`Data invalida: ${rawValue}. Use YYYY-MM-DD ou ISO 8601.`, 400);
  }

  return parsedDate.toISOString();
}

// Monta o intervalo de datas usado nas consultas historicas.
function parsePeriod({ dataInicio = null, dataFim = null } = {}) {
  const startDate = parseDateFilter(dataInicio);
  const endDate = parseDateFilter(dataFim, { endOfDay: true });

  if (startDate && endDate && startDate > endDate) {
    throw new AppError("dataInicio nao pode ser maior que dataFim.", 400);
  }

  return { startDate, endDate };
}

// Lista snapshots historicos ja persistidos no banco.
async function getHistory(source = "all", limit = 50) {
  const normalizedSource = normalizeRequestedSource(source);
  return listSnapshots({ source: normalizedSource === "all" ? null : normalizedSource, limit });
}

// Calcula a variacao de preco de uma fonte dentro do periodo informado.
async function getVariation({
  source,
  filters = {},
  dataInicio = null,
  dataFim = null,
  limit = 500,
} = {}) {
  const normalizedSource = normalizeRequestedSource(source);
  const appliedFilters = cleanFilters(filters);
  const { startDate, endDate } = parsePeriod({ dataInicio, dataFim });

  if (normalizedSource === "all") {
    throw new AppError("Informe uma fonte especifica para consultar a variacao.", 400);
  }

  if (!appliedFilters.grao) {
    throw new AppError("Informe o parametro grao para consultar a variacao.", 400);
  }

  const snapshots = await listSnapshotsByPeriod({
    source: normalizedSource,
    startDate,
    endDate,
    limit,
  });
  const variation = buildVariationFromSnapshots(snapshots, appliedFilters);

  if (!variation) {
    throw new AppError("Nao ha historico suficiente para o filtro informado.", 404);
  }

  return {
    fonte: normalizedSource,
    filtros: appliedFilters,
    periodo: {
      dataInicio: startDate,
      dataFim: endDate,
    },
    ...variation,
  };
}

// Expande o historico salvo no banco em itens filtrados por periodo.
async function getHistoryByPeriod({
  source = "all",
  filters = {},
  dataInicio = null,
  dataFim = null,
  limit = 500,
} = {}) {
  const normalizedSource = normalizeRequestedSource(source);
  const appliedFilters = cleanFilters(filters);
  const { startDate, endDate } = parsePeriod({ dataInicio, dataFim });

  if (!startDate && !endDate) {
    throw new AppError("Informe dataInicio ou dataFim para consultar por periodo.", 400);
  }

  const snapshots = await listSnapshotsByPeriod({
    source: normalizedSource === "all" ? null : normalizedSource,
    startDate,
    endDate,
    limit,
  });
  const items = buildPeriodItems(snapshots, appliedFilters);

  return {
    fonte: normalizedSource,
    filtros: appliedFilters,
    periodo: {
      dataInicio: startDate,
      dataFim: endDate,
    },
    totalSnapshots: snapshots.length,
    totalItens: items.length,
    itens: items,
  };
}

module.exports = {
  getHistory,
  getHistoryByPeriod,
  getVariation,
};
