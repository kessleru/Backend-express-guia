/**
 * Router de autores. Note que ele NÃO importa `rotasLivros` — os dois importam
 * `dados.ts`. Dependência em uma direção só, sem ciclo.
 */
import { Router } from 'express';
import { autores, livros, proximoIdAutor, type Autor } from '../dados.ts';

export const rotasAutores = Router();

rotasAutores.param('id', (req, res, next, valor) => {
  const id = Number(valor);
  const autor = Number.isInteger(id) ? autores.find((a) => a.id === id) : undefined;
  if (!autor) return res.status(404).json({ erro: `Autor ${valor} não encontrado` });

  res.locals.autor = autor;
  next();
});

rotasAutores.get('/', (_req, res) => {
  res.json(autores);
});

rotasAutores.get('/:id', (_req, res) => {
  res.json(res.locals.autor as Autor);
});

/**
 * Sub-recurso: os livros DESTE autor.
 *
 * `GET /livros?autorId=1` devolve a mesma coisa e as duas formas são corretas.
 * A hierarquia comunica melhor a relação; o filtro combina melhor com outros
 * critérios (`?autorId=1&disponivel=true`). Ter as duas é comum e não é erro.
 */
rotasAutores.get('/:id/livros', (_req, res) => {
  const autor = res.locals.autor as Autor;
  res.json(livros.filter((l) => l.autorId === autor.id));
});

rotasAutores.post('/', (req, res) => {
  const { nome, nacionalidade } = (req.body ?? {}) as Record<string, unknown>;

  if (typeof nome !== 'string' || nome.trim() === '') {
    return res.status(400).json({ erro: '`nome` é obrigatório' });
  }
  if (typeof nacionalidade !== 'string' || nacionalidade.trim() === '') {
    return res.status(400).json({ erro: '`nacionalidade` é obrigatória' });
  }

  const autor: Autor = { id: proximoIdAutor(), nome: nome.trim(), nacionalidade };
  autores.push(autor);
  res.status(201).location(`${req.baseUrl}/${autor.id}`).json(autor);
});

/**
 * Deletar autor com livros → 409.
 *
 * É integridade referencial na mão. No módulo 09 quem garante isso passa a ser o
 * banco (`FOREIGN KEY ... ON DELETE RESTRICT`) — e é bom ter escrito a regra
 * manualmente antes, para entender o que a chave estrangeira está comprando.
 *
 * As alternativas seriam apagar os livros junto (CASCADE) ou deixar `autorId`
 * nulo (SET NULL). Nenhuma é "a certa": é decisão de negócio.
 */
rotasAutores.delete('/:id', (_req, res) => {
  const autor = res.locals.autor as Autor;
  const quantos = livros.filter((l) => l.autorId === autor.id).length;

  if (quantos > 0) {
    return res.status(409).json({
      erro: `Autor tem ${quantos} livro(s) cadastrado(s). Remova os livros primeiro.`,
    });
  }

  autores.splice(autores.indexOf(autor), 1);
  res.status(204).send();
});
