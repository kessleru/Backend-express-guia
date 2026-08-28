/**
 * Controller de autores.
 */
import type { Request, Response } from 'express';
import { validados } from '../middlewares/validar.ts';
import { atualizarAutorSchema, criarAutorSchema } from '../schemas/autor.ts';
import { idSchema } from '../schemas/comuns.ts';
import type { ServicoAutores } from '../servicos/autores.ts';
import type { ServicoLivros } from '../servicos/livros.ts';

/**
 * Este controller recebe DOIS services porque a rota `/autores/:id/livros`
 * pertence à URL de autores mas devolve livros. Um controller pode orquestrar
 * mais de um service — é ele quem existe para montar a resposta HTTP.
 */
export function criarControllerAutores(
  servico: ServicoAutores,
  servicoLivros: ServicoLivros,
) {
  return {
    async listar(_req: Request, res: Response) {
      res.json(await servico.listar());
    },

    async buscar(_req: Request, res: Response) {
      const { id } = validados(res, idSchema, 'params');
      res.json(await servico.buscar(id));
    },

    async livrosDoAutor(_req: Request, res: Response) {
      const { id } = validados(res, idSchema, 'params');
      await servico.buscar(id); // 404 se o autor não existe
      res.json(await servicoLivros.listarDoAutor(id));
    },

    async criar(req: Request, res: Response) {
      const autor = await servico.criar(validados(res, criarAutorSchema));
      res.status(201).location(`${req.baseUrl}/${autor.id}`).json(autor);
    },

    async alterar(_req: Request, res: Response) {
      const { id } = validados(res, idSchema, 'params');
      res.json(await servico.alterar(id, validados(res, atualizarAutorSchema)));
    },

    async remover(_req: Request, res: Response) {
      const { id } = validados(res, idSchema, 'params');
      await servico.remover(id);
      res.status(204).send();
    },
  };
}
