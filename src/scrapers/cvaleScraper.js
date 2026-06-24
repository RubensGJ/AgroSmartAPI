const AppError = require("../errors/AppError");
const { criarLogger } = require("../logs/logger");
const { getPuppeteerLaunchOptions, puppeteer } = require("../utils/puppeteer");

const TIMEOUT_PADRAO_MS = Number.parseInt(process.env.SCRAPER_NAV_TIMEOUT_MS, 10) || 90000;
const TIMEOUT_SELETOR_MS = Number.parseInt(process.env.SCRAPER_SELECTOR_TIMEOUT_MS, 10) || 45000;
const logger = criarLogger("SCRAPER-CVALE");

// Abre o site da C.Vale, seleciona o local e devolve as cotacoes encontradas.
async function scrapeCvale() {
  let browser;

  try {
    const url = "https://www.cvale.com.br/site/preco-do-dia";
    logger.info("Iniciando navegador Puppeteer.");

    browser = await puppeteer.launch(getPuppeteerLaunchOptions());

    const page = await browser.newPage();
    await optimizePageRequests(page);

    const userAgent =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    await page.setUserAgent(userAgent);

    logger.info(`Acessando URL: ${url}`);
    await gotoWithFallback(page, url);

    const ok = await selecionarLocal(page);
    if (!ok) {
      throw new AppError("Falha ao selecionar local no formulario da C.Vale", 502, {
        origem: "cvale",
      });
    }

    const indisponivel = await detectarPrecoIndisponivel(page);
    if (indisponivel) {
      throw new AppError(
        "Precos indisponiveis no momento na C.Vale (fora do horario de consulta: 09:00-12:00 e 13:30-15:00)",
        502,
        { origem: "cvale", tipo: "fora_de_horario" }
      );
    }

    logger.info("Aguardando a tabela carregar.");
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
            fornecedor: "C.Vale Cooperativa Agroindustrial",
            grao: colunas[0]?.innerText.trim(),
            descricao: colunas[1]?.innerText.trim(),
            data_hora: colunas[2]?.innerText.trim(),
            preco: colunas[3]?.innerText.trim(),
            unidade: colunas[4]?.innerText.trim(),
            local: "Dourados",
          });
        }
      });

      return dados;
    });

    logger.sucesso(`Cotacoes obtidas com sucesso. Total: ${cotacoes.length}.`);
    return cotacoes;
  } catch (error) {
    logger.erro("Erro ao coletar cotacoes da C.Vale.", error);

    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError("Falha ao coletar cotações da C.Vale", 502, {
      origem: "cvale",
      causa: error.message,
    });
  } finally {
    if (browser) {
      await browser.close();
      logger.info("Navegador encerrado.");
    }
  }
}

module.exports = scrapeCvale;

// Bloqueia recursos pesados da pagina para a coleta ficar mais leve.
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

// Detecta se o erro recebido foi de timeout durante a navegacao.
function isTimeoutError(error) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("timeout");
}

// Tenta carregar a pagina com uma estrategia secundaria se a primeira expirar.
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

// Seleciona o local desejado no dropdown da pagina de precos da C.Vale.
async function selecionarLocal(page, options = {}) {
  const { desiredText = "DOURADOS", fallbackIndex = 0 } = options;

  try {
    await page.waitForSelector("select", { timeout: TIMEOUT_SELETOR_MS });

    const optionValue = await page.evaluate(
      (desiredTextLocal, fallbackIdx) => {
        const selects = document.querySelectorAll("select");
        const select = selects.length > 0 ? selects[0] : null;
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

    logger.info(`Selecionando local: ${desiredText} (valor: ${optionValue})`);

    const selectSelector = await page.evaluate(() => {
      const selects = document.querySelectorAll("select");
      if (selects.length === 0) return null;
      const select = selects[0];
      if (select.id) return `select#${select.id}`;
      if (select.name) return `select[name="${select.name}"]`;
      return "select";
    });

    if (!selectSelector) {
      logger.erro("Nao foi possivel identificar o seletor do dropdown.");
      return false;
    }

    await page.select(selectSelector, optionValue);

    // Aguarda a pagina reagir a mudanca de local.
    await page.waitForFunction(
      () => {
        const loading = document.querySelector(".loading, .spinner, [class*='loading']");
        return !loading || loading.offsetParent === null;
      },
      { timeout: TIMEOUT_SELETOR_MS }
    );

    // Tempo extra para o conteudo dinamico carregar apos a troca de local.
    await new Promise((resolve) => setTimeout(resolve, 2000));

    logger.info("Local selecionado com sucesso.");
    return true;
  } catch (err) {
    logger.erro("Erro em selecionarLocal.", err);
    return false;
  }
}

// Verifica se a pagina mostra a mensagem de precos indisponiveis.
async function detectarPrecoIndisponivel(page) {
  const conteudo = await page.content();
  const textoNormalizado = conteudo.toLowerCase();

  if (textoNormalizado.includes("indispon")) {
    logger.aviso("Pagina indica precos indisponiveis no momento.");
    return true;
  }

  // Verifica se existe tabela com dados.
  const temTabela = await page.evaluate(() => {
    const tbody = document.querySelector("table tbody");
    if (!tbody) return false;
    return tbody.querySelectorAll("tr").length > 0;
  });

  if (!temTabela) {
    logger.aviso("Nenhuma tabela com dados encontrada na pagina.");
    return true;
  }

  return false;
}
