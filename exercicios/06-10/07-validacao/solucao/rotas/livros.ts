/**
 * Router de livros com Zod.
 *
 * Compare com a versão do exercício 06: nenhum `typeof`, nenhuma função
 * `validar()` de 50 linhas. Cada handler tem só a REGRA DE NEGÓCIO.
 */
import { Router } from 'express';
import { livros, autores, proximoIdLivro } from '../dados.ts';
import { conflito, naoEncontrado, requisicaoInvalida } from '../erros/AppError.ts';
import { validados, validar } from '../middlewares/validar.ts';
import { idSchema } from '../schemas/comuns.ts';
import {
  atualizarLivroSchema,
  criarLivroSchema,
  listarLivrosSchema,
  type Livro,
} from '../schemas/livro.ts';

export const rotasLivros = Router();

// Literal antes de parâmetro (módulo 04).
rotasLivros.get('/disponiveis', (_req, res) => {
  res.json(livros.filter((l) => l.disponivel));
});

rotasLivros.get('/', validar(listarLivrosSchema, 'query'), (_req, res) => {
  // Sem `as`: `pagina` já é number com default aplicado, `disponivel` já é
  // boolean de verdade, `autorId` já foi convertido.
  const { autorId, disponivel, ordenar, pagina, porPagina } = validados(
    res,
    listarLivrosSchema,
    'query',
  );

  let resultado = livros;
  if (autorId !== undefined) resultado = resultado.filter((l) => l.autorId === autorId);
  if (disponivel !== undefined)
    resultado = resultado.filter((l) => l.disponivel === disponivel);

  if (ordenar === 'ano') resultado = [...resultado].sort((a, b) => a.ano - b.ano);
  else if (ordenar === 'titulo') {
    resultado = [...resultado].sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'));
  }

  const inicio = (pagina - 1) * porPagina;
  res.json({
    dados: resultado.slice(inicio, inicio + porPagina),
    pagina,
    porPagina,
    total: resultado.length,
  });
});

/**
 * O `param` valida o formato do id via schema.
 *
 * Diferença sutil que o enunciado cobra: `/livros/abc` agora é **400** (formato
 * inválido), não 404 (não existe). O cliente que manda `abc` tem um bug; o que
 * manda `999` só pediu algo que não está lá.
 */
rotasLivros.param('id', (req, res, next, valor) => {
  const resultado = idSchema.safeParse({ id: valor });
  if (!resultado.success) throw requisicaoInvalida(`\`id\` inválido: ${valor}`);

  const livro = livros.find((l) => l.id === resultado.data.id);
  if (!livro) throw naoEncontrado('Livro', valor);

  res.locals.livro = livro;
  next();
});

rotasLivros.get('/:id', (_req, res) => {
  res.json(res.locals.livro as Livro);
});

rotasLivros.post('/', validar(criarLivroSchema), (req, res) => {
  const dados = validados(res, criarLivroSchema);

  // REGRAS DE NEGÓCIO — o que o schema não pode saber porque precisa dos dados.
  //
  // 400 para autor inexistente: é uma referência inválida, o cliente mandou algo
  // errado e deve corrigir o body.
  if (!autores.some((a) => a.id === dados.autorId)) {
    throw requisicaoInvalida(`Autor ${dados.autorId} não existe`, { campo: 'autorId' });
  }

  // 409 para ISBN repetido: o body está perfeito, é o ESTADO que impede.
  if (dados.isbn && livros.some((l) => l.isbn === dados.isbn)) {
    throw conflito(`Já existe um livro com o ISBN ${dados.isbn}`);
  }

  const livro: Livro = { id: proximoIdLivro(), ...dados, disponivel: true };
  livros.push(livro);

  res.status(201).location(`${req.baseUrl}/${livro.id}`).json(livro);
});

rotasLivros.patch('/:id', validar(atualizarLivroSchema), (_req, res) => {
  const livro = res.locals.livro as Livro;
  const dados = validados(res, atualizarLivroSchema);

  if (dados.autorId !== undefined && !autores.some((a) => a.id === dados.autorId)) {
    throw requisicaoInvalida(`Autor ${dados.autorId} não existe`, { campo: 'autorId' });
  }
  if (dados.isbn && livros.some((l) => l.isbn === dados.isbn && l.id !== livro.id)) {
    throw conflito(`Já existe um livro com o ISBN ${dados.isbn}`);
  }

  // `atualizarLivroSchema` não tem default, então só as chaves enviadas estão em
  // `dados`. É isso que impede o PATCH de apagar `generos` sem ninguém pedir.
  Object.assign(livro, dados);
  res.json(livro);
});

rotasLivros.delete('/:id', (_req, res) => {
  const livro = res.locals.livro as Livro;
  livros.splice(livros.indexOf(livro), 1);
  res.status(204).send();
});

rotasLivros.post('/:id/emprestar', (_req, res) => {
  const livro = res.locals.livro as Livro;
  if (!livro.disponivel) throw conflito('Livro já está emprestado');
  livro.disponivel = false;
  res.json(livro);
});

rotasLivros.post('/:id/devolver', (_req, res) => {
  const livro = res.locals.livro as Livro;
  if (livro.disponivel) throw conflito('Livro não está emprestado');
  livro.disponivel = true;
  res.json(livro);
});
