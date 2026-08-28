/**
 * CRUD de cursos em memória — o "hello world" honesto do Express.
 *
 * É o mesmo servidor do módulo 01 (`node:http` puro), agora com Express.
 * Compare os dois arquivos: a lógica é a mesma, o trabalho manual sumiu.
 *
 * Rodar:  node src/exemplos/01-05/03-express-basico/crud-cursos.ts
 */
import express from 'express';

const app = express();

// Sem isto, `req.body` é `undefined` em qualquer rota. Este middleware lê o
// corpo da requisição em pedaços, faz `JSON.parse` e guarda em `req.body`.
// Só age quando o `Content-Type` é `application/json` — ver o POST abaixo.
app.use(express.json());

type Curso = { id: number; titulo: string; horas: number };

const cursos: Curso[] = [
  { id: 1, titulo: 'Fundamentos de HTTP', horas: 4 },
  { id: 2, titulo: 'Node e assincronia', horas: 6 },
  { id: 3, titulo: 'Express do zero', horas: 8 },
];

let proximoId = 4; // contador que só cresce: id de curso deletado não volta

// ---------------------------------------------------------------------
// GET — os três tipos de parâmetro
// ---------------------------------------------------------------------

/**
 * QUERY PARAMS (`req.query`) — filtro e paginação. Sempre opcionais.
 *
 *   GET /cursos
 *   GET /cursos?titulo=http&maxHoras=5
 *
 * Tudo que vem da URL é string. `?maxHoras=5` chega como `"5"`, não `5`.
 */
app.get('/cursos', (req, res) => {
  // `req.query` é `string | string[] | ...` — daí a checagem de tipo. Mandar
  // `?titulo=a&titulo=b` faz virar array: o `typeof` derruba para `undefined`
  // em vez de estourar num `.toLowerCase()` que não existe em array.
  const titulo = typeof req.query.titulo === 'string' ? req.query.titulo : undefined;

  let resultado = cursos;

  if (titulo) {
    const busca = titulo.toLowerCase();
    resultado = resultado.filter((c) => c.titulo.toLowerCase().includes(busca));
  }

  // Query param é opcional: ausente = sem filtro. Mas presente e inválido é um
  // erro do cliente, e ignorar em silêncio é pior que recusar — quem pediu
  // `?maxHoras=abc` recebe a lista inteira e acha que o filtro funcionou.
  if (req.query.maxHoras !== undefined) {
    const bruto = req.query.maxHoras;
    const maxHoras =
      typeof bruto === 'string' && bruto.trim() !== '' ? Number(bruto) : NaN;

    // O `trim() !== ''` não é frescura: `Number('')` é **0**, não NaN. Sem essa
    // guarda, `?maxHoras=` (vazio) filtraria por `horas <= 0` e devolveria
    // lista vazia com 200 — o pior tipo de bug, o que parece resposta legítima.
    // `Number.isFinite` completa barrando NaN e Infinity de uma vez.
    if (!Number.isFinite(maxHoras) || maxHoras < 0) {
      return res.status(400).json({ erro: '`maxHoras` deve ser um número >= 0' });
    }

    resultado = resultado.filter((c) => c.horas <= maxHoras);
  }

  // `res.json()` faz três coisas: serializa, põe o Content-Type e encerra.
  res.json(resultado);
});

/**
 * ROUTE PARAMS (`req.params`) — identificam UM recurso. Sempre obrigatórios.
 *
 *   GET /cursos/2
 *
 * O `:id` no caminho é o que cria `req.params.id` — também como string.
 */
app.get('/cursos/:id', (req, res) => {
  const id = Number(req.params.id);
  const curso = cursos.find((c) => c.id === id);

  if (!curso) {
    // `res.status(404).json(...)` encadeia: status primeiro, corpo depois.
    // O `return` evita continuar e responder duas vezes.
    return res.status(404).json({ erro: `Curso ${req.params.id} não existe` });
  }

  res.json(curso);
});

// ---------------------------------------------------------------------
// POST — cria. REQUEST BODY (`req.body`)
// ---------------------------------------------------------------------

/**
 * BODY — os dados de criação/edição. Vem em JSON, não na URL.
 *
 *   curl -X POST localhost:5051/cursos \
 *     -H 'Content-Type: application/json' \
 *     -d '{"titulo":"Prisma","horas":5}'
 *
 * Sem o header `Content-Type: application/json`, o `express.json()` não toca no
 * corpo e no Express 5 `req.body` fica **`undefined`** (no Express 4 era `{}`).
 * É a causa nº 1 de "meu POST chega vazio" — e desestruturar `undefined` joga
 * um TypeError, virando 500 num erro que era do cliente. Daí o `?? {}`.
 */
