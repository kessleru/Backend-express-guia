/**
 * TESTE DE SEGURANÇA — a stack trace nunca vaza.
 *
 * Este é o teste que o desafio extra do exercício 06 pediu, e ele é um bom
 * primeiro caso porque mostra um uso de teste que não é "verificar se funciona":
 *
 *   **teste como TRAVA de uma decisão.**
 *
 * O tratador central (módulo 06) devolve `{ erro: 'Erro interno do servidor' }`
 * para qualquer bug, e loga o detalhe só no servidor. É uma decisão consciente,
 * fácil de desfazer sem querer: basta alguém "melhorar o debug" incluindo
 * `erro.message` na resposta durante uma investigação e esquecer de tirar.
 *
 * Nada quebra quando isso acontece. Nenhum usuário reclama. A API continua
 * respondendo 500 normalmente — só que agora com o caminho dos seus arquivos, a
 * versão do Node, o IP do banco (`connect ECONNREFUSED 10.0.0.5:5432`) ou o
 * conteúdo da variável que causou o erro.
 *
 * Um teste é a única coisa que reclama. Princípio: **o que não pode regredir em
 * silêncio precisa de teste, mesmo que já esteja certo.**
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { criarApp, type App } from '../app.ts';
import { criarRepositorioMemoria } from '../repositorios/memoria.ts';
import { livrosDeTeste } from './fixtures.ts';

let app: App;

beforeEach(() => {
  app = criarApp(criarRepositorioMemoria(livrosDeTeste()));

  // O tratador loga o erro real com `console.error`. Sem silenciar, a saída do
  // teste fica cheia de stack trace vermelha e um erro DE VERDADE se perde no
  // meio. `vi.spyOn` com implementação vazia cala sem apagar o método.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('erro não tratado', () => {
  it('responde 500 com mensagem genérica', async () => {
    const resposta = await request(app).get('/boom');

    expect(resposta.status).toBe(500);
    expect(resposta.body).toMatchObject({
      erro: 'Erro interno do servidor',
      status: 500,
    });
  });

  it('NÃO devolve stack, mensagem interna nem nome de arquivo', async () => {
    const resposta = await request(app).get('/boom');

    // A asserção é sobre o corpo INTEIRO serializado, não sobre campos
    // específicos. Testar `expect(resposta.body.stack).toBeUndefined()` deixaria
    // passar um `detalhes: { stack: '...' }` ou um `debug` novo.
    //
    // Princípio: **para o que não pode aparecer, teste a ausência no todo.**
    const corpo = JSON.stringify(resposta.body);

    expect(corpo).not.toContain('senha=123'); // a mensagem interna do erro
    expect(corpo).not.toContain('at '); // formato de linha de stack
    expect(corpo).not.toContain('.ts'); // caminho de arquivo do servidor
    expect(corpo).not.toContain('node_modules');
  });

  it('o detalhe do erro vai para o LOG, não para a resposta', async () => {
    // O outro lado da moeda: esconder do cliente só é aceitável porque o
    // desenvolvedor continua enxergando. Um tratador que engolisse o erro em
    // silêncio passaria nos dois testes acima e seria muito pior.
    await request(app).get('/boom');

    expect(console.error).toHaveBeenCalled();
    const logado = vi.mocked(console.error).mock.calls.flat().join(' ');
    expect(logado).toContain('ERRO NÃO TRATADO');
  });
});

describe('JSON malformado do cliente', () => {
  it('é 400, não 500', async () => {
    // Culpa do cliente tem que ser 4xx. Como 500, este caso apareceria nos seus
    // alertas de erro e você caçaria um bug que não existe — e o cliente nunca
    // saberia que o problema era o body dele.
    const resposta = await request(app)
      .post('/livros')
      .set('Content-Type', 'application/json')
      .send('{"titulo": ');

    expect(resposta.status).toBe(400);
  });
});
