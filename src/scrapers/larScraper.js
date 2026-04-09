const puppeteer = require("puppeteer");
const AppError = require("../errors/AppError");
const { criarLogger } = require("../logs/logger");

const TIMEOUT_PADRAO_MS = Number.parseInt(process.env.SCRAPER_NAV_TIMEOUT_MS, 10) || 90000;
const TIMEOUT_SELETOR_MS = Number.parseInt(process.env.SCRAPER_SELECTOR_TIMEOUT_MS, 10) || 45000;
const logger = criarLogger("SCRAPER-LAR");

function parseBoolean(value, defaultValue = true) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  const normalized = String(value).toLowerCase().trim();
  return ["1", "true", "yes", "y", "on"].includes(normalized);
}

async function scrapeLarAgro() {
  let browser;

  try {
    const url = "https://www.lar.ind.br/lar-agro/agricola/#cotacao";
    logger.info("Iniciando navegador Puppeteer.");

    browser = await puppeteer.launch({
      headless: parseBoolean(process.env.PUPPETEER_HEADLESS, true),
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    const page = await browser.newPage();
    await optimizePageRequests(page);

    const userAgent =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    await page.setUserAgent(userAgent);

    logger.info(`Acessando URL: ${url}`);
    await gotoWithFallback(page, url);

    const bloqueado = await detectarPaginaBloqueada(page);
    if (bloqueado) {
      throw new AppError("Acesso bloqueado no provedor da LAR", 503, {
        origem: "lar",
        tipo: "bloqueio_akamai",
      });
    }

    const ok = await selectCotacaoAndSubmit(page);
    if (!ok) {
      throw new AppError("Falha ao preencher formulario da LAR", 502, { origem: "lar" });
    }

    logger.info("Aguardando a tabela carregar.");
    await page.waitForSelector("table tbody", { timeout: TIMEOUT_SELETOR_MS });
    await page.waitForFunction(() => document.querySelectorAll("table tbody tr").length > 0, {
      timeout: TIMEOUT_SELETOR_MS,
    });

    const cotacoes = await page.evaluate(() => {
      const dados = [];
      document.querySelectorAll("table tbody tr").forEach((row) => {
        const colunas = row.querySelectorAll("td");
        if (colunas.length > 0) {
          dados.push({
            fornecedor: "Lar Agro",
            grao: colunas[1]?.innerText.trim(),
            descricao: "Sem descricao",
            data_hora: colunas[2]?.innerText.trim(),
            preco: colunas[3]?.innerText.trim(),
            unidade: "SC",
            local: colunas[0]?.innerText.trim(),
          });
        }
      });
      return dados;
    });

    logger.sucesso(`Cotacoes obtidas com sucesso. Total: ${cotacoes.length}.`);
    return cotacoes;
  } catch (error) {
    logger.erro("Erro ao coletar cotacoes da LAR.", error);

    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError("Falha ao coletar cotacoes da LAR", 502, {
      origem: "lar",
      causa: error.message,
    });
  } finally {
    if (browser) {
      await browser.close();
      logger.info("Navegador encerrado.");
    }
  }
}

module.exports = scrapeLarAgro;
module.exports.selectCotacaoAndSubmit = selectCotacaoAndSubmit;

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

async function detectarPaginaBloqueada(page) {
  const urlAtual = page.url() || "";
  if (urlAtual.includes("errors.edgesuite.net")) {
    return true;
  }

  const titulo = (await page.title()) || "";
  if (titulo.toLowerCase().includes("an error occurred while processing your request")) {
    return true;
  }

  const conteudo = await page.content();
  return conteudo.includes("errors.edgesuite.net");
}

async function selectCotacaoAndSubmit(page, options = {}) {
  const { desiredText = "UNIDADE CAMPO GRANDE - MS", fallbackIndex = 48 } = options;

  try {
    await page.waitForSelector("select#cotacao", { timeout: TIMEOUT_SELETOR_MS });

    const optionValue = await page.evaluate(
      (desiredTextLocal, fallbackIdx) => {
        const select = document.querySelector("select#cotacao");
        if (!select) return null;

        const desiredOption = Array.from(select.options).find((option) =>
          option.text.toUpperCase().includes(desiredTextLocal.toUpperCase())
        );

        if (desiredOption) return desiredOption.value;
        if (select.options.length > fallbackIdx) return select.options[fallbackIdx].value;
        return null;
      },
      desiredText,
      fallbackIndex
    );

    if (!optionValue) {
      logger.erro("Nao foi possivel encontrar a opcao desejada no menu suspenso.");
      return false;
    }

    logger.info(`Selecionando opcao do menu suspenso: ${optionValue}`);
    await page.select("select#cotacao", optionValue);

    const hoje = new Date();
    const dd = String(hoje.getDate()).padStart(2, "0");
    const mm = String(hoje.getMonth() + 1).padStart(2, "0");
    const yyyy = hoje.getFullYear();
    const dataStr = `${dd}/${mm}/${yyyy}`;

    const filled = await page.evaluate((dataValue) => {
      const input = document.querySelector("#dtb_yr");
      if (!input) return false;

      input.focus();
      input.value = dataValue;

      const evInput = new Event("input", { bubbles: true });
      const evChange = new Event("change", { bubbles: true });
      input.dispatchEvent(evInput);
      input.dispatchEvent(evChange);
      return true;
    }, dataStr);

    if (!filled) {
      logger.aviso("Campo #dtb_yr nao encontrado; prosseguindo sem preencher.");
    } else {
      logger.info(`Campo #dtb_yr preenchido com: ${dataStr}`);
    }

    logger.info("Buscando botao de envio.");
    await page.waitForSelector("form[action*='cotacao'] button[type='submit']", {
      timeout: TIMEOUT_SELETOR_MS,
    });

    const botaoSubmit = await page.$("form[action*='cotacao'] button[type='submit']");
    if (!botaoSubmit) {
      logger.aviso("Botao de envio nao encontrado.");
      return false;
    }

    logger.info("Clicando no botao de envio.");
    await botaoSubmit.click();
    return true;
  } catch (err) {
    logger.erro("Erro em selectCotacaoAndSubmit.", err);
    return false;
  }
}
