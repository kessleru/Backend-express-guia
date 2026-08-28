/**
 * Service de autores.
 */
import type {
  AlterarAutor,
  Autor,
  NovoAutor,
  RepositorioAutores,
} from '../dominio/autor.ts';
import type { RepositorioLivros } from '../dominio/livro.ts';
import { conflito, naoEncontrado } from '../erros/AppError.ts';

export function criarServicoAutores(
  repoAutores: RepositorioAutores,
  repoLivros: RepositorioLivros,
) {
  async function exigirAutor(id: number): Promise<Autor> {
    const autor = await repoAutores.buscarPorId(id);
    if (!autor) throw naoEncontrado('Autor', id);
    return autor;
  }

  return {
    async listar(): Promise<Autor[]> {
      return repoAutores.listar();
    },

    async buscar(id: number): Promise<Autor> {
      return exigirAutor(id);
    },

    async criar(dados: NovoAutor): Promise<Autor> {
      return repoAutores.criar(dados);
    },

    async alterar(id: number, dados: AlterarAutor): Promise<Autor> {
      await exigirAutor(id);
      const atualizado = await repoAutores.atualizar(id, dados);
      if (!atualizado) throw naoEncontrado('Autor', id);
      return atualizado;
    },

    /**
     * Integridade referencial na mão.
     *
     * `contarPorAutor` está na interface de livros justamente por isso: o service
     * de autores precisa da informação, mas não pode conhecer o array de livros
     * nem chamar o service de livros. Ele pergunta ao repositório, pela interface.
     *
     * No módulo 09 isso passa a ser uma FOREIGN KEY com ON DELETE RESTRICT, e o
     * banco garante a regra. Vale ter escrito à mão antes, para saber o que a
     * chave estrangeira está comprando.
     */
    async remover(id: number): Promise<void> {
      await exigirAutor(id);

      const quantos = await repoLivros.contarPorAutor(id);
      if (quantos > 0) {
        throw conflito(
          `Autor tem ${quantos} livro(s) cadastrado(s). Remova os livros primeiro.`,
        );
      }

      await repoAutores.remover(id);
    },
  };
}

export type ServicoAutores = ReturnType<typeof criarServicoAutores>;
