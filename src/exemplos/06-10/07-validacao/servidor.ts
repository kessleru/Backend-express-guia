/**
 * O CRUD com Zod. Compare o tamanho dos handlers com o do módulo 03.
 *
 * Rodar:  node src/exemplos/06-10/07-validacao/servidor.ts
 */
import express from 'express';
import { randomUUID } from 'node:crypto';
import { conflito, naoEncontrado } from '../06-erros/erro-app.ts';
import { rotaNaoEncontrada, tratarErro } from '../06-erros/tratador.ts';
import {
  atualizarCursoSchema,
  criarCursoSchema,
  idSchema,
  listarCursosSchema,
  periodoSchema,
  type CriarCurso,
} from './schemas.ts';
import { validados, validar } from './validar.ts';

const app = express();
app.use(express.json());
app.use((_req, res, next) => {
  res.locals.requestId = randomUUID().slice(0, 8);
  next();
});

// O tipo do "banco" vem do schema: uma fonte de verdade. Mudar o schema muda o
// tipo, e o TypeScript aponta todo lugar que precisa acompanhar.
type Curso = CriarCurso & { id: number };

const cursos: Curso[] = [
  {
    id: 1,
    titulo: 'Fundamentos de HTTP',
    horas: 4,
    ano: 2026,
    publicado: true,
    nivel: 'iniciante',
    tags: ['http'],
  },
  {
    id: 2,
    titulo: 'Express do zero',
    horas: 8,
    ano: 2026,
    publicado: false,
    nivel: 'intermediario',
    tags: [],
  },
];

let proximoId = 3;

// ---------------------------------------------------------------------
// Handlers curtos: a validação saiu de dentro deles
// ---------------------------------------------------------------------

app.get('/cursos', validar(listarCursosSchema, 'query'), (_req, res) => {
  // Sem `as`: o tipo vem do schema. `maxHoras` já é number, `pagina` já tem o
  // default aplicado, `publicado` já é boolean de verdade.
  const { titulo, maxHoras, publicado, pagina, porPagina } = validados(
    res,
    listarCursosSchema,
    'query',
  );

  let resultado = cursos;
  if (titulo) {
    const busca = titulo.toLowerCase();
    resultado = resultado.filter((c) => c.titulo.toLowerCase().includes(busca));
  }
  if (maxHoras !== undefined) resultado = resultado.filter((c) => c.horas <= maxHoras);
  if (publicado !== undefined)
    resultado = resultado.filter((c) => c.publicado === publicado);

  const inicio = (pagina - 1) * porPagina;
  res.json({
    dados: resultado.slice(inicio, inicio + porPagina),
    pagina,
    porPagina,
    total: resultado.length,
  });
});

app.get('/cursos/:id', validar(idSchema, 'params'), (_req, res) => {
  const { id } = validados(res, idSchema, 'params'); // id: number, não string
  const curso = cursos.find((c) => c.id === id);
  if (!curso) throw naoEncontrado('Curso', id);
  res.json(curso);
});

/**
 * O handler que tinha 20 linhas no módulo 03 tem 6.
 *
 * E o mais importante: `dados` é do tipo `CriarCurso`, não `any`. Acessar um
 * campo que não existe é erro de compilação.
 */
app.post('/cursos', validar(criarCursoSchema), (_req, res) => {
  const dados = validados(res, criarCursoSchema);

  // VALIDAÇÃO vs REGRA DE NEGÓCIO — a distinção central do módulo:
  //   "título tem ao menos 3 caracteres" é formato → schema, 400.
  //   "não pode haver outro curso com este título" precisa consultar os dados
  //   → regra de negócio, 409. O Zod não tem como saber disso.
  if (cursos.some((c) => c.titulo.toLowerCase() === dados.titulo.toLowerCase())) {
    throw conflito('Já existe um curso com esse título');
  }

  const curso: Curso = { id: proximoId++, ...dados };
  cursos.push(curso);
  res.status(201).location(`/cursos/${curso.id}`).json(curso);
});

// Dois middlewares de validação na mesma rota: params e body.
app.patch(
  '/cursos/:id',
  validar(idSchema, 'params'),
  validar(atualizarCursoSchema),
  (_req, res) => {
    const { id } = validados(res, idSchema, 'params');
    const curso = cursos.find((c) => c.id === id);
    if (!curso) throw naoEncontrado('Curso', id);

    // `atualizarCursoSchema` não tem `.default()`, então só as chaves que o
    // cliente mandou existem aqui. É o que faz o PATCH ser um PATCH.
    Object.assign(curso, validados(res, atualizarCursoSchema));
    res.json(curso);
  },
);

// `.refine()` em ação: regra que envolve dois campos.
app.post('/periodos', validar(periodoSchema), (_req, res) => {
  res.status(201).json(validados(res, periodoSchema));
});

app.use(rotaNaoEncontrada);
app.use(tratarErro);

const PORT = 5055;
app.listen(PORT, () => {
  console.log(`CRUD com Zod em http://localhost:${PORT}/cursos`);
});
