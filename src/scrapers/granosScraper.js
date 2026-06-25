const AppError = require("../errors/AppError");
const { criarLogger } = require("../logs/logger");
const { getPuppeteerLaunchOptions, puppeteer } = require("../utils/puppeteer");

const logger = criarLogger("SCRAPER-GRANOS");

async function scrapeGranos() {
  let browser;

  try {
    const url = "https://granoscorretora.com.br/cotacao-do-dia/";
    logger.info("Iniciando navegador Puppeteer.");

    browser = await puppeteer.launch(getPuppeteerLaunchOptions());
    const page = await browser.newPage();

    await page.setRequestInterception(true);
    page.on("request", (req) => {
      if (
        req.resourceType() === "image" ||
        req.resourceType() === "stylesheet" ||
        req.resourceType() === "font"
      ) {
        req.abort();
      } else {
        req.continue();
      }
    });

    logger.info(`Acessando URL: ${url}`);
    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 60000,
    });

    logger.info("Pagina carregada.");

    const tableData = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll("table tbody tr"));
      const pricesMap = {};

      rows.forEach((row) => {
        const columns = row.querySelectorAll("td");
        if (columns.length < 6) return;

        const cidade = columns[1]?.innerText?.trim() || "";
        if (!cidade.toUpperCase().includes("CAMPO GRANDE")) return;

        const dataOriginal = columns[0]?.innerText?.trim() || "";
        let dataHoraISO = null;
        if (dataOriginal) {
          const parts = dataOriginal.split("/");
          if (parts.length === 3) {
            dataHoraISO = `${parts[2]}-${parts[1]}-${parts[0]}T00:00:00.000Z`;
          }
        }

        const precos = [
          { grao: "SOJA", valor: columns[2]?.innerText?.trim() },
          { grao: "MILHO", valor: columns[3]?.innerText?.trim() },
          { grao: "TRIGO", valor: columns[4]?.innerText?.trim() },
          { grao: "SORGO", valor: columns[5]?.innerText?.trim() },
        ];

        precos.forEach((item) => {
          if (item.valor && item.valor !== "0,00" && item.valor !== "" && !pricesMap[item.grao]) {
            pricesMap[item.grao] = {
              fornecedor: "Granos Corretora",
              grao: item.grao,
              descricao: "Sem descricao",
              data_hora: dataHoraISO,
              preco: item.valor,
              unidade: "sc",
              local: cidade,
            };
          }
        });
      });

      return Object.values(pricesMap);
    });

    logger.sucesso(`Cotacoes obtidas com sucesso. Total: ${tableData.length}.`);
    return tableData;
  } catch (error) {
    logger.erro("Erro ao coletar cotacoes da Granos.", error);

    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError("Falha ao coletar cotacoes da Granos", 502, {
      origem: "granos",
      causa: error.message,
    });
  } finally {
    if (browser) {
      await browser.close();
      logger.info("Navegador encerrado.");
    }
  }
}

module.exports = scrapeGranos;