app.post('/cursos', (req, res) => {
  // `req.body` é `any`: o Express não sabe o que o cliente mandou, e o cliente
  // pode mandar qualquer coisa. Validar aqui é obrigatório — no módulo 07 isso
  // sai da rota e vira um schema Zod.
  const { titulo, horas } = (req.body ?? {}) as Partial<Curso>;

  if (typeof titulo !== 'string' || titulo.trim() === '') {
    return res.status(400).json({ erro: '`titulo` é obrigatório' });
  }
  if (typeof horas !== 'number' || horas <= 0) {
    return res.status(400).json({ erro: '`horas` deve ser um número positivo' });
  }

  // 400 e 409 dizem coisas diferentes. 400: o pedido está malformado, reenviar
  // igual falha de novo. 409: o pedido está correto, mas briga com o estado
  // atual do servidor — o mesmo POST pode dar certo depois que o outro curso
  // for renomeado ou apagado. Devolver 400 aqui manda o cliente procurar um
  // erro de digitação que não existe.
  const jaExiste = cursos.some(
    (c) => c.titulo.toLowerCase() === titulo.trim().toLowerCase(),
  );
  if (jaExiste) {
    return res
      .status(409)
      .json({ erro: `Já existe um curso chamado "${titulo.trim()}"` });
  }

  const curso: Curso = { id: proximoId++, titulo: titulo.trim(), horas };
  cursos.push(curso);

  // 201 Created + Location apontando para o recurso novo. É o combinado do HTTP.
  res.status(201).location(`/cursos/${curso.id}`).json(curso);
});

// ---------------------------------------------------------------------
// PUT vs PATCH — substituir vs alterar um pedaço
// ---------------------------------------------------------------------

/** PUT substitui o recurso INTEIRO. Campo que não vier é campo perdido. */
app.put('/cursos/:id', (req, res) => {
  const id = Number(req.params.id);
  const indice = cursos.findIndex((c) => c.id === id);

  if (indice === -1) return res.status(404).json({ erro: 'Curso não existe' });

  const { titulo, horas } = (req.body ?? {}) as Partial<Curso>;
  if (typeof titulo !== 'string' || typeof horas !== 'number') {
    return res.status(400).json({ erro: 'PUT exige `titulo` e `horas`' });
  }

  const atualizado: Curso = { id, titulo, horas };
  cursos[indice] = atualizado;
  res.json(atualizado);
});

/** PATCH altera só o que veio. O resto fica como estava. */
app.patch('/cursos/:id', (req, res) => {
  const id = Number(req.params.id);
  const curso = cursos.find((c) => c.id === id);

  if (!curso) return res.status(404).json({ erro: 'Curso não existe' });

  const { titulo, horas } = (req.body ?? {}) as Partial<Curso>;

  // Só toca no campo que veio de verdade. `undefined` é "não mandou".
  if (titulo !== undefined) {
    if (typeof titulo !== 'string' || titulo.trim() === '') {
      return res.status(400).json({ erro: '`titulo` inválido' });
    }
    curso.titulo = titulo.trim();
  }
  if (horas !== undefined) {
    if (typeof horas !== 'number' || horas <= 0) {
      return res.status(400).json({ erro: '`horas` inválido' });
    }
    curso.horas = horas;
  }

  res.json(curso);
});

// ---------------------------------------------------------------------
// DELETE — 204, sem corpo
// ---------------------------------------------------------------------

app.delete('/cursos/:id', (req, res) => {
  const id = Number(req.params.id);
  const indice = cursos.findIndex((c) => c.id === id);

  if (indice === -1) return res.status(404).json({ erro: 'Curso não existe' });

  cursos.splice(indice, 1);

  // 204 No Content: deu certo e não há nada para devolver.
  // `.send()` sem argumento — um `.json({})` aqui contraria o próprio status.
  res.status(204).send();
});

// ---------------------------------------------------------------------
// 404 de rota inexistente — o último da fila
// ---------------------------------------------------------------------

/**
 * Os 404 acima são de RECURSO: a rota existe, o curso é que não. Este é o 404
 * de ROTA: nada casou com o método + caminho (`GET /disciplinas`, ou
 * `POST /cursos/1`, que não tem handler).
 *
 * Sem isto o Express já responde 404 — mas em **HTML**. Uma API que promete
 * JSON e devolve HTML no erro quebra o `await res.json()` do cliente: o erro do
 * servidor vira um erro de parse, que esconde o de verdade.
 *
 * A posição é o mecanismo, não um detalhe de estilo: middleware sem caminho
 * roda para toda requisição, então só é 404 porque está DEPOIS de todas as
 * rotas. Suba estas linhas para o topo e a API inteira responde 404.
 */
app.use((req, res) => {
  // `originalUrl` guarda a URL como chegou, com query string. Volta no módulo 04.
  res.status(404).json({ erro: `Rota ${req.method} ${req.originalUrl} não existe` });
});

// ---------------------------------------------------------------------

const PORT = 5051;
app.listen(PORT, () => {
  console.log(`CRUD de cursos em http://localhost:${PORT}/cursos`);
});
