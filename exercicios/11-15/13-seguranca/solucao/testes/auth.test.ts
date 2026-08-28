/**
 * INTEGRAÇÃO — o fluxo de autenticação inteiro.
 *
 * Estes testes substituem os 30 `curl` que o exercício 11 exigia rodar à mão. A
 * diferença não é conveniência: um `curl` você roda uma vez e esquece; a suíte
 * roda a cada mudança, para sempre.
 *
 * É o ponto em que testes deixam de ser "verificação" e viram **infraestrutura
 * de refatoração** — só com isso no lugar dá para mexer no auth sem medo.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { App } from '../app.ts';
import { comToken, montarApp, registrarELogar, SENHA } from './fixtures.ts';

let app: App;

beforeEach(() => {
  ({ app } = montarApp());
});

describe('POST /auth/registrar', () => {
  it('201 e a resposta NÃO contém senhaHash', async () => {
    const r = await request(app)
      .post('/auth/registrar')
      .send({ email: 'admin@x.com', senha: SENHA });

    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ email: 'admin@x.com', papel: 'admin' });

    // Testar o corpo INTEIRO serializado, não `expect(r.body.senhaHash)`:
    // assim um `usuario: { senhaHash }` aninhado também seria pego.
    expect(JSON.stringify(r.body)).not.toContain('senhaHash');
    expect(JSON.stringify(r.body)).not.toContain('$argon2');
  });

  it('o primeiro vira admin, os seguintes viram leitor', async () => {
    await request(app).post('/auth/registrar').send({ email: 'a@x.com', senha: SENHA });
    const r = await request(app)
      .post('/auth/registrar')
      .send({ email: 'b@x.com', senha: SENHA });

    expect(r.body.papel).toBe('leitor');
  });

  it('409 para e-mail repetido', async () => {
    await request(app).post('/auth/registrar').send({ email: 'a@x.com', senha: SENHA });
    const r = await request(app)
      .post('/auth/registrar')
      .send({ email: 'a@x.com', senha: SENHA });

    expect(r.status).toBe(409);
  });

  it('e-mail é normalizado para minúsculas', async () => {
    await request(app).post('/auth/registrar').send({ email: 'Ana@X.com', senha: SENHA });

    // `Ana@X.com` e `ana@x.com` são a MESMA caixa postal. Sem a normalização,
    // daria para criar duas contas "diferentes" que entregam no mesmo lugar.
    const r = await request(app)
      .post('/auth/registrar')
      .send({ email: 'ana@x.com', senha: SENHA });

    expect(r.status).toBe(409);
  });

  it('400 para senha de 7 caracteres', async () => {
    const r = await request(app)
      .post('/auth/registrar')
      .send({ email: 'c@x.com', senha: '1234567' });

    expect(r.status).toBe(400);
  });
});

describe('POST /auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/auth/registrar').send({ email: 'a@x.com', senha: SENHA });
  });

  it('200 com accessToken e cookie HttpOnly', async () => {
    const r = await request(app)
      .post('/auth/login')
      .send({ email: 'a@x.com', senha: SENHA });

    expect(r.status).toBe(200);
    expect(r.body.accessToken).toEqual(expect.any(String));

    const cookies = (r.headers['set-cookie'] as unknown as string[]).join(';');
    // `HttpOnly` é o que impede um XSS de ler o refresh token. Perder esse
    // atributo não quebra nada visivelmente — daí o teste.
    expect(cookies).toContain('HttpOnly');
    expect(cookies).toContain('SameSite=Strict');
    expect(cookies).toContain('Path=/auth');
  });

  it('o refreshToken NÃO aparece no corpo', async () => {
    const r = await request(app)
      .post('/auth/login')
      .send({ email: 'a@x.com', senha: SENHA });

    // Repetir o refresh no corpo anularia o `HttpOnly`: o front leria a resposta
    // e provavelmente o guardaria onde um XSS alcança.
    expect(r.body.refreshToken).toBeUndefined();
  });

  it('senha errada e e-mail inexistente dão a MESMA resposta', async () => {
    const errada = await request(app)
      .post('/auth/login')
      .send({ email: 'a@x.com', senha: 'errada12345' });
    const inexistente = await request(app)
      .post('/auth/login')
      .send({ email: 'nao@existe.com', senha: 'errada12345' });

    expect(errada.status).toBe(401);
    expect(inexistente.status).toBe(401);

    // Qualquer diferença — inclusive um ponto final — reabre a enumeração de
    // usuários. Comparar as mensagens é a única forma de garantir que elas não
    // divergiram numa edição distraída.
    expect(errada.body.erro).toBe(inexistente.body.erro);
  });
});

describe('GET /auth/eu', () => {
  it('401 sem token', async () => {
    expect((await request(app).get('/auth/eu')).status).toBe(401);
  });

  it('200 com token', async () => {
    const token = await registrarELogar(app, 'a@x.com');
    const r = await request(app).get('/auth/eu').set(comToken(token));

    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ email: 'a@x.com' });
    expect(JSON.stringify(r.body)).not.toContain('senhaHash');
  });

  it('401 quando falta o prefixo "Bearer "', async () => {
    const token = await registrarELogar(app, 'a@x.com');
    const r = await request(app).get('/auth/eu').set('Authorization', token);

    expect(r.status).toBe(401);
  });

  it('401 para token com o payload alterado', async () => {
    const token = await registrarELogar(app, 'a@x.com');
    const [cabecalho, , assinatura] = token.split('.');

    // Um payload forjado com `papel: admin`, mantendo a assinatura original.
    // Este é O teste do JWT: se ele passar, alguém trocou `verify` por `decode`.
    const payloadForjado = Buffer.from(
      JSON.stringify({ sub: '1', papel: 'admin' }),
    ).toString('base64url');
    const forjado = `${cabecalho}.${payloadForjado}.${assinatura}`;

    expect((await request(app).get('/auth/eu').set(comToken(forjado))).status).toBe(401);
  });
});

describe('refresh e logout', () => {
  /** Faz login e devolve os cookies para reenviar. */
  async function logarComCookie(email: string) {
    const r = await request(app).post('/auth/login').send({ email, senha: SENHA });
    return r.headers['set-cookie'] as unknown as string[];
  }

  beforeEach(async () => {
    await request(app).post('/auth/registrar').send({ email: 'a@x.com', senha: SENHA });
  });

  it('refresh devolve access novo e rotaciona o cookie', async () => {
    const cookies = await logarComCookie('a@x.com');

    const r = await request(app).post('/auth/refresh').set('Cookie', cookies);

    expect(r.status).toBe(200);
    expect(r.body.accessToken).toEqual(expect.any(String));
    expect(r.headers['set-cookie']).toBeDefined(); // rotacionou
  });

  it('o refresh ANTERIOR deixa de funcionar depois da rotação', async () => {
    const cookies = await logarComCookie('a@x.com');
    await request(app).post('/auth/refresh').set('Cookie', cookies);

    // Reusar o token já rotacionado. É o sinal de roubo que a rotação existe
    // para detectar — e é a parte que quase todo tutorial de JWT esquece.
    const r = await request(app).post('/auth/refresh').set('Cookie', cookies);
    expect(r.status).toBe(401);
  });

  it('depois do logout, refresh dá 401', async () => {
    const cookies = await logarComCookie('a@x.com');

    expect((await request(app).post('/auth/logout').set('Cookie', cookies)).status).toBe(
      204,
    );
    expect((await request(app).post('/auth/refresh').set('Cookie', cookies)).status).toBe(
      401,
    );
  });

  it('logout sem cookie nenhum ainda é 204', async () => {
    // Recusar um pedido de sair não protege nada e deixa o usuário preso numa
    // tela de erro.
    expect((await request(app).post('/auth/logout')).status).toBe(204);
  });

  it('refresh sem token dá 401, não 500', async () => {
    expect((await request(app).post('/auth/refresh')).status).toBe(401);
  });
});

