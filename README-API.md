# AgroSmart API - Documentação

## Descrição
API para coleta e consulta de cotações de grãos de cooperativas agrícolas (Coamo e LAR). A API utiliza web scraping para obter dados atualizados dos sites oficiais das cooperativas.

## Base URL
```
http://localhost:3000/api
```

## Endpoints Disponíveis

### 1. Cotações Coamo
Retorna as cotações atuais da Coamo Agroindustrial Cooperativa.

```
GET /cotacoes/coamo
```

#### Resposta
```json
[
  {
    "fornecedor": "Coamo Agroindustrial Cooperativa",
    "grao": "SOJA DISPONÍVEL",
    "descricao": "60 KG",
    "data_hora": "25/09/2025 08:00",
    "preco": "R$ 150,00",
    "unidade": "SC",
    "local": "Campo Mourão"
  }
  // ... outros itens
]
```

### 2. Cotações LAR
Retorna as cotações atuais da Cooperativa LAR.

```
GET /cotacoes/lar
```

#### Resposta
```json
[
  {
    "fornecedor": "Cooperativa LAR",
    "grao": "MILHO",
    "descricao": "60 KG",
    "data_hora": "25/09/2025 08:00",
    "preco": "R$ 45,00",
    "unidade": "SC",
    "local": "Medianeira"
  }
  // ... outros itens
]
```

### 3. Todas as Cotações
Retorna as cotações de todas as cooperativas em um único endpoint.

```
GET /cotacoes/todos
```

#### Resposta
```json
{
  "coamo": [
    {
      "fornecedor": "Coamo Agroindustrial Cooperativa",
      "grao": "SOJA DISPONÍVEL",
      "descricao": "60 KG",
      "data_hora": "25/09/2025 08:00",
      "preco": "R$ 150,00",
      "unidade": "SC",
      "local": "Campo Mourão"
    }
    // ... outros itens
  ],
  "larAgro": [
    {
      "fornecedor": "Cooperativa LAR",
      "grao": "MILHO",
      "descricao": "60 KG",
      "data_hora": "25/09/2025 08:00",
      "preco": "R$ 45,00",
      "unidade": "SC",
      "local": "Medianeira"
    }
    // ... outros itens
  ]
}
```

## Cache e Performance

A API implementa um sistema de cache em memória para otimizar o desempenho e reduzir a carga nos servidores das cooperativas:

- Cache TTL: 5 minutos
- Os dados são armazenados em memória
- Novas requisições dentro do período de TTL retornam dados do cache
- Após expirar o TTL, uma nova consulta aos sites é realizada

## Códigos de Erro

- **200**: Sucesso
- **500**: Erro interno do servidor
  ```json
  {
    "error": "Erro ao obter cotações da Coamo"
  }
  ```

## Instalação e Execução Local

1. Clone o repositório:
```bash
git clone https://github.com/RubensGJ/AgroSmartAPI.git
cd AgroSmartAPI
```

2. Instale as dependências:
```bash
npm install
```

3. Execute o servidor:
```bash
node src/app.js
```

