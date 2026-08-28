/**
 * TESTE DE INTEGRAÇÃO HTTP — o meio da pirâmide.
 *
 * Aqui a requisição atravessa a pilha inteira: middleware de JSON, validação,
 * rota, controller, service, repositório e tratador de erro. É o nível que pega
 * o que o unitário não vê:
 *
 *   - rota registrada no caminho errado (ou não registrada);
 *   - middleware faltando ou na ordem errada;
 *   - status code e formato de resposta;
 *   - o `AppError` do service virando (ou não) a resposta certa.
 *
 * SUPERTEST NÃO ABRE PORTA FIXA. Ele recebe o `app` — não uma URL —, sobe um
 * servidor efêmero numa porta livre escolhida pelo sistema, dispara a
 * requisição e fecha. Por isso não há `EADDRINUSE`, não há `await sleep(500)`
 * esperando o servidor subir, e os arquivos rodam em paralelo.
 *
 * É o `criarApp()` pagando: sem ele, importar o servidor já ocuparia a porta.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { criarApp, type App } from '../app.ts';
import { criarRepositorioMemoria } from '../repositorios/memoria.ts';
import { livrosDeTeste } from './fixtures.ts';

let app: App;

// `beforeEach` (e não `beforeAll`): app e "banco" novos a cada teste.
//
// Com `beforeAll`, o POST do teste 3 deixaria um livro a mais para o teste 4
// contar — e o teste 4 passaria ou falharia conforme a ordem de execução.
// Isolamento custa microssegundos aqui; um teste instável custa dias.
beforeEach(() => {
  app = criarApp(criarRepositorioMemoria(livrosDeTeste()));
});

describe('GET /livros', () => {
  it('devolve 200 e a lista', async () => {
    const resposta = await request(app).get('/livros');

    expect(resposta.status).toBe(200);
    expect(resposta.body).toHaveLength(3);

    // `toMatchObject` no primeiro item, e não `toEqual` na lista inteira: a
    // asserção fica sobre o que o teste realmente afirma. `toEqual` exaustivo
    // quebra sempre que um campo novo aparece, mesmo quando nada regrediu —
    // teste que dá alarme falso acaba sendo ignorado.
    expect(resposta.body[0]).toMatchObject({ titulo: 'O Hobbit' });
  });
});

describe('GET /livros/:id', () => {
  it('404 no formato de erro padrão da API', async () => {
    const resposta = await request(app).get('/livros/999');

    expect(resposta.status).toBe(404);
    // O CONTRATO de erro (módulo 06) é público: um cliente lê `erro` e `status`.
    // Testá-lo é o que impede alguém de "melhorar" o formato e quebrar o front.
    expect(resposta.body).toMatchObject({ erro: expect.any(String), status: 404 });
  });

  it('400 quando o id não é número', async () => {
    // O middleware de validação (módulo 07) é exercitado aqui, não no unitário —
    // ele só existe dentro do Express.
    const resposta = await request(app).get('/livros/abc');
    expect(resposta.status).toBe(400);
  });
});

describe('POST /livros', () => {
  it('201 com Location e o corpo criado', async () => {
    const resposta = await request(app)
      .post('/livros')
      .send({ titulo: 'Solaris', autorId: 4, ano: 1961 });

    expect(resposta.status).toBe(201);
    expect(resposta.headers.location).toBe('/livros/4');
    expect(resposta.body).toMatchObject({ id: 4, titulo: 'Solaris' });
  });

  it('400 lista os campos que faltam', async () => {
    const resposta = await request(app).post('/livros').send({ titulo: 'Sem autor' });

    expect(resposta.status).toBe(400);
    // O valor de uma mensagem de erro é dizer O QUE corrigir. Testar só o 400
    // deixaria passar um "Dados inválidos" sem detalhe nenhum, que é inútil para
    // quem consome a API.
    expect(JSON.stringify(resposta.body)).toContain('autorId');
  });

  it('400 quando vem campo desconhecido (.strict do Zod)', async () => {
    const resposta = await request(app)
      .post('/livros')
      .send({ titulo: 'X', autorId: 1, ano: 2000, editora: 'Acme' });

    expect(resposta.status).toBe(400);
  });

  it('400 sem Content-Type: application/json', async () => {
    // O achado do módulo 03: no Express 5, sem `Content-Type` o `req.body` fica
    // `undefined` — não `{}`. Este teste TRAVA o comportamento: se alguém mexer
    // no `?? {}` do middleware de validação, o erro volta a ser a mensagem
    // inútil "expected object, received undefined".
    //
    // É o melhor uso de teste: **um achado que custou caro vira uma trava.**
    const resposta = await request(app)
      .post('/livros')
      .set('Content-Type', 'text/plain')
      .send('titulo=X');

    expect(resposta.status).toBe(400);
  });
});

describe('PATCH /livros/:id', () => {
  it('altera só o campo enviado', async () => {
    const resposta = await request(app).patch('/livros/1').send({ ano: 1938 });

    expect(resposta.status).toBe(200);
    expect(resposta.body).toMatchObject({ ano: 1938, titulo: 'O Hobbit' });
  });
});

describe('DELETE /livros/:id', () => {
  it('204 e o livro some', async () => {
    expect((await request(app).delete('/livros/1')).status).toBe(204);
    expect((await request(app).get('/livros/1')).status).toBe(404);
  });

  it('409 para livro emprestado', async () => {
    // O cenário é montado PELA API, não por dentro do repositório. Assim o teste
    // exercita o fluxo que o usuário realmente faz — e pegaria um `emprestar`
    // que respondesse 200 sem gravar nada.
    await request(app).post('/livros/1/emprestar');

    const resposta = await request(app).delete('/livros/1');
    expect(resposta.status).toBe(409);
  });
});

describe('rota inexistente', () => {
  it('404 no mesmo formato dos outros erros', async () => {
    const resposta = await request(app).get('/nao-existe');

    expect(resposta.status).toBe(404);
    expect(resposta.body).toMatchObject({ status: 404 });
  });
});
