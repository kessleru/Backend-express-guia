/**
 * `RepositorioAutores` sobre Prisma.
 *
 * Compare com a versão SQLite: sumiu a conversão `TEXT ISO` ↔ `Date`, porque o
 * Prisma sabe que `nascimento` é `DateTime` pelo schema. É um exemplo pequeno e
 * exato do que o ORM entrega.
 */
import type {
  AlterarAutor,
  Autor,
  NovoAutor,
  RepositorioAutores,
} from '../dominio/autor.ts';
import { prisma } from '../db/prisma.ts';

type AutorDoPrisma = {
  id: number;
  nome: string;
  nacionalidade: string;
  nascimento: Date | null;
};

const paraAutor = (a: AutorDoPrisma): Autor => ({
  id: a.id,
  nome: a.nome,
  nacionalidade: a.nacionalidade,
  ...(a.nascimento !== null ? { nascimento: a.nascimento } : {}),
});

/** `criadoEm` existe no schema mas não no domínio: `select` explícito o deixa fora. */
const SELECIONA = {
  id: true,
  nome: true,
  nacionalidade: true,
  nascimento: true,
} as const;

/**
 * O CLIENTE ENTRA POR PARÂMETRO, com o singleton como padrão.
 *
 * Em produção ninguém passa nada: `criarRepositorioX()` usa a instância única de
 * `db/prisma.ts`, que é o certo (um pool por processo).
 *
 * O parâmetro existe para a suíte de contrato (`testes/repositorio.test.ts`)
 * poder apontar para um banco TEMPORÁRIO. Sem ele, testar a implementação real
 * significaria escrever no mesmo arquivo `.sqlite` do desenvolvimento — e a
 * suíte apagaria os dados com que você estava brincando.
 *
 * É a mesma injeção de dependência do módulo 08, um nível abaixo: o repositório
 * recebe o cliente em vez de alcançá-lo por conta própria.
 */
type ClientePrisma = typeof prisma;

export function criarRepositorioAutoresPrisma(
  cliente: ClientePrisma = prisma,
): RepositorioAutores {
  return {
    async listar() {
      const autores = await cliente.autor.findMany({
        select: SELECIONA,
        orderBy: { nome: 'asc' },
      });
      return autores.map(paraAutor);
    },

    async buscarPorId(id: number) {
      const autor = await cliente.autor.findUnique({ where: { id }, select: SELECIONA });
      return autor ? paraAutor(autor) : null;
    },

    async criar(dados: NovoAutor) {
      const autor = await cliente.autor.create({
        data: {
          nome: dados.nome,
          nacionalidade: dados.nacionalidade,
          ...(dados.nascimento !== undefined ? { nascimento: dados.nascimento } : {}),
        },
        select: SELECIONA,
      });
      return paraAutor(autor);
    },

    async atualizar(id: number, dados: AlterarAutor) {
      try {
        const autor = await cliente.autor.update({
          where: { id },
          data: {
            ...(dados.nome !== undefined ? { nome: dados.nome } : {}),
            ...(dados.nacionalidade !== undefined
              ? { nacionalidade: dados.nacionalidade }
              : {}),
            ...(dados.nascimento !== undefined ? { nascimento: dados.nascimento } : {}),
          },
          select: SELECIONA,
        });
        return paraAutor(autor);
      } catch {
        return null;
      }
    },

    /**
     * O `onDelete: Restrict` do schema faz este delete FALHAR se o autor tiver
     * livros — e o `catch` transforma isso num `false`.
     *
     * O service checa antes com `contarPorAutor` e devolve 409 com mensagem clara,
     * que é o que o cliente precisa. A restrição do banco é a segunda linha de
     * defesa: protege de script, migration e console de produção, que não passam
     * pelo service. Duas defesas para a mesma regra não é redundância — uma dá boa
     * mensagem, a outra dá garantia.
     */
    async remover(id: number) {
      try {
        await cliente.autor.delete({ where: { id } });
        return true;
      } catch {
        return false;
      }
    },
  };
}
