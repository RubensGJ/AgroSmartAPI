const { query } = require("../database/db");
const { getLatestSnapshotsBySources } = require("../database/cotacoesRepository");
const { getCotacaoSchedulerStatus } = require("../jobs/cotacaoScheduler");
const { getChromeDiagnostics } = require("../utils/puppeteer");

const EXPECTED_SOURCES = ["coamo", "cvale", "lar", "granos"];
const FRESHNESS_THRESHOLD_HOURS = 24;

function toIsoString(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function getAgeHours(value, now) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, Math.round(((now.getTime() - date.getTime()) / 36e5) * 100) / 100);
}

async function checkDatabase() {
  const startedAt = Date.now();

  try {
    await query("SELECT 1");
    return {
      ok: true,
      latencyMs: Date.now() - startedAt,
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      error: "Falha ao consultar o banco.",
    };
  }
}

async function checkSnapshots(now) {
  const snapshots = await getLatestSnapshotsBySources(EXPECTED_SOURCES);
  const bySource = new Map(snapshots.map((snapshot) => [snapshot.source, snapshot]));

  const sources = {};
  for (const source of EXPECTED_SOURCES) {
    const snapshot = bySource.get(source);
    const ageHours = snapshot ? getAgeHours(snapshot.collectedAt, now) : null;
    const hasData = Boolean(snapshot && snapshot.itemCount > 0);
    const fresh = hasData && ageHours !== null && ageHours <= FRESHNESS_THRESHOLD_HOURS;

    sources[source] = {
      ok: Boolean(fresh),
      exists: Boolean(snapshot),
      hasData,
      fresh,
      ageHours,
      thresholdHours: FRESHNESS_THRESHOLD_HOURS,
      itemCount: snapshot?.itemCount || 0,
      collectedAt: toIsoString(snapshot?.collectedAt),
      updatedAt: toIsoString(snapshot?.updatedAt),
    };
  }

  const usableCount = Object.values(sources).filter((source) => source.exists && source.hasData).length;
  const freshCount = Object.values(sources).filter((source) => source.fresh).length;

  return {
    ok: freshCount === EXPECTED_SOURCES.length,
    usableCount,
    freshCount,
    expectedSources: EXPECTED_SOURCES,
    sources,
  };
}

function checkChrome() {
  const diagnostics = getChromeDiagnostics();

  return {
    ok: Boolean(diagnostics.executablePath && diagnostics.exists),
    available: Boolean(diagnostics.executablePath && diagnostics.exists),
    platform: diagnostics.platform,
    arch: diagnostics.arch,
    nodeVersion: diagnostics.nodeVersion,
    error: diagnostics.error ? "Chrome indisponivel para o Puppeteer." : null,
  };
}

function checkScheduler() {
  const status = getCotacaoSchedulerStatus();
  const ok = Boolean(status.enabled && status.jobsRegistered > 0);

  return {
    ok,
    enabled: status.enabled,
    timezone: status.timezone,
    expressions: status.expressions,
    jobsRegistered: status.jobsRegistered,
    invalidExpressions: status.invalidExpressions,
    lastStartedAt: status.lastStartedAt,
    lastFinishedAt: status.lastFinishedAt,
    lastResult: status.lastResult,
    lastError: status.lastError,
  };
}

function resolveOverallStatus(checks) {
  if (!checks.database.ok) {
    return "fail";
  }

  if (checks.snapshots.usableCount === 0) {
    return "fail";
  }

  if (
    !checks.snapshots.ok ||
    !checks.chrome.ok ||
    !checks.scheduler.ok ||
    checks.scheduler.invalidExpressions.length > 0
  ) {
    return "degraded";
  }

  return "ok";
}

async function getDeepHealth() {
  const now = new Date();
  const database = await checkDatabase();
  let snapshots;

  if (database.ok) {
    try {
      snapshots = await checkSnapshots(now);
    } catch (error) {
      snapshots = {
        ok: false,
        usableCount: 0,
        freshCount: 0,
        expectedSources: EXPECTED_SOURCES,
        sources: {},
        error: "Falha ao consultar snapshots.",
      };
    }
  } else {
    snapshots = {
      ok: false,
      usableCount: 0,
      freshCount: 0,
      expectedSources: EXPECTED_SOURCES,
      sources: {},
      error: "Snapshots nao verificados porque o banco falhou.",
    };
  }

  const checks = {
    database,
    snapshots,
    chrome: checkChrome(),
    scheduler: checkScheduler(),
  };

  return {
    status: resolveOverallStatus(checks),
    timestamp: now.toISOString(),
    checks,
  };
}

module.exports = {
  FRESHNESS_THRESHOLD_HOURS,
  getDeepHealth,
};