O servidor iniciará na porta 3000 por padrão (http://localhost:3000).

## Dependências Principais

- Express.js: Framework web
- Puppeteer: Web scraping
- CORS: Habilitado para todas as origens

## Recomendações de Uso

1. **Rate Limiting**
   - Evite fazer mais de 1 requisição por minuto para o mesmo endpoint
   - Use o endpoint `/todos` quando precisar de dados de múltiplas cooperativas

2. **Cache**
   - O cache interno tem duração de 5 minutos
   - Implemente cache no seu cliente para reduzir requisições

3. **Tratamento de Erros**
   - Sempre implemente tratamento de erros no cliente
   - Considere implementar retry com backoff em caso de falhas

4. **Ambiente de Produção**
   - Configure um proxy reverso (nginx/apache)
   - Implemente rate limiting no servidor
   - Configure CORS adequadamente para seus domínios
   - Use HTTPS em produção

## Limitações Conhecidas

1. **Disponibilidade**
   - O serviço depende da disponibilidade dos sites das cooperativas
   - Mudanças no layout dos sites podem afetar o scraping

2. **Precisão**
   - Os dados são atualizados conforme disponibilidade nos sites
   - O timestamp indica quando o dado foi coletado

3. **Performance**
   - Primeira requisição após cache expirar pode ser mais lenta
   - Web scraping é naturalmente mais lento que APIs nativas

## Exemplos de Integração com React

### Instalação no Projeto React

1. Instale o Axios (opcional, mas recomendado para requisições HTTP):
```bash
npm install axios
```

2. Configure a URL base no seu projeto:
```javascript
// src/services/api.js
import axios from 'axios';

export const api = axios.create({
  baseURL: 'http://localhost:3000/api',
});
```

### Exemplo 1: Hook Personalizado
```javascript
// src/hooks/useCotacoes.js
import { useState, useEffect } from 'react';
import { api } from '../services/api';

export function useCotacoes() {
  const [cotacoes, setCotacoes] = useState({ coamo: [], larAgro: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchCotacoes() {
      try {
        setLoading(true);
        const response = await api.get('/cotacoes/todos');
        setCotacoes(response.data);
        setError(null);
      } catch (err) {
        setError('Erro ao carregar cotações');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchCotacoes();
    // Atualiza a cada 5 minutos
    const interval = setInterval(fetchCotacoes, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return { cotacoes, loading, error };
}
```

### Exemplo 2: Componente Funcional com Hook
```javascript
// src/components/TabelaCotacoes.js
import React from 'react';
import { useCotacoes } from '../hooks/useCotacoes';

export function TabelaCotacoes() {
  const { cotacoes, loading, error } = useCotacoes();

  if (loading) return <div>Carregando...</div>;
  if (error) return <div>Erro: {error}</div>;

  return (
    <div>
      <h2>Cotações Coamo</h2>
      <table>
        <thead>
          <tr>
            <th>Grão</th>
            <th>Preço</th>
            <th>Data/Hora</th>
            <th>Local</th>
          </tr>
        </thead>
        <tbody>
          {cotacoes.coamo.map((item, index) => (
            <tr key={index}>
              <td>{item.grao}</td>
              <td>{item.preco}</td>
              <td>{item.data_hora}</td>
              <td>{item.local}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### Exemplo 3: Componente de Classe
```javascript
// src/components/CotacoesContainer.js
import React, { Component } from 'react';
import { api } from '../services/api';

class CotacoesContainer extends Component {
  state = {
    cotacoesCoamo: [],
    loading: true,
    error: null,
  };

  componentDidMount() {
    this.fetchCotacoesCoamo();
  }

  fetchCotacoesCoamo = async () => {
    try {
      const response = await api.get('/cotacoes/coamo');
      this.setState({ 
        cotacoesCoamo: response.data,
        loading: false,
      });
    } catch (error) {
      this.setState({ 
        error: 'Falha ao carregar dados',
        loading: false,
      });
    }
  };

  render() {
    const { cotacoesCoamo, loading, error } = this.state;

    if (loading) return <div>Carregando...</div>;
    if (error) return <div>{error}</div>;

    return (
      <div>
        <h2>Cotações Coamo</h2>
        {cotacoesCoamo.map((cotacao, index) => (
          <div key={index} className="cotacao-card">
            <h3>{cotacao.grao}</h3>
            <p>Preço: {cotacao.preco}</p>
            <p>Local: {cotacao.local}</p>
            <p>Atualizado em: {cotacao.data_hora}</p>
          </div>
        ))}
      </div>
    );
  }
}

export default CotacoesContainer;
```

### Exemplo 4: Context API para Cotações Globais
```javascript
// src/contexts/CotacoesContext.js
import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { api } from '../services/api';

const CotacoesContext = createContext();

const initialState = {
  dados: { coamo: [], larAgro: [] },
  loading: true,
  error: null,
};

function cotacoesReducer(state, action) {
  switch (action.type) {
    case 'FETCH_START':
      return { ...state, loading: true };
    case 'FETCH_SUCCESS':
      return { 
        dados: action.payload,
        loading: false,
        error: null,
      };
    case 'FETCH_ERROR':
      return {
        ...state,
        loading: false,
        error: action.payload,
      };
    default:
      return state;
  }
}

export function CotacoesProvider({ children }) {
  const [state, dispatch] = useReducer(cotacoesReducer, initialState);

  useEffect(() => {
    async function fetchData() {
      dispatch({ type: 'FETCH_START' });
      try {
        const response = await api.get('/cotacoes/todos');
        dispatch({ 
          type: 'FETCH_SUCCESS',
          payload: response.data,
        });
      } catch (error) {
        dispatch({ 
          type: 'FETCH_ERROR',
          payload: 'Erro ao carregar cotações',
        });
      }
    }

    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <CotacoesContext.Provider value={state}>
      {children}
    </CotacoesContext.Provider>
  );
}

// Hook personalizado para usar o contexto
export function useCotacoesContext() {
  const context = useContext(CotacoesContext);
  if (!context) {
    throw new Error('useCotacoesContext deve ser usado dentro de um CotacoesProvider');
  }
  return context;
}
```

### Uso do Context no App
```javascript
// src/App.js
import { CotacoesProvider } from './contexts/CotacoesContext';
import { TabelaCotacoes } from './components/TabelaCotacoes';

function App() {
  return (
    <CotacoesProvider>
      <div className="App">
        <h1>Sistema de Cotações</h1>
        <TabelaCotacoes />
      </div>
    </CotacoesProvider>
  );
}
```

### Boas Práticas de Integração

1. **Gestão de Estado**
   - Use Context API para dados globais
   - Implemente cache local com localStorage/sessionStorage
   - Considere bibliotecas como React Query ou SWR para cache e revalidação

2. **Tratamento de Erros**
   - Implemente retry em caso de falhas
   - Mostre feedback visual de loading/erro
   - Use toast/snackbar para notificações

3. **Performance**
   - Implemente debounce em atualizações frequentes
   - Use React.memo() para componentes que recebem muitos dados
   - Considere virtualização para listas longas (react-window)

4. **UX**
   - Mostre timestamp da última atualização
   - Adicione botão de atualização manual
   - Implemente loading states informativos

## Suporte e Contribuição

Para reportar bugs ou sugerir melhorias:
1. Abra uma issue no GitHub
2. Descreva o problema/sugestão detalhadamente
3. Inclua exemplos de código quando relevante

## Licença

MIT - Veja o arquivo LICENSE para detalhes.