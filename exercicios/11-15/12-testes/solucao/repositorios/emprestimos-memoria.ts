/**
 * Repositório de empréstimos em memória.
 */
import type {
  Emprestimo,
  NovoEmprestimo,
  RepositorioEmprestimos,
} from '../dominio/emprestimo.ts';

export function criarRepositorioEmprestimos(
  iniciais: Emprestimo[] = [],
): RepositorioEmprestimos {
  const emprestimos: Emprestimo[] = iniciais.map((e) => ({ ...e }));
  let ultimoId = Math.max(0, ...emprestimos.map((e) => e.id));

  const copiar = (e: Emprestimo): Emprestimo => ({ ...e });

  /** "Aberto" = sem data de devolução. Um lugar só define isso. */
  const aberto = (e: Emprestimo) => e.devolvidoEm === undefined;

  return {
    async buscarPorId(id) {
      const emprestimo = emprestimos.find((e) => e.id === id);
      return emprestimo ? copiar(emprestimo) : null;
    },

    async buscarAbertoPorLivro(livroId) {
      const emprestimo = emprestimos.find((e) => e.livroId === livroId && aberto(e));
      return emprestimo ? copiar(emprestimo) : null;
    },

    async listarPorUsuario(usuarioId) {
      // O FILTRO POR DONO ACONTECE AQUI, não no controller.
      //
      // A diferença importa: filtrar depois de listar tudo significa que a
      // resposta já saiu do banco com os dados dos outros — basta um `console.log`
      // distraído, um log de debug ou um bug no `.filter()` para vazar. Num banco
      // real isto vira `WHERE usuario_id = ?`, e o dado alheio nunca é lido.
      //
      // Princípio: **filtre o mais perto possível da fonte.**
      return emprestimos.filter((e) => e.usuarioId === usuarioId).map(copiar);
    },

    async listarTodos() {
      return emprestimos.map(copiar);
    },

    async criar(dados: NovoEmprestimo) {
      const emprestimo: Emprestimo = {
        id: ++ultimoId,
        livroId: dados.livroId,
        usuarioId: dados.usuarioId,
        pegoEm: new Date(),
        // `devolvidoEm` fica AUSENTE, não `undefined` explícito:
        // `exactOptionalPropertyTypes` distingue os dois casos.
      };
      emprestimos.push(emprestimo);
      return copiar(emprestimo);
    },

    async registrarDevolucao(id, devolvidoEm) {
      const indice = emprestimos.findIndex((e) => e.id === id);
      if (indice === -1) return null;

      const atualizado = copiar(emprestimos[indice]!);
      atualizado.devolvidoEm = devolvidoEm;
      emprestimos[indice] = atualizado;
      return copiar(atualizado);
    },
  };
}
