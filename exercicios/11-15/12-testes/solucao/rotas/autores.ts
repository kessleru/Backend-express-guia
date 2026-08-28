/**
 * Rotas de autores.
 */
import { Router } from 'express';
import { criarControllerAutores } from '../controllers/autores.ts';
import { autenticar, exigirPapel } from '../middlewares/autenticar.ts';
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

  const soAdmin = [autenticar, exigirPapel('admin')];

  // Leitura pública, escrita de admin — a mesma política de `rotas/livros.ts`.
  // Manter a regra IGUAL entre recursos parecidos não é preguiça: exceção sem
  // motivo é o que faz ninguém mais conseguir prever quem pode o quê.
  router.get('/', controller.listar);
  router.get('/:id', validar(idSchema, 'params'), controller.buscar);
  router.get('/:id/livros', validar(idSchema, 'params'), controller.livrosDoAutor);

  router.post('/', soAdmin, validar(criarAutorSchema), controller.criar);

  router.patch(
    '/:id',
    soAdmin,
    validar(idSchema, 'params'),
    validar(atualizarAutorSchema),
    controller.alterar,
  );

  // A autorização fica visível na rota que ela protege — melhor que escondida
  // num `app.use` distante (módulo 05).
  router.delete('/:id', soAdmin, validar(idSchema, 'params'), controller.remover);

  return router;
}
