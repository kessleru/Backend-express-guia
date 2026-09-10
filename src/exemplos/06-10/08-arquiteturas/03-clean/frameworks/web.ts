/**
 * CÍRCULO 4 — FRAMEWORKS: o Express propriamente dito.
 *
 * O círculo mais de fora é onde mora o que você não escreveu e pode trocar:
 * framework web, driver de banco. O texto original diz que aqui ficam "os
 * detalhes", e o nome é deliberado — detalhe é o que não deveria decidir o
 * formato do resto.
 *
 * Este arquivo só cola: URL + validação → método do controller.
 */
import express from 'express';
import type { Express } from 'express';
import { rotaNaoEncontrada, tratarErro } from '../../../06-erros/tratador.ts';
import { validar } from '../../../07-validacao/validar.ts';
import { traduzirErro } from '../adaptadores/controller.ts';
import type { criarControllerCursos } from '../adaptadores/controller.ts';
import { criarSchema, idSchema, listarSchema } from '../adaptadores/schemas.ts';

type ControllerCursos = ReturnType<typeof criarControllerCursos>;

export function criarApp(controller: ControllerCursos): Express {
  const router = express.Router();
  router.get('/', validar(listarSchema, 'query'), controller.listar);
  router.post('/', validar(criarSchema), controller.criar);
  router.post('/publicar-todos', controller.publicarRascunhos);
  router.get('/:id', validar(idSchema, 'params'), controller.buscar);
  router.post('/:id/publicar', validar(idSchema, 'params'), controller.publicar);
  router.delete('/:id', validar(idSchema, 'params'), controller.remover);

  const app = express();
  app.use(express.json());
  app.use('/api/v1/cursos', router);
  app.use(rotaNaoEncontrada);
  app.use(traduzirErro);
  app.use(tratarErro);
  return app;
}
