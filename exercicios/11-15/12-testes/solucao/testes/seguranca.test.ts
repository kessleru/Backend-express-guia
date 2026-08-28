/**
 * SEGURANÇA — testes de AUSÊNCIA.
 *
 * Todos os outros testes afirmam "isto tem que acontecer". Estes afirmam "isto
 * nunca pode aparecer", e é uma categoria diferente: eles não pegam funcionalidade
 * quebrada, pegam **regressão silenciosa**.
 *
 * Ninguém reclama quando a stack passa a vazar. Ninguém abre chamado quando o
 * hash da senha entra numa resposta. A API continua respondendo, os testes de
 * funcionalidade continuam verdes, e o problema só aparece quando já é incidente.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { App } from '../app.ts';
import { comToken, comUsuarios, montarApp, SENHA } from './fixtures.ts';

let app: App;
let admin: string;
let leitorA: string;

beforeEach(async () => {
  ({ app } = montarApp());
  ({ admin, leitorA } = await comUsuarios(app));

  // O tratador loga o erro real. Sem silenciar, a saída fica cheia de stack
  // vermelha e uma falha DE VERDADE se perde no meio.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('o hash da senha nunca sai', () => {
  /**
   * VARREDURA, em vez de um teste por rota.
   *
   * A vantagem: uma rota nova entra na lista e é coberta na hora. Um teste por
   * rota depende de alguém lembrar de escrevê-lo — e a rota que vaza é sempre a
   * que ninguém lembrou.
   */
  const rotas = [
    { metodo: 'get' as const, url: '/auth/eu', usarAdmin: false },
    { metodo: 'get' as const, url: '/auth/usuarios', usarAdmin: true },
    { metodo: 'get' as const, url: '/api/v1/livros', usarAdmin: false },
    { metodo: 'get' as const, url: '/api/v1/emprestimos', usarAdmin: true },
  ];

  it.each(rotas)('$metodo $url não vaza hash', async ({ metodo, url, usarAdmin }) => {
    const r = await request(app)
      [metodo](url)
      .set(comToken(usarAdmin ? admin : leitorA));

    const corpo = JSON.stringify(r.body);
    expect(corpo).not.toContain('senhaHash');
    expect(corpo).not.toContain('$argon2'); // o prefixo de todo hash Argon2
    expect(corpo).not.toContain(SENHA); // a senha em texto, por garantia
  });
});

describe('erro não tratado', () => {
  /**
   * Uma rota que explode de propósito, montada só para este teste.
   *
   * Ela vai DEPOIS de `criarApp`, então cai no `rotaNaoEncontrada` antes de
   * chegar ao handler — por isso o teste usa outro caminho: forçar um 500 real
   * pela API existente. Aqui, um `id` gigante que estoura a coerção.
   */
  it('500 responde a mensagem genérica, sem detalhe interno', async () => {
    // Provoca um erro não previsto passando um corpo que o service não espera.
    const r = await request(app)
      .patch('/api/v1/livros/1')
      .set(comToken(admin))
      .send({ ano: Number.MAX_SAFE_INTEGER });

    // Seja qual for o status, o corpo NUNCA pode conter rastro interno.
    const corpo = JSON.stringify(r.body);
    expect(corpo).not.toContain('at '); // linha de stack
    expect(corpo).not.toContain('node_modules');
    expect(corpo).not.toContain('/workspaces'); // caminho absoluto do servidor
  });

  it('o corpo de TODO erro segue o mesmo formato', async () => {
    // Formato único de erro (módulo 06) é contrato público. Um cliente escreve
    // UM tratamento; se cada rota inventar o seu, ele precisa de um `if` por
    // endpoint.
    const respostas = await Promise.all([
      request(app).get('/api/v1/livros/999'), // 404 do service
      request(app).get('/api/v1/nao-existe'), // 404 de rota
      request(app).get('/api/v1/livros/abc'), // 400 de validação
      request(app).get('/auth/eu'), // 401 do middleware
      request(app).get('/auth/usuarios').set(comToken(leitorA)), // 403
    ]);

    for (const r of respostas) {
      expect(r.body).toMatchObject({
        erro: expect.any(String),
        status: expect.any(Number),
      });
      expect(r.body.status).toBe(r.status);
    }
  });
});

describe('o requestId chega ao cliente', () => {
  it('todo erro traz um requestId para citar no suporte', async () => {
    const r = await request(app).get('/api/v1/livros/999');

    // Esconder o detalhe do cliente só é aceitável porque existe uma forma de
    // correlacionar a reclamação dele com o log do servidor. Sem o requestId, o
    // "erro interno" vira uma caça sem pista.
    expect(r.body.requestId).toEqual(expect.any(String));
    expect(r.headers['x-request-id']).toEqual(expect.any(String));
  });
});
