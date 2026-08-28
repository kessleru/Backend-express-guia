/**
 * Controller de autenticação: traduz HTTP ↔ service.
 *
 * É aqui — e só aqui — que se decide que o refresh vai em COOKIE e o access no
 * CORPO. O service devolveu os dois como strings; a escolha de transporte é
 * assunto de HTTP.
 */
import type { CookieOptions, Request, Response } from 'express';
import { naoAutenticado } from '../erros/AppError.ts';
import { idDoUsuario, usuarioAutenticado } from '../middlewares/autenticar.ts';
import { validados } from '../middlewares/validar.ts';
import {
  loginSchema,
  refreshSchema,
  registrarSchema,
  trocarSenhaSchema,
} from '../schemas/usuario.ts';
import type { ServicoAutenticacao } from '../servicos/autenticacao.ts';

/**
 * As opções do cookie de refresh — declaradas UMA vez.
 *
 * Duplicá-las entre `res.cookie` e `res.clearCookie` é o erro clássico: o
 * navegador só apaga um cookie se `path` e `domain` baterem com os do original.
 * Com `path` divergente, o "logout" limpa nada e o cookie continua lá.
 */
const COOKIE_REFRESH: CookieOptions = {
  /**
   * httpOnly: o JavaScript da página NÃO lê este cookie (`document.cookie` não o
   * mostra). É a defesa contra XSS: um script injetado rouba o que está em
   * `localStorage`, mas não alcança um cookie httpOnly.
   *
   * É exatamente por isso que refresh token não vai para `localStorage`.
   */
  httpOnly: true,

  /**
   * secure: só trafega em HTTPS.
   *
   * Em desenvolvimento local (http) precisa ser `false`, senão o navegador
   * simplesmente não envia o cookie e você perde uma tarde procurando bug no
   * servidor. Em produção, `true` não é negociável — sem ele o token viaja
   * legível em qualquer Wi-Fi.
   */
  secure: process.env.NODE_ENV === 'production',

  /**
   * sameSite: defesa contra CSRF. O navegador não manda o cookie em requisição
   * originada de outro site.
   *
   *   'strict' — nunca em navegação vinda de fora (quebra link de e-mail)
   *   'lax'    — manda em navegação GET de nível superior (padrão razoável)
   *   'none'   — manda sempre; exige `secure`. Só se o front está em outro domínio.
   *
   * 'strict' aqui porque `/auth/refresh` é POST e nunca é alvo de link.
   */
  sameSite: 'strict',

  /**
   * path: o cookie só é enviado para `/auth/*`.
   *
   * Princípio do **menor privilégio aplicado ao transporte**: não faz sentido o
   * refresh token viajar em toda listagem de livros. Quanto menos vezes um
   * segredo trafega, menos chances de vazar em log, proxy ou extensão.
   */
  path: '/auth',

  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias, igual à expiração do JWT
};

export function criarControllerAuth(servico: ServicoAutenticacao) {
  /** Lê o refresh do cookie (navegador) ou do corpo (mobile, script). */
  const lerRefresh = (req: Request, res: Response): string | undefined =>
    (req.cookies as Record<string, string> | undefined)?.refreshToken ??
    validados(res, refreshSchema).refreshToken;

  return {
    async registrar(req: Request, res: Response) {
      const { email, senha } = validados(res, registrarSchema);
      const usuario = await servico.registrar(email, senha);

      // O service já devolveu `UsuarioPublico`. Não há hash a vazar nem por
      // descuido — o tipo não tem o campo, então `res.json` não alcança.
      //
      // É por isso que `grep -rn senhaHash controllers/` não acha nada: a
      // proteção não é disciplina de quem escreve o controller, é o tipo.
      res.status(201).location(`${req.baseUrl}/usuarios/${usuario.id}`).json(usuario);
    },

    async login(_req: Request, res: Response) {
      const { email, senha } = validados(res, loginSchema);
      const sessao = await servico.login(email, senha);

      res.cookie('refreshToken', sessao.refreshToken, COOKIE_REFRESH);

      // O access vai no CORPO, e o cliente o guarda em memória (variável de
      // JavaScript), não em localStorage: ele é curto (15 min) e some ao
      // recarregar a página — quando o refresh, que está no cookie, gera outro.
      //
      // O `refreshToken` NÃO é repetido no corpo. Repeti-lo anularia o httpOnly:
      // o front leria a resposta e provavelmente o guardaria onde um XSS alcança.
      res.json({
        accessToken: sessao.accessToken,
        expiraEm: sessao.expiraEm,
        usuario: sessao.usuario,
      });
    },

    async refresh(req: Request, res: Response) {
      const token = lerRefresh(req, res);
      if (!token) throw naoAutenticado('Refresh token ausente');

      const sessao = await servico.renovar(token);
      res.cookie('refreshToken', sessao.refreshToken, COOKIE_REFRESH);
      res.json({ accessToken: sessao.accessToken, expiraEm: sessao.expiraEm });
    },

    async logout(req: Request, res: Response) {
      await servico.logout(
        (req.cookies as Record<string, string> | undefined)?.refreshToken,
      );

      // As MESMAS opções de `path` do `res.cookie` original — ver COOKIE_REFRESH.
      res.clearCookie('refreshToken', { path: COOKIE_REFRESH.path! });

      // 204: deu certo, não há nada a devolver.
      res.status(204).send();
    },

    async eu(_req: Request, res: Response) {
      // O id vem do TOKEN, não da URL. Uma rota `/usuarios/:id` que devolvesse o
      // usuário do parâmetro seria IDOR — bastaria trocar o número.
      res.json(await servico.buscarPublico(idDoUsuario(res)));
    },

    async listarUsuarios(_req: Request, res: Response) {
      res.json(await servico.listarPublicos());
    },

    async trocarSenha(_req: Request, res: Response) {
      const { senhaAtual, novaSenha } = validados(res, trocarSenhaSchema);
      const sessoesEncerradas = await servico.trocarSenha(
        idDoUsuario(res),
        senhaAtual,
        novaSenha,
      );

      // A sessão atual caiu junto: o cookie tem que ir embora também, senão o
      // navegador continua mandando um refresh que o servidor já não reconhece.
      res.clearCookie('refreshToken', { path: COOKIE_REFRESH.path! });

      res.json({
        mensagem: 'Senha alterada. Faça login novamente.',
        sessoesEncerradas,
        papel: usuarioAutenticado(res).papel,
      });
    },
  };
}
