/**
 * A BORDA HTTP da versão DDD.
 *
 * Duas coisas diferentes dos outros exemplos, as duas por causa da entidade rica:
 *
 * 1. O schema Zod só confere o FORMATO (é string? é número?). Tamanho do título
 *    e limite de horas saíram daqui e foram para os value objects, que valem em
 *    qualquer porta de entrada — não só nesta.
 *
 * 2. A resposta passa por `paraJson`. Sem ele, `res.json(curso)` devolveria
 *    `{"id":1}` e mais nada — ver o comentário da função.
 */
import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../../../06-erros/erro-app.ts';
import { validados, validar } from '../../../07-validacao/validar.ts';
import type { ServicoCursos } from '../aplicacao/servico-cursos.ts';
import type { Curso } from '../dominio/curso.ts';
import { ErroDeDominio } from '../dominio/erros.ts';
import type { TipoDeErro } from '../dominio/erros.ts';

const idSchema = z.object({ id: z.coerce.number().int().positive() });
const criarSchema = z.object({ titulo: z.string(), horas: z.number() }).strict();
const listarSchema = z.object({
  publicado: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

/**
 * ⚠️ FALSO AMIGO: `res.json(curso)` compila e responde `{"id":1}`.
 *
 * `JSON.stringify` só enxerga propriedades próprias e enumeráveis. Os campos
 * `#privados` não são propriedades, e os getters (`titulo`, `publicado`) moram no
 * protótipo da classe, não no objeto. Sobra só o `id`, que é campo público.
 *
 * O TypeScript não avisa, porque `res.json` aceita `any`. A saída é mapear na
 * borda, de propósito — e é aqui que o formato da API fica decidido.
 */
const paraJson = (curso: Curso) => ({
  id: curso.id,
  titulo: curso.titulo.valor,
  horas: curso.cargaHoraria.horas,
  publicado: curso.publicado,
});

export function criarRotasCursos(servico: ServicoCursos): Router {
  const router = Router();

  router.get('/', validar(listarSchema, 'query'), async (_req, res) => {
    const cursos = await servico.listar(validados(res, listarSchema, 'query'));
    res.json(cursos.map(paraJson));
  });

  router.post('/', validar(criarSchema), async (_req, res) => {
    const curso = await servico.criar(validados(res, criarSchema));
    res.status(201).location(`/api/v1/cursos/${curso.id}`).json(paraJson(curso));
  });

  router.get('/:id', validar(idSchema, 'params'), async (_req, res) => {
    res.json(paraJson(await servico.buscar(validados(res, idSchema, 'params').id)));
  });

  router.post('/:id/publicar', validar(idSchema, 'params'), async (_req, res) => {
    res.json(paraJson(await servico.publicar(validados(res, idSchema, 'params').id)));
  });

  router.delete('/:id', validar(idSchema, 'params'), async (_req, res) => {
    await servico.remover(validados(res, idSchema, 'params').id);
    res.status(204).send();
  });

  return router;
}

const STATUS_POR_TIPO: Record<TipoDeErro, number> = {
  'nao-encontrado': 404,
  conflito: 409,
  'regra-violada': 400,
};

export function traduzirErroDeDominio(
  erro: unknown,
  _req: Request,
  _res: Response,
  next: NextFunction,
) {
  if (erro instanceof ErroDeDominio) {
    return next(new AppError(erro.message, STATUS_POR_TIPO[erro.tipo]));
  }
  next(erro);
}
