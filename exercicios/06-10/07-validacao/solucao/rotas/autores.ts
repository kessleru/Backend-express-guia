/**
 * Router de autores com Zod.
 */
import { Router } from 'express';
import { autores, livros, proximoIdAutor } from '../dados.ts';
import { conflito, naoEncontrado, requisicaoInvalida } from '../erros/AppError.ts';
import { validados, validar } from '../middlewares/validar.ts';
import { atualizarAutorSchema, criarAutorSchema, type Autor } from '../schemas/autor.ts';
import { idSchema } from '../schemas/comuns.ts';

export const rotasAutores = Router();

rotasAutores.param('id', (_req, res, next, valor) => {
  const resultado = idSchema.safeParse({ id: valor });
  if (!resultado.success) throw requisicaoInvalida(`\`id\` inválido: ${valor}`);

  const autor = autores.find((a) => a.id === resultado.data.id);
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

rotasAutores.post('/', validar(criarAutorSchema), (req, res) => {
  const dados = validados(res, criarAutorSchema);

  const autor: Autor = { id: proximoIdAutor(), ...dados };
  autores.push(autor);
  res.status(201).location(`${req.baseUrl}/${autor.id}`).json(autor);
});

rotasAutores.patch('/:id', validar(atualizarAutorSchema), (_req, res) => {
  const autor = res.locals.autor as Autor;
  Object.assign(autor, validados(res, atualizarAutorSchema));
  res.json(autor);
});

/** Integridade referencial na mão → 409. No módulo 09 o banco passa a garantir. */
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
