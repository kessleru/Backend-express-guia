/**
 * A pilha de middlewares, com log mostrando a ordem REAL de execução.
 *
 * Rode e observe o terminal: cada requisição imprime a descida (→) e a subida
 * (←) da cadeia. Ver isso uma vez explica middleware melhor que qualquer texto.
 *
 * Rodar:  node src/exemplos/01-05/05-middlewares/pilha.ts
 */
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import morgan from 'morgan';

const app = express();

// ---------------------------------------------------------------------
// O QUE É UM MIDDLEWARE
// ---------------------------------------------------------------------
// Uma função `(req, res, next)` que roda ANTES do handler da rota e pode:
//   1. ler ou modificar `req` / `res`
//   2. chamar `next()` para passar a bola adiante
//   3. responder e ENCERRAR a cadeia (sem chamar next)
//
// A cadeia é montada na ordem em que você escreve `app.use()`. Não existe
// prioridade, peso ou configuração — é a ordem do arquivo, e nada mais.

// ---------------------------------------------------------------------
// 1. Middleware global
// ---------------------------------------------------------------------

/** Marca o instante da chegada — todo mundo depois deste vê `res.locals.inicio`. */
function marcarInicio(_req: Request, res: Response, next: NextFunction) {
  res.locals.inicio = performance.now();
  console.log('  → 1 marcarInicio');
  next();
}

/**
 * Cronômetro. O truque está no `res.on('finish')`: o middleware roda na DESCIDA,
 * mas o tempo total só é conhecido quando a resposta termina. Registrar um
 * listener é como se "espera" o fim sem bloquear a cadeia.
 */
function cronometro(_req: Request, res: Response, next: NextFunction) {
  console.log('  → 2 cronometro (registra listener)');
  res.on('finish', () => {
    const ms = performance.now() - (res.locals.inicio as number);
    console.log(`  ← 2 cronometro: ${res.statusCode} em ${ms.toFixed(1)}ms`);
  });
  next();
}

/** Adiciona um header em toda resposta. Tem que rodar antes de alguém responder. */
function identificarServidor(_req: Request, res: Response, next: NextFunction) {
  console.log('  → 3 identificarServidor');
  res.set('X-Servidor', 'exemplo-modulo-05');
  next();
}

// morgan: log de requisição HTTP pronto, de terceiros.
// No módulo 14 ele é trocado por Pino (log estruturado em JSON) — morgan é
// ótimo para humano lendo terminal, ruim para máquina filtrando log.
app.use(morgan('tiny'));

// cors: responde os headers que o NAVEGADOR exige para permitir que um front em
// outra origem chame esta API. Detalhe importante: CORS é uma regra do
// navegador, não uma proteção do servidor — `curl` ignora tudo isso.
// Configuração real e o que ele NÃO protege ficam no módulo 13.
app.use(cors({ origin: 'http://localhost:3000' }));

app.use(express.json()); // também é um middleware — sempre foi

app.use(marcarInicio);
app.use(cronometro);
app.use(identificarServidor);

// ---------------------------------------------------------------------
// 2. Middleware de rota — vale só onde você pendura
// ---------------------------------------------------------------------

/** Exige `X-Api-Key`. Encerra a cadeia com 401 se faltar — e não chama next(). */
function exigirApiKey(req: Request, res: Response, next: NextFunction) {
  console.log('  → 4 exigirApiKey');
  const chave = req.header('X-Api-Key');

  if (!chave) {
    // Repare: responder É encerrar. Nada depois disto roda.
    // 401 = "não sei quem você é". Autenticação de verdade vem no módulo 11.
    return res.status(401).json({ erro: 'Header X-Api-Key é obrigatório' });
  }
  if (chave !== 'segredo-123') {
    return res.status(403).json({ erro: 'Chave inválida' }); // "sei quem é, não pode"
  }

  next();
}

/** Middlewares recebem argumento via fábrica: uma função que devolve middleware. */
function exigirPapel(papel: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    console.log(`  → 5 exigirPapel(${papel})`);
    if (req.header('X-Papel') !== papel) {
      return res.status(403).json({ erro: `Precisa do papel "${papel}"` });
    }
    next();
  };
}

// ---------------------------------------------------------------------
// 3. Rotas
// ---------------------------------------------------------------------

app.get('/publico', (_req, res) => {
  console.log('  → HANDLER /publico');
  res.json({ mensagem: 'qualquer um vê isto' });
});

// Middlewares entre o caminho e o handler rodam só nesta rota, nesta ordem.
app.get('/privado', exigirApiKey, (_req, res) => {
  console.log('  → HANDLER /privado');
  res.json({ mensagem: 'você passou pela chave' });
});

app.delete('/admin/tudo', exigirApiKey, exigirPapel('admin'), (_req, res) => {
  console.log('  → HANDLER /admin/tudo');
  res.json({ mensagem: 'apagaria tudo aqui' });
});

// O bug mais comum: esqueceu o `next()`. Nada acontece, nenhum erro aparece,
// a requisição fica pendurada até o cliente desistir.
app.get('/travado', (_req, _res, _next) => {
  console.log('  → HANDLER /travado (sem next e sem responder — vai travar)');
  // faltou next() ou res.json()
});

// ---------------------------------------------------------------------
// 4. Middleware de ERRO — 4 argumentos, sempre por último
// ---------------------------------------------------------------------
// O que faz o Express reconhecer um middleware como tratador de erro é a
// ARIDADE: exatamente 4 parâmetros. Tirar o `_next` daqui transforma isto num
// middleware normal, que nunca receberia o erro. Detalhes no módulo 06.

app.get('/quebra', (_req, _res) => {
  throw new Error('estourei de propósito');
});

app.use((req, res) => {
  console.log('  → 404 (nenhuma rota casou)');
  res.status(404).json({ erro: `Rota não encontrada: ${req.path}` });
});

app.use((erro: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const mensagem = erro instanceof Error ? erro.message : 'erro desconhecido';
  console.log(`  ⚠ middleware de erro: ${mensagem}`);
  res.status(500).json({ erro: 'Erro interno' }); // nunca vaze a stack ao cliente
});

const PORT = 5053;
app.listen(PORT, () => {
  console.log(`Pilha de middlewares em http://localhost:${PORT}`);
  console.log('Rotas: /publico /privado /admin/tudo /quebra /travado\n');
});
