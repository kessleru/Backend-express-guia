/**
 * id-de-requisicao — dá um identificador a cada requisição, aceita o que já vier
 * do cliente e devolve o valor no cabeçalho `X-Request-Id`.
 *
 * Conceito de middleware, ordem e `res.locals`: docs/01-05/05-middlewares.md.
 * Copiável: não importa nada de outra pasta do catálogo.
 */
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const CABECALHO = 'X-Request-Id';

// A chave em `res.locals` fica exportada porque quem lê o id (o middleware de
// log, uma rota) precisa combinar a mesma string. Constante em vez de literal
// solto: um `res.locals.idRequisicao` digitado diferente não dá erro nenhum —
// devolve `undefined` e o log sai sem id, silenciosamente.
export const CHAVE_ID = 'idDaRequisicao';

// O formato aceito de um id que vem de fora. As três restrições resolvem coisas
// diferentes: sem `\n` e `\r`, um id não consegue fabricar linhas inteiras de
// log; sem espaço e sem aspas, ele não quebra a linha JSON de quem loga; e o
// teto de 128 impede que um cabeçalho de 8 KB seja copiado para dentro de toda
// linha de log da requisição. 128 cabe um UUID (36) com folga para os formatos
// mais longos que outros serviços usam.
const FORMATO_ACEITO = /^[A-Za-z0-9._-]{1,128}$/;

export function idDeRequisicao(req: Request, res: Response, next: NextFunction) {
  const recebido = req.header(CABECALHO);

  // Aceitar o id que já veio é o que faz o rastro atravessar serviços: a API que
  // chama esta manda o id dela, e as duas escrevem log com a mesma chave. Se o
  // valor não passa no formato, ele é **descartado** e um novo é gerado — nunca
  // sanitizado. Remover os caracteres ruins e seguir usando o resto devolveria ao
  // cliente um id diferente do que ele mandou, e o rastro se perderia do mesmo
  // jeito, só que sem ninguém perceber.
  const id = recebido && FORMATO_ACEITO.test(recebido) ? recebido : randomUUID();

  res.locals[CHAVE_ID] = id;

  // Setar aqui, e não no fim: neste ponto nada foi enviado ainda, então é
  // `setHeader` simples — a acrobacia com `writeHead` da pasta `tempo-de-resposta`
  // só é necessária para o que ainda não se sabe no começo da requisição.
  // Devolver o id é o que permite ao cliente citar a requisição no chamado de
  // suporte sem precisar do horário exato.
  res.setHeader(CABECALHO, id);

  next();
}

/**
 * Lê o id da requisição atual.
 *
 * `res.locals` é tipado como `Record<string, any>`, então `res.locals.idDaRequisicao`
 * é `any`: erro de digitação e uso como número passam pelo compilador. Este
 * acessor é o único ponto que toca o `any` e devolve `string`, com um valor de
 * fallback para o caso de a pilha ter sido montada sem o middleware acima.
 */
export function lerIdDaRequisicao(res: Response): string {
  const valor: unknown = res.locals[CHAVE_ID];
  return typeof valor === 'string' ? valor : 'sem-id';
}
