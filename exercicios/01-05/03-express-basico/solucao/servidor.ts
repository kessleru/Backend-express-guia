/**
 * Solução do exercício 03 — API de biblioteca, primeira versão.
 *
 * Tudo num arquivo só, validação dentro das rotas. É de propósito: essa dor é o
 * que os módulos 04 (routers), 06 (erros) e 07 (Zod) vão resolver, um por vez.
 *
 * Rodar:  node exercicios/01-05/03-express-basico/solucao/servidor.ts
 */
import express from 'express';

const app = express();
app.use(express.json());

type Livro = {
  id: number;
  titulo: string;
  autor: string;
  ano: number;
  disponivel: boolean;
};

const livros: Livro[] = [
  { id: 1, titulo: 'O Hobbit', autor: 'J.R.R. Tolkien', ano: 1937, disponivel: true },
  { id: 2, titulo: 'Duna', autor: 'Frank Herbert', ano: 1965, disponivel: true },
  {
    id: 3,
    titulo: 'O Senhor dos Anéis',
    autor: 'J.R.R. Tolkien',
    ano: 1954,
    disponivel: false,
  },
];

let proximoId = 4;

const ANO_MIN = 1450; // Gutenberg; qualquer limite serve, o que importa é ter um
const ANO_MAX = new Date().getFullYear();

/**
 * Validação do corpo, compartilhada entre POST e PATCH.
 *
 * `parcial: true` (PATCH) aceita campo ausente; `false` (POST) exige todos.
 * Devolve `{ erro }` ou `{ dados }` — nunca joga exceção, porque no Express 5
 * um throw dentro de rota async viraria 500 (é o assunto do módulo 06).
 */
function validarLivro(
  corpo: unknown,
  parcial: boolean,
): { erro: string } | { dados: Partial<Omit<Livro, 'id' | 'disponivel'>> } {
  // `?? {}` porque sem `Content-Type: application/json` o body é `undefined`.
  const { titulo, autor, ano } = (corpo ?? {}) as Record<string, unknown>;
  const dados: Partial<Omit<Livro, 'id' | 'disponivel'>> = {};

  if (titulo !== undefined) {
    if (typeof titulo !== 'string' || titulo.trim() === '') {
      return { erro: '`titulo` deve ser um texto não vazio' };
    }
    dados.titulo = titulo.trim();
  } else if (!parcial) {
    return { erro: '`titulo` é obrigatório' };
  }

  if (autor !== undefined) {
    if (typeof autor !== 'string' || autor.trim() === '') {
      return { erro: '`autor` deve ser um texto não vazio' };
    }
    dados.autor = autor.trim();
  } else if (!parcial) {
    return { erro: '`autor` é obrigatório' };
  }

  if (ano !== undefined) {
    // `Number.isInteger` cobre string, null, NaN e float de uma vez.
    if (
      !Number.isInteger(ano) ||
      (ano as number) < ANO_MIN ||
      (ano as number) > ANO_MAX
    ) {
      return { erro: `\`ano\` deve ser um inteiro entre ${ANO_MIN} e ${ANO_MAX}` };
    }
    dados.ano = ano as number;
  } else if (!parcial) {
    return { erro: '`ano` é obrigatório' };
  }

  // Note o que NÃO está aqui: `disponivel` e `id`. Campo que o cliente não pode
  // controlar simplesmente não é lido — melhor que rejeitar, porque ignorar
  // silenciosamente não vaza qual é a regra interna.
  return { dados };
}

/** Busca comum a todas as rotas de `:id`. Devolve `undefined` se não achar. */
function acharLivro(idBruto: string | undefined): Livro | undefined {
  const id = Number(idBruto);
  if (!Number.isInteger(id)) return undefined; // '/livros/abc' → NaN → 404
  return livros.find((l) => l.id === id);
}

// ---------------------------------------------------------------------
// GET /livros — query params: filtro + ordenação + paginação
// ---------------------------------------------------------------------

