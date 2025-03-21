const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
const port = 3000;

app.use(express.json());

app.get('/', (req, res) => {
    res.send('API de Cotação de Grãos funcionando!');
});

app.get('/cotacoes', async (req, res) => {
    try {
        const url = 'https://www.coamo.com.br/preco-do-dia/';

        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();

        await page.goto(url, { waitUntil: 'networkidle2' });

        await page.waitForSelector('table tbody');

        const cotacoes = await page.evaluate(() => {
            let dados = [];
            document.querySelectorAll('table tbody tr').forEach(row => {
                const colunas = row.querySelectorAll('td');
                if (colunas.length > 0) {
                    dados.push({
                        grao: colunas[0]?.innerText.trim(),
                        descricao: colunas[1]?.innerText.trim(),
                        data_hora: colunas[2]?.innerText.trim(),
                        preco: colunas[3]?.innerText.trim(),
                        unidade: colunas[4]?.innerText.trim()
                    });
                }
            });
            return dados;
        });

        await browser.close();
        res.json(cotacoes);
    } catch (error) {
        console.error("Erro ao buscar cotações:", error);
        res.status(500).json({ erro: "Erro ao buscar cotações" });
    }
});

app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});
