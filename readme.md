# API de Cotação de Grãos

Este projeto é uma API que busca cotações de grãos no site da Coamo e retorna os dados em formato JSON.

## Pré-requisitos

- Node.js
- npm

## Instalação

1. Clone o repositório:
    ```sh
    git clone <URL_DO_REPOSITORIO>
    cd api-cotacao-graos
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

### GET /cotacoes

Busca as cotações de grãos no site da Coamo e retorna os dados em formato JSON.

#### Exemplo de resposta:
```json
[
    {
        "grao": "Soja",
        "descricao": "Soja Convencional",
        "data_hora": "21/03/2025 10:00",
        "preco": "R$ 150,00",
        "unidade": "saca"
    },
    {
        "grao": "Milho",
        "descricao": "Milho Convencional",
        "data_hora": "21/03/2025 10:00",
        "preco": "R$ 70,00",
        "unidade": "saca"
    }
]
```

## Estrutura do Projeto

- `server.js`: Arquivo principal que contém a lógica da API.
- `package.json`: Arquivo de configuração do npm que lista as dependências do projeto.
- `.gitignore`: Arquivo que especifica quais arquivos e diretórios devem ser ignorados pelo Git.

## Dependências

- `express`: Framework web para Node.js.
- `puppeteer`: Biblioteca para controle de navegadores headless.
- `axios`: Cliente HTTP para fazer requisições.
- `cheerio`: Biblioteca para manipulação de HTML.
- `dotenv`: Biblioteca para carregar variáveis de ambiente de um arquivo `.env`.

## Licença

Este projeto está licenciado sob a licença ISC.