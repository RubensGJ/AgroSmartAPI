function getTimestamp() {
  return new Date().toISOString();
}

function getMensagemErro(error) {
  if (!error) {
    return "";
  }

  if (error.stack) {
    return error.stack;
  }

  if (error.message) {
    return error.message;
  }

  return String(error);
}

function escrever(nivel, contexto, mensagem, error = null) {
  const linha = `[${getTimestamp()}] [${nivel}] [${contexto}] ${mensagem}`;
  const detalheErro = getMensagemErro(error);

  if (nivel === "ERRO") {
    console.error(linha);

    if (detalheErro) {
      console.error(detalheErro);
    }
  } else if (nivel === "AVISO") {
    console.warn(linha);
  } else {
    console.log(linha);
  }
}

function criarLogger(contexto) {
  return {
    info(mensagem) {
      escrever("INFO", contexto, mensagem);
    },

    aviso(mensagem) {
      escrever("AVISO", contexto, mensagem);
    },

    sucesso(mensagem) {
      escrever("SUCESSO", contexto, mensagem);
    },

    erro(mensagem, error = null) {
      escrever("ERRO", contexto, mensagem, error);
    },
  };
}

module.exports = { criarLogger };
