/**
 * Log estruturado com Pino: request id atravessando a stack, níveis por status,
 * redação de segredo e serialização de erro.
 *
 * Rodar:  node src/exemplos/11-15/14-observabilidade/servidor.ts
 * Legível: node src/exemplos/11-15/14-observabilidade/servidor.ts | npx pino-pretty
 */
import express from 'express';
import pino from 'pino';
// Import NOMEADO, não default: com `verbatimModuleSyntax`, o default do
// `pino-http` (que é CommonJS) chega como namespace e o TS recusa chamá-lo
// ("This expression is not callable"). O pacote exporta `pinoHttp` para isso.
import { pinoHttp } from 'pino-http';
import { randomUUID } from 'node:crypto';

const PORTA = 5064;

// ---------------------------------------------------------------------
// 1. O LOGGER — nível por ambiente e redação de segredo
// ---------------------------------------------------------------------

const log = pino({
  // O nível vem do ambiente: dá para ligar `debug` em produção por alguns
  // minutos sem editar código nem fazer deploy.
  level: process.env.LOG_LEVEL ?? 'info',

  // `redact` é proteção por CONFIGURAÇÃO. Confiar em "lembrar de não logar a
  // senha" falha uma vez só — e o vazamento fica no agregador para sempre.
  redact: {
    // ATENÇÃO: `redact` age nos CAMINHOS listados, não no nome do campo em
    // qualquer profundidade. `senha` cobre `{ senha }` no topo, mas NÃO cobre
    // `{ corpo: { senha } }` — daí `corpo.senha` e `*.senha` abaixo.
    // Foi um vazamento real durante a escrita deste exemplo: o teste pegou.
    paths: [
      'senha',
      'token',
      '*.senha', // um nível de aninhamento (corpo.senha, usuario.senha…)
      'corpo.senha',
      'req.body.senha',
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
    ],
    censor: '[REDACTED]',
  },
});

// ---------------------------------------------------------------------
// 2. pino-http — uma linha estruturada por requisição, com id
// ---------------------------------------------------------------------

const app = express();
app.use(express.json());

// Os callbacks do pino-http recebem `IncomingMessage`/`ServerResponse` do
// `node:http`, não o `Request`/`Response` do Express — e não são inferidos.
// Sem anotar, o `tsc` acusa TS7006 (parâmetro com `any` implícito).
type ReqHttp = import('node:http').IncomingMessage;
type ResHttp = import('node:http').ServerResponse;

