/**
 * ROTA — o mapa. Só liga caminho + método a um método do controller.
 *
 * Deve ser possível ler este arquivo e entender a API inteira em 20 segundos.
 * Se tem lógica aqui, ela está no lugar errado.
 */
import { Router } from 'express';
import { validar } from '../../07-validacao/validar.ts';
import type { ServicoCursos } from '../servicos/cursos.ts';
import { criarControllerCursos } from '../controllers/cursos.ts';
import {
  alterarCursoSchema,
  criarCursoSchema,
  idSchema,
  listarSchema,
} from './schemas.ts';

/** Recebe o service e devolve o router. A injeção continua até aqui. */
export function criarRotasCursos(servico: ServicoCursos): Router {
  const controller = criarControllerCursos(servico);
  const router = Router();

  router.get('/', validar(listarSchema, 'query'), controller.listar);
  router.post('/', validar(criarCursoSchema), controller.criar);

  router.get('/:id', validar(idSchema, 'params'), controller.buscar);
  router.patch(
    '/:id',
    validar(idSchema, 'params'),
    validar(alterarCursoSchema),
    controller.alterar,
  );
  router.delete('/:id', validar(idSchema, 'params'), controller.remover);

  // Ação de negócio como sub-recurso (módulo 04). O controller não decide nada
  // sobre publicar — só chama `servico.publicar`.
  router.post('/:id/publicar', validar(idSchema, 'params'), controller.publicar);

  return router;
}
