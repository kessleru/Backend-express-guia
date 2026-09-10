/**
 * CASO DE USO — criar.
 *
 * "Título não se repete" mora aqui, e não na entidade, por um motivo que vale
 * guardar: para saber se o título se repete é preciso olhar OUTROS cursos. Uma
 * entidade só enxerga a si mesma. Regra que precisa consultar o conjunto é regra
 * da aplicação — o círculo 2.
 */
import type { Curso } from '../entidades/curso.ts';
import { ErroDeCasoDeUso } from './erros.ts';
import type { NovoCurso, RepositorioCursos } from './portas.ts';

export type CriarCurso = (dados: NovoCurso) => Promise<Curso>;

export function criarCurso(repositorio: RepositorioCursos): CriarCurso {
  return async (dados) => {
    if (await repositorio.buscarPorTitulo(dados.titulo)) {
      throw new ErroDeCasoDeUso(
        'conflito',
        `Já existe um curso chamado "${dados.titulo}"`,
      );
    }
    return repositorio.criar(dados);
  };
}
