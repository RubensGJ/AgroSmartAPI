const express = require("express");
const {
  exportQuotes,
  getBestPrice,
  getCoamo,
  getComparisonBySource,
  getFilteredQuotes,
  getAll,
  getHistory,
  getHistoryByPeriod,
  getLar,
  getVariation,
} = require("../services/cotacaoService");

const router = express.Router();

// Encapsula handlers async para repassar erros ao middleware global.
function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

// Converte o parametro force vindo na query string para booleano.
function parseForce(value) {
  return value === "true";
}

// Limita e converte o parametro limit usado nas consultas historicas.
function parseLimit(value, fallback = 50) {
  const parsedLimit = Number.parseInt(value, 10);
  return Number.isFinite(parsedLimit) ? parsedLimit : fallback;
}

// Monta um objeto unico com os filtros textuais aceitos pelas rotas.
function buildFiltersFromQuery(query) {
  return {
    grao: query.grao,
    local: query.local,
    descricao: query.descricao,
    fornecedor: query.fornecedor,
    unidade: query.unidade,
  };
}

// Retorna as cotacoes atuais da Coamo.
router.get(
  "/coamo",
  asyncHandler(async (req, res) => {
    const dados = await getCoamo(parseForce(req.query.force));
    res.json(dados);
  })
);

// Retorna as cotacoes atuais da LAR.
router.get(
  "/lar",
  asyncHandler(async (req, res) => {
    const dados = await getLar(parseForce(req.query.force));
    res.json(dados);
  })
);

// Retorna as cotacoes atuais das duas fontes em uma unica resposta.
router.get(
  "/todos",
  asyncHandler(async (req, res) => {
    const dados = await getAll(parseForce(req.query.force));
    res.json(dados);
  })
);

// Filtra as cotacoes atuais pelos campos enviados na query string.
router.get(
  "/filtro",
  asyncHandler(async (req, res) => {
    const dados = await getFilteredQuotes({
      source: req.query.fonte || "all",
      force: parseForce(req.query.force),
      filters: buildFiltersFromQuery(req.query),
    });

    res.json(dados);
  })
);

// Retorna a maior cotacao encontrada dentro do filtro enviado.
router.get(
  "/melhor-preco",
  asyncHandler(async (req, res) => {
    const dados = await getBestPrice({
      source: req.query.fonte || "all",
      force: parseForce(req.query.force),
      filters: buildFiltersFromQuery(req.query),
    });

    res.json(dados);
  })
);

// Compara a melhor cotacao entre Coamo e LAR para um grao especifico.
router.get(
  "/comparativo",
  asyncHandler(async (req, res) => {
    const dados = await getComparisonBySource({
      force: parseForce(req.query.force),
      filters: buildFiltersFromQuery(req.query),
    });

    res.json(dados);
  })
);

// Calcula a variacao historica de preco dentro do periodo informado.
router.get(
  "/variacao",
  asyncHandler(async (req, res) => {
    const dados = await getVariation({
      source: req.query.fonte,
      filters: buildFiltersFromQuery(req.query),
      dataInicio: req.query.dataInicio,
      dataFim: req.query.dataFim,
      limit: parseLimit(req.query.limit, 500),
    });

    res.json(dados);
  })
);

// Lista os itens historicos encontrados em um intervalo de datas.
router.get(
  "/periodo",
  asyncHandler(async (req, res) => {
    const dados = await getHistoryByPeriod({
      source: req.query.fonte || "all",
      filters: buildFiltersFromQuery(req.query),
      dataInicio: req.query.dataInicio,
      dataFim: req.query.dataFim,
      limit: parseLimit(req.query.limit, 500),
    });

    res.json(dados);
  })
);

// Exporta as cotacoes filtradas em formato CSV.
router.get(
  "/exportar",
  asyncHandler(async (req, res) => {
    const csv = await exportQuotes({
      source: req.query.fonte || "all",
      force: parseForce(req.query.force),
      filters: buildFiltersFromQuery(req.query),
    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="cotacoes.csv"');
    res.status(200).send(csv);
  })
);

// Retorna o historico bruto de snapshots salvos no banco.
router.get(
  "/historico",
  asyncHandler(async (req, res) => {
    const fonte = (req.query.fonte || "all").toString().toLowerCase();
    const dados = await getHistory(fonte, parseLimit(req.query.limit, 50));
    res.json(dados);
  })
);

module.exports = router;
