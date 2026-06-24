const scrapeCoamo = require("../../scrapers/coamoScraper");
const scrapeCvale = require("../../scrapers/cvaleScraper");
const scrapeLarAgro = require("../../scrapers/larScraper");
const AppError = require("../../errors/AppError");
const { getLatestSnapshot, saveSnapshot } = require("../../database/cotacoesRepository");
const { getNowInBrasiliaISO } = require("../../utils/dateTime");
const { criarLogger } = require("../../logs/logger");
const {
  SOURCE_LABELS,
  ensureSource,
  normalizeRequestedSource,
} = require("./cotacaoCommon");
const { enrichQuotes } = require("../../utils/cotacoes");

const logger = criarLogger("COTACAO");

const SOURCES = {
  coamo: { label: SOURCE_LABELS.coamo, scraper: scrapeCoamo },
  cvale: { label: SOURCE_LABELS.cvale, scraper: scrapeCvale },
  lar: { label: SOURCE_LABELS.lar, scraper: scrapeLarAgro },
};

const cache = {
  coamo: null,
  cvale: null,
  lar: null,
};

const inFlight = {
  coamo: null,
  cvale: null,
  lar: null,
};

// Converte valores do ambiente para booleano dentro das regras de coleta.
function parseBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  const normalized = String(value).toLowerCase().trim();
  return ["1", "true", "yes", "y", "on"].includes(normalized);
}

// Define se Coamo e LAR devem ser coletadas em paralelo.
function shouldCollectInParallel() {
  return parseBoolean(process.env.SCRAPER_PARALLEL_COLLECTION, false);
}

// Le o maximo de tentativas configurado para repeticao de coleta.
function getRetryMaxAttempts() {
  const value = Number.parseInt(process.env.SCRAPER_RETRY_MAX_ATTEMPTS, 10);
  return Number.isFinite(value) && value > 0 ? value : 3;
}

// Le o intervalo entre tentativas de coleta em milissegundos.
function getRetryDelayMs() {
  const value = Number.parseInt(process.env.SCRAPER_RETRY_DELAY_MS, 10);
  return Number.isFinite(value) && value >= 0 ? value : 180000;
}

// Aguarda o tempo informado antes de seguir para a proxima tentativa.
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Padroniza erros vindos do scraper para o formato usado pela API.
function normalizeError(source, error) {
  if (error instanceof AppError) {
    return error;
  }

  const sourceLabel = ensureSource(source);
  return new AppError(`Falha ao coletar cotacoes da ${sourceLabel}`, 502, {
    origem: source,
    causa: error.message,
  });
}

// Define se o erro permite uma nova tentativa automatica.
function isRetryableError(error) {
  const message = String(error?.message || "").toLowerCase();
  const knownNonRetryablePatterns = [
    "chrome do puppeteer nao encontrado",
    "could not find chrome",
    "browser was not found",
    "chrome executable",
  ];

  return !knownNonRetryablePatterns.some((pattern) => message.includes(pattern));
}

// Garante que a coleta retornou um array valido e nao vazio.
function validateScrapedData(source, data) {
  const sourceLabel = ensureSource(source);

  if (!Array.isArray(data)) {
    throw new AppError(`Resposta invalida ao obter cotacoes da ${sourceLabel}`, 502, {
      origem: source,
      tipo: "invalid_payload",
    });
  }

  if (data.length === 0) {
    throw new AppError(`Coleta vazia para ${sourceLabel}`, 502, {
      origem: source,
      tipo: "empty_payload",
    });
  }
}

// Persiste a coleta no banco e atualiza o cache em memoria da fonte.
async function persistSnapshot(source, data, { triggerType = "manual", slotLabel = null } = {}) {
  const snapshot = await saveSnapshot({
    source,
    payload: data,
    collectedAt: getNowInBrasiliaISO(),
    slotLabel,
    triggerType,
  });

  cache[source] = snapshot;
  logger.sucesso(
    `Snapshot salvo para ${source} com ${data.length} itens. Tipo de disparo: ${triggerType}.`
  );
  return data;
}

