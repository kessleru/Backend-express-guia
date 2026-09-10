/** CASO DE USO — remover. A regra ("publicado não se apaga") é da entidade. */
import { motivoParaNaoRemover } from '../entidades/curso.ts';
import { cursoNaoEncontrado, recusado } from './erros.ts';
import type { RepositorioCursos } from './portas.ts';

export type RemoverCurso = (id: number) => Promise<void>;

export function removerCurso(repositorio: RepositorioCursos): RemoverCurso {
  return async (id) => {
    const curso = await repositorio.buscarPorId(id);
    if (!curso) throw cursoNaoEncontrado(id);

    const recusa = motivoParaNaoRemover(curso);
    if (recusa) throw recusado(recusa);

    await repositorio.remover(id);
  };
}
