const { query } = require("./db");
const { getNowInBrasiliaISO } = require("../utils/dateTime");

// Converte o JSON salvo no banco para um array padrao usado pelos services.
function parsePayload(payloadJson) {
  if (Array.isArray(payloadJson)) {
    return payloadJson;
  }

  if (payloadJson && typeof payloadJson === "object") {
    return Array.isArray(payloadJson.payload) ? payloadJson.payload : [];
  }

  try {
    const payload = JSON.parse(payloadJson);
    return Array.isArray(payload) ? payload : [];
  } catch (error) {
    return [];
  }
}

// Mapeia uma linha do banco para o formato de snapshot usado na aplicacao.
function mapSnapshotRow(row) {
  if (!row) return null;

  return {
    id: row.id,
    source: row.fonte,
    payload: parsePayload(row.dados_json),
    itemCount: row.quantidade_itens,
    collectedAt: row.coletado_em,
    slotLabel: row.janela_horario,
    triggerType: row.tipo_disparo,
    createdAt: row.criado_em || null,
    updatedAt: row.atualizado_em || null,
  };
}

// Salva um novo snapshot no historico e atualiza a tabela com a ultima coleta.
async function saveSnapshot({
  source,
  payload,
  collectedAt = getNowInBrasiliaISO(),
  slotLabel = null,
  triggerType = "manual",
}) {
  if (!Array.isArray(payload)) {
    throw new TypeError("payload precisa ser um array");
  }

  const payloadJson = JSON.stringify(payload);
  const itemCount = payload.length;

  const insertResult = await query(
    `
      INSERT INTO cotacoes_historico
      (fonte, dados_json, quantidade_itens, coletado_em, janela_horario, tipo_disparo)
      VALUES ($1, $2::jsonb, $3, $4, $5, $6)
      RETURNING id
    `,
    [source, payloadJson, itemCount, collectedAt, slotLabel, triggerType]
  );

  await query(
    `
      INSERT INTO cotacoes_ultima
      (fonte, dados_json, quantidade_itens, coletado_em, janela_horario, tipo_disparo, atualizado_em)
      VALUES ($1, $2::jsonb, $3, $4, $5, $6, now())
      ON CONFLICT(fonte) DO UPDATE SET
        dados_json = EXCLUDED.dados_json,
        quantidade_itens = EXCLUDED.quantidade_itens,
        coletado_em = EXCLUDED.coletado_em,
        janela_horario = EXCLUDED.janela_horario,
        tipo_disparo = EXCLUDED.tipo_disparo,
        atualizado_em = now()
    `,
    [source, payloadJson, itemCount, collectedAt, slotLabel, triggerType]
  );

  return {
    id: insertResult.rows[0]?.id || null,
    source,
    payload,
    itemCount,
    collectedAt,
    slotLabel,
    triggerType,
  };
}

// Busca o snapshot mais recente de uma fonte especifica.
async function getLatestSnapshot(source) {
  const result = await query(
    `
      SELECT fonte, dados_json, quantidade_itens, coletado_em, janela_horario, tipo_disparo, atualizado_em
      FROM cotacoes_ultima
      WHERE fonte = $1
    `,
    [source]
  );

  const row = result.rows[0];
  return mapSnapshotRow(row);
}

// Busca os ultimos snapshots das fontes informadas em uma unica consulta.
async function getLatestSnapshotsBySources(sources) {
  if (!Array.isArray(sources) || sources.length === 0) {
    return [];
  }

  const result = await query(
    `
      SELECT fonte, dados_json, quantidade_itens, coletado_em, janela_horario, tipo_disparo, atualizado_em
      FROM cotacoes_ultima
      WHERE fonte = ANY($1::text[])
    `,
    [sources]
  );

  return result.rows.map(mapSnapshotRow);
}

// Lista snapshots mais recentes, com ou sem filtro por fonte.
async function listSnapshots({ source = null, limit = 50 }) {
  const parsedLimit = Number(limit);
  const safeLimit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 500) : 50;

  const result = source
    ? await query(
        `
          SELECT id, fonte, dados_json, quantidade_itens, coletado_em, janela_horario, tipo_disparo, criado_em
          FROM cotacoes_historico
          WHERE fonte = $1
          ORDER BY coletado_em DESC, id DESC
          LIMIT $2
        `,
        [source, safeLimit]
      )
    : await query(
        `
          SELECT id, fonte, dados_json, quantidade_itens, coletado_em, janela_horario, tipo_disparo, criado_em
          FROM cotacoes_historico
          ORDER BY coletado_em DESC, id DESC
          LIMIT $1
        `,
        [safeLimit]
      );

  return result.rows.map(mapSnapshotRow);
}

// Lista snapshots dentro de um periodo para montar consultas historicas.
async function listSnapshotsByPeriod({ source = null, startDate = null, endDate = null, limit = 500 }) {
  const parsedLimit = Number(limit);
  const safeLimit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 2000) : 500;
  const values = [];
  const conditions = [];

  if (source) {
    values.push(source);
    conditions.push(`fonte = $${values.length}`);
  }

  if (startDate) {
    values.push(startDate);
    conditions.push(`coletado_em >= $${values.length}`);
  }

  if (endDate) {
    values.push(endDate);
    conditions.push(`coletado_em <= $${values.length}`);
  }

  values.push(safeLimit);

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await query(
    `
      SELECT id, fonte, dados_json, quantidade_itens, coletado_em, janela_horario, tipo_disparo, criado_em
      FROM cotacoes_historico
      ${whereClause}
      ORDER BY coletado_em ASC, id ASC
      LIMIT $${values.length}
    `,
    values
  );

  return result.rows.map(mapSnapshotRow);
}

module.exports = {
  getLatestSnapshot,
  getLatestSnapshotsBySources,
  listSnapshots,
  listSnapshotsByPeriod,
  saveSnapshot,
};
