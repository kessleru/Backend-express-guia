/**
 * Repositório em memória. Serve para rodar o exemplo e para os testes de rota.
 */
import type {
  AtualizacaoLivro,
  Livro,
  NovoLivro,
  RepositorioLivros,
} from '../dominio.ts';

export function criarRepositorioMemoria(iniciais: Livro[] = []): RepositorioLivros {
  // O array vive no closure e é RECRIADO a cada chamada da fábrica.
  //
  // Isso é o que dá isolamento de graça no teste: cada `beforeEach` chama a
  // fábrica de novo e ganha um "banco" limpo. Um módulo que exportasse
  // `export const livros = []` compartilharia o array entre todos os testes do
  // arquivo — e o teste 3 passaria ou falharia dependendo de o teste 1 ter
  // rodado. Princípio: **teste que depende de ordem não é teste, é sorte.**
  const livros: Livro[] = iniciais.map((l) => ({ ...l }));
  let ultimoId = Math.max(0, ...livros.map((l) => l.id));

  const copiar = (l: Livro): Livro => ({ ...l });

  return {
    async listar() {
      return livros.map(copiar);
    },

    async buscarPorId(id) {
      const livro = livros.find((l) => l.id === id);
      return livro ? copiar(livro) : null;
    },

    async criar(dados: NovoLivro) {
      const livro: Livro = { id: ++ultimoId, ...dados, disponivel: true };
      livros.push(livro);
      return copiar(livro);
    },

    async atualizar(id, dados: AtualizacaoLivro) {
      const indice = livros.findIndex((l) => l.id === id);
      if (indice === -1) return null;

      const atualizado = copiar(livros[indice]!);
      if (dados.titulo !== undefined) atualizado.titulo = dados.titulo;
      if (dados.ano !== undefined) atualizado.ano = dados.ano;
      if (dados.disponivel !== undefined) atualizado.disponivel = dados.disponivel;

      livros[indice] = atualizado;
      return copiar(atualizado);
    },

    async remover(id) {
      const indice = livros.findIndex((l) => l.id === id);
      if (indice === -1) return false;
      livros.splice(indice, 1);
      return true;
    },
  };
}