app.get('/livros', (req, res) => {
  let resultado = livros;

  const autor = req.query.autor;
  if (typeof autor === 'string' && autor !== '') {
    const busca = autor.toLowerCase();
    resultado = resultado.filter((l) => l.autor.toLowerCase().includes(busca));
  }

  // PEGADINHA: `?disponivel=false` chega como a STRING "false", que é truthy.
  // Comparar com a string é a única forma correta.
  if (req.query.disponivel === 'true') resultado = resultado.filter((l) => l.disponivel);
  else if (req.query.disponivel === 'false')
    resultado = resultado.filter((l) => !l.disponivel);

  // `sort` ordena no lugar — copiamos para não embaralhar o array original.
  if (req.query.ordenar === 'ano') {
    resultado = [...resultado].sort((a, b) => a.ano - b.ano);
  } else if (req.query.ordenar === 'titulo') {
    resultado = [...resultado].sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'));
  }

  // Desafio extra: paginação. Só muda o formato se o cliente pedir — assim quem
  // já usava `GET /livros` continua recebendo um array.
  const pagina = Number(req.query.pagina);
  if (Number.isInteger(pagina) && pagina > 0) {
    const porPagina = Number(req.query.porPagina) || 10;
    const inicio = (pagina - 1) * porPagina;
    return res.json({
      dados: resultado.slice(inicio, inicio + porPagina),
      pagina,
      porPagina,
      total: resultado.length,
    });
  }

  res.json(resultado);
});

// ---------------------------------------------------------------------
// GET /livros/:id — route param
// ---------------------------------------------------------------------

app.get('/livros/:id', (req, res) => {
  const livro = acharLivro(req.params.id);
  if (!livro)
    return res.status(404).json({ erro: `Livro ${req.params.id} não encontrado` });
  res.json(livro);
});

// ---------------------------------------------------------------------
// POST /livros — body
// ---------------------------------------------------------------------

app.post('/livros', (req, res) => {
  const validado = validarLivro(req.body, false);
  if ('erro' in validado) return res.status(400).json({ erro: validado.erro });

  // Montado campo por campo. Nunca `{ ...req.body }`: isso deixaria o cliente
  // definir `id` (colisão) e `disponivel` (burlar o empréstimo).
  const livro: Livro = {
    id: proximoId++,
    titulo: validado.dados.titulo!, // `!` seguro: parcial=false garantiu presença
    autor: validado.dados.autor!,
    ano: validado.dados.ano!,
    disponivel: true,
  };
  livros.push(livro);

  res.status(201).location(`/livros/${livro.id}`).json(livro);
});

// ---------------------------------------------------------------------
// PATCH /livros/:id — altera só o que veio
// ---------------------------------------------------------------------

app.patch('/livros/:id', (req, res) => {
  const livro = acharLivro(req.params.id);
  if (!livro) return res.status(404).json({ erro: 'Livro não encontrado' });

  const validado = validarLivro(req.body, true);
  if ('erro' in validado) return res.status(400).json({ erro: validado.erro });

  // `Object.assign` só copia as chaves presentes — exatamente a semântica do
  // PATCH. Com PUT seria o oposto: substituir o objeto inteiro.
  Object.assign(livro, validado.dados);
  res.json(livro);
});

// ---------------------------------------------------------------------
// DELETE /livros/:id
// ---------------------------------------------------------------------

app.delete('/livros/:id', (req, res) => {
  const livro = acharLivro(req.params.id);
  if (!livro) return res.status(404).json({ erro: 'Livro não encontrado' });

  livros.splice(livros.indexOf(livro), 1);
  res.status(204).send(); // 204 = sem corpo. Nem `{}`.
});

// ---------------------------------------------------------------------
// Ações — quando a operação não é um CRUD
// ---------------------------------------------------------------------
// "Emprestar" não é criar nem substituir um livro; é uma transição de estado.
// A convenção prática é um sub-recurso em POST: /livros/:id/emprestar.
// (Um purista diria PATCH { disponivel: false } — mas aí o cliente decide a
// regra de negócio, e amanhã ele "devolve" um livro que nunca pegou.)

app.post('/livros/:id/emprestar', (req, res) => {
  const livro = acharLivro(req.params.id);
  if (!livro) return res.status(404).json({ erro: 'Livro não encontrado' });

  // 409 Conflict: a requisição está correta, o ESTADO é que não permite.
  // Um 400 aqui faria o cliente procurar erro no body que ele nem mandou.
  if (!livro.disponivel)
    return res.status(409).json({ erro: 'Livro já está emprestado' });

  livro.disponivel = false;
  res.json(livro);
});

app.post('/livros/:id/devolver', (req, res) => {
  const livro = acharLivro(req.params.id);
  if (!livro) return res.status(404).json({ erro: 'Livro não encontrado' });

  if (livro.disponivel)
    return res.status(409).json({ erro: 'Livro não está emprestado' });

  livro.disponivel = true;
  res.json(livro);
});

// ---------------------------------------------------------------------

const PORT = 4030;
app.listen(PORT, () => {
  console.log(`Biblioteca em http://localhost:${PORT}/livros`);
});