// Carrega do banco o ultimo snapshot conhecido para aquecer o cache da API.
async function loadLatestToCache(source) {
  ensureSource(source);
  const snapshot = await getLatestSnapshot(source);

  if (snapshot) {
    cache[source] = snapshot;
    logger.info(`Ultimo snapshot de ${source} carregado do banco com ${snapshot.itemCount} itens.`);
  } else {
    logger.aviso(`Nenhum snapshot encontrado no banco para ${source}.`);
  }

  return snapshot;
}

// Executa a coleta de uma fonte com reaproveitamento de promessa e tentativas de retry.
async function collectSourceWithRetry(source, { triggerType = "manual", slotLabel = null } = {}) {
  if (inFlight[source]) {
    logger.info(`Coleta de ${source} ja esta em andamento. Reaproveitando execucao atual.`);
    return inFlight[source];
  }

  const sourceConfig = SOURCES[source];
  if (!sourceConfig) {
    ensureSource(source);
  }

  const maxAttempts = getRetryMaxAttempts();
  const retryDelayMs = getRetryDelayMs();

  inFlight[source] = (async () => {
    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        logger.info(
          `Iniciando coleta de ${source}. Tentativa ${attempt} de ${maxAttempts}. Tipo: ${triggerType}.`
        );
        const data = await sourceConfig.scraper();
        validateScrapedData(source, data);
        logger.sucesso(`Coleta de ${source} concluida com ${data.length} itens.`);
        return await persistSnapshot(source, data, { triggerType, slotLabel });
      } catch (error) {
        lastError = normalizeError(source, error);
        const retryable = isRetryableError(error) && isRetryableError(lastError);

        if (!retryable) {
          logger.erro(
            `Falha nao-retriavel na coleta de ${source}. Encerrando tentativas.`,
            lastError
          );
          break;
        }

        if (attempt < maxAttempts) {
          logger.aviso(
            `Coleta de ${source} falhou na tentativa ${attempt} de ${maxAttempts}. Nova tentativa em ${retryDelayMs}ms. Motivo: ${lastError.message}`
          );
          await sleep(retryDelayMs);
        }
      }
    }

    logger.erro(`Coleta de ${source} falhou apos ${maxAttempts} tentativas.`, lastError);
    throw lastError;
  })();

  try {
    return await inFlight[source];
  } finally {
    inFlight[source] = null;
  }
}

// Decide entre cache, banco ou nova coleta para devolver a cotacao atual de uma fonte.
async function getSourceData(source, force = false) {
  ensureSource(source);

  if (force) {
    logger.info(`Coleta forcada solicitada para ${source}.`);
    return collectSourceWithRetry(source, { triggerType: "manual" });
  }

  if (cache[source]?.payload?.length) {
    logger.info(`Usando cache em memoria para ${source}.`);
    return cache[source].payload;
  }

  const latestSnapshot = await loadLatestToCache(source);
  if (latestSnapshot?.payload?.length) {
    logger.info(`Usando ultimo snapshot salvo no banco para ${source}.`);
    return latestSnapshot.payload;
  }

  logger.aviso(`Sem cache disponivel para ${source}. Sera feita nova coleta.`);
  return collectSourceWithRetry(source, { triggerType: "manual" });
}

// Atalho para retornar apenas a cotacao atual da Coamo.
async function getCoamo(force = false) {
  return getSourceData("coamo", force);
}

// Atalho para retornar apenas a cotacao atual da C.Vale.
async function getCvale(force = false) {
  return getSourceData("cvale", force);
}

// Atalho para retornar apenas a cotacao atual da LAR.
async function getLar(force = false) {
  return getSourceData("lar", force);
}

