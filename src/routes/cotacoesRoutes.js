const express = require("express");
const scrapeCoamo = require("../scrapers/coamoScraper");
const scrapeLarAgro = require("../scrapers/larScraper");

const router = express.Router();

router.get("/coamo", async (req, res) => {
  try {
    console.log("Iniciando scrapeCoamo");
    const dados = await scrapeCoamo();
    console.log("Dados obtidos:", dados);
    res.json(dados);
  } catch (error) {
    console.error("Erro ao obter cotações da Coamo:", error);
    res.status(500).json({ error: "Erro ao obter cotações da Coamo" });
  }
});

router.get("/lar", async (req, res) => {
  try {
    console.log("Iniciando scrapeLarAgro");
    const dados = await scrapeLarAgro();
    console.log("Dados obtidos:", dados);
    res.json(dados);
  } catch (error) {
    console.error("Erro ao obter cotações da LAR:", error);
    res.status(500).json({ error: "Erro ao obter cotações da LAR" });
  }
});

router.get('/todos', async (req, res) => {
  try {
    const [coamoData, larAgroData] = await Promise.all([scrapeCoamo(), scrapeLarAgro()]);
    res.json({
      coamo: coamoData,
      larAgro: larAgroData
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao executar os scrapers' });
  }
});

module.exports = router;
