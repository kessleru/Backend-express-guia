/**
 * REPOSITÓRIO — a única camada que sabe COMO os dados são guardados.
 *
 * Esta implementação usa um array. No módulo 09 aparece uma com `node:sqlite` e
 * no 10 uma com Prisma. Todas as três satisfazem `RepositorioCursos`, e é por
 * isso que o service não muda.
 *
 * Regra desta camada: **nenhuma regra de negócio aqui**. Ela só guarda e busca.
 * "Não pode ter dois cursos com o mesmo título" é decisão de negócio e mora no
 * service — o repositório só sabe responder `buscarPorTitulo`.
 */
import type {
  AtualizacaoCurso,
  Curso,
  FiltroCursos,
  NovoCurso,
  RepositorioCursos,
} from '../dominio/curso.ts';

export function criarRepositorioEmMemoria(iniciais: Curso[] = []): RepositorioCursos {
  // Estado encapsulado no closure: quem recebe o repositório não tem acesso ao
  // array. Sem isso, um handler distraído faria `cursos.push()` direto e furaria
  // todas as regras do service.
  const cursos: Curso[] = [...iniciais];
  let proximoId = Math.max(0, ...cursos.map((c) => c.id)) + 1;

  return {
    async listar(filtro: FiltroCursos) {
      let resultado = cursos;
      if (filtro.titulo) {
        const busca = filtro.titulo.toLowerCase();
        resultado = resultado.filter((c) => c.titulo.toLowerCase().includes(busca));
      }
      if (filtro.publicado !== undefined) {
        resultado = resultado.filter((c) => c.publicado === filtro.publicado);
      }
      // Devolve COPIAS. Entregar a referência do array interno deixaria quem
      // chamou capaz de alterar o "banco" sem passar por aqui.
      return resultado.map((c) => ({ ...c }));
    },

    async buscarPorId(id: number) {
      const curso = cursos.find((c) => c.id === id);
      return curso ? { ...curso } : null;
    },

    async buscarPorTitulo(titulo: string) {
      const alvo = titulo.trim().toLowerCase();
      const curso = cursos.find((c) => c.titulo.toLowerCase() === alvo);
      return curso ? { ...curso } : null;
    },

    async criar(dados: NovoCurso) {
      const curso: Curso = { id: proximoId++, ...dados, publicado: false };
      cursos.push(curso);
      return { ...curso };
    },

    async atualizar(id: number, dados: AtualizacaoCurso) {
      const indice = cursos.findIndex((c) => c.id === id);
      if (indice === -1) return null;

      const atual = cursos[indice]!;

      // `{ ...atual, ...dados }` seria o óbvio — e está ERRADO. Se `dados` tem
      // `{ titulo: undefined }` (chave presente, valor ausente), o spread grava
      // `undefined` sobre o título salvo e apaga o dado.
      //
      // O `exactOptionalPropertyTypes: true` do tsconfig é justamente o que
      // recusa esse spread na compilação. Sem a flag, isto compilaria e o bug
      // apareceria em produção, num PATCH que "às vezes limpa o campo".
      const atualizado: Curso = { ...atual, id: atual.id };
      if (dados.titulo !== undefined) atualizado.titulo = dados.titulo;
      if (dados.horas !== undefined) atualizado.horas = dados.horas;
      if (dados.publicado !== undefined) atualizado.publicado = dados.publicado;

      cursos[indice] = atualizado;
      return { ...atualizado };
    },

    async remover(id: number) {
      const indice = cursos.findIndex((c) => c.id === id);
      if (indice === -1) return false;
      cursos.splice(indice, 1);
      return true;
    },
  };
}
