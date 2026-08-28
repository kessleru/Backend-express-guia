/**
 * INTEGRAÇÃO HTTP — o que só existe dentro do Express.
 *
 * Status code, header `Location`, formato do corpo de erro, o middleware de
 * validação e a ordem das rotas. Nada disso é alcançável pelo teste unitário.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { App } from '../app.ts';
import { comToken, comUsuarios, montarApp, novoLivro } from './fixtures.ts';

let app: App;
let admin: string;

// `beforeEach`, não `beforeAll`: app e "banco" novos por teste. O POST de um
// teste não pode mudar a contagem do próximo.
beforeEach(async () => {
  ({ app } = montarApp());
  ({ admin } = await comUsuarios(app));
});

describe('GET /api/v1/livros', () => {
  it('200 e a lista paginada — rota pública', async () => {
    const r = await request(app).get('/api/v1/livros');

    expect(r.status).toBe(200);
    // O contrato de paginação (módulo 08) é público: o front depende de `total`
    // para desenhar os botões de página.
    expect(r.body).toMatchObject({ pagina: 1, total: 2 });
    expect(r.body.dados).toHaveLength(2);
  });

  it('400 para porPagina acima do máximo', async () => {
    // O limite existe para proteger o SERVIDOR: `?porPagina=999999` é um vetor
    // de negação de serviço barato de disparar. Testá-lo trava a decisão.
    expect((await request(app).get('/api/v1/livros?porPagina=9999')).status).toBe(400);
  });
});

describe('GET /api/v1/livros/:id', () => {
  it('404 no formato de erro padrão', async () => {
    const r = await request(app).get('/api/v1/livros/999');

    expect(r.status).toBe(404);
    // O FORMATO do erro é contrato público. Testá-lo impede que alguém o
    // "melhore" e quebre todo cliente que lê `erro`.
    expect(r.body).toMatchObject({ erro: expect.any(String), status: 404 });
  });

  it('400 quando o id não é número', async () => {
    expect((await request(app).get('/api/v1/livros/abc')).status).toBe(400);
  });
});

describe('POST /api/v1/livros', () => {
  it('201 com Location e o corpo criado', async () => {
    const r = await request(app)
      .post('/api/v1/livros')
      .set(comToken(admin))
      .send(novoLivro());

    expect(r.status).toBe(201);
    expect(r.headers.location).toBe('/api/v1/livros/3');
    expect(r.body).toMatchObject({ id: 3, titulo: 'Solaris' });
  });

  it('400 lista o campo que falta', async () => {
    const r = await request(app)
      .post('/api/v1/livros')
      .set(comToken(admin))
      .send({ titulo: 'Sem autor' });

    expect(r.status).toBe(400);
    // O valor de um erro de validação é dizer O QUE corrigir. Testar só o 400
    // deixaria passar um "Dados inválidos" sem detalhe, que é inútil.
    expect(JSON.stringify(r.body)).toContain('autorId');
  });

  it('400 para campo desconhecido (.strict do Zod)', async () => {
    const r = await request(app)
      .post('/api/v1/livros')
      .set(comToken(admin))
      .send(novoLivro({ editora: 'Acme' }));

    expect(r.status).toBe(400);
  });

  it('400 sem Content-Type: application/json', async () => {
    // O ACHADO DO MÓDULO 03 virando trava.
    //
    // No Express 5, sem `Content-Type` o `req.body` fica `undefined` — não `{}`.
    // O `?? {}` no middleware de validação é o que transforma isso em "faltam os
    // campos X e Y" em vez de "expected object, received undefined". Este teste
    // avisa se alguém remover o `?? {}` achando que é redundante.
    const r = await request(app)
      .post('/api/v1/livros')
      .set(comToken(admin))
      .set('Content-Type', 'text/plain')
      .send('titulo=X');

    expect(r.status).toBe(400);
  });

  it('400 para JSON malformado — culpa do cliente é 4xx', async () => {
    const r = await request(app)
      .post('/api/v1/livros')
      .set(comToken(admin))
      .set('Content-Type', 'application/json')
      .send('{"titulo": ');

    // Como 500, este caso apareceria nos seus alertas e você caçaria um bug seu
    // que não existe.
    expect(r.status).toBe(400);
  });
});

describe('PATCH /api/v1/livros/:id', () => {
  it('altera só o campo enviado', async () => {
    const r = await request(app)
      .patch('/api/v1/livros/1')
      .set(comToken(admin))
      .send({ ano: 1938 });

    expect(r.status).toBe(200);
    // O TÍTULO E OS GÊNEROS TÊM QUE SOBREVIVER.
    //
    // É a armadilha do módulo 07: `criarLivroSchema.partial()` manteria o
    // `.default(['ficcao'])`, e um PATCH de ano apagaria os gêneros salvos em
    // silêncio. Nenhum erro, nenhum log — só dado perdido.
    expect(r.body).toMatchObject({
      ano: 1938,
      titulo: 'O Hobbit',
      generos: ['fantasia'],
    });
  });
});

describe('DELETE /api/v1/livros/:id', () => {
  it('204 e o livro some', async () => {
    expect(
      (await request(app).delete('/api/v1/livros/1').set(comToken(admin))).status,
    ).toBe(204);
    expect((await request(app).get('/api/v1/livros/1')).status).toBe(404);
  });

  it('409 para livro emprestado', async () => {
    // O cenário é montado PELA API, não por dentro do repositório: assim o teste
    // exercita o fluxo real e pegaria um `emprestar` que responde 201 sem gravar.
    await request(app).post('/api/v1/livros/1/emprestar').set(comToken(admin));

    const r = await request(app).delete('/api/v1/livros/1').set(comToken(admin));
    expect(r.status).toBe(409);
  });
});

describe('rota inexistente', () => {
  it('404 no mesmo formato dos outros erros', async () => {
    const r = await request(app).get('/api/v1/nao-existe');

    expect(r.status).toBe(404);
    expect(r.body).toMatchObject({ status: 404 });
  });
});
