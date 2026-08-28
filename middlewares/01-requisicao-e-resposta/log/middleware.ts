/**
 * log — uma linha JSON por requisição, com método, rota, status, duração e o id
 * da requisição.
 *
 * Conceito de middleware, ordem e `res.on('finish')`: docs/01-05/05-middlewares.md.
 * Copiável: não importa nada de outra pasta do catálogo — daí a chave repetida
 * abaixo em vez de um import da pasta `id-de-requisicao`.
 */
import type { NextFunction, Request, Response } from 'express';

const CHAVE_ID = 'idDaRequisicao';

// O que a linha **não** tem, e é decisão, não esquecimento: `Authorization`,
// `Cookie` e `Set-Cookie` carregam a credencial em texto puro, e log é o arquivo
// que mais gente lê e mais tempo sobrevive — um token que vazou ali continua
// válido meses depois, num backup que ninguém lembra que existe. `req.body` fica
// de fora pelo mesmo motivo: é por onde passam a senha do cadastro e o número do
// cartão. Se um dia precisar do corpo, escolha campo por campo o que entra;
// `body: req.body` é a linha que vaza a senha de todo mundo de uma vez.

export function log(req: Request, res: Response, next: NextFunction) {
  const inicio = process.hrtime.bigint();

  // `finish` dispara quando o último byte da resposta foi entregue ao sistema
  // operacional. É tarde demais para mexer em cabeçalho (a pasta
  // `tempo-de-resposta` mostra o que acontece), e é exatamente por isso que ele
  // serve para log: aqui `res.statusCode` já é o status final, inclusive quando
  // quem decidiu o status foi o tratador de erro no fim da pilha.
  res.on('finish', () => {
    const duracaoMs = Number(process.hrtime.bigint() - inicio) / 1e6;
    const idValor: unknown = res.locals[CHAVE_ID];

    // `req.route.path` é o padrão registrado (`/tempo/:ms`), não o caminho que
    // chegou (`/tempo/450`). Agrupar por caminho cru transforma cada id de
    // recurso numa série própria — mil links viram mil "rotas" e qualquer
    // contagem por rota deixa de significar coisa alguma. `req.route` é
    // `undefined` quando nenhuma rota casou (o 404), e aí o caminho cru é o
    // único dado que existe. Isso vira métrica no módulo 14.
    const rota: string = req.route?.path ?? req.path;

    // `req.originalUrl` traz a query string colada, e a query string é o lugar
    // clássico onde a credencial vaza: `?token=`, `?api_key=`, `?senha=`. Quem
    // escreve `caminho: req.originalUrl` sem pensar acaba com o token em texto
    // puro no arquivo de log — o mesmo problema da lista acima, por uma porta que
    // ninguém olha. Cortar no `?` descarta os filtros junto; se um dia precisar
    // deles, escolha as chaves uma a uma, como no corpo.
    const caminho: string = req.originalUrl.split('?')[0] ?? req.path;

    const linha = {
      hora: new Date().toISOString(),
      id: typeof idValor === 'string' ? idValor : 'sem-id',
      metodo: req.method,
      rota,
      caminho,
      status: res.statusCode,
      duracaoMs: Number(duracaoMs.toFixed(2)),
    };

    // `JSON.stringify` de uma linha só, e não várias linhas indentadas: a linha é
    // a unidade que o coletor de log lê. Um objeto quebrado em dez linhas vira
    // dez eventos soltos, e nenhum deles é JSON válido sozinho.
    console.log(JSON.stringify(linha));
  });

  next();
}