app.use(
  pinoHttp({
    logger: log,

    // Reaproveita o id que o proxy (ou outro serviço) já mandou. Gerar um novo
    // aqui quebraria o rastro entre serviços — o log de cada um teria um id
    // diferente para a MESMA jornada do usuário.
    genReqId: (req: ReqHttp, res: ResHttp) => {
      const recebido = req.headers['x-request-id'];
      const id = typeof recebido === 'string' && recebido ? recebido : randomUUID();
      // Devolver no header é o que permite ao usuário abrir um chamado com o id
      // e você achar a requisição exata, em vez de caçar por horário.
      res.setHeader('x-request-id', id);
      return id;
    },

    // Sem isto TODA requisição sai como `info`, inclusive as 500 — e aí o
    // filtro por gravidade não encontra o que importa.
    customLogLevel: (_req: ReqHttp, res: ResHttp, erro?: Error) => {
      if (erro || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },

    customSuccessMessage: (req: ReqHttp, res: ResHttp) =>
      `${req.method} ${req.url} → ${res.statusCode}`,
  }),
);

// ---------------------------------------------------------------------
// "Banco" e uma camada de service, para mostrar o id descendo junto
// ---------------------------------------------------------------------

const livros = [
  { id: 1, titulo: 'O Hobbit', autor: 'Tolkien' },
  { id: 2, titulo: 'Duna', autor: 'Herbert' },
];

type Logger = pino.Logger;

// O service recebe o LOGGER da requisição, não o global. É o mesmo princípio de
// injeção do módulo 08: quem chama decide o contexto.
function servicoBuscarLivro(id: number, logger: Logger) {
  logger.debug({ id }, 'buscando livro'); // só aparece com LOG_LEVEL=debug
  const livro = livros.find((l) => l.id === id);
  if (!livro) {
    // `warn`: anormal, mas tratado. Não é erro do servidor.
    logger.warn({ id }, 'livro não encontrado');
    return null;
  }
  logger.info({ id, titulo: livro.titulo }, 'livro encontrado');
  return livro;
}

// ---------------------------------------------------------------------
// 3. Rotas
// ---------------------------------------------------------------------

app.get('/livros', (req, res) => {
  // `req.log` já é um child logger com o requestId embutido — todo evento
  // abaixo sai com ele, sem ninguém repetir o campo.
  req.log.info({ total: livros.length }, 'listagem pedida');
  res.json(livros);
});

app.get('/livros/:id', (req, res) => {
  const livro = servicoBuscarLivro(Number(req.params.id), req.log);
  if (!livro) return res.status(404).json({ erro: 'livro não encontrado' });
  res.json(livro);
});

app.post('/login', (req, res) => {
  // Loga o corpo INTEIRO de propósito, para você ver o `redact` agindo: a senha
  // sai como [REDACTED] mesmo estando aqui.
  req.log.info({ corpo: req.body, senha: req.body?.senha }, 'tentativa de login');
  res.json({ ok: true, dica: 'procure [REDACTED] na linha de log acima' });
});

app.get('/lento', async (req, res) => {
  const inicio = process.hrtime.bigint();
  await new Promise((r) => setTimeout(r, 250));
  const ms = Number(process.hrtime.bigint() - inicio) / 1e6;

  // Duração medida à mão é o embrião de uma métrica (o D de RED). Aqui vira só
  // um campo; num sistema real iria para um histograma, e você olharia o p95.
  req.log.info({ ms: Math.round(ms) }, 'operação lenta concluída');
  res.json({ ok: true, ms: Math.round(ms) });
});

app.get('/quebra', () => {
  // Erro não tratado de propósito: repare que o log traz `err.stack` completo,
  // mas a RESPOSTA ao cliente não (módulo 06).
  throw new Error('falha proposital para ver a stack no log');
});

// ---------------------------------------------------------------------
// 4. HEALTH vs READY — perguntas diferentes
// ---------------------------------------------------------------------

// Vivo: não toca em dependência nenhuma. Se checasse o banco, uma queda do banco
// faria o orquestrador REINICIAR o processo em loop — sem consertar o banco.
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Pronto: aí sim confere as dependências. Falhar aqui só tira a instância do
// balanceador, sem reiniciar nada.
let bancoOk = true;
app.get('/ready', (_req, res) => {
  if (!bancoOk) return res.status(503).json({ status: 'indisponível', banco: false });
  res.json({ status: 'pronto', banco: true });
});

// Rota de apoio para você ver a diferença: derruba o "banco" e compare
// /health (continua 200) com /ready (passa a 503).
app.post('/simular-queda', (req, res) => {
  bancoOk = !bancoOk;
  req.log.warn({ bancoOk }, 'estado do banco alternado (simulação)');
  res.json({ bancoOk });
});

// ---------------------------------------------------------------------
// 5. Tratador de erro — loga com stack, responde sem
// ---------------------------------------------------------------------

app.use(((erro, req, res, _next) => {
  // `{ err }` recebe o serializador do Pino: type, message e stack viram campos.
  // Com `JSON.stringify(erro)` isso viraria `{}` e a mensagem se perderia.
  req.log.error({ err: erro }, 'erro não tratado na rota');
  res.status(500).json({ erro: 'erro interno' }); // stack NUNCA vai para o cliente
}) as express.ErrorRequestHandler);

app.listen(PORTA, () => {
  log.info({ porta: PORTA }, 'servidor no ar');
  console.log(`
  Experimente:
    curl -i localhost:${PORTA}/livros            # veja o header x-request-id
    curl localhost:${PORTA}/livros/999           # 404 → nível warn
    curl localhost:${PORTA}/quebra               # 500 → nível error, com stack
    curl -X POST localhost:${PORTA}/login -H 'Content-Type: application/json' \\
      -d '{"email":"ana@x.com","senha":"segredo"}'   # senha → [REDACTED]
    curl -H 'x-request-id: meu-id-123' localhost:${PORTA}/livros

    curl -X POST localhost:${PORTA}/simular-queda    # /health segue ok, /ready cai
`);
});
