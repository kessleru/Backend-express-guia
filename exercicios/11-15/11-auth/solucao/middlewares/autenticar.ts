/**
 * Autenticação e autorização por PAPEL.
 *
 * Este arquivo substitui a `X-Api-Key` que serviu de placeholder dos módulos 05
 * ao 10. Ela cumpriu o papel didático (mostrar middleware barrando requisição) e
 * agora sai: uma chave fixa compartilhada não identifica NINGUÉM — não dá para
 * saber quem pegou um livro, revogar o acesso de uma pessoa só, nem dar papéis
 * diferentes. Era autenticação de porta, não de pessoa.
 *
 * ---------------------------------------------------------------------
 * AS DUAS PERGUNTAS, E POR QUE SÃO DOIS MIDDLEWARES
 * ---------------------------------------------------------------------
 *   AUTENTICAÇÃO → "quem é você?"      → 401 → `autenticar`
 *   AUTORIZAÇÃO  → "e você pode isto?" → 403 → `exigirPapel`
 *
 * São funções separadas porque são perguntas separadas, e a resposta HTTP muda o
 * que o cliente faz: 401 significa "sua credencial falhou, renove o token ou
 * faça login"; 403 significa "sua credencial está ótima, você é que não tem
 * permissão — insistir não adianta". Devolver 403 para token expirado manda o
 * usuário pedir permissão ao administrador quando bastava recarregar a página.
 *
 * ---------------------------------------------------------------------
 * O LIMITE DESTE ARQUIVO
 * ---------------------------------------------------------------------
 * Middleware decide o que dá para decidir **antes de tocar nos dados**: papel,
 * token válido, escopo. A pergunta "este empréstimo é seu?" exige BUSCAR o
 * empréstimo — logo é regra de negócio e mora no service
 * (`servicos/emprestimos.ts`).
 *
 * Confundir os dois produz middleware consultando banco, autorização espalhada
 * entre camadas e regra que vale só quando a chamada entra pelo HTTP.
 */
import type { NextFunction, Request, Response } from 'express';
import type { Papel } from '../dominio/usuario.ts';
import { naoAutenticado, semPermissao } from '../erros/AppError.ts';
import { verificarAcesso, type PayloadAcesso } from '../auth/tokens.ts';

/**
 * Lê `Authorization: Bearer <token>` e valida a assinatura.
 *
 * O esquema `Bearer` ("ao portador") é o padrão da RFC 6750, e o nome já diz o
 * risco: quem porta o token é tratado como dono dele. Não há segundo fator nem
 * vínculo com o dispositivo — é por isso que o access token expira em 15 minutos
 * e que HTTPS não é opcional (em HTTP, o token viaja legível na rede).
 */
export function autenticar(req: Request, res: Response, next: NextFunction) {
  const cabecalho = req.header('Authorization');
  if (!cabecalho) throw naoAutenticado('Header Authorization ausente');

  // O formato é exigido com rigor de propósito. Aceitar o token "solto" (sem o
  // prefixo) parece gentileza, mas cria duas formas de mandar a mesma coisa: no
  // dia em que um cliente mandar `Basic <usuario:senha em base64>`, o parsing
  // frouxo trataria a senha como token.
  const [esquema, token, ...sobra] = cabecalho.split(' ');
  if (esquema !== 'Bearer' || !token || sobra.length > 0) {
    throw naoAutenticado('Formato esperado: Authorization: Bearer <token>');
  }

  // `verificarAcesso` lança AppError 401 com a mensagem certa (expirado vs
  // inválido) e o tratador central (módulo 06) transforma em resposta. Repare que
  // este middleware não sabe qual é o formato JSON de erro da API — não precisa.
  res.locals.usuario = verificarAcesso(token);
  next();
}

/**
 * RBAC (Role-Based Access Control) na forma mais simples que funciona.
 *
 * O papel vem de DENTRO do token, então autorizar não consulta o banco. Esse é o
 * ganho — e o custo vem junto: **rebaixar um admin só tem efeito quando o access
 * token dele expira** (até 15 min). Se isso for inaceitável para o produto, o
 * papel precisa vir do banco a cada requisição, e você troca latência por
 * revogação imediata.
 *
 * É decisão de produto, não técnica. O erro é não perceber que existe escolha.
 *
 * Variádico (`...papeis`) porque "admin OU bibliotecário" é comum.
 */
export function exigirPapel(...papeisPermitidos: Papel[]) {
  if (papeisPermitidos.length === 0) {
    // Erro de programação, detectado quando a rota é montada e não no primeiro
    // request — que é quando ele viraria uma rota aberta em silêncio.
    throw new Error('exigirPapel() precisa de ao menos um papel');
  }

  return (_req: Request, res: Response, next: NextFunction) => {
    const usuario = res.locals.usuario as PayloadAcesso | undefined;

    // Cair aqui significa que você esqueceu o `autenticar` antes. É bug seu, não
    // do cliente — mas a resposta segura é 401, nunca deixar passar. Princípio:
    // **na dúvida, feche a porta** (fail closed). Uma checagem de permissão que
    // libera quando dá errado é pior que não ter checagem, porque dá confiança.
    if (!usuario) throw naoAutenticado('Rota protegida sem middleware de autenticação');

    if (!papeisPermitidos.includes(usuario.papel)) {
      // Aqui a mensagem PODE ser específica: o usuário já se identificou, não há
      // enumeração a proteger. Dizer qual papel falta economiza um chamado de
      // suporte.
      throw semPermissao(
        `Esta operação exige um destes papéis: ${papeisPermitidos.join(', ')}`,
      );
    }

    next();
  };
}

/**
 * Autenticação OPCIONAL: identifica quem tem token, deixa passar quem não tem.
 *
 * Serve para rota pública que muda de comportamento para quem está logado — por
 * exemplo, `GET /livros` marcando quais livros são do próprio usuário. Sem isso,
 * você acabaria com duas rotas quase iguais, uma pública e uma privada.
 *
 * Token RUIM aqui é tratado como anônimo, não como erro: a rota é pública, e
 * recusar por causa de um token velho no localStorage quebraria a navegação de
 * quem nem precisava estar logado.
 */
export function autenticarSePossivel(req: Request, res: Response, next: NextFunction) {
  const cabecalho = req.header('Authorization');
  if (!cabecalho) return next();

  try {
    autenticar(req, res, next);
  } catch {
    next();
  }
}

/**
 * Atalho tipado para handlers e controllers.
 *
 * Sem ele, cada handler faria `res.locals.usuario as PayloadAcesso` — um `as`
 * repetido em 15 lugares, e cada um deles é um ponto onde a asserção pode virar
 * mentira sem o compilador reclamar. Aqui a asserção acontece uma vez, com a
 * checagem colada nela.
 */
export function usuarioAutenticado(res: Response): PayloadAcesso {
  const usuario = res.locals.usuario as PayloadAcesso | undefined;
  if (!usuario) throw naoAutenticado('Requisição sem usuário autenticado');
  return usuario;
}

/** `sub` é string por definição da RFC 7519. Converter num lugar só. */
export function idDoUsuario(res: Response): number {
  return Number(usuarioAutenticado(res).sub);
}
