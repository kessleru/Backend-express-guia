/**
 * Router de autores, sem responder erro em lugar nenhum.
 */
import { Router } from 'express';
import { autores, livros, proximoIdAutor, type Autor } from '../dados.ts';
import { conflito, naoEncontrado, requisicaoInvalida } from '../erros/AppError.ts';

export const rotasAutores = Router();

rotasAutores.param('id', (_req, res, next, valor) => {
  const id = Number(valor);
  const autor = Number.isInteger(id) ? autores.find((a) => a.id === id) : undefined;
  if (!autor) throw naoEncontrado('Autor', valor);

  res.locals.autor = autor;
  next();
});

rotasAutores.get('/', (_req, res) => {
  res.json(autores);
});

rotasAutores.get('/:id', (_req, res) => {
  res.json(res.locals.autor as Autor);
});

rotasAutores.get('/:id/livros', (_req, res) => {
  const autor = res.locals.autor as Autor;
  res.json(livros.filter((l) => l.autorId === autor.id));
});

rotasAutores.post('/', (req, res) => {
  const { nome, nacionalidade } = (req.body ?? {}) as Record<string, unknown>;

  if (typeof nome !== 'string' || nome.trim() === '') {
    throw requisicaoInvalida('`nome` é obrigatório', { campo: 'nome' });
  }
  if (typeof nacionalidade !== 'string' || nacionalidade.trim() === '') {
    throw requisicaoInvalida('`nacionalidade` é obrigatória', { campo: 'nacionalidade' });
  }

  const autor: Autor = { id: proximoIdAutor(), nome: nome.trim(), nacionalidade };
  autores.push(autor);
  res.status(201).location(`${req.baseUrl}/${autor.id}`).json(autor);
});

/**
 * Integridade referencial na mão → 409.
 *
 * `conflito` e não `requisicaoInvalida`: o body está perfeito (não tem body), o
 * ESTADO é que impede. Um 400 aqui faria o cliente procurar erro onde não tem.
 */
rotasAutores.delete('/:id', (_req, res) => {
  const autor = res.locals.autor as Autor;
  const quantos = livros.filter((l) => l.autorId === autor.id).length;

  if (quantos > 0) {
    throw conflito(
      `Autor tem ${quantos} livro(s) cadastrado(s). Remova os livros primeiro.`,
    );
  }

  autores.splice(autores.indexOf(autor), 1);
  res.status(204).send();
});
