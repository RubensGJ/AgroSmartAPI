const { Pool } = require("pg");
const { criarLogger } = require("../logs/logger");

let pool = null;
const logger = criarLogger("BANCO");

function parseBoolean(value, defaultValue = true) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  const normalized = String(value).toLowerCase().trim();
  return ["1", "true", "yes", "y", "on"].includes(normalized);
}

function shouldUseSsl(connectionString) {
  const explicit = process.env.DATABASE_SSL;
  if (explicit !== undefined) {
    return parseBoolean(explicit, true);
  }

  return connectionString.includes("neon.tech");
}

function getPool() {
  if (pool) {
    return pool;
  }

  const connectionString = (process.env.DATABASE_URL || "").trim();
  if (!connectionString) {
    throw new Error("DATABASE_URL nao configurada. Defina a URL do Neon no .env.");
  }

  pool = new Pool({
    connectionString,
    ssl: shouldUseSsl(connectionString) ? { rejectUnauthorized: false } : false,
  });

  logger.info("Pool de conexao com o banco criado.");

  return pool;
}

async function query(text, params = []) {
  return getPool().query(text, params);
}

async function initDatabase() {
  logger.info("Garantindo estrutura do banco.");

  await query(`
    CREATE TABLE IF NOT EXISTS cotacoes_historico (
      id BIGSERIAL PRIMARY KEY,
      fonte TEXT NOT NULL,
      dados_json JSONB NOT NULL,
      quantidade_itens INTEGER NOT NULL,
      coletado_em TIMESTAMPTZ NOT NULL,
      janela_horario TEXT,
      tipo_disparo TEXT NOT NULL,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_historico_fonte_coletado_em
    ON cotacoes_historico(fonte, coletado_em DESC)
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS cotacoes_ultima (
      fonte TEXT PRIMARY KEY,
      dados_json JSONB NOT NULL,
      quantidade_itens INTEGER NOT NULL,
      coletado_em TIMESTAMPTZ NOT NULL,
      janela_horario TEXT,
      tipo_disparo TEXT NOT NULL,
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS logs_requisicoes (
      id BIGSERIAL PRIMARY KEY,
      metodo TEXT NOT NULL,
      rota TEXT NOT NULL,
      status_code INTEGER NOT NULL,
      duracao_ms INTEGER NOT NULL,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_logs_requisicoes_criado_em
    ON logs_requisicoes(criado_em DESC)
  `);

  logger.sucesso("Estrutura do banco pronta.");
}

module.exports = { initDatabase, query };