describe('POST /auth/trocar-senha', () => {
  it('401 com a senha atual errada, mesmo autenticado', async () => {
    const token = await registrarELogar(app, 'a@x.com');

    // O token prova que a SESSÃO é legítima, não que quem está no teclado é o
    // dono. Quem senta no computador destravado de outra pessoa tem a sessão.
    const r = await request(app)
      .post('/auth/trocar-senha')
      .set(comToken(token))
      .send({ senhaAtual: 'errada12345', novaSenha: 'nova123456' });

    expect(r.status).toBe(401);
  });

  it('troca a senha e derruba as sessões', async () => {
    await request(app).post('/auth/registrar').send({ email: 'a@x.com', senha: SENHA });
    const login = await request(app)
      .post('/auth/login')
      .send({ email: 'a@x.com', senha: SENHA });
    const cookies = login.headers['set-cookie'] as unknown as string[];

    const r = await request(app)
      .post('/auth/trocar-senha')
      .set(comToken(login.body.accessToken))
      .send({ senhaAtual: SENHA, novaSenha: 'nova123456' });

    expect(r.status).toBe(200);
    expect(r.body.sessoesEncerradas).toBeGreaterThan(0);

    // O motivo mais comum para trocar senha é suspeitar que alguém a tem. Se as
    // sessões antigas continuassem valendo, a troca não expulsaria o invasor.
    expect((await request(app).post('/auth/refresh').set('Cookie', cookies)).status).toBe(
      401,
    );

    // E a senha nova funciona.
    expect(
      (
        await request(app)
          .post('/auth/login')
          .send({ email: 'a@x.com', senha: 'nova123456' })
      ).status,
    ).toBe(200);
  });
});
