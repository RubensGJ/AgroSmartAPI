const puppeteer = require("puppeteer");
const AppError = require("../errors/AppError");

const LOG_PREFIX = "[LAR]";
const TIMEOUT_PADRAO_MS = 30000;

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
    console.log(`${LOG_PREFIX} Iniciando navegador Puppeteer`);

    browser = await puppeteer.launch({
      headless: parseBoolean(process.env.PUPPETEER_HEADLESS, true),
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    const page = await browser.newPage();

    // Define o user agent para simular navegador comum.
    const userAgent =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    await page.setUserAgent(userAgent);

    console.log(`${LOG_PREFIX} Acessando URL:`, url);
    await page.goto(url, { waitUntil: "networkidle2", timeout: TIMEOUT_PADRAO_MS });

    const bloqueado = await detectarPaginaBloqueada(page);
    if (bloqueado) {
      throw new AppError("Acesso bloqueado no provedor da LAR", 503, {
        origem: "lar",
        tipo: "bloqueio_akamai",
      });
    }

    const ok = await selectCotacaoAndSubmit(page);
    if (!ok) {
      throw new AppError("Falha ao preencher formulário da LAR", 502, { origem: "lar" });
    }

    console.log(`${LOG_PREFIX} Aguardando a tabela carregar...`);
    await page.waitForSelector("table tbody", { timeout: TIMEOUT_PADRAO_MS });
    await page.waitForFunction(
      () => document.querySelectorAll("table tbody tr").length > 0,
      { timeout: TIMEOUT_PADRAO_MS }
    );

    const cotacoes = await page.evaluate(() => {
      const dados = [];
      document.querySelectorAll("table tbody tr").forEach((row) => {
        const colunas = row.querySelectorAll("td");
        if (colunas.length > 0) {
          dados.push({
            fornecedor: "Lar Agro",
            grao: colunas[1]?.innerText.trim(),
            descricao: "Sem descrição",
            data_hora: colunas[2]?.innerText.trim(),
            preco: colunas[3]?.innerText.trim(),
            unidade: "SC",
            local: colunas[0]?.innerText.trim(),
          });
        }
      });
      return dados;
    });

    console.log(`${LOG_PREFIX} Cotações obtidas:`, cotacoes);
    return cotacoes;
  } catch (error) {
    console.error(`${LOG_PREFIX} Erro ao coletar cotações da LAR:`, error);

    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError("Falha ao coletar cotações da LAR", 502, {
      origem: "lar",
      causa: error.message,
    });
  } finally {
    if (browser) {
      await browser.close();
      console.log(`${LOG_PREFIX} Navegador encerrado`);
    }
  }
}

module.exports = scrapeLarAgro;
// Exporta também a função auxiliar para testes/reuso.
module.exports.selectCotacaoAndSubmit = selectCotacaoAndSubmit;

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
    // Aguarda o menu suspenso carregar para selecionar a unidade.
    await page.waitForSelector("select#cotacao", { timeout: TIMEOUT_PADRAO_MS });

    const optionValue = await page.evaluate((desiredTextLocal, fallbackIdx) => {
      const select = document.querySelector("select#cotacao");
      if (!select) return null;

      const desiredOption = Array.from(select.options).find((option) =>
        option.text.toUpperCase().includes(desiredTextLocal.toUpperCase())
      );

      if (desiredOption) return desiredOption.value;
      if (select.options.length > fallbackIdx) return select.options[fallbackIdx].value;
      return null;
    }, desiredText, fallbackIndex);

    if (!optionValue) {
      console.error(`${LOG_PREFIX} Não foi possível encontrar a opção desejada no menu suspenso.`);
      return false;
    }

    console.log(`${LOG_PREFIX} Selecionando opção do menu suspenso:`, optionValue);
    await page.select("select#cotacao", optionValue);

    // Preenche a data de referência no formato DD/MM/AAAA.
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
      console.warn(`${LOG_PREFIX} Campo #dtb_yr não encontrado; prosseguindo sem preencher.`);
    } else {
      console.log(`${LOG_PREFIX} Campo #dtb_yr preenchido com:`, dataStr);
    }

    console.log(`${LOG_PREFIX} Buscando botão de envio...`);
    await page.waitForSelector("form[action*='cotacao'] button[type='submit']", {
      timeout: TIMEOUT_PADRAO_MS,
    });

    const botaoSubmit = await page.$("form[action*='cotacao'] button[type='submit']");
    if (!botaoSubmit) {
      console.warn(`${LOG_PREFIX} Botão de envio não encontrado.`);
      return false;
    }

    console.log(`${LOG_PREFIX} Clicando no botão de envio...`);
    await botaoSubmit.click();
    return true;
  } catch (err) {
    console.error(`${LOG_PREFIX} Erro em selectCotacaoAndSubmit:`, err);
    return false;
  }
}
