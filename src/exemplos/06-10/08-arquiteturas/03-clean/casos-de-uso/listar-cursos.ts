/**
 * CASO DE USO — listar.
 *
 * Este arquivo é o custo da Clean Architecture à mostra: ele não acrescenta
 * nada, só repassa para o repositório. Existe porque a regra do padrão é "um
 * caso de uso por operação", e o controller não pode falar direto com o
 * repositório (pularia um círculo).
 *
 * Num projeto deste tamanho, é um arquivo que você abre para ler uma linha. É o
 * que o módulo chama de "camada que só repassa" — ver
 * `docs/06-10/08-arquitetura-em-camadas/05-quando-nao-usar.md`.
 */
import type { Curso } from '../entidades/curso.ts';
import type { FiltroCursos, RepositorioCursos } from './portas.ts';

export type ListarCursos = (filtro: FiltroCursos) => Promise<Curso[]>;

export function listarCursos(repositorio: RepositorioCursos): ListarCursos {
  return (filtro) => repositorio.listar(filtro);
}
