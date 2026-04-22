const { enrichQuotes, filterQuotes, findHighestPriceQuote, sanitizeQuote } = require("./filtering");

// Monta o objeto de resposta usado no comparativo entre Coamo e LAR.
function buildComparison(bestCoamo, bestLar, filters = {}) {
  const coamoPrice = bestCoamo?.precoNumerico ?? null;
  const larPrice = bestLar?.precoNumerico ?? null;
  let melhorFonte = null;
  let diferencaValor = null;
  let diferencaPercentual = null;

  if (Number.isFinite(coamoPrice) && Number.isFinite(larPrice)) {
    if (coamoPrice === larPrice) {
      melhorFonte = "empate";
      diferencaValor = 0;
      diferencaPercentual = 0;
    } else {
      melhorFonte = coamoPrice > larPrice ? "coamo" : "lar";
      diferencaValor = Number(Math.abs(coamoPrice - larPrice).toFixed(2));

      const menorPreco = Math.min(coamoPrice, larPrice);
      if (menorPreco > 0) {
        diferencaPercentual = Number(((diferencaValor / menorPreco) * 100).toFixed(2));
      }
    }
  }

  return {
    filtros: filters,
    coamo: bestCoamo
      ? { ...sanitizeQuote(bestCoamo), precoNumerico: bestCoamo.precoNumerico }
      : null,
    lar: bestLar ? { ...sanitizeQuote(bestLar), precoNumerico: bestLar.precoNumerico } : null,
    diferenca: {
      valor: diferencaValor,
      percentual: diferencaPercentual,
      melhorFonte,
    },
  };
}

// Gera a serie historica usada pela rota de variacao com base nos snapshots salvos.
function buildVariationFromSnapshots(snapshots, filters = {}) {
  const points = [];

  for (const snapshot of snapshots) {
    const quotes = filterQuotes(enrichQuotes(snapshot.source, snapshot.payload), filters);
    const bestQuote = findHighestPriceQuote(quotes);

    if (!bestQuote) {
      continue;
    }

    points.push({
      snapshotId: snapshot.id,
      collectedAt: snapshot.collectedAt,
      slotLabel: snapshot.slotLabel,
      triggerType: snapshot.triggerType,
      preco: bestQuote.preco,
      precoNumerico: bestQuote.precoNumerico,
      item: sanitizeQuote(bestQuote),
    });
  }

  if (points.length === 0) {
    return null;
  }

  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  let variacaoValor = null;
  let variacaoPercentual = null;

  if (points.length > 1) {
    variacaoValor = Number((lastPoint.precoNumerico - firstPoint.precoNumerico).toFixed(2));

    if (firstPoint.precoNumerico > 0) {
      variacaoPercentual = Number(
        (((lastPoint.precoNumerico - firstPoint.precoNumerico) / firstPoint.precoNumerico) * 100).toFixed(2)
      );
    }
  }

  return {
    totalPontos: points.length,
    primeiro: firstPoint,
    ultimo: lastPoint,
    variacao: {
      valor: variacaoValor,
      percentual: variacaoPercentual,
    },
    historico: points,
  };
}

// Expande snapshots historicos em itens individuais para a consulta por periodo.
function buildPeriodItems(snapshots, filters = {}) {
  const items = [];

  for (const snapshot of snapshots) {
    const quotes = filterQuotes(enrichQuotes(snapshot.source, snapshot.payload), filters);

    for (const quote of quotes) {
      items.push({
        snapshotId: snapshot.id,
        collectedAt: snapshot.collectedAt,
        slotLabel: snapshot.slotLabel,
        triggerType: snapshot.triggerType,
        ...sanitizeQuote(quote),
        precoNumerico: quote.precoNumerico,
      });
    }
  }

  return items;
}

// Escapa um valor individual para que ele possa ser escrito com seguranca em CSV.
function escapeCsvValue(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

// Converte um conjunto de cotacoes em CSV para download.
function quotesToCsv(quotes) {
  const header = [
    "fonte",
    "fornecedor",
    "grao",
    "descricao",
    "data_hora",
    "preco",
    "preco_numerico",
    "unidade",
    "local",
  ];

  const rows = quotes.map((quote) =>
    [
      quote.fonte,
      quote.fornecedor,
      quote.grao,
      quote.descricao,
      quote.data_hora,
      quote.preco,
      quote.precoNumerico,
      quote.unidade,
      quote.local,
    ]
      .map(escapeCsvValue)
      .join(",")
  );

  return [header.join(","), ...rows].join("\n");
}

module.exports = {
  buildComparison,
  buildPeriodItems,
  buildVariationFromSnapshots,
  escapeCsvValue,
  quotesToCsv,
};
