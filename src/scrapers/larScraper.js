const puppeteer = require("puppeteer");

async function scrapeLarAgro() {
  try {
    const url = "https://www.lar.ind.br/lar-agro/agricola/#cotacao";
    console.log("Iniciando navegador Puppeteer");
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: puppeteer.executablePath() // Use o caminho do Chrome instalado pelo Puppeteer
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
            fornecedor: "Lar Agro",
            grao: colunas[0]?.innerText.trim(),
            descricao: colunas[1]?.innerText.trim(),
            data_hora: colunas[2]?.innerText.trim(),
            preco: colunas[3]?.innerText.trim(),
            unidade: colunas[4]?.innerText.trim(),
          });
        }
      });
      return dados;
    });

    await browser.close();
    console.log("Cotações obtidas:", cotacoes);
    return cotacoes;
  } catch (error) {
    console.error("Erro ao coletar cotações da Lar Agro:", error);
    return [];
  }
}

module.exports = scrapeLarAgro;