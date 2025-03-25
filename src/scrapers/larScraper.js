const puppeteer = require("puppeteer");

async function scrapeLarAgro() {
  try {
    const url = "https://www.lar.ind.br/lar-agro/agricola/#cotacao";
    console.log("Iniciando navegador Puppeteer");
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    // Definindo o user agent
    const userAgent =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3";
    await page.setUserAgent(userAgent);

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
            grao: colunas[1]?.innerText.trim(),
            descricao: "No Data", 
            data_hora: colunas[2]?.innerText.trim(),
            preco: colunas[4]?.innerText.trim(),
            unidade: "SC",
            local: colunas[0]?.innerText.trim()
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

module.exports = scrapeLarAgro;
