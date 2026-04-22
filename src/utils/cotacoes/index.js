// Reexporta os utilitarios de cotacoes em um unico ponto de importacao.
module.exports = {
  ...require("./normalization"),
  ...require("./filtering"),
  ...require("./reporting"),
};
