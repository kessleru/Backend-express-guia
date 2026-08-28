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

export function criarRepositorioAutoresPrisma(): RepositorioAutores {
  return {
    async listar() {
      const autores = await prisma.autor.findMany({
        select: SELECIONA,
        orderBy: { nome: 'asc' },
      });
      return autores.map(paraAutor);
    },

    async buscarPorId(id: number) {
      const autor = await prisma.autor.findUnique({ where: { id }, select: SELECIONA });
      return autor ? paraAutor(autor) : null;
    },

    async criar(dados: NovoAutor) {
      const autor = await prisma.autor.create({
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
        const autor = await prisma.autor.update({
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
        await prisma.autor.delete({ where: { id } });
        return true;
      } catch {
        return false;
      }
    },
  };
}
