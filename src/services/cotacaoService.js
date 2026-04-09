const scrapeCoamo = require("../scrapers/coamoScraper");
const scrapeLarAgro = require("../scrapers/larScraper");
const AppError = require("../errors/AppError");
const {
  getLatestSnapshot,
  listSnapshots,
  saveSnapshot,
} = require("../database/cotacoesRepository");
const { getNowInBrasiliaISO } = require("../utils/dateTime");
const { criarLogger } = require("../logs/logger");

const logger = criarLogger("COTACAO");

// Scrappers disponiveis
const SOURCES = {
  coamo: { label: "Coamo", scraper: scrapeCoamo },
  lar: { label: "LAR", scraper: scrapeLarAgro },
};

//Cache em memoria
const cache = {
  coamo: null,
  lar: null,
};

//Coletas em andamento
const inFlight = {
  coamo: null,
  lar: null,
};

function parseBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  const normalized = String(value).toLowerCase().trim();
  return ["1", "true", "yes", "y", "on"].includes(normalized);
}

function shouldCollectInParallel() {
  return parseBoolean(process.env.SCRAPER_PARALLEL_COLLECTION, false);
}

//Get Maximo tenativas do .env, se não definido será 3
function getRetryMaxAttempts() {
  const value = Number.parseInt(process.env.SCRAPER_RETRY_MAX_ATTEMPTS, 10);
  return Number.isFinite(value) && value > 0 ? value : 3;
}

//Get Delay entre tentativas do .env, se não definido será 3 minutos
function getRetryDelayMs() {
  const value = Number.parseInt(process.env.SCRAPER_RETRY_DELAY_MS, 10);
  return Number.isFinite(value) && value >= 0 ? value : 180000;
}

//sleep
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

//checa fonte, se nao existir lanca erro
function ensureSource(source) {
  if (!SOURCES[source]) {
    throw new AppError("Fonte invalida. Use: coamo, lar ou all.", 400);
  }

  return SOURCES[source];
}

//err0
function normalizeError(source, error) {
  if (error instanceof AppError) {
    return error;
  }

  const sourceConfig = ensureSource(source);
  return new AppError(`Falha ao coletar cotacoes da ${sourceConfig.label}`, 502, {
    origem: source,
    causa: error.message,
  });
}

function isRetryableError(error) {
  const message = String(error?.message || "").toLowerCase();
  const knownNonRetryablePatterns = [
    "could not find chrome",
    "browser was not found",
    "chrome executable",
  ];

  return !knownNonRetryablePatterns.some((pattern) => message.includes(pattern));
}

//valida resposta, se nao for array ou estiver vazio lanca um erro
function validateScrapedData(source, data) {
  if (!Array.isArray(data)) {
    throw new AppError(`Resposta invalida ao obter cotacoes da ${ensureSource(source).label}`, 502, {
      origem: source,
      tipo: "invalid_payload",
    });
  }

  if (data.length === 0) {
    throw new AppError(`Coleta vazia para ${ensureSource(source).label}`, 502, {
      origem: source,
      tipo: "empty_payload",
    });
  }
}

//persiste resposta e atualiza cache
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

//carrega ultima coleta para cache
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

//tenta coletar dados, se nao conseguir tenta denovo, e denovo, e denovo ate dar o limite
async function collectSourceWithRetry(source, { triggerType = "manual", slotLabel = null } = {}) {
  if (inFlight[source]) {
    logger.info(`Coleta de ${source} ja esta em andamento. Reaproveitando execucao atual.`);
    return inFlight[source];
  }

  const sourceConfig = ensureSource(source);
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

//obtem dados, tenta cache, se nao tiver tenta coletar, se coletar falhar lanca erro
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

//get coamo :D
async function getCoamo(force = false) {
  return getSourceData("coamo", force);
}

//get Lar:D
async function getLar(force = false) {
  return getSourceData("lar", force);
}

//get tudo :D
async function getAll(force = false) {
  const runInParallel = shouldCollectInParallel();

  if (force) {
    if (runInParallel) {
      const [coamoData, larData] = await Promise.all([
        collectSourceWithRetry("coamo", { triggerType: "manual" }),
        collectSourceWithRetry("lar", { triggerType: "manual" }),
      ]);

      return { coamo: coamoData, larAgro: larData };
    }

    const coamoData = await collectSourceWithRetry("coamo", { triggerType: "manual" });
    const larData = await collectSourceWithRetry("lar", { triggerType: "manual" });

    return { coamo: coamoData, larAgro: larData };
  }

  if (runInParallel) {
    const [coamoData, larData] = await Promise.all([
      getSourceData("coamo", false),
      getSourceData("lar", false),
    ]);

    return { coamo: coamoData, larAgro: larData };
  }

  const coamoData = await getSourceData("coamo", false);
  const larData = await getSourceData("lar", false);

  return { coamo: coamoData, larAgro: larData };
}

//coleta agendada, tenta coletar ambos, se falhar em um tenta coletar o outro, se ambos falharem lanca erro geral, mas informa qual falhou e qual conseguiu coletar, slotLabel é para identificar qual coleta agendada esta rodando, tipo 12:00 ou 15:00 ou a expressao cron caso seja personalizada
async function refreshScheduled(slotLabel) {
  logger.info(`Iniciando coleta agendada do horario ${slotLabel}.`);
  let coamoResult;
  let larResult;

  if (shouldCollectInParallel()) {
    [coamoResult, larResult] = await Promise.allSettled([
      collectSourceWithRetry("coamo", { triggerType: "scheduled", slotLabel }),
      collectSourceWithRetry("lar", { triggerType: "scheduled", slotLabel }),
    ]);
  } else {
    try {
      const coamoData = await collectSourceWithRetry("coamo", { triggerType: "scheduled", slotLabel });
      coamoResult = { status: "fulfilled", value: coamoData };
    } catch (error) {
      coamoResult = { status: "rejected", reason: error };
    }

    try {
      const larData = await collectSourceWithRetry("lar", { triggerType: "scheduled", slotLabel });
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
    lar:
      larResult.status === "fulfilled"
        ? { ok: true, count: larResult.value.length }
        : { ok: false, error: larResult.reason.message },
  };
}

//obtem historico de coletas, pode filtrar por fonte e limitar quantidade, se fonte for invalida lanca erro
async function getHistory(source = "all", limit = 50) {
  if (source !== "all") {
    ensureSource(source);
  }

  const normalizedSource = source === "all" ? null : source;
  return listSnapshots({ source: normalizedSource, limit });
}

//coleta forçada para popular cache no boot da aplicação
async function bootstrapCotacoesCache() {
  await Promise.all([loadLatestToCache("coamo"), loadLatestToCache("lar")]);
  logger.sucesso("Carga inicial de cache concluida.");
}

module.exports = {
  bootstrapCotacoesCache,
  getAll,
  getCoamo,
  getHistory,
  getLar,
  refreshScheduled,
};
