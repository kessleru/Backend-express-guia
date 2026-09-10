/**
 * CASO DE USO — publicar um curso.
 *
 * Repare na divisão de trabalho com a entidade: a entidade diz SE pode
 * (`motivoParaNaoPublicar`); o caso de uso cuida do resto da história — buscar,
 * perguntar, gravar. A regra em si não está escrita aqui, e é por isso que o
 * `publicar-rascunhos.ts` ao lado consegue reusá-la sem copiar.
 */
import { motivoParaNaoPublicar } from '../entidades/curso.ts';
import type { Curso } from '../entidades/curso.ts';
import { cursoNaoEncontrado, recusado } from './erros.ts';
import type { RepositorioCursos } from './portas.ts';

export type PublicarCurso = (id: number) => Promise<Curso>;

export function publicarCurso(repositorio: RepositorioCursos): PublicarCurso {
  return async (id) => {
    const curso = await repositorio.buscarPorId(id);
    if (!curso) throw cursoNaoEncontrado(id);

    const recusa = motivoParaNaoPublicar(curso);
    if (recusa) throw recusado(recusa);

    const publicado = { ...curso, publicado: true };
    await repositorio.salvar(publicado);
    return publicado;
  };
}
