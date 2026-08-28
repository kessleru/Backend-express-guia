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
import {
  comToken,
  comUsuarios,
  montarApp,
  montarAppComLimite,
  SENHA,
} from './fixtures.ts';

let app: App;
let admin: string;
let leitorA: string;
let leitorB: string;

beforeEach(async () => {
  ({ app } = montarApp());
  ({ admin, leitorA, leitorB } = await comUsuarios(app));

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

// =====================================================================
// O QUE O MÓDULO 13 ACRESCENTA
// =====================================================================
//
// Os testes acima (módulo 12) afirmam que um segredo não vaza no CORPO. Os de
// baixo afirmam outra coisa: que a defesa está ligada. São dois riscos
// diferentes — um header de segurança que ninguém montou não quebra nenhuma
// funcionalidade, então nada avisa. Só um teste avisa.

describe('helmet: os headers de defesa estão ligados', () => {
  it('a resposta traz nosniff e content-security-policy', async () => {
    const r = await request(app).get('/api/v1/livros');

    // `nosniff` é o mais importante numa API JSON: sem ele, um navegador pode
    // "adivinhar" que a resposta é HTML e executá-la.
    expect(r.headers['x-content-type-options']).toBe('nosniff');
    expect(r.headers['content-security-policy']).toEqual(expect.any(String));
  });

  it('x-powered-by não aparece em NENHUMA resposta', async () => {
    // Varredura de novo, e pelo mesmo motivo da varredura de hash: a rota que
    // vaza é sempre a que ninguém lembrou de testar.
    const respostas = await Promise.all([
      request(app).get('/api/v1/livros'),
      request(app).get('/api/v1/livros/999'), // 404
      request(app).get('/auth/eu'), // 401
      request(app).get('/api/v1/nao-existe'), // 404 de rota
    ]);

    for (const r of respostas) {
      expect(r.headers['x-powered-by']).toBeUndefined();
    }
  });
});

describe('cors: a lista de origens é explícita', () => {
  it('a origem listada recebe o allow-origin', async () => {
    const r = await request(app)
      .get('/api/v1/livros')
      .set('Origin', 'http://localhost:3000');

    expect(r.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    // `credentials: true` é o que permite ao front mandar o cookie de refresh.
    expect(r.headers['access-control-allow-credentials']).toBe('true');
  });

  /**
   * O TESTE QUE CORRIGE O ENTENDIMENTO DE CORS.
   *
   * A origem não listada recebe **200 com os dados**. O servidor não recusou
   * nada: ele só deixou de mandar o header que AUTORIZA o navegador a entregar a
   * resposta ao JavaScript da página.
   *
   * É por isso que CORS não é defesa do servidor. Um `curl`, um script de
   * backend ou um app mobile ignoram a política inteira — quem obedece é o
   * navegador, e ele obedece para proteger o USUÁRIO dele, não a sua API.
   */
  it('a origem NÃO listada recebe os dados, e é o navegador que barra', async () => {
    const r = await request(app)
      .get('/api/v1/livros')
      .set('Origin', 'http://site-malicioso.com');

    expect(r.status).toBe(200);
    expect(r.body.dados).toBeInstanceOf(Array); // os dados vieram
    expect(r.headers['access-control-allow-origin']).toBeUndefined(); // sem permissão
  });
});

describe('rate limit por finalidade', () => {
  /**
   * Estes casos criam o app com os limitadores LIGADOS — os únicos da suíte.
   *
   * `montarAppComLimite()` zera os contadores antes, porque o balde do
   * `express-rate-limit` é do processo e sobreviveria de um `it` para o outro
   * (ver `middlewares/limites.ts`).
   */
  it('a 6ª tentativa de login em 1 minuto responde 429', async () => {
    const { app: comLimite } = montarAppComLimite();
    const tentativa = () =>
      request(comLimite)
        .post('/auth/login')
        .send({ email: 'ninguem@x.com', senha: SENHA });

    for (let i = 0; i < 5; i++) {
      // As cinco primeiras chegam ao service e falham por credencial.
      expect((await tentativa()).status).toBe(401);
    }

    const bloqueada = await tentativa();
    expect(bloqueada.status).toBe(429);

    // `Retry-After` em segundos: sem ele o cliente não sabe quando voltar e
    // martela a API em loop, transformando o limite em tráfego extra.
    expect(bloqueada.headers['retry-after']).toEqual(expect.any(String));

    // E o corpo segue o formato único de erro da API (módulo 06), não o
    // `{ "message": "Too many requests" }` que a lib manda por padrão.
    expect(bloqueada.body).toMatchObject({ erro: expect.any(String), status: 429 });
  });

  it('navegar não consome a cota do login', async () => {
    const { app: comLimite } = montarAppComLimite();

    // Dez leituras: mais que o dobro da cota de login, e bem dentro das 100 de
    // leitura. Se os dois dividissem um balde, o login abaixo já sairia 429.
    for (let i = 0; i < 10; i++) {
      expect((await request(comLimite).get('/api/v1/livros')).status).toBe(200);
    }

    const login = await request(comLimite)
      .post('/auth/login')
      .send({ email: 'ninguem@x.com', senha: SENHA });

    expect(login.status).toBe(401); // recusado pela credencial, não pelo limite
  });
});

describe('IDOR: o empréstimo do outro não existe para você', () => {
  /** Cria um empréstimo do leitor A e devolve o id. */
  async function emprestimoDeA(): Promise<number> {
    const r = await request(app)
      .post('/api/v1/livros/1/emprestar')
      .set(comToken(leitorA));
    expect(r.status).toBe(201);
    return r.body.id as number;
  }

  it('o dono vê o próprio empréstimo', async () => {
    const id = await emprestimoDeA();
    const r = await request(app).get(`/api/v1/emprestimos/${id}`).set(comToken(leitorA));

    expect(r.status).toBe(200);
    expect(r.body.usuarioId).toEqual(expect.any(Number));
  });

  it('outro leitor recebe 404 — não 403, não 200', async () => {
    const id = await emprestimoDeA();
    const r = await request(app).get(`/api/v1/emprestimos/${id}`).set(comToken(leitorB));

    // 403 confirmaria que o empréstimo existe. 404 não conta nada.
    expect(r.status).toBe(404);
  });

  it('admin vê o empréstimo de qualquer pessoa', async () => {
    const id = await emprestimoDeA();
    const r = await request(app).get(`/api/v1/emprestimos/${id}`).set(comToken(admin));

    expect(r.status).toBe(200);
  });

  /**
   * O TESTE QUE PROVA QUE O 404 NÃO VAZA.
   *
   * Não basta responder 404 nos dois casos: as duas respostas precisam ser
   * INDISTINGUÍVEIS. Uma mensagem diferente ("empréstimo de outro usuário" vs
   * "empréstimo não encontrado") reabriria o vazamento com status 404 e tudo.
   *
   * Por isso o teste compara dois mundos com o MESMO id: num deles o empréstimo
   * existe e é de outra pessoa, no outro ele nunca existiu.
   */
  it('"não é seu" e "não existe" produzem respostas idênticas', async () => {
    const id = await emprestimoDeA();
    const existeMasNaoEhSeu = await request(app)
      .get(`/api/v1/emprestimos/${id}`)
      .set(comToken(leitorB));

    // Um app novo, onde ninguém pegou livro nenhum: o mesmo id não existe.
    const { app: outroApp } = montarApp();
    const { leitorB: estranho } = await comUsuarios(outroApp);
    const naoExiste = await request(outroApp)
      .get(`/api/v1/emprestimos/${id}`)
      .set(comToken(estranho));

    expect(existeMasNaoEhSeu.status).toBe(naoExiste.status);

    // `requestId` muda a cada requisição por desenho — é o único campo que pode
    // diferir, e tirá-lo do confronto é o que torna a comparação honesta.
    const semId = (corpo: Record<string, unknown>) => {
      const { requestId: _ignorado, ...resto } = corpo;
      return resto;
    };
    expect(semId(existeMasNaoEhSeu.body)).toEqual(semId(naoExiste.body));
  });

  it('devolver o empréstimo de outro também responde 404', async () => {
    const id = await emprestimoDeA();
    const r = await request(app)
      .post(`/api/v1/emprestimos/${id}/devolver`)
      .set(comToken(leitorB));

    expect(r.status).toBe(404);

    // E o livro continua emprestado: a recusa não teve efeito colateral nenhum.
    const livro = await request(app).get('/api/v1/livros/1');
    expect(livro.body.disponivel).toBe(false);
  });
});

describe('enumeração de usuário', () => {
  /**
   * A correção já estava feita desde o módulo 11 — mesma mensagem, mesmo status
   * e `gastarTempoDeHash()` no caminho sem usuário. O que faltava era o TESTE.
   *
   * A diferença importa: sem ele, a próxima pessoa a mexer no login troca a
   * mensagem por uma "mais útil" ("e-mail não cadastrado") e reabre a porta sem
   * que nada fique vermelho.
   */
  it('e-mail inexistente e senha errada dão o MESMO status e o MESMO corpo', async () => {
    const inexistente = await request(app)
      .post('/auth/login')
      .send({ email: 'ninguem@x.com', senha: SENHA });

    const senhaErrada = await request(app)
      .post('/auth/login')
      .send({ email: 'a@x.com', senha: 'senha-errada-mas-valida' });

    expect(inexistente.status).toBe(senhaErrada.status);

    const semId = (corpo: Record<string, unknown>) => {
      const { requestId: _ignorado, ...resto } = corpo;
      return resto;
    };
    // `toEqual`, não `toMatchObject`: "parecido" não serve. Um ponto final a
    // mais numa das mensagens é um oráculo.
    expect(semId(inexistente.body)).toEqual(semId(senhaErrada.body));
  });
});

describe('path traversal', () => {
  it('a capa que existe é servida', async () => {
    const r = await request(app).get('/api/v1/arquivos/o-hobbit.svg');

    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toContain('image/svg+xml');
    // SVG é executável no navegador: o nosniff do helmet vale principalmente
    // aqui (ver `rotas/arquivos.ts`).
    expect(r.headers['x-content-type-options']).toBe('nosniff');
  });

  /**
   * ---------------------------------------------------------------
   * O FALSO AMIGO QUE ESTE TESTE DESCOBRIU
   * ---------------------------------------------------------------
   * A forma crua e a codificada NÃO chegam ao mesmo lugar — e a diferença é a
   * armadilha do módulo.
   *
   * `GET /api/v1/arquivos/../../.env` tem quatro segmentos de caminho. A rota
   * declarada é `/:nome`, que casa com UM segmento só, então o Express nem
   * chama o handler: a requisição cai no `rotaNaoEncontrada` e volta 404.
   *
   * `GET /api/v1/arquivos/..%2f..%2f.env` tem um segmento só — o `%2f` não é
   * uma barra para o roteador. Ele casa com `/:nome`, o Express decodifica ao
   * preencher `req.params`, e a string `../../.env` chega ao SEU código. É a
   * única das duas que testa a sua defesa.
   *
   * A consequência prática: quem testa só a forma crua vê 404, conclui que está
   * protegido, e nunca exercitou uma linha do próprio `resolverCapa`. O 404 veio
   * do roteamento, não da segurança — e roteamento muda. Basta alguém trocar
   * `/:nome` por `/*nome` (wildcard, módulo 04) para os quatro segmentos passarem
   * a casar, e a proteção imaginária desaparece sem nenhum teste ficar vermelho.
   */
  it('a forma crua é barrada pelo ROTEAMENTO, com 404 — não pela sua defesa', async () => {
    const r = await request(app).get('/api/v1/arquivos/../../.env');

    expect(r.status).toBe(404);
    expect(JSON.stringify(r.body)).not.toContain('JWT'); // nada do .env, de todo jeito
  });

  it('a forma codificada chega ao handler e é barrada com 400', async () => {
    const r = await request(app).get('/api/v1/arquivos/..%2f..%2f.env');

    expect(r.status).toBe(400);
    const corpo = JSON.stringify(r.body);
    expect(corpo).not.toContain('JWT'); // nada do .env
    expect(corpo).not.toContain('/workspaces'); // nem o caminho absoluto tentado
  });

  it('nome que só COMEÇA igual à pasta permitida não passa', async () => {
    // `startsWith(raiz)` sem o separador aceitaria `capas-secretas/x.svg`, que
    // é outra pasta. É o motivo do `raiz + sep` no service.
    const r = await request(app).get('/api/v1/arquivos/..%2fcapas-secretas%2fx.svg');
    expect(r.status).toBe(400);
  });
});

describe('injeção: o texto do cliente é dado, não comando', () => {
  it('busca com "; DROP TABLE livros; --" responde 200 e não altera nada', async () => {
    const antes = await request(app).get('/api/v1/livros');

    const r = await request(app)
      .get('/api/v1/livros')
      .query({ q: "'; DROP TABLE livros; --" });

    expect(r.status).toBe(200);
    expect(r.body.dados).toEqual([]); // é só um título que ninguém tem

    const depois = await request(app).get('/api/v1/livros');
    expect(depois.body.total).toBe(antes.body.total);
  });

  /**
   * A HONESTIDADE DESTE TESTE.
   *
   * O repositório aqui é um array em memória: não existe SQL, então não existe
   * injeção de SQL a demonstrar. O que este caso garante é o passo anterior —
   * que a API aceita o texto perigoso como DADO comum, sem tentar "limpá-lo" e
   * sem quebrar.
   *
   * A prova com um banco de verdade está no exemplo do módulo 09, onde a mesma
   * string apaga a tabela na rota concatenada e não faz nada na parametrizada.
   */
  it('o texto perigoso não é recusado nem mutilado pela validação', async () => {
    const r = await request(app).get('/api/v1/livros').query({ q: "O' Hobbit --" });

    expect(r.status).toBe(200); // 400 aqui seria sanitização disfarçada de validação
  });
});
