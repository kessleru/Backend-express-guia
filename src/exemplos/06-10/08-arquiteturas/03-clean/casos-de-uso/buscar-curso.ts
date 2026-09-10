/** CASO DE USO — buscar um curso, ou falhar com "não encontrado". */
import type { Curso } from '../entidades/curso.ts';
import { cursoNaoEncontrado } from './erros.ts';
import type { RepositorioCursos } from './portas.ts';

export type BuscarCurso = (id: number) => Promise<Curso>;

export function buscarCurso(repositorio: RepositorioCursos): BuscarCurso {
  return async (id) => {
    const curso = await repositorio.buscarPorId(id);
    if (!curso) throw cursoNaoEncontrado(id);
    return curso;
  };
}
