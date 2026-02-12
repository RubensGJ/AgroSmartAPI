const puppeteer = require("puppeteer");

const LOG_PREFIX = "[COAMO]";

async function scrapeCoamo() {
  let browser;

  try {
    const url = "https://www.coamo.com.br/preco-do-dia/";
    console.log(`${LOG_PREFIX} Iniciando navegador Puppeteer`);

    browser = await puppeteer.launch({
      headless: false,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();

    console.log(`${LOG_PREFIX} Acessando URL:`, url);
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

    await page.waitForSelector("table tbody", { timeout: 30000 });
    await page.waitForFunction(
      () => document.querySelectorAll("table tbody tr").length > 0,
      { timeout: 30000 }
    );

    const totalLinhas = await page.$$eval("table tbody tr", (linhas) => linhas.length);
    console.log(`${LOG_PREFIX} Tabela carregada com ${totalLinhas} linhas`);

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
            local: "Campo Mourao",
          });
        }
      });

      return dados;
    });

    console.log(`${LOG_PREFIX} Cotacoes obtidas:`, cotacoes);
    return cotacoes;
  } catch (error) {
    console.error(`${LOG_PREFIX} Erro ao coletar cotacoes da Coamo:`, error);
    return [];
  } finally {
    if (browser) {
      await browser.close();
      console.log(`${LOG_PREFIX} Navegador encerrado`);
    }
  }
}

module.exports = scrapeCoamo;
