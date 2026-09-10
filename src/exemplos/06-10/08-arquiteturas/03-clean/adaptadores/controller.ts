/**
 * CÍRCULO 3 — CONTROLLER: traduz a requisição para a entrada do caso de uso e
 * a saída do caso de uso (via apresentador) para a resposta.
 *
 * Ele conhece os tipos de `req`/`res`, e está certo: o círculo 3 é justamente o
 * que fala as duas línguas. O que ele não faz é decidir regra — cada método
 * chama exatamente UM caso de uso.
 */
import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../../06-erros/erro-app.ts';
import { validados } from '../../../07-validacao/validar.ts';
import type { BuscarCurso } from '../casos-de-uso/buscar-curso.ts';
import type { CriarCurso } from '../casos-de-uso/criar-curso.ts';
import { ErroDeCasoDeUso } from '../casos-de-uso/erros.ts';
import type { TipoDeErro } from '../casos-de-uso/erros.ts';
import type { ListarCursos } from '../casos-de-uso/listar-cursos.ts';
import type { PublicarCurso } from '../casos-de-uso/publicar-curso.ts';
import type { PublicarRascunhos } from '../casos-de-uso/publicar-rascunhos.ts';
import type { RemoverCurso } from '../casos-de-uso/remover-curso.ts';
import { apresentarCurso } from './apresentador.ts';
import { criarSchema, idSchema, listarSchema } from './schemas.ts';

/** O pacote de casos de uso que o controller recebe pronto do `servidor.ts`. */
export type CasosDeUsoCursos = {
  listar: ListarCursos;
  buscar: BuscarCurso;
  criar: CriarCurso;
  publicar: PublicarCurso;
  publicarRascunhos: PublicarRascunhos;
  remover: RemoverCurso;
};

export function criarControllerCursos(casos: CasosDeUsoCursos) {
  return {
    async listar(_req: Request, res: Response) {
      const cursos = await casos.listar(validados(res, listarSchema, 'query'));
      res.json(cursos.map(apresentarCurso));
    },
    async buscar(_req: Request, res: Response) {
      const { id } = validados(res, idSchema, 'params');
      res.json(apresentarCurso(await casos.buscar(id)));
    },
    async criar(_req: Request, res: Response) {
      const curso = await casos.criar(validados(res, criarSchema));
      res.status(201).location(`/api/v1/cursos/${curso.id}`).json(apresentarCurso(curso));
    },
    async publicar(_req: Request, res: Response) {
      const { id } = validados(res, idSchema, 'params');
      res.json(apresentarCurso(await casos.publicar(id)));
    },
    async publicarRascunhos(_req: Request, res: Response) {
      const { publicados, recusados } = await casos.publicarRascunhos();
      res.json({ publicados: publicados.map(apresentarCurso), recusados });
    },
    async remover(_req: Request, res: Response) {
      await casos.remover(validados(res, idSchema, 'params').id);
      res.status(204).send();
    },
  };
}

const STATUS_POR_TIPO: Record<TipoDeErro, number> = {
  'nao-encontrado': 404,
  conflito: 409,
  'regra-violada': 400,
};

/** Converte o erro do caso de uso em `AppError` e deixa o tratador do 06 responder. */
export function traduzirErro(
  erro: unknown,
  _req: Request,
  _res: Response,
  next: NextFunction,
) {
  if (erro instanceof ErroDeCasoDeUso) {
    return next(new AppError(erro.message, STATUS_POR_TIPO[erro.tipo]));
  }
  next(erro);
}
