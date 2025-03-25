# API de Cotação de Grãos

Este projeto é uma API que busca cotações de grãos nos sites da Coamo e Lar Agro, retornando os dados em formato JSON.

## Pré-requisitos

- Node.js
- npm

## Instalação

1. Clone o repositório:
    ```sh
    git clone <URL_DO_REPOSITORIO>
    cd AgroSmartAPI
    ```

2. Instale as dependências:
    ```sh
    npm install
    ```

3. Crie um arquivo `.env` na raiz do projeto e adicione suas variáveis de ambiente, se necessário.

## Uso

1. Inicie o servidor:
    ```sh
    npm start
    ```

2. Acesse a API em `http://localhost:3000`.

## Endpoints

### GET /

Retorna uma mensagem indicando que a API está funcionando.

### GET /api/cotacoes/coamo

Busca as cotações de grãos no site da Coamo e retorna os dados em formato JSON.

#### Exemplo de resposta:
```json
[
    {
        "fornecedor": "Coamo Agroindustrial Cooperativa",
        "grao": "Soja",
        "descricao": "Soja Convencional",
        "data_hora": "21/03/2025 10:00",
        "preco": "R$ 150,00",
        "unidade": "saca",
        "local": "Campo Mourão"
    },
    {
        "fornecedor": "Coamo Agroindustrial Cooperativa",
        "grao": "Milho",
        "descricao": "Milho Convencional",
        "data_hora": "21/03/2025 10:00",
        "preco": "R$ 70,00",
        "unidade": "saca",
        "local": "Campo Mourão"
    }
]
```

### GET /api/cotacoes/lar

Busca as cotações de grãos no site da Lar Agro e retorna os dados em formato JSON.

#### Exemplo de resposta:

```json
[
    {
        "fornecedor": "Lar Agro",
        "grao": "Soja",
        "descricao": "No Data",
        "data_hora": "21/03/2025 10:00",
        "preco": "R$ 150,00",
        "unidade": "SC",
        "local": "Campo Mourão"
    },
    {
        "fornecedor": "Lar Agro",
        "grao": "Milho",
        "descricao": "No Data",
        "data_hora": "21/03/2025 10:00",
        "preco": "R$ 70,00",
        "unidade": "SC",
        "local": "Campo Mourão"
    }
]
```

### GET /api/cotacoes/todos

Executa ambos os scrapers (Coamo e Lar Agro) em paralelo e retorna os dados combinados em formato JSON.

#### Exemplo de resposta:

```json
{
    "coamo": [
        {
            "fornecedor": "Coamo Agroindustrial Cooperativa",
            "grao": "Soja",
            "descricao": "Soja Convencional",
            "data_hora": "21/03/2025 10:00",
            "preco": "R$ 150,00",
            "unidade": "saca",
            "local": "Campo Mourão"
        },
        {
            "fornecedor": "Coamo Agroindustrial Cooperativa",
            "grao": "Milho",
            "descricao": "Milho Convencional",
            "data_hora": "21/03/2025 10:00",
            "preco": "R$ 70,00",
            "unidade": "saca",
            "local": "Campo Mourão"
        }
    ],
    "larAgro": [
        {
            "fornecedor": "Lar Agro",
            "grao": "Soja",
            "descricao": "No Data",
            "data_hora": "21/03/2025 10:00",
            "preco": "R$ 150,00",
            "unidade": "SC",
            "local": "Campo Mourão"
        },
        {
            "fornecedor": "Lar Agro",
            "grao": "Milho",
            "descricao": "No Data",
            "data_hora": "21/03/2025 10:00",
            "preco": "R$ 70,00",
            "unidade": "SC",
            "local": "Campo Mourão"
        }
    ]
}
```

### Estrutura do Projeto

- src/app.js: Arquivo principal que contém a lógica da API.
- src/routes/cotacoesRoutes.js: Arquivo que define as rotas da API.
- src/scrapers/coamoScraper.js: Arquivo que contém o scraper para o site da Coamo.
- src/scrapers/larScraper.js: Arquivo que contém o scraper para o site da Lar Agro.
- package.json: Arquivo de configuração do npm que lista as dependências do projeto.
- .gitignore: Arquivo que especifica quais arquivos e diretórios devem ser ignorados pelo Git.

### Dependências

- express: Framework web para Node.js.
- puppeteer: Biblioteca para controle de navegadores headless.
- axios: Cliente HTTP para fazer requisições.
- cheerio: Biblioteca para manipulação de HTML.
- dotenv: Biblioteca para carregar variáveis de ambiente de um arquivo .env.
- cors: Middleware para habilitar CORS (Cross-Origin Resource Sharing).

### Licença

Não sei sobre isso kkkkkkkk essa API pode facilmente ser ilegal;