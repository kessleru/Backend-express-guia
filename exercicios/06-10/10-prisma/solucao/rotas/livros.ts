/**
 * Rotas de livros: só o mapa. Dá para entender a API inteira em 20 segundos.
 */
import { Router } from 'express';
import { criarControllerLivros } from '../controllers/livros.ts';
import { validar } from '../middlewares/validar.ts';
import { idSchema } from '../schemas/comuns.ts';
import {
  atualizarLivroSchema,
  criarLivroSchema,
  listarLivrosSchema,
} from '../schemas/livro.ts';
import type { ServicoLivros } from '../servicos/livros.ts';

export function criarRotasLivros(servico: ServicoLivros): Router {
  const controller = criarControllerLivros(servico);
  const router = Router();

  // Literal antes de parâmetro (módulo 04).
  router.get('/disponiveis', controller.listarDisponiveis);

  router.get('/', validar(listarLivrosSchema, 'query'), controller.listar);
  router.post('/', validar(criarLivroSchema), controller.criar);

  router.get('/:id', validar(idSchema, 'params'), controller.buscar);
  router.patch(
    '/:id',
    validar(idSchema, 'params'),
    validar(atualizarLivroSchema),
    controller.alterar,
  );
  router.delete('/:id', validar(idSchema, 'params'), controller.remover);

  router.post('/:id/emprestar', validar(idSchema, 'params'), controller.emprestar);
  router.post('/:id/devolver', validar(idSchema, 'params'), controller.devolver);

  return router;
}
