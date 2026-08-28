/**
 * CONTROLLER — o tradutor entre HTTP e o service.
 *
 * Responsabilidade: ler da requisição, chamar UM método do service, escolher o
 * status e escrever a resposta. Nada além disso.
 *
 * Se um controller tem `if` de regra de negócio, a regra está no lugar errado.
 * O sinal de alerta é o tamanho: controller de mais de 10 linhas por método
 * quase sempre está fazendo trabalho de service.
 */
import type { Request, Response } from 'express';
import { validados } from '../../07-validacao/validar.ts';
import type { ServicoCursos } from '../servicos/cursos.ts';
import {
  alterarCursoSchema,
  criarCursoSchema,
  idSchema,
  listarSchema,
} from '../rotas/schemas.ts';

export function criarControllerCursos(servico: ServicoCursos) {
  return {
    async listar(_req: Request, res: Response) {
      const filtro = validados(res, listarSchema, 'query');
      res.json(await servico.listar(filtro));
    },

    async buscar(_req: Request, res: Response) {
      const { id } = validados(res, idSchema, 'params');
      res.json(await servico.buscar(id));
    },

    async criar(_req: Request, res: Response) {
      const curso = await servico.criar(validados(res, criarCursoSchema));
      // O status é decisão de HTTP, então é aqui — não no service. O service não
      // sabe o que é 201, e é isso que o deixa reusável fora de uma API.
      res.status(201).location(`/cursos/${curso.id}`).json(curso);
    },

    async alterar(_req: Request, res: Response) {
      const { id } = validados(res, idSchema, 'params');
      res.json(await servico.alterar(id, validados(res, alterarCursoSchema)));
    },

    async publicar(_req: Request, res: Response) {
      const { id } = validados(res, idSchema, 'params');
      res.json(await servico.publicar(id));
    },

    async remover(_req: Request, res: Response) {
      const { id } = validados(res, idSchema, 'params');
      await servico.remover(id);
      res.status(204).send();
    },
  };
}

// Nenhum try/catch neste arquivo. O service lança `AppError`, o Express 5 dá
// await no handler async, e o tratador central (módulo 06) converte em resposta.
// Um try/catch aqui só faria o trabalho que o tratador já faz — pior e em 6 lugares.
