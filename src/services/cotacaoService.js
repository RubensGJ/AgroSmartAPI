const scrapeCoamo = require("../scrapers/coamoScraper");
const scrapeLarAgro = require("../scrapers/larScraper");
const AppError = require("../errors/AppError");
const {
  getLatestSnapshot,
  listSnapshots,
  saveSnapshot,
} = require("../database/cotacoesRepository");

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
    collectedAt: new Date().toISOString(),
    slotLabel,
    triggerType,
  });

  cache[source] = snapshot;
  return data;
}

//carrega ultima coleta para cache
async function loadLatestToCache(source) {
  ensureSource(source);
  const snapshot = await getLatestSnapshot(source);

  if (snapshot) {
    cache[source] = snapshot;
  }

  return snapshot;
}

//tenta coletar dados, se nao conseguir tenta denovo, e denovo, e denovo ate dar o limite
async function collectSourceWithRetry(source, { triggerType = "manual", slotLabel = null } = {}) {
  if (inFlight[source]) {
    return inFlight[source];
  }

  const sourceConfig = ensureSource(source);
  const maxAttempts = getRetryMaxAttempts();
  const retryDelayMs = getRetryDelayMs();

  inFlight[source] = (async () => {
    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const data = await sourceConfig.scraper();
        validateScrapedData(source, data);
        return await persistSnapshot(source, data, { triggerType, slotLabel });
      } catch (error) {
        lastError = normalizeError(source, error);
        const retryable = isRetryableError(error) && isRetryableError(lastError);

        if (!retryable) {
          console.error(
            `[${source.toUpperCase()}] Falha nao-retriavel detectada (${lastError.message}). Encerrando tentativas.`
          );
          break;
        }

        if (attempt < maxAttempts) {
          console.warn(
            `[${source.toUpperCase()}] Tentativa ${attempt}/${maxAttempts} falhou (${lastError.message}). Nova tentativa em ${retryDelayMs}ms.`
          );
          await sleep(retryDelayMs);
        }
      }
    }

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
    return collectSourceWithRetry(source, { triggerType: "manual" });
  }

  if (cache[source]?.payload?.length) {
    return cache[source].payload;
  }

  const latestSnapshot = await loadLatestToCache(source);
  if (latestSnapshot?.payload?.length) {
    return latestSnapshot.payload;
  }

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
  if (force) {
    const [coamoData, larData] = await Promise.all([
      collectSourceWithRetry("coamo", { triggerType: "manual" }),
      collectSourceWithRetry("lar", { triggerType: "manual" }),
    ]);

    return { coamo: coamoData, larAgro: larData };
  }

  const [coamoData, larData] = await Promise.all([
    getSourceData("coamo", false),
    getSourceData("lar", false),
  ]);

  return { coamo: coamoData, larAgro: larData };
}

//coleta agendada, tenta coletar ambos, se falhar em um tenta coletar o outro, se ambos falharem lanca erro geral, mas informa qual falhou e qual conseguiu coletar, slotLabel é para identificar qual coleta agendada esta rodando, tipo 12:00 ou 15:00 ou a expressao cron caso seja personalizada
async function refreshScheduled(slotLabel) {
  const [coamoResult, larResult] = await Promise.allSettled([
    collectSourceWithRetry("coamo", { triggerType: "scheduled", slotLabel }),
    collectSourceWithRetry("lar", { triggerType: "scheduled", slotLabel }),
  ]);

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
}

module.exports = {
  bootstrapCotacoesCache,
  getAll,
  getCoamo,
  getHistory,
  getLar,
  refreshScheduled,
};
