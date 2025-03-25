const puppeteer = require("puppeteer");

async function scrapeCoamo() {
  try {
    const url = "https://www.coamo.com.br/preco-do-dia/";
    console.log("Iniciando navegador Puppeteer");
    const browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();

    console.log("Acessando URL:", url);
    await page.goto(url, { waitUntil: "networkidle2" });
    await page.waitForSelector("table tbody");

    const cotacoes = await page.evaluate(() => {
      let dados = [];
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
            local:"Campo Mourão",
            
          });
        }
      });
      return dados;
    });

    await browser.close();
    console.log("Cotações obtidas:", cotacoes);
    return cotacoes;
  } catch (error) {
    console.error("Erro ao coletar cotações da Coamo:", error);
    return [];
  }
}

module.exports = scrapeCoamo;
