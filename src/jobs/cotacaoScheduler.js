const cron = require("node-cron");
const { refreshScheduled } = require("../services/cotacaoService");

//helper
function parseBoolean(value, defaultValue) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  const normalized = String(value).toLowerCase().trim();
  return ["1", "true", "yes", "y", "on"].includes(normalized);
}

//pega o tempo agendado do env
function getCronExpressions() {
  const first = (process.env.SCHEDULER_CRON_1 || "0 12 * * *").trim();
  const second = (process.env.SCHEDULER_CRON_2 || "0 15 * * *").trim();
  return [first, second];
}

//
function getSlotLabel(index, expression) {
  if (index === 0) return "12:00";
  if (index === 1) return "15:00";
  return expression;
}

//
function startCotacaoScheduler() {
  const enabled = parseBoolean(process.env.SCHEDULER_ENABLED, true);
  if (!enabled) {
    console.log("[SCHEDULER] Desabilitado via SCHEDULER_ENABLED.");
    return [];
  }

  const timezone = process.env.SCHEDULER_TIMEZONE || "America/Sao_Paulo";
  const jobs = [];

  for (const [index, expression] of getCronExpressions().entries()) {
    if (!cron.validate(expression)) {
      console.error(`[SCHEDULER] Expressao cron invalida ignorada: "${expression}"`);
      continue;
    }

    const slotLabel = getSlotLabel(index, expression);
    const job = cron.schedule(
      expression,
      async () => {
        const startedAt = new Date().toISOString();
        console.log(`[SCHEDULER] Iniciando coleta ${slotLabel}. startedAt=${startedAt}`);

        try {
          const result = await refreshScheduled(slotLabel);
          console.log(`[SCHEDULER] Coleta ${slotLabel} finalizada: ${JSON.stringify(result)}`);
        } catch (error) {
          console.error(`[SCHEDULER] Falha geral na coleta ${slotLabel}:`, error);
        }
      },
      { timezone }
    );

    jobs.push(job);
    console.log(`[SCHEDULER] Job registrado: cron="${expression}", timezone="${timezone}"`);
  }

  return jobs;
}

module.exports = { startCotacaoScheduler };
