/**
 * Autenticação por chave de API — a versão mais simples que existe.
 *
 * Uma chave fixa no código é péssima ideia em produção (vaza no git, é a mesma
 * para todo mundo, não dá pra revogar uma sem revogar todas). Serve aqui porque
 * o assunto é MIDDLEWARE, não segurança: o módulo 11 troca isto por senha
 * hasheada com Argon2 + JWT.
 */
import type { NextFunction, Request, Response } from 'express';

// Em produção viria de variável de ambiente. Nunca no código.
const CHAVE_VALIDA = process.env.API_KEY ?? 'biblioteca-123';

/**
 * 401 vs 403 — a distinção que quase todo mundo erra:
 *   401 Unauthorized  → "não sei quem você é" (credencial ausente ou ilegível)
 *   403 Forbidden     → "sei quem você é, e você não pode"
 *
 * O nome do 401 no padrão HTTP é infeliz: ele é sobre AUTENTICAÇÃO.
 */
export function exigirChave(req: Request, res: Response, next: NextFunction) {
  const chave = req.header('X-Api-Key');

  if (!chave) {
    return res.status(401).json({ erro: 'Header X-Api-Key é obrigatório' });
  }
  if (chave !== CHAVE_VALIDA) {
    return res.status(403).json({ erro: 'Chave de API inválida' });
  }

  // Guardamos "quem é" para os middlewares seguintes. Com JWT (módulo 11) aqui
  // moraria o usuário decodificado do token.
  res.locals.cliente = { tipo: 'api-key' };
  next();
}

/**
 * Fábrica: recebe configuração, devolve middleware.
 *
 * Middleware tem assinatura fixa `(req, res, next)`, então não há como passar
 * argumento direto. A fábrica resolve — e o `()` na hora de usar é obrigatório:
 *
 *   app.delete('/x', exigirPapel('admin'), handler)   ✅
 *   app.delete('/x', exigirPapel, handler)            ❌ trava a requisição
 *
 * O segundo caso é traiçoeiro: o Express chama a fábrica como se fosse o
 * middleware, ela devolve uma função que ninguém usa, e ninguém chama `next()`.
 */
export function exigirPapel(papel: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const papelDoCliente = req.header('X-Papel');

    if (papelDoCliente !== papel) {
      // 403: a credencial é válida, a permissão é que falta. É autorização
      // (RBAC), não autenticação — a diferença abre o módulo 11.
      return res.status(403).json({ erro: `Esta operação exige o papel "${papel}"` });
    }

    next();
  };
}

/**
 * Exige chave só em escritas.
 *
 * Alternativa a pendurar `exigirChave` rota por rota: aqui você não corre o risco
 * de esquecer numa rota nova. O custo é que a proteção fica invisível de quem lê
 * o arquivo de rotas — escolha consciente, não há resposta certa.
 */
export function exigirChaveEmEscritas(req: Request, res: Response, next: NextFunction) {
  const leitura =
    req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS';
  if (leitura) return next();
  return exigirChave(req, res, next);
}
