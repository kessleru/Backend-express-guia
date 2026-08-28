/**
 * Registro, login, refresh, logout, rota protegida e rota só-para-admin.
 *
 * Rodar:  node src/exemplos/11-15/11-auth/servidor.ts
 */
import express from 'express';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  conflito,
  naoAutenticado,
  requisicaoInvalida,
} from '../../06-10/06-erros/erro-app.ts';
import { rotaNaoEncontrada, tratarErro } from '../../06-10/06-erros/tratador.ts';
import { validados, validar } from '../../06-10/07-validacao/validar.ts';
import { autenticar, exigirPapel, usuarioAutenticado } from './middlewares.ts';
import { conferirSenha, hashSenha } from './senhas.ts';
import { gerarAcesso, gerarRefresh, verificarRefresh, type Papel } from './tokens.ts';

const app = express();
app.use(express.json());

// `cookie-parser` popula `req.cookies`. Necessário para o refresh token em cookie
// httpOnly — sem ele, `req.cookies` é `undefined`.
app.use(cookieParser());

app.use((_req, res, next) => {
  res.locals.requestId = randomUUID().slice(0, 8);
  next();
});

// ---------------------------------------------------------------------
// "Banco" em memória (o repositório de verdade seria o do módulo 09/10)
// ---------------------------------------------------------------------

type Usuario = {
  id: number;
  email: string;
  senhaHash: string; // NUNCA a senha em texto. Nem em log, nem em variável.
  papel: Papel;
};

const usuarios: Usuario[] = [];
let proximoId = 1;

/**
 * Refresh tokens VÁLIDOS, por `jti`.
 *
 * Esta tabela é o que torna o logout possível. JWT assinado não pode ser
 * revogado — quem tem o token entra até expirar. Guardar o `jti` e checá-lo
 * transforma o refresh em algo revogável: no logout, apaga-se a linha.
 *
 * Em produção isto é uma tabela no banco (ou Redis, com TTL), não um Map.
 */
const refreshsValidos = new Map<string, { usuarioId: number; criadoEm: Date }>();

// ---------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------

const credenciaisSchema = z
  .object({
    email: z.email('e-mail inválido').toLowerCase(),
    // O mínimo de 8 é o piso do OWASP. Regra de "1 maiúscula, 1 número, 1
    // símbolo" é contraproducente: leva a `Senha1!` e proíbe passphrase longa,
    // que é mais forte. Comprimento mínimo + checagem contra senhas vazadas
    // (Have I Been Pwned) protege muito mais.
    senha: z.string().min(8, 'senha precisa de ao menos 8 caracteres').max(200),
  })
  .strict();

const refreshSchema = z.object({ refreshToken: z.string().optional() }).strict();

// ---------------------------------------------------------------------
// POST /auth/registrar
// ---------------------------------------------------------------------

app.post('/auth/registrar', validar(credenciaisSchema), async (_req, res) => {
  const { email, senha } = validados(res, credenciaisSchema);

  if (usuarios.some((u) => u.email === email)) {
    // Dilema real: 409 aqui CONFIRMA que o e-mail está cadastrado — é
    // enumeração de usuários. A alternativa (responder 201 e mandar um e-mail
    // dizendo "alguém tentou criar conta com seu endereço") é mais segura e mais
    // complexa. Para uma API de estudo, 409 e a consciência do trade-off.
    throw conflito('E-mail já cadastrado');
  }

  const usuario: Usuario = {
    id: proximoId++,
    email,
    // O hash é a ÚNICA forma da senha que sai desta função. A variável `senha`
    // não é guardada, não é logada, não vai para lugar nenhum.
    senhaHash: await hashSenha(senha),
    papel: usuarios.length === 0 ? 'admin' : 'leitor', // o primeiro é admin
  };
  usuarios.push(usuario);

  // A resposta NUNCA inclui `senhaHash`. Montar o objeto campo por campo é mais
  // seguro que `delete usuario.senhaHash` — se um campo sensível for adicionado
  // ao tipo amanhã, ele não vaza por omissão.
  res.status(201).json({ id: usuario.id, email: usuario.email, papel: usuario.papel });
});

// ---------------------------------------------------------------------
// POST /auth/login
// ---------------------------------------------------------------------

app.post('/auth/login', validar(credenciaisSchema), async (_req, res) => {
  const { email, senha } = validados(res, credenciaisSchema);

  const usuario = usuarios.find((u) => u.email === email);

  // MENSAGEM GENÉRICA, de propósito.
  //
  // "E-mail não encontrado" vs "senha incorreta" entrega ao atacante quais
  // e-mails existem — e ele passa a atacar só as contas reais. A mesma mensagem
  // para os dois casos custa nada e fecha essa porta.
  //
  // Nota honesta: como o `verify` do Argon2 leva ~200ms e o "usuário não existe"
  // responde na hora, o TEMPO ainda vaza a informação. A defesa completa é
  // rodar um hash falso quando o usuário não existe.
  if (!usuario || !(await conferirSenha(usuario.senhaHash, senha))) {
    throw naoAutenticado('E-mail ou senha inválidos');
  }

  const acesso = gerarAcesso(usuario.id, usuario.papel);
  const { token: refresh, jti } = gerarRefresh(usuario.id);

  refreshsValidos.set(jti, { usuarioId: usuario.id, criadoEm: new Date() });

  // ---------------------------------------------------------------------
  // O refresh vai em COOKIE httpOnly; o access, no corpo.
  // ---------------------------------------------------------------------
  res.cookie('refreshToken', refresh, {
    // httpOnly: JavaScript da página NÃO lê este cookie. É a defesa contra XSS —
    // um script injetado consegue roubar o que está em localStorage, mas não um
    // cookie httpOnly. É o motivo de refresh token não ir para localStorage.
    httpOnly: true,

    // secure: só trafega em HTTPS. Em desenvolvimento local (http) tem que ser
    // false, senão o cookie simplesmente não é enviado e você perde uma tarde.
    secure: process.env.NODE_ENV === 'production',

    // sameSite protege contra CSRF: o navegador não manda o cookie em requisição
    // vinda de outro site.
    //   'strict' — nunca em navegação de outro site (quebra link de e-mail)
    //   'lax'    — manda em navegação GET de nível superior (o padrão razoável)
    //   'none'   — manda sempre; exige secure. Só se o front está em outro domínio.
    sameSite: 'strict',

    // Escopo: o cookie só é enviado para as rotas de refresh/logout. Não faz
    // sentido mandá-lo em toda requisição da API.
    path: '/auth',

    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias, igual à expiração do JWT
  });

  // O ACCESS token vai no corpo, e o cliente o guarda em MEMÓRIA (variável do
  // JavaScript), não em localStorage. Ele é curto (15 min) e some ao recarregar
  // a página — quando o refresh, que está no cookie, gera outro.
  res.json({
    accessToken: acesso,
    expiraEm: 900, // segundos; o cliente usa para renovar antes de estourar
    usuario: { id: usuario.id, email: usuario.email, papel: usuario.papel },
  });
});

