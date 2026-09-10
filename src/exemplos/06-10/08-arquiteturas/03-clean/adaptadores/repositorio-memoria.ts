/**
 * CÍRCULO 3 — ADAPTADOR de dados: implementa o contrato do círculo 2.
 *
 * O import aponta para DENTRO (`../casos-de-uso/portas.ts`). Nenhum arquivo de
 * `casos-de-uso/` importa este aqui — quem liga os dois é o `servidor.ts`.
 */
import type { Curso } from '../entidades/curso.ts';
import type { RepositorioCursos } from '../casos-de-uso/portas.ts';

export function criarRepositorioEmMemoria(iniciais: Curso[]): RepositorioCursos {
  const cursos = iniciais.map((c) => ({ ...c }));
  let proximoId = Math.max(0, ...cursos.map((c) => c.id)) + 1;

  return {
    async listar(filtro) {
      const lista =
        filtro.publicado === undefined
          ? cursos
          : cursos.filter((c) => c.publicado === filtro.publicado);
      return lista.map((c) => ({ ...c }));
    },
    async buscarPorId(id) {
      const curso = cursos.find((c) => c.id === id);
      return curso ? { ...curso } : null;
    },
    async buscarPorTitulo(titulo) {
      const alvo = titulo.trim().toLowerCase();
      const curso = cursos.find((c) => c.titulo.toLowerCase() === alvo);
      return curso ? { ...curso } : null;
    },
    async criar(dados) {
      const curso: Curso = { id: proximoId++, ...dados, publicado: false };
      cursos.push(curso);
      return { ...curso };
    },
    async salvar(curso) {
      const indice = cursos.findIndex((c) => c.id === curso.id);
      if (indice !== -1) cursos[indice] = { ...curso };
    },
    async remover(id) {
      const indice = cursos.findIndex((c) => c.id === id);
      if (indice !== -1) cursos.splice(indice, 1);
    },
  };
}
