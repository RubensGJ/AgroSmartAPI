const puppeteer = require("puppeteer");
const AppError = require("../errors/AppError");
const { criarLogger } = require("../logs/logger");

const TIMEOUT_PADRAO_MS = Number.parseInt(process.env.SCRAPER_NAV_TIMEOUT_MS, 10) || 90000;
const TIMEOUT_SELETOR_MS = Number.parseInt(process.env.SCRAPER_SELECTOR_TIMEOUT_MS, 10) || 45000;
const logger = criarLogger("SCRAPER-COAMO");

function parseBoolean(value, defaultValue = true) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  const normalized = String(value).toLowerCase().trim();
  return ["1", "true", "yes", "y", "on"].includes(normalized);
}

async function scrapeCoamo() {
  let browser;

  try {
    const url = "https://www.coamo.com.br/preco-do-dia/";
    logger.info("Iniciando navegador Puppeteer.");

    browser = await puppeteer.launch({
      headless: parseBoolean(process.env.PUPPETEER_HEADLESS, true),
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    const page = await browser.newPage();
    await optimizePageRequests(page);

    logger.info(`Acessando URL: ${url}`);
    await gotoWithFallback(page, url);

    await page.waitForSelector("table tbody", { timeout: TIMEOUT_SELETOR_MS });
    await page.waitForFunction(
      () => document.querySelectorAll("table tbody tr").length > 0,
      { timeout: TIMEOUT_SELETOR_MS }
    );

    const totalLinhas = await page.$$eval("table tbody tr", (linhas) => linhas.length);
    logger.info(`Tabela carregada com ${totalLinhas} linhas.`);

    const cotacoes = await page.evaluate(() => {
      const dados = [];

      document.querySelectorAll("table tbody tr").forEach((row) => {
        const colunas = row.querySelectorAll("td");
        if (colunas.length > 0) {
          dados.push({
            fornecedor: "Coamo Agroindustrial Cooperativa",
            grao: colunas[0]?.innerText.trim(),
            descricao: colunas[1]?.innerText.trim(),
            data_hora: colunas[2]?.innerText.trim(),
            preco: colunas[3]?.innerText.trim(),
            unidade: colunas[4]?.innerText.trim(),
            local: "Campo Mour\u00e3o",
          });
        }
      });

      return dados;
    });

    logger.sucesso(`Cotacoes obtidas com sucesso. Total: ${cotacoes.length}.`);
    return cotacoes;
  } catch (error) {
    logger.erro("Erro ao coletar cotacoes da Coamo.", error);
    throw new AppError("Falha ao coletar cota\u00e7\u00f5es da Coamo", 502, {
      origem: "coamo",
      causa: error.message,
    });
  } finally {
    if (browser) {
      await browser.close();
      logger.info("Navegador encerrado.");
    }
  }
}

module.exports = scrapeCoamo;

async function optimizePageRequests(page) {
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    const type = request.resourceType();
    if (type === "image" || type === "media" || type === "font") {
      request.abort();
      return;
    }

    request.continue();
  });
}

function isTimeoutError(error) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("timeout");
}

async function gotoWithFallback(page, url) {
  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: TIMEOUT_PADRAO_MS });
  } catch (error) {
    if (!isTimeoutError(error)) {
      throw error;
    }

    logger.aviso("Timeout em networkidle2. Tentando domcontentloaded.");
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: TIMEOUT_PADRAO_MS });
  }
}
