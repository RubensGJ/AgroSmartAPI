const { query } = require("./db");

async function saveRequestLog({ metodo, rota, statusCode, duracaoMs }) {
  await query(
    `
      INSERT INTO logs_requisicoes (metodo, rota, status_code, duracao_ms)
      VALUES ($1, $2, $3, $4)
    `,
    [metodo, rota, statusCode, duracaoMs]
  );
}

module.exports = { saveRequestLog };
