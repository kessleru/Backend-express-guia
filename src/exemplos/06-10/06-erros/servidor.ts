/**
 * Tratamento de erro central aplicado ao CRUD.
 *
 * Compare com o módulo 03: lá cada rota montava sua própria resposta de erro.
 * Aqui as rotas só dizem O QUE deu errado — o formato da resposta é decidido em
 * um lugar só (`tratador.ts`).
 *
 * Rodar:  node src/exemplos/06-10/06-erros/servidor.ts
 */
import express, { type NextFunction, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import { AppError, conflito, naoEncontrado, requisicaoInvalida } from './erro-app.ts';
import { rotaNaoEncontrada, tratarErro } from './tratador.ts';

const app = express();
app.use(express.json());

app.use((_req, res, next) => {
  res.locals.requestId = randomUUID().slice(0, 8);
  next();
});

type Curso = { id: number; titulo: string; horas: number; publicado: boolean };

const cursos: Curso[] = [
  { id: 1, titulo: 'Fundamentos de HTTP', horas: 4, publicado: true },
  { id: 2, titulo: 'Express do zero', horas: 8, publicado: false },
];

function acharCurso(idBruto: string | undefined): Curso {
  const id = Number(idBruto);
  const curso = Number.isInteger(id) ? cursos.find((c) => c.id === id) : undefined;

  // `throw` no lugar de `return res.status(404)`: a função não conhece `res` e
  // não precisa. Ela reporta o problema; quem responde é o tratador central.
  // Isso é o que permite reusar esta função num service (módulo 08) e num
  // worker de fila (17), onde não existe requisição HTTP nenhuma.
  if (!curso) throw naoEncontrado('Curso', idBruto ?? '?');

  return curso;
}

// ---------------------------------------------------------------------
// 1. throw em rota SÍNCRONA — sempre funcionou
// ---------------------------------------------------------------------
// O Express envolve handlers síncronos num try/catch. Um throw aqui vira
// `next(erro)` automaticamente.

app.get('/cursos/:id', (req, res) => {
  res.json(acharCurso(req.params.id));
});

// ---------------------------------------------------------------------
// 2. throw em rota ASSÍNCRONA — o que mudou no Express 5
// ---------------------------------------------------------------------
// EXPRESS 4: uma Promise rejeitada dentro de handler async NÃO era capturada.
// O erro virava `unhandledRejection` e derrubava o processo. A API inteira caía
// porque um cliente pediu um id que não existe. Daí a existência de wrappers
// como `express-async-errors` e o famoso `asyncHandler(fn)`.
//
// EXPRESS 5: o router dá await no retorno do handler. `throw` dentro de async
// vai para o tratador de erro igual ao caso síncrono. Nada de wrapper.

app.get('/cursos/:id/detalhes', async (req, res) => {
  const curso = acharCurso(req.params.id);
  await new Promise((r) => setTimeout(r, 10)); // simula ir ao banco

  if (!curso.publicado) throw conflito(`Curso "${curso.titulo}" ainda não foi publicado`);

  res.json({ ...curso, aulas: 12 });
});

// ---------------------------------------------------------------------
// 3. Erro esperado vs bug
// ---------------------------------------------------------------------

app.post('/cursos', (req, res) => {
  const { titulo, horas } = (req.body ?? {}) as Partial<Curso>;

  // ESPERADO: entrada ruim é situação prevista. 400, mensagem clara ao cliente.
  if (typeof titulo !== 'string' || titulo.trim() === '') {
    throw requisicaoInvalida('`titulo` é obrigatório', { campo: 'titulo' });
  }
  if (typeof horas !== 'number' || horas <= 0) {
    throw requisicaoInvalida('`horas` deve ser um número positivo', { campo: 'horas' });
  }

  if (cursos.some((c) => c.titulo.toLowerCase() === titulo.trim().toLowerCase())) {
    throw conflito('Já existe um curso com esse título'); // 409, não 400
  }

  const curso: Curso = {
    id: Math.max(...cursos.map((c) => c.id)) + 1,
    titulo: titulo.trim(),
    horas,
    publicado: false,
  };
  cursos.push(curso);
  res.status(201).json(curso);
});

// BUG: erro que ninguém previu. O cliente vê 500 genérico; o servidor loga tudo.
app.get('/bug', (_req, res) => {
  const nada = undefined as unknown as { valor: string };
  res.json({ valor: nada.valor }); // TypeError
});

// BUG assíncrono: no Express 4 isto derrubava o processo.
app.get('/bug-async', async () => {
  await new Promise((r) => setTimeout(r, 5));
  throw new Error('falha ao conectar em algum-servico-interno:5432');
});

// ---------------------------------------------------------------------
// 4. next(erro) — quando você não pode usar throw
// ---------------------------------------------------------------------
// Dentro de callback de biblioteca antiga (que não devolve Promise), o throw
// escapa do handler e ninguém captura. Aí `next(erro)` é a única saída.

app.get('/callback', (_req: Request, _res: Response, next: NextFunction) => {
  setTimeout(() => {
    next(new AppError('erro vindo de um callback', 502));
  }, 5);
});

// ---------------------------------------------------------------------
// 5. A ORDEM FINAL — 404, depois o tratador
// ---------------------------------------------------------------------
app.use(rotaNaoEncontrada);
app.use(tratarErro);

// ---------------------------------------------------------------------
// 6. A rede de segurança do processo
// ---------------------------------------------------------------------
// O tratador do Express só pega erro que passou por uma requisição. Erro em
// timer, worker ou callback solto não passa por ele.
//
// A recomendação oficial do Node: LOGAR e SAIR. Um processo que continua depois
// de uma exceção não capturada está em estado desconhecido — pode estar
// corrompendo dados silenciosamente. O orquestrador (Docker, systemd, PM2)
// reinicia. Graceful shutdown de verdade fica no módulo 15.

process.on('unhandledRejection', (motivo) => {
  console.error('UNHANDLED REJECTION — encerrando:', motivo);
  process.exit(1);
});

process.on('uncaughtException', (erro) => {
  console.error('UNCAUGHT EXCEPTION — encerrando:', erro);
  process.exit(1);
});

const PORT = 5054;
app.listen(PORT, () => {
  console.log(`Tratamento de erros em http://localhost:${PORT}`);
});
