/**
 * Service — o alvo do teste UNITÁRIO.
 *
 * Nenhum import de `express`, de banco ou de `node:*`. Só domínio e AppError.
 * Testar isto não precisa de servidor, de porta, de banco nem de mock de módulo:
 * basta passar um objeto que satisfaça `RepositorioLivros`.
 *
 * É a diferença entre "código testável" e "código que dá para testar com
 * esforço". Se um teste precisa de `vi.mock`, quase sempre a dependência estava
 * importada em vez de injetada.
 */
import type { AtualizacaoLivro, Livro, NovoLivro, RepositorioLivros } from './dominio.ts';
import {
  conflito,
  naoEncontrado,
  requisicaoInvalida,
} from '../../06-10/06-erros/erro-app.ts';

const ANO_MINIMO = 1450; // a imprensa de Gutenberg

export function criarServicoLivros(repo: RepositorioLivros) {
  async function exigirLivro(id: number): Promise<Livro> {
    const livro = await repo.buscarPorId(id);
    if (!livro) throw naoEncontrado('Livro', id);
    return livro;
  }

  return {
    async listar(): Promise<Livro[]> {
      return repo.listar();
    },

    async buscar(id: number): Promise<Livro> {
      return exigirLivro(id);
    },

    async criar(dados: NovoLivro): Promise<Livro> {
      // Regra de NEGÓCIO, não de formato (módulo 07). "É um número inteiro" é
      // trabalho do Zod; "livro não pode ser anterior à imprensa" é do service —
      // e vale também para o seed e para o importador em massa, que não passam
      // pelo middleware de validação.
      if (dados.ano < ANO_MINIMO) {
        throw requisicaoInvalida(`\`ano\` não pode ser antes de ${ANO_MINIMO}`);
      }
      return repo.criar(dados);
    },

    async alterar(id: number, dados: AtualizacaoLivro): Promise<Livro> {
      await exigirLivro(id);
      const atualizado = await repo.atualizar(id, dados);
      if (!atualizado) throw naoEncontrado('Livro', id);
      return atualizado;
    },

    async remover(id: number): Promise<void> {
      const livro = await exigirLivro(id);
      if (!livro.disponivel) {
        throw conflito('Livro emprestado não pode ser removido');
      }
      await repo.remover(id);
    },

    async emprestar(id: number): Promise<Livro> {
      const livro = await exigirLivro(id);
      if (!livro.disponivel) throw conflito('Livro já está emprestado');

      const atualizado = await repo.atualizar(id, { disponivel: false });
      if (!atualizado) throw naoEncontrado('Livro', id);
      return atualizado;
    },
  };
}

export type ServicoLivros = ReturnType<typeof criarServicoLivros>;
