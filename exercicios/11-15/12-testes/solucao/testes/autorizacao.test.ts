/**
 * AUTORIZAÇÃO — papel e dono.
 *
 * Estes são os testes de maior valor da suíte, e a razão é o tipo de falha que
 * eles pegam: uma regra de autorização quebrada **não dá erro**. A API responde
 * 200, os dados aparecem, o log fica limpo. Só que para a pessoa errada.
 *
 * Princípio: **quanto mais silenciosa a falha, mais o teste vale.**
 *
 * Repare na simetria de cada bloco: todo teste de "pode" tem um par de "não
 * pode". Testar só o caminho permitido passaria numa API que não checa nada.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { App } from '../app.ts';
import { comToken, comUsuarios, montarApp, novoLivro } from './fixtures.ts';

let app: App;
let admin: string;
let leitorA: string;
let leitorB: string;

beforeEach(async () => {
  ({ app } = montarApp());
  ({ admin, leitorA, leitorB } = await comUsuarios(app));
});

describe('autorização por PAPEL (middleware)', () => {
  it('leitura é pública', async () => {
    expect((await request(app).get('/api/v1/livros')).status).toBe(200);
    expect((await request(app).get('/api/v1/autores')).status).toBe(200);
  });

  it('escrita sem token nenhum → 401', async () => {
    // 401, não 403: o servidor não sabe quem é. Trocar os dois faria o cliente
    // pedir permissão ao administrador quando bastava fazer login.
    expect((await request(app).post('/api/v1/livros').send(novoLivro())).status).toBe(
      401,
    );
  });

  it('escrita como leitor → 403', async () => {
    const r = await request(app)
      .post('/api/v1/livros')
      .set(comToken(leitorA))
      .send(novoLivro());

    expect(r.status).toBe(403);
  });

  it('escrita como admin → 201', async () => {
    const r = await request(app)
      .post('/api/v1/livros')
      .set(comToken(admin))
      .send(novoLivro());

    expect(r.status).toBe(201);
  });

  it('DELETE de autor como leitor → 403', async () => {
    expect(
      (await request(app).delete('/api/v1/autores/2').set(comToken(leitorA))).status,
    ).toBe(403);
  });

  it('GET /auth/usuarios: leitor 403, admin 200', async () => {
    expect((await request(app).get('/auth/usuarios').set(comToken(leitorA))).status).toBe(
      403,
    );
    expect((await request(app).get('/auth/usuarios').set(comToken(admin))).status).toBe(
      200,
    );
  });
});

describe('autorização por DONO (service)', () => {
  it('o usuarioId gravado vem do TOKEN, não do body', async () => {
    // O teste que prova a regra: mandar `usuarioId: 999` no corpo e conferir que
    // ele foi ignorado. Sem isso, um `req.body.usuarioId` no controller passaria
    // despercebido — e qualquer pessoa pegaria livro no nome de outra.
    const r = await request(app)
      .post('/api/v1/livros/1/emprestar')
      .set(comToken(leitorA))
      .send({ usuarioId: 999 });

    expect(r.status).toBe(201);
    expect(r.body.usuarioId).not.toBe(999);

    const eu = await request(app).get('/auth/eu').set(comToken(leitorA));
    expect(r.body.usuarioId).toBe(eu.body.id);
  });

  it('B não devolve o empréstimo de A → 403', async () => {
    await request(app).post('/api/v1/livros/1/emprestar').set(comToken(leitorA));

    const r = await request(app).post('/api/v1/livros/1/devolver').set(comToken(leitorB));

    expect(r.status).toBe(403);
  });

  it('A devolve o próprio empréstimo → 200', async () => {
    await request(app).post('/api/v1/livros/1/emprestar').set(comToken(leitorA));

    const r = await request(app).post('/api/v1/livros/1/devolver').set(comToken(leitorA));

    expect(r.status).toBe(200);
    expect(r.body.devolvidoEm).toEqual(expect.any(String));
  });

  it('admin devolve o empréstimo de A → 200', async () => {
    await request(app).post('/api/v1/livros/1/emprestar').set(comToken(leitorA));

    const r = await request(app).post('/api/v1/livros/1/devolver').set(comToken(admin));

    expect(r.status).toBe(200);
  });

  it('devolver livro não emprestado → 409 (não 403)', async () => {
    // A ORDEM das checagens no service, testada.
    //
    // Se o 403 viesse antes do 409, um livro que nem está emprestado responderia
    // "sem permissão" — mensagem que manda o cliente resolver o problema errado.
    const r = await request(app).post('/api/v1/livros/2/devolver').set(comToken(leitorB));

    expect(r.status).toBe(409);
  });

  it('emprestar livro já emprestado → 409', async () => {
    await request(app).post('/api/v1/livros/1/emprestar').set(comToken(leitorA));

    const r = await request(app)
      .post('/api/v1/livros/1/emprestar')
      .set(comToken(leitorB));

    expect(r.status).toBe(409);
  });
});

describe('listagem filtrada por dono', () => {
  beforeEach(async () => {
    await request(app).post('/api/v1/livros/1/emprestar').set(comToken(leitorA));
    await request(app).post('/api/v1/livros/2/emprestar').set(comToken(leitorB));
  });

  it('/emprestimos/meus mostra só os do próprio usuário', async () => {
    const r = await request(app).get('/api/v1/emprestimos/meus').set(comToken(leitorB));

    expect(r.status).toBe(200);
    expect(r.body).toHaveLength(1);
    expect(r.body[0]).toMatchObject({ livroId: 2 });

    // A asserção que importa é a NEGATIVA: o empréstimo de A não pode estar aí.
    // Testar só `toHaveLength(1)` passaria numa implementação que devolvesse o
    // primeiro empréstimo da lista, qualquer que fosse o dono.
    expect(JSON.stringify(r.body)).not.toContain('"livroId":1');
  });

  it('/emprestimos: leitor 403, admin vê todos', async () => {
    expect(
      (await request(app).get('/api/v1/emprestimos').set(comToken(leitorB))).status,
    ).toBe(403);

    const r = await request(app).get('/api/v1/emprestimos').set(comToken(admin));
    expect(r.status).toBe(200);
    expect(r.body).toHaveLength(2);
  });
});
