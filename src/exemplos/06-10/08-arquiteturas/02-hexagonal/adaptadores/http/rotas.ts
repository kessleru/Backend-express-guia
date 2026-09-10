/**
 * ADAPTADOR DE ENTRADA (condutor) — HTTP com Express.
 *
 * "Condutor" porque é ele que toma a iniciativa: chega uma requisição, ele
 * traduz para uma chamada da porta de entrada, e traduz a resposta de volta.
 *
 * É o ÚNICO arquivo do exemplo que sabe o que é status code. Repare que a
 * tradução de erro (`STATUS_POR_TIPO`) mora aqui, e não no núcleo.
 */
import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../../../../06-erros/erro-app.ts';
import { validados, validar } from '../../../../07-validacao/validar.ts';
import { ErroDoNucleo } from '../../nucleo/curso.ts';
import type { TipoDeErro } from '../../nucleo/curso.ts';
import type { CatalogoDeCursos } from '../../nucleo/portas.ts';

const idSchema = z.object({ id: z.coerce.number().int().positive() });
const criarSchema = z
  .object({
    titulo: z.string().trim().min(3).max(120),
    horas: z.number().int().positive().max(500),
  })
  .strict();
const listarSchema = z.object({
  publicado: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

export function criarRotasHttp(catalogo: CatalogoDeCursos): Router {
  const router = Router();

  router.get('/', validar(listarSchema, 'query'), async (_req, res) => {
    res.json(await catalogo.listar(validados(res, listarSchema, 'query')));
  });

  router.post('/', validar(criarSchema), async (_req, res) => {
    const curso = await catalogo.criar(validados(res, criarSchema));
    res.status(201).location(`/api/v1/cursos/${curso.id}`).json(curso);
  });

  router.get('/:id', validar(idSchema, 'params'), async (_req, res) => {
    res.json(await catalogo.buscar(validados(res, idSchema, 'params').id));
  });

  router.post('/:id/publicar', validar(idSchema, 'params'), async (_req, res) => {
    res.json(await catalogo.publicar(validados(res, idSchema, 'params').id));
  });

  router.delete('/:id', validar(idSchema, 'params'), async (_req, res) => {
    await catalogo.remover(validados(res, idSchema, 'params').id);
    res.status(204).send();
  });

  return router;
}

// A tradução "tipo de problema do núcleo → status HTTP" em UM lugar. O
// adaptador de linha de comando tem a tabela dele (código de saída); o núcleo
// não tem nenhuma.
const STATUS_POR_TIPO: Record<TipoDeErro, number> = {
  'nao-encontrado': 404,
  conflito: 409,
  'regra-violada': 400,
};

/**
 * Converte `ErroDoNucleo` em `AppError` e passa adiante. Assim o tratador
 * central do módulo 06 continua sendo o único que monta a resposta de erro — o
 * adaptador só acrescenta a tradução que o núcleo, de propósito, não sabe fazer.
 */
export function traduzirErroDoNucleo(
  erro: unknown,
  _req: Request,
  _res: Response,
  next: NextFunction,
) {
  if (erro instanceof ErroDoNucleo) {
    return next(new AppError(erro.message, STATUS_POR_TIPO[erro.tipo]));
  }
  next(erro);
}
