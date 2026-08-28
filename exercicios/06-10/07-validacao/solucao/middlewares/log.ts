/**
 * Log e correlação de requisição.
 *
 * `registrar` substitui o morgan por algo que você escreveu — o objetivo é ver
 * que não tem mágica: são ~10 linhas. No módulo 14 isso vira Pino, que troca o
 * texto por JSON estruturado (o que máquina consegue filtrar).
 */
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

/**
 * Dá um id a cada requisição.
 *
 * Serve para correlacionar: quando um cliente reclama de um erro, ele te passa o
 * `X-Request-Id` e você acha TODAS as linhas de log daquela requisição — mesmo
 * com 500 requisições por segundo intercaladas no arquivo.
 */
export function identificar(_req: Request, res: Response, next: NextFunction) {
  const id = randomUUID().slice(0, 8); // 8 chars bastam para ler no terminal
  res.locals.requestId = id;
  res.set('X-Request-Id', id); // devolvido ao cliente, para ele poder citar
  next();
}

/**
 * Registra a requisição DEPOIS que ela termina.
 *
 * O middleware roda na descida, então `res.statusCode` ainda não é o final aqui.
 * O evento `finish` dispara quando a resposta foi entregue — aí o status e o
 * tempo total são reais.
 *
 * `close` seria o par: dispara também quando o cliente desiste no meio. Útil
 * para detectar abandono, mas duplicaria o log neste caso simples.
 */
export function registrar(req: Request, res: Response, next: NextFunction) {
  const inicio = performance.now();

  res.on('finish', () => {
    const ms = (performance.now() - inicio).toFixed(1);
    const id = res.locals.requestId ?? '--------';
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} em ${ms}ms [${id}]`);
  });

  next();
}

/**
 * Desafio extra: só aplica o middleware fora de produção.
 *
 * O middleware "vazio" não é `undefined` — o Express exige uma função. Então o
 * caminho de produção devolve um que só chama `next()`.
 */
export function apenasEmDesenvolvimento(
  middleware: (req: Request, res: Response, next: NextFunction) => void,
) {
  if (process.env.NODE_ENV === 'production') {
    return (_req: Request, _res: Response, next: NextFunction) => next();
  }
  return middleware;
}

/** Latência artificial: descobre se o front tem estado de loading. */
export function atrasar(ms: number) {
  return (_req: Request, _res: Response, next: NextFunction) => {
    setTimeout(next, ms); // `next` é chamado depois; a thread não fica bloqueada
  };
}
