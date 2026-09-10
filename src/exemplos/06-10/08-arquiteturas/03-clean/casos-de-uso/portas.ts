/**
 * CÍRCULO 2 — o que os casos de uso precisam que alguém de fora faça.
 *
 * O texto da Clean Architecture chama isto de "gateway"; aqui ficou com o nome
 * que o resto do repositório usa, `RepositorioCursos`. O nome muda de livro para
 * livro — a posição não: o contrato mora DENTRO, e a implementação, fora
 * (`../adaptadores/repositorio-memoria.ts`).
 */
import type { Curso } from '../entidades/curso.ts';

export type FiltroCursos = { publicado?: boolean | undefined };

export type NovoCurso = { titulo: string; horas: number };

export type RepositorioCursos = {
  listar(filtro: FiltroCursos): Promise<Curso[]>;
  buscarPorId(id: number): Promise<Curso | null>;
  buscarPorTitulo(titulo: string): Promise<Curso | null>;
  criar(dados: NovoCurso): Promise<Curso>;
  /** Grava o curso inteiro. Quem decide O QUE mudou foi o caso de uso. */
  salvar(curso: Curso): Promise<void>;
  remover(id: number): Promise<void>;
};
