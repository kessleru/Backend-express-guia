/**
 * O "banco" da biblioteca. Note que este arquivo não declara mais tipo nenhum:
 * `Livro` e `Autor` vêm dos schemas, que são a única fonte de verdade.
 */
import type { Autor } from './schemas/autor.ts';
import type { Livro } from './schemas/livro.ts';

export type { Autor, Livro };

export const autores: Autor[] = [
  { id: 1, nome: 'J.R.R. Tolkien', nacionalidade: 'britânica' },
  { id: 2, nome: 'Frank Herbert', nacionalidade: 'estadunidense' },
];

export const livros: Livro[] = [
  {
    id: 1,
    titulo: 'O Hobbit',
    autorId: 1,
    ano: 1937,
    isbn: '9788595084742',
    generos: ['fantasia'],
    disponivel: true,
  },
  {
    id: 2,
    titulo: 'Duna',
    autorId: 2,
    ano: 1965,
    generos: ['ficcao'],
    disponivel: true,
  },
  {
    id: 3,
    titulo: 'O Senhor dos Anéis',
    autorId: 1,
    ano: 1954,
    generos: ['fantasia', 'ficcao'],
    disponivel: false,
  },
];

let ultimoIdLivro = 3;
let ultimoIdAutor = 2;

export const proximoIdLivro = () => ++ultimoIdLivro;
export const proximoIdAutor = () => ++ultimoIdAutor;
