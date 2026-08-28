/**
 * Service de livros — TODAS as regras de negócio da biblioteca moram aqui.
 *
 * Não importa `express`. Não importa nada de banco. Só domínio e AppError.
 * É o que permite testá-lo sem servidor e sem banco (módulo 12), e reusá-lo num
 * worker de fila (17) ou num comando de importação em massa.
 */
import type { RepositorioAutores } from '../dominio/autor.ts';
import type {
  AlterarLivro,
  FiltroLivros,
  Livro,
  NovoLivro,
  Pagina,
  RepositorioLivros,
} from '../dominio/livro.ts';
import { conflito, naoEncontrado, requisicaoInvalida } from '../erros/AppError.ts';

/**
 * Dois repositórios injetados.
 *
 * "O autor do livro tem que existir" é regra do livro, mas precisa consultar
 * autores. Um service pode depender de vários repositórios; o que ele não deve
 * fazer é depender de outro SERVICE — aí a mesma regra passa a ter dois pontos de
 * entrada, e o risco de dependência circular aparece.
 */
export function criarServicoLivros(
  repoLivros: RepositorioLivros,
  repoAutores: RepositorioAutores,
) {
  /** Reaproveitada por metade dos métodos: buscar ou 404. */
  async function exigirLivro(id: number): Promise<Livro> {
    const livro = await repoLivros.buscarPorId(id);
    if (!livro) throw naoEncontrado('Livro', id);
    return livro;
  }

  /** 400 e não 404: referência inválida é erro no body que o cliente mandou. */
  async function exigirAutorExistente(autorId: number): Promise<void> {
    const autor = await repoAutores.buscarPorId(autorId);
    if (!autor)
      throw requisicaoInvalida(`Autor ${autorId} não existe`, { campo: 'autorId' });
  }

  /** 409 e não 400: o body está correto, é o estado do acervo que impede. */
  async function exigirIsbnLivre(isbn: string, ignorarId?: number): Promise<void> {
    const existente = await repoLivros.buscarPorIsbn(isbn);
    if (existente && existente.id !== ignorarId) {
      throw conflito(`Já existe um livro com o ISBN ${isbn}`);
    }
  }

  return {
    async listar(filtro: FiltroLivros): Promise<Pagina<Livro>> {
      return repoLivros.listar(filtro);
    },

    async listarDisponiveis(): Promise<Livro[]> {
      return repoLivros.listarDisponiveis();
    },

    async buscar(id: number): Promise<Livro> {
      return exigirLivro(id);
    },

    async contarPorAutor(autorId: number): Promise<number> {
      return repoLivros.contarPorAutor(autorId);
    },

    async listarDoAutor(autorId: number): Promise<Livro[]> {
      const { dados } = await repoLivros.listar({ autorId, pagina: 1, porPagina: 1000 });
      return dados;
    },

    async criar(dados: NovoLivro): Promise<Livro> {
      await exigirAutorExistente(dados.autorId);
      if (dados.isbn) await exigirIsbnLivre(dados.isbn);
      return repoLivros.criar(dados);
    },

    async alterar(id: number, dados: AlterarLivro): Promise<Livro> {
      await exigirLivro(id); // 404 antes de validar o resto

      if (dados.autorId !== undefined) await exigirAutorExistente(dados.autorId);
      if (dados.isbn) await exigirIsbnLivre(dados.isbn, id);

      const atualizado = await repoLivros.atualizar(id, dados);
      if (!atualizado) throw naoEncontrado('Livro', id);
      return atualizado;
    },

    /**
     * REGRA NOVA do exercício: livro emprestado não se apaga.
     *
     * Repare onde ela mora. No controller, o worker de importação a ignoraria.
     * No repositório, o `remover` genérico a ignoraria. Aqui, ela vale para todo
     * mundo que quiser remover um livro — hoje e nos módulos seguintes.
     */
    async remover(id: number): Promise<void> {
      const livro = await exigirLivro(id);
      if (!livro.disponivel) {
        throw conflito(
          'Livro emprestado não pode ser removido. Registre a devolução primeiro.',
        );
      }
      await repoLivros.remover(id);
    },

    async emprestar(id: number): Promise<Livro> {
      const livro = await exigirLivro(id);
      if (!livro.disponivel) throw conflito('Livro já está emprestado');

      const atualizado = await repoLivros.atualizar(id, { disponivel: false });
      if (!atualizado) throw naoEncontrado('Livro', id);
      return atualizado;
    },

    async devolver(id: number): Promise<Livro> {
      const livro = await exigirLivro(id);
      if (livro.disponivel) throw conflito('Livro não está emprestado');

      const atualizado = await repoLivros.atualizar(id, { disponivel: true });
      if (!atualizado) throw naoEncontrado('Livro', id);
      return atualizado;
    },
  };
}

/** O tipo sai da função — nada de interface escrita à mão para divergir. */
export type ServicoLivros = ReturnType<typeof criarServicoLivros>;
