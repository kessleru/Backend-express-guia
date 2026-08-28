/**
 * Rotas de autores.
 */
import { Router } from 'express';
import { criarControllerAutores } from '../controllers/autores.ts';
import { exigirPapel } from '../middlewares/autenticar.ts';
import { validar } from '../middlewares/validar.ts';
import { atualizarAutorSchema, criarAutorSchema } from '../schemas/autor.ts';
import { idSchema } from '../schemas/comuns.ts';
import type { ServicoAutores } from '../servicos/autores.ts';
import type { ServicoLivros } from '../servicos/livros.ts';

export function criarRotasAutores(
  servico: ServicoAutores,
  servicoLivros: ServicoLivros,
): Router {
  const controller = criarControllerAutores(servico, servicoLivros);
  const router = Router();

  router.get('/', controller.listar);
  router.post('/', validar(criarAutorSchema), controller.criar);

  router.get('/:id', validar(idSchema, 'params'), controller.buscar);
  router.get('/:id/livros', validar(idSchema, 'params'), controller.livrosDoAutor);

  router.patch(
    '/:id',
    validar(idSchema, 'params'),
    validar(atualizarAutorSchema),
    controller.alterar,
  );

  // A autorização fica visível na rota que ela protege — melhor que escondida
  // num `app.use` distante (módulo 05).
  router.delete(
    '/:id',
    exigirPapel('admin'),
    validar(idSchema, 'params'),
    controller.remover,
  );

  return router;
}
