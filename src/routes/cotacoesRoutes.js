const express = require("express");
const scrapeCoamo = require("../scrapers/coamoScraper");


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

module.exports = router;
