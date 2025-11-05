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

    // Usa a função auxiliar 
    const ok = await selectCotacaoAndSubmit(page);
    if (!ok) {
      await browser.close();
      return [];
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
            preco: colunas[3]?.innerText.trim(),
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
// exporta também a função auxiliar para testes/reuso
module.exports.selectCotacaoAndSubmit = selectCotacaoAndSubmit;

// Função extraída para selecionar a cotação, preencher a data e submeter o formulário
async function selectCotacaoAndSubmit(page, options = {}) {
  const { desiredText = 'UNIDADE CAMPO GRANDE - MS', fallbackIndex = 48 } = options;
  try {
    // Aguarda o menu suspenso aparecer
    await page.waitForSelector('select#cotacao', { timeout: 15000 });

    // Determina o value da opção a ser selecionada
    const optionValue = await page.evaluate((desiredTextLocal, fallbackIdx) => {
      const select = document.querySelector('select#cotacao');
      if (!select) return null;
      const desiredOption = Array.from(select.options).find(
        option => option.text.toUpperCase().includes(desiredTextLocal.toUpperCase())
      );
      if (desiredOption) return desiredOption.value;
      if (select.options.length > fallbackIdx) return select.options[fallbackIdx].value;
      return null;
    }, desiredText, fallbackIndex);

    if (!optionValue) {
      console.error('Não foi possível encontrar a opção desejada no menu suspenso.');
      return false;
    }

    console.log('Selecionando a opção do menu suspenso:', optionValue);
    await page.select('select#cotacao', optionValue);

    // Preenche o campo de data #dtb_yr com a data de hoje (formato DD/MM/YYYY)
    const hoje = new Date();
    const dd = String(hoje.getDate()).padStart(2, '0');
    const mm = String(hoje.getMonth() + 1).padStart(2, '0');
    const yyyy = hoje.getFullYear();
    const dataStr = `${dd}/${mm}/${yyyy}`;

    const filled = await page.evaluate((dataValue) => {
      const input = document.querySelector('#dtb_yr');
      if (!input) return false;
      input.focus();
      input.value = dataValue;
      // dispara eventos para frameworks que escutam mudanças
      const evInput = new Event('input', { bubbles: true });
      const evChange = new Event('change', { bubbles: true });
      input.dispatchEvent(evInput);
      input.dispatchEvent(evChange);
      return true;
    }, dataStr);

    if (!filled) {
      console.warn('Campo de data #dtb_yr não encontrado; prosseguindo sem preenchê-lo.');
    } else {
      console.log('Campo #dtb_yr preenchido com:', dataStr);
    }

    // Aguarda o botão submit e clica nele
    console.log('Buscando botão submit...');
    await page.waitForSelector('form[action*="cotacao"] button[type="submit"]', { timeout: 10000 });
    const botaoSubmit = await page.$('form[action*="cotacao"] button[type="submit"]');
    if (botaoSubmit) {
      console.log('Clicando no botão submit...');
      await botaoSubmit.click();
      // Aguarda a página atualizar após o clique
      return true;
    } else {
      console.warn('Botão submit não encontrado!');
      return false;
    }
  } catch (err) {
    console.error('Erro em selectCotacaoAndSubmit:', err);
    return false;
  }
}
