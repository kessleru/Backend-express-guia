/**
 * Rate limiting em memória, escrito na mão.
 *
 * É uma "janela fixa": conta requisições por IP num intervalo e zera no fim.
 * Simples e suficiente para estudar. As limitações, todas reais:
 *
 *   1. O Map morre no restart do processo.
 *   2. Com 3 instâncias atrás de um load balancer, cada uma conta separado —
 *      o limite efetivo triplica. Estado compartilhado precisa de Redis (15).
 *   3. Janela fixa permite rajada na virada: 20 no fim de uma janela + 20 no
 *      começo da próxima = 40 em milissegundos. "Sliding window" resolve.
 *
 * `express-rate-limit` (módulo 13) resolve os três com uma linha de config.
 * Vale escrever à mão uma vez para saber o que aquela linha está comprando.
 */
import type { NextFunction, Request, Response } from 'express';

type Contagem = { total: number; expiraEm: number };

export function limitar(max: number, janelaMs: number) {
  const porIp = new Map<string, Contagem>();

  return (req: Request, res: Response, next: NextFunction) => {
    // `req.ip` respeita o header `X-Forwarded-For` só se `app.set('trust proxy')`
    // estiver ligado. Sem isso, atrás de um proxy TODO mundo é o mesmo IP — e o
    // rate limit vira uma negação de serviço acidental contra seus usuários.
    const ip = req.ip ?? 'desconhecido';
    const agora = Date.now();
    const atual = porIp.get(ip);

    // Primeira requisição, ou janela já vencida: começa de novo.
    if (!atual || atual.expiraEm <= agora) {
      porIp.set(ip, { total: 1, expiraEm: agora + janelaMs });
      return next();
    }

    atual.total++;

    // Headers informativos: o cliente educado se auto-regula com eles.
    res.set('X-RateLimit-Limit', String(max));
    res.set('X-RateLimit-Remaining', String(Math.max(0, max - atual.total)));

    if (atual.total > max) {
      const segundos = Math.ceil((atual.expiraEm - agora) / 1000);
      // `Retry-After` em segundos inteiros. Sem ele, o cliente não tem como
      // saber quando tentar de novo — e vai martelar sua API em loop.
      res.set('Retry-After', String(segundos));
      return res.status(429).json({
        erro: `Muitas requisições. Tente novamente em ${segundos}s.`,
      });
    }

    next();
  };
}
