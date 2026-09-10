/**
 * CÍRCULO 3 — APRESENTADOR ("presenter" no texto original).
 *
 * Transforma o que o caso de uso devolve no formato que a API promete ao
 * cliente. Hoje os dois formatos são iguais, e este arquivo copia campo a campo —
 * o que é, honestamente, burocracia.
 *
 * O dia em que ele se paga: a API precisa de uma v2 que mostre `"8h"` em vez de
 * `8`, ou esconder um campo interno. A mudança fica aqui, e nenhum caso de uso é
 * tocado. Se esse dia não vai chegar, o apresentador é uma compra que não
 * compensa.
 */
import type { Curso } from '../entidades/curso.ts';

export type CursoApresentado = {
  id: number;
  titulo: string;
  horas: number;
  publicado: boolean;
};

export const apresentarCurso = (curso: Curso): CursoApresentado => ({
  id: curso.id,
  titulo: curso.titulo,
  horas: curso.horas,
  publicado: curso.publicado,
});
