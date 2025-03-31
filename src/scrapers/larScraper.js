const puppeteer = require("puppeteer");

async function scrapeLarAgro() {
  try {
    const url = "https://www.lar.ind.br/lar-agro/agricola/#cotacao";
    console.log("Iniciando navegador Puppeteer");
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();

    // Define o user agent
    const userAgent =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3";
    await page.setUserAgent(userAgent);

    console.log("Acessando URL:", url);
    await page.goto(url, { waitUntil: "networkidle2" });

    // Aguarda o menu suspenso aparecer
    await page.waitForSelector('select#cotacao');

    // Seleciona a opção desejada: "UNIDADE CAMPO GRANDE - MS" ou, se não encontrar, a opção 49
    const optionValue = await page.evaluate(() => {
      const select = document.querySelector('select#cotacao');
      if (!select) return null;
      const desiredOption = Array.from(select.options).find(
        option => option.text.toUpperCase().includes("UNIDADE CAMPO GRANDE - MS")
      );
      if (desiredOption) return desiredOption.value;
      if (select.options.length >= 49) return select.options[48].value;
      return null;
    });

    if (!optionValue) {
      console.error("Não foi possível encontrar a opção desejada no menu suspenso.");
      await browser.close();
      return [];
    }

    console.log("Selecionando a opção do menu suspenso:", optionValue);
    await page.select('select#cotacao', optionValue);

    // Aguarda o botão submit e clica nele
    console.log("Buscando botão submit...");
    await page.waitForSelector('form[action*="cotacao"] button[type="submit"]', { timeout: 10000 });
    const botaoSubmit = await page.$('form[action*="cotacao"] button[type="submit"]');
    if (botaoSubmit) {
      console.log("Clicando no botão submit...");
      await botaoSubmit.click();
      // Aguarda a página atualizar após o clique
      await new Promise(resolve => setTimeout(resolve, 3000));
    } else {
      console.warn("Botão submit não encontrado!");
    }

    console.log("Aguardando a tabela carregar...");
    await page.waitForSelector("table tbody", { timeout: 60000 });

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