// Retorna as cotacoes atuais das tres fontes em uma unica chamada.
async function getAll(force = false) {
  const runInParallel = shouldCollectInParallel();

  if (force) {
    if (runInParallel) {
      const [coamoData, cvaleData, larData] = await Promise.all([
        collectSourceWithRetry("coamo", { triggerType: "manual" }),
        collectSourceWithRetry("cvale", { triggerType: "manual" }),
        collectSourceWithRetry("lar", { triggerType: "manual" }),
      ]);

      return { coamo: coamoData, cvale: cvaleData, larAgro: larData };
    }

    const coamoData = await collectSourceWithRetry("coamo", { triggerType: "manual" });
    const cvaleData = await collectSourceWithRetry("cvale", { triggerType: "manual" });
    const larData = await collectSourceWithRetry("lar", { triggerType: "manual" });

    return { coamo: coamoData, cvale: cvaleData, larAgro: larData };
  }

  if (runInParallel) {
    const [coamoData, cvaleData, larData] = await Promise.all([
      getSourceData("coamo", false),
      getSourceData("cvale", false),
      getSourceData("lar", false),
    ]);

    return { coamo: coamoData, cvale: cvaleData, larAgro: larData };
  }

  const coamoData = await getSourceData("coamo", false);
  const cvaleData = await getSourceData("cvale", false);
  const larData = await getSourceData("lar", false);

  return { coamo: coamoData, cvale: cvaleData, larAgro: larData };
}

// Entrega cotacoes atuais ja enriquecidas com metadados para filtros e calculos.
async function getCurrentQuotes(source = "all", force = false) {
  const normalizedSource = normalizeRequestedSource(source);

  if (normalizedSource === "all") {
    const currentQuotes = await getAll(force);
    return [
      ...enrichQuotes("coamo", currentQuotes.coamo),
      ...enrichQuotes("cvale", currentQuotes.cvale),
      ...enrichQuotes("lar", currentQuotes.larAgro),
    ];
  }

  const currentSourceQuotes = await getSourceData(normalizedSource, force);
  return enrichQuotes(normalizedSource, currentSourceQuotes);
}

// Executa a coleta chamada pelo scheduler e devolve um resumo do resultado.
async function refreshScheduled(slotLabel) {
  logger.info(`Iniciando coleta agendada do horario ${slotLabel}.`);
  let coamoResult;
  let cvaleResult;
  let larResult;

  if (shouldCollectInParallel()) {
    [coamoResult, cvaleResult, larResult] = await Promise.allSettled([
      collectSourceWithRetry("coamo", { triggerType: "scheduled", slotLabel }),
      collectSourceWithRetry("cvale", { triggerType: "scheduled", slotLabel }),
      collectSourceWithRetry("lar", { triggerType: "scheduled", slotLabel }),
    ]);
  } else {
    try {
      const coamoData = await collectSourceWithRetry("coamo", {
        triggerType: "scheduled",
        slotLabel,
      });
      coamoResult = { status: "fulfilled", value: coamoData };
    } catch (error) {
      coamoResult = { status: "rejected", reason: error };
    }

    try {
      const cvaleData = await collectSourceWithRetry("cvale", {
        triggerType: "scheduled",
        slotLabel,
      });
      cvaleResult = { status: "fulfilled", value: cvaleData };
    } catch (error) {
      cvaleResult = { status: "rejected", reason: error };
    }

    try {
      const larData = await collectSourceWithRetry("lar", {
        triggerType: "scheduled",
        slotLabel,
      });
      larResult = { status: "fulfilled", value: larData };
    } catch (error) {
      larResult = { status: "rejected", reason: error };
    }
  }

  return {
    slotLabel,
    coamo:
      coamoResult.status === "fulfilled"
        ? { ok: true, count: coamoResult.value.length }
        : { ok: false, error: coamoResult.reason.message },
    cvale:
      cvaleResult.status === "fulfilled"
        ? { ok: true, count: cvaleResult.value.length }
        : { ok: false, error: cvaleResult.reason.message },
    lar:
      larResult.status === "fulfilled"
        ? { ok: true, count: larResult.value.length }
        : { ok: false, error: larResult.reason.message },
  };
}

// Faz a carga inicial do cache em memoria com os ultimos snapshots do banco.
async function bootstrapCotacoesCache() {
  await Promise.all([loadLatestToCache("coamo"), loadLatestToCache("cvale"), loadLatestToCache("lar")]);
  logger.sucesso("Carga inicial de cache concluida.");
}

module.exports = {
  bootstrapCotacoesCache,
  getAll,
  getCoamo,
  getCvale,
  getCurrentQuotes,
  getLar,
  normalizeRequestedSource,
  refreshScheduled,
};
