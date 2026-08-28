/**
 * Ponto único de importação dos schemas (desafio extra).
 *
 * Um `index.ts` por pasta encurta os imports de quem consome:
 *   import { criarLivroSchema, idSchema } from './index.ts';
 * em vez de dois imports de arquivos diferentes.
 */
export * from './autor.ts';
export * from './comuns.ts';
export * from './livro.ts';
export * from './usuario.ts';
