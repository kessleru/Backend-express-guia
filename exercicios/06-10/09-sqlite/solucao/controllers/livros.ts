/**
 * Controller de livros: traduz HTTP ↔ service. Nada mais.
 *
 * Nenhum método passa de 4 linhas, e nenhum tem `if`. Se aparecer um `if` aqui,
 * é regra de negócio no lugar errado.
 *
 * Nenhum `try/catch` também: o service lança `AppError`, o Express 5 dá await no
 * handler async, e o tratador central (módulo 06) responde. Um try/catch por
 * método repetiria em 8 lugares o que já existe em 1.
 */
import type { Request, Response } from 'express';
import { validados } from '../middlewares/validar.ts';
import { idSchema } from '../schemas/comuns.ts';
import {
  atualizarLivroSchema,
  criarLivroSchema,
  listarLivrosSchema,
} from '../schemas/livro.ts';
import type { ServicoLivros } from '../servicos/livros.ts';

export function criarControllerLivros(servico: ServicoLivros) {
  return {
    async listar(_req: Request, res: Response) {
      res.json(await servico.listar(validados(res, listarLivrosSchema, 'query')));
    },

    async listarDisponiveis(_req: Request, res: Response) {
      res.json(await servico.listarDisponiveis());
    },

    async buscar(_req: Request, res: Response) {
      const { id } = validados(res, idSchema, 'params');
      res.json(await servico.buscar(id));
    },

    async criar(req: Request, res: Response) {
      const livro = await servico.criar(validados(res, criarLivroSchema));
      // 201 e Location são decisões de HTTP — por isso ficam aqui e não no
      // service, que não sabe o que é um status code.
      res.status(201).location(`${req.baseUrl}/${livro.id}`).json(livro);
    },

    async alterar(_req: Request, res: Response) {
      const { id } = validados(res, idSchema, 'params');
      res.json(await servico.alterar(id, validados(res, atualizarLivroSchema)));
    },

    async remover(_req: Request, res: Response) {
      const { id } = validados(res, idSchema, 'params');
      await servico.remover(id);
      res.status(204).send();
    },

    async emprestar(_req: Request, res: Response) {
      const { id } = validados(res, idSchema, 'params');
      res.json(await servico.emprestar(id));
    },

    async devolver(_req: Request, res: Response) {
      const { id } = validados(res, idSchema, 'params');
      res.json(await servico.devolver(id));
    },
  };
}
