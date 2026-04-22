const cron = require("node-cron");
const { refreshScheduled } = require("../services/cotacaoService");
const { criarLogger } = require("../logs/logger");

const logger = criarLogger("SCHEDULER");

// Converte variaveis do .env para booleano no scheduler.
function parseBoolean(value, defaultValue) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  const normalized = String(value).toLowerCase().trim();
  return ["1", "true", "yes", "y", "on"].includes(normalized);
}

// Le as expressoes cron configuradas para os horarios de coleta automatica.
function getCronExpressions() {
  const first = (process.env.SCHEDULER_CRON_1 || "0 12 * * *").trim();
  const second = (process.env.SCHEDULER_CRON_2 || "0 15 * * *").trim();
  return [first, second];
}

// Define o nome exibido no historico para cada horario agendado.
function getSlotLabel(index, expression) {
  if (index === 0) return "12:00";
  if (index === 1) return "15:00";
  return expression;
}

// Registra os jobs cron que atualizam as cotacoes automaticamente.
function startCotacaoScheduler() {
  const enabled = parseBoolean(process.env.SCHEDULER_ENABLED, true);
  if (!enabled) {
    logger.aviso("Scheduler desabilitado via SCHEDULER_ENABLED.");
    return [];
  }

  const timezone = process.env.SCHEDULER_TIMEZONE || "America/Sao_Paulo";
  const jobs = [];

  for (const [index, expression] of getCronExpressions().entries()) {
    if (!cron.validate(expression)) {
      logger.erro(`Expressao cron invalida ignorada: "${expression}".`);
      continue;
    }

    const slotLabel = getSlotLabel(index, expression);
    const job = cron.schedule(
      expression,
      async () => {
        const startedAt = new Date().toISOString();
        logger.info(`Iniciando coleta agendada ${slotLabel}. Inicio: ${startedAt}.`);

        try {
          const result = await refreshScheduled(slotLabel);
          logger.sucesso(
            `Coleta ${slotLabel} finalizada. Coamo: ${
              result.coamo.ok ? `ok (${result.coamo.count} itens)` : `falhou (${result.coamo.error})`
            }. LAR: ${result.lar.ok ? `ok (${result.lar.count} itens)` : `falhou (${result.lar.error})`}.`
          );
        } catch (error) {
          logger.erro(`Falha geral na coleta agendada ${slotLabel}.`, error);
        }
      },
      { timezone }
    );

    jobs.push(job);
    logger.info(`Job registrado. Cron: "${expression}". Timezone: "${timezone}".`);
  }

  return jobs;
}

module.exports = { startCotacaoScheduler };