// ---------------------------------------------------------------------
// POST /auth/refresh — troca refresh por access novo
// ---------------------------------------------------------------------

app.post('/auth/refresh', validar(refreshSchema), (req, res) => {
  // Aceita o refresh do cookie (navegador) ou do corpo (app mobile, script).
  const doCorpo = validados(res, refreshSchema).refreshToken;
  const token =
    (req.cookies as Record<string, string> | undefined)?.refreshToken ?? doCorpo;

  if (!token) throw naoAutenticado('Refresh token ausente');

  const payload = verificarRefresh(token); // assinatura + expiração

  // A checagem que a assinatura não faz: este jti ainda está válido?
  // É aqui que o logout tem efeito.
  const registro = refreshsValidos.get(payload.jti);
  if (!registro) throw naoAutenticado('Refresh token revogado');

  const usuario = usuarios.find((u) => u.id === Number(payload.sub));
  if (!usuario) throw naoAutenticado('Usuário não existe mais');

  // ROTAÇÃO DE REFRESH TOKEN: o antigo é invalidado e um novo é emitido.
  //
  // O ganho é detecção de roubo: se um atacante copiou o refresh e o usuário
  // legítimo o usa, o do atacante para de funcionar (e vice-versa). Um sistema
  // mais sofisticado detecta a reutilização de um jti já rotacionado e revoga a
  // sessão inteira — sinal claro de que o token vazou.
  refreshsValidos.delete(payload.jti);
  const { token: novoRefresh, jti: novoJti } = gerarRefresh(usuario.id);
  refreshsValidos.set(novoJti, { usuarioId: usuario.id, criadoEm: new Date() });

  res.cookie('refreshToken', novoRefresh, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({ accessToken: gerarAcesso(usuario.id, usuario.papel), expiraEm: 900 });
});

// ---------------------------------------------------------------------
// POST /auth/logout
// ---------------------------------------------------------------------

app.post('/auth/logout', (req, res) => {
  const token = (req.cookies as Record<string, string> | undefined)?.refreshToken;

  if (token) {
    try {
      // Apagar o jti é o que faz o logout ser real. Sem isso, "logout" seria só
      // o front esquecer o token — e quem tivesse copiado continuaria dentro.
      refreshsValidos.delete(verificarRefresh(token).jti);
    } catch {
      // Token já inválido: o logout continua sendo sucesso. Não faz sentido
      // recusar um pedido de sair.
    }
  }

  // Limpar o cookie precisa das MESMAS opções de `path` do original — senão o
  // navegador não encontra o cookie a apagar e ele fica lá.
  res.clearCookie('refreshToken', { path: '/auth' });

  // 204: deu certo, nada a devolver.
  res.status(204).send();

  // ATENÇÃO ao que este logout NÃO faz: o ACCESS token continua válido até
  // expirar (até 15 min). É a natureza do JWT sem estado. Se o produto exige
  // logout instantâneo, é preciso uma lista de revogação consultada a cada
  // requisição — e aí você abriu mão do "stateless" que motivou usar JWT.
});

// ---------------------------------------------------------------------
// Rotas protegidas
// ---------------------------------------------------------------------

/** Autenticada: qualquer usuário logado. */
app.get('/eu', autenticar, (_req, res) => {
  const { sub, papel } = usuarioAutenticado(res);
  const usuario = usuarios.find((u) => u.id === Number(sub));
  res.json({ id: sub, papel, email: usuario?.email });
});

/** Autorizada: só admin. Note os DOIS middlewares, nesta ordem. */
app.get('/admin/usuarios', autenticar, exigirPapel('admin'), (_req, res) => {
  // `senhaHash` fica de fora, mesmo numa rota de admin.
  res.json(usuarios.map((u) => ({ id: u.id, email: u.email, papel: u.papel })));
});

/** Vários papéis permitidos. */
app.get('/relatorios', autenticar, exigirPapel('admin', 'leitor'), (_req, res) => {
  res.json({ totalUsuarios: usuarios.length });
});

app.get('/publico', (_req, res) => {
  res.json({ mensagem: 'qualquer um vê isto' });
});

app.use(rotaNaoEncontrada);
app.use(tratarErro);

const PORT = 5059;
app.listen(PORT, () => {
  console.log(`Auth em http://localhost:${PORT}`);
  console.log('Rotas: POST /auth/registrar /auth/login /auth/refresh /auth/logout');
  console.log('       GET  /eu /admin/usuarios /relatorios /publico\n');
});
