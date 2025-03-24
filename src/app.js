const express = require('express');
const cors = require('cors');
const cotacoesRoutes = require('./routes/cotacoesRoutes');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api/cotacoes', cotacoesRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
