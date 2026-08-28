/**
 * Router de cursos — o CRUD do módulo 03, agora num arquivo só dele.
 *
 * Um `Router` é um mini-app: tem `.get`, `.post`, `.use`, aceita middlewares.
 * A diferença é que ele não escuta porta — quem monta define o prefixo.
 * Por isso os caminhos aqui são '/' e '/:id', não '/cursos' e '/cursos/:id':
 * o prefixo é problema de quem faz o `app.use()`.
 */
import { Router } from 'express';

export type Curso = { id: number; titulo: string; horas: number; instrutorId: number };

export const cursos: Curso[] = [
  { id: 1, titulo: 'Fundamentos de HTTP', horas: 4, instrutorId: 1 },
  { id: 2, titulo: 'Node e assincronia', horas: 6, instrutorId: 1 },
  { id: 3, titulo: 'Express do zero', horas: 8, instrutorId: 2 },
];

let proximoId = 4;

export const rotasCursos = Router();

// ---------------------------------------------------------------------
// ORDEM DAS ROTAS IMPORTA
// ---------------------------------------------------------------------
// O Express testa as rotas de cima para baixo e para na primeira que casa.
// '/novidades' tem que vir ANTES de '/:id' — senão ':id' captura a string
// "novidades", `Number('novidades')` dá NaN, e você recebe um 404 misterioso
// numa rota que existe.
//
// Regra: caminho literal antes de caminho com parâmetro.

rotasCursos.get('/novidades', (_req, res) => {
  const recentes = [...cursos].sort((a, b) => b.id - a.id).slice(0, 2);
  res.json(recentes);
});

rotasCursos.get('/', (req, res) => {
  const titulo =
    typeof req.query.titulo === 'string' ? req.query.titulo.toLowerCase() : undefined;
  const resultado = titulo
    ? cursos.filter((c) => c.titulo.toLowerCase().includes(titulo))
    : cursos;
  res.json(resultado);
});

// ---------------------------------------------------------------------
// router.param — roda antes de qualquer rota que tenha ':id'
// ---------------------------------------------------------------------
// Em vez de repetir "acha o curso ou devolve 404" em cinco handlers, você
// resolve uma vez e pendura o resultado no `req`. É um middleware (módulo 05)
// especializado em parâmetro de rota.

rotasCursos.param('id', (_req, res, next, valor) => {
  const id = Number(valor);
  const curso = cursos.find((c) => c.id === id);
  if (!curso) return res.status(404).json({ erro: `Curso ${valor} não encontrado` });

  // `res.locals` é o lugar oficial para passar dados entre middlewares desta
  // requisição. Inventar `req.curso` exigiria estender os tipos do Express.
  res.locals.curso = curso;
  next(); // sem isto a requisição congela até dar timeout
});

rotasCursos.get('/:id', (_req, res) => {
  res.json(res.locals.curso as Curso); // o param já garantiu que existe
});

rotasCursos.post('/', (req, res) => {
  const { titulo, horas, instrutorId } = (req.body ?? {}) as Partial<Curso>;
  if (
    typeof titulo !== 'string' ||
    typeof horas !== 'number' ||
    typeof instrutorId !== 'number'
  ) {
    return res
      .status(400)
      .json({ erro: '`titulo`, `horas` e `instrutorId` são obrigatórios' });
  }

  const curso: Curso = { id: proximoId++, titulo, horas, instrutorId };
  cursos.push(curso);
  res.status(201).location(`/api/v1/cursos/${curso.id}`).json(curso);
});

rotasCursos.delete('/:id', (_req, res) => {
  const curso = res.locals.curso as Curso;
  cursos.splice(cursos.indexOf(curso), 1);
  res.status(204).send();
});

// ---------------------------------------------------------------------
// Router aninhado — recurso dentro de recurso
// ---------------------------------------------------------------------
// `/cursos/:id/aulas` expressa a hierarquia real: uma aula não existe fora de
// um curso. `mergeParams: true` é o que faz o `:id` do pai chegar aqui —
// sem ele, `req.params` do filho vem vazio.

const rotasAulas = Router({ mergeParams: true });

const aulas = [
  { id: 1, cursoId: 1, titulo: 'Métodos HTTP' },
  { id: 2, cursoId: 1, titulo: 'Status codes' },
  { id: 3, cursoId: 3, titulo: 'Middlewares' },
];

// O generic `<{ id: string }>` é necessário porque o TypeScript deduz
// `req.params` a partir do caminho — e o caminho aqui é '/', sem parâmetro.
// O `:id` vem do pai em runtime, mas o tipo não tem como saber disso.
rotasAulas.get<{ id: string }>('/', (req, res) => {
  const cursoId = Number(req.params.id); // veio do router pai
  res.json(aulas.filter((a) => a.cursoId === cursoId));
});

rotasCursos.use('/:id/aulas', rotasAulas);
