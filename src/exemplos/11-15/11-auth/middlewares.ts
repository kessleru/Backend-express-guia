/**
 * Middlewares de autenticação e autorização.
 *
 * A distinção que dá nome ao módulo:
 *   AUTENTICAÇÃO (401) — quem você é.  → `autenticar`
 *   AUTORIZAÇÃO   (403) — o que pode.   → `exigirPapel`
 *
 * São dois middlewares porque são duas perguntas. Misturá-los produz o clássico
 * "403 quando devia ser 401", que faz o cliente tentar corrigir a permissão
 * quando o problema é que o token expirou.
 */
import type { NextFunction, Request, Response } from 'express';
import { naoAutenticado, semPermissao } from '../../06-10/06-erros/erro-app.ts';
import { verificarAcesso, type Papel, type PayloadAcesso } from './tokens.ts';

/** Lê o token de `Authorization: Bearer <token>` e valida. */
export function autenticar(req: Request, res: Response, next: NextFunction) {
  const cabecalho = req.header('Authorization');

  if (!cabecalho) throw naoAutenticado('Header Authorization ausente');

  // O esquema "Bearer" ("portador") é o padrão para token. `Basic` é
  // usuário:senha em base64 — não use.
  const [esquema, token] = cabecalho.split(' ');
  if (esquema !== 'Bearer' || !token) {
    throw naoAutenticado('Formato esperado: Authorization: Bearer <token>');
  }

  // `verificarAcesso` lança AppError 401 com a mensagem certa (expirado vs
  // inválido). O tratador central (módulo 06) transforma em resposta.
  const payload = verificarAcesso(token);

  // Disponível para os middlewares e handlers seguintes.
  res.locals.usuario = payload;
  next();
}

/**
 * RBAC (Role-Based Access Control) na sua forma mais simples: o papel está no
 * token, então autorizar não precisa tocar no banco.
 *
 * A contrapartida: rebaixar alguém de admin só tem efeito quando o access token
 * dele expirar (15 min). Se isso for inaceitável, o papel tem que vir do banco a
 * cada requisição — e você troca latência por revogação imediata. É uma decisão
 * de produto, não técnica.
 */
export function exigirPapel(...papeisPermitidos: Papel[]) {
  return (_req: Request, res: Response, next: NextFunction) => {
    const usuario = res.locals.usuario as PayloadAcesso | undefined;

    // Se cair aqui, você esqueceu o `autenticar` antes deste middleware. É bug
    // de programação, não do cliente — mas responder 401 é o comportamento
    // seguro: nunca deixe passar por omissão.
    if (!usuario) throw naoAutenticado('Rota protegida sem middleware de autenticação');

    if (!papeisPermitidos.includes(usuario.papel)) {
      // 403: sabemos quem é, e não pode. A mensagem pode ser específica — o
      // usuário já se identificou, não há o que proteger aqui.
      throw semPermissao(
        `Esta operação exige um destes papéis: ${papeisPermitidos.join(', ')}`,
      );
    }

    next();
  };
}

/**
 * Autenticação OPCIONAL: identifica se houver token, segue em frente se não.
 *
 * Útil para rota pública que muda de comportamento para quem está logado — por
 * exemplo, uma listagem que marca quais livros o usuário já pegou.
 */
export function autenticarSePossivel(req: Request, res: Response, next: NextFunction) {
  const cabecalho = req.header('Authorization');
  if (!cabecalho) return next();

  try {
    autenticar(req, res, next);
  } catch {
    // Token ruim numa rota opcional: trate como anônimo, não como erro.
    next();
  }
}

/** Atalho tipado para os handlers. */
export function usuarioAutenticado(res: Response): PayloadAcesso {
  const usuario = res.locals.usuario as PayloadAcesso | undefined;
  if (!usuario) throw naoAutenticado('Requisição sem usuário autenticado');
  return usuario;
}
