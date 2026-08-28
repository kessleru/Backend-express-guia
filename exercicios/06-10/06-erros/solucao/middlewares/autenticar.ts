/**
 * Autenticação, agora lançando AppError.
 *
 * Middleware também lança — não existe nada de especial nele. E aqui a vantagem
 * fica clara: 401 e 403 passam a sair no MESMO formato de todos os outros erros
 * da API, sem que este arquivo saiba qual é esse formato.
 */
import type { NextFunction, Request, Response } from 'express';
import { naoAutenticado, semPermissao } from '../erros/AppError.ts';

const CHAVE_VALIDA = process.env.API_KEY ?? 'biblioteca-123';

export function exigirChave(req: Request, res: Response, next: NextFunction) {
  const chave = req.header('X-Api-Key');

  // 401 = "não sei quem você é". 403 = "sei, e você não pode".
  if (!chave) throw naoAutenticado('Header X-Api-Key é obrigatório');
  if (chave !== CHAVE_VALIDA) throw semPermissao('Chave de API inválida');

  res.locals.cliente = { tipo: 'api-key' };
  next();
}

export function exigirPapel(papel: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (req.header('X-Papel') !== papel) {
      throw semPermissao(`Esta operação exige o papel "${papel}"`);
    }
    next();
  };
}

/** Leitura é pública; escrita exige chave. */
export function exigirChaveEmEscritas(req: Request, res: Response, next: NextFunction) {
  const leitura =
    req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS';
  if (leitura) return next();
  return exigirChave(req, res, next);
}
