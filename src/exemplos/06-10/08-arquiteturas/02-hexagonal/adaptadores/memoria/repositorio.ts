/**
 * ADAPTADOR DE SAÍDA (conduzido) — guarda os cursos num array.
 *
 * "Conduzido" porque ele nunca toma a iniciativa: só responde quando o núcleo
 * chama. Um adaptador SQLite ou Prisma entraria ao lado deste, satisfazendo a
 * mesma porta `RepositorioCursos`, sem que o núcleo perceba a troca.
 */
import type { Curso } from '../../nucleo/curso.ts';
import type { RepositorioCursos } from '../../nucleo/portas.ts';

export function criarRepositorioEmMemoria(iniciais: Curso[]): RepositorioCursos {
  const cursos = iniciais.map((c) => ({ ...c }));
  let proximoId = Math.max(0, ...cursos.map((c) => c.id)) + 1;

  // Devolve cópias pelo mesmo motivo do exemplo principal: entregar a
  // referência interna deixaria quem chamou alterar o "banco" pelas costas.
  const copia = (c: Curso | undefined) => (c ? { ...c } : null);

  return {
    async listar(filtro) {
      const lista =
        filtro.publicado === undefined
          ? cursos
          : cursos.filter((c) => c.publicado === filtro.publicado);
      return lista.map((c) => ({ ...c }));
    },
    async buscarPorId(id) {
      return copia(cursos.find((c) => c.id === id));
    },
    async buscarPorTitulo(titulo) {
      const alvo = titulo.trim().toLowerCase();
      return copia(cursos.find((c) => c.titulo.toLowerCase() === alvo));
    },
    async criar(dados) {
      const curso: Curso = { id: proximoId++, ...dados, publicado: false };
      cursos.push(curso);
      return { ...curso };
    },
    async marcarPublicado(id) {
      const curso = cursos.find((c) => c.id === id);
      if (!curso) return null;
      curso.publicado = true;
      return { ...curso };
    },
    async remover(id) {
      const indice = cursos.findIndex((c) => c.id === id);
      if (indice === -1) return false;
      cursos.splice(indice, 1);
      return true;
    },
  };
}
