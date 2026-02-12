const express = require("express");
const { getCoamo, getLar, getAll } = require("../services/cotacaoService");

const router = express.Router();

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

router.get(
  "/coamo",
  asyncHandler(async (req, res) => {
    const force = req.query.force === "true";
    const dados = await getCoamo(force);
    res.json(dados);
  })
);

router.get(
  "/lar",
  asyncHandler(async (req, res) => {
    const force = req.query.force === "true";
    const dados = await getLar(force);
    res.json(dados);
  })
);

router.get(
  "/todos",
  asyncHandler(async (req, res) => {
    const force = req.query.force === "true";
    const dados = await getAll(force);
    res.json(dados);
  })
);

module.exports = router;
