/**
 * `RepositorioEmprestimos` sobre Prisma.
 *
 * É aqui que a diferença entre memória e banco deixa de ser detalhe: os dois
 * métodos de busca deste arquivo viram `WHERE` que o banco resolve com índice.
 * Na versão em memória eles eram `.find()` sobre um array — correto, e com custo
 * proporcional ao número total de empréstimos da biblioteca inteira.
 */
import type {
  Emprestimo,
  NovoEmprestimo,
  RepositorioEmprestimos,
} from '../dominio/emprestimo.ts';
import { prisma } from '../db/prisma.ts';

/**
 * `null` do banco vira campo AUSENTE no domínio.
 *
 * O domínio declara `devolvidoEm?: Date | undefined`, e o banco devolve
 * `Date | null`. Com `exactOptionalPropertyTypes` ligado, `{ devolvidoEm: null }`
 * não compila — e mesmo que compilasse, o service checa `if (emprestimo.devolvidoEm)`
 * e `null` se comportaria como `undefined` só por acidente.
 *
 * O spread condicional faz a tradução explícita: **`null` é um valor do banco,
 * `undefined` é a ausência no domínio.** Confundir os dois é a origem de metade
 * dos bugs de "campo opcional" em código com ORM.
 */
const paraEmprestimo = (e: {
  id: number;
  livroId: number;
  usuarioId: number;
  pegoEm: Date;
  devolvidoEm: Date | null;
}): Emprestimo => ({
  id: e.id,
  livroId: e.livroId,
  usuarioId: e.usuarioId,
  pegoEm: e.pegoEm,
  ...(e.devolvidoEm !== null ? { devolvidoEm: e.devolvidoEm } : {}),
});

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

export function criarRepositorioEmprestimosPrisma(
  cliente: ClientePrisma = prisma,
): RepositorioEmprestimos {
  return {
    async buscarPorId(id) {
      const emprestimo = await cliente.emprestimo.findUnique({ where: { id } });
      return emprestimo ? paraEmprestimo(emprestimo) : null;
    },

    /**
     * "Aberto" = `devolvido_em IS NULL`.
     *
     * `findFirst` e não `findUnique`: `livroId` não é único (o mesmo livro é
     * emprestado muitas vezes ao longo do tempo). O que é único — e o banco NÃO
     * garante — é haver no máximo um empréstimo aberto por livro.
     *
     * Vale encarar essa lacuna: quem impede dois empréstimos abertos do mesmo
     * livro é a regra do service (`if (!livro.disponivel) throw conflito`). Sob
     * concorrência real, duas requisições simultâneas passariam as duas pelo
     * `if` antes de qualquer uma escrever. A defesa de verdade é um índice único
     * parcial (`CREATE UNIQUE INDEX ... WHERE devolvido_em IS NULL`), que o
     * SQLite suporta mas o Prisma ainda não declara no schema.
     *
     * Fica registrado como o que é: uma corrida conhecida, não um descuido.
     * Índice em `(livro_id, devolvido_em)` já existe e serve a esta consulta.
     */
    async buscarAbertoPorLivro(livroId) {
      const emprestimo = await cliente.emprestimo.findFirst({
        where: { livroId, devolvidoEm: null },
      });
      return emprestimo ? paraEmprestimo(emprestimo) : null;
    },

    /**
     * O FILTRO POR DONO ACONTECE NO BANCO.
     *
     * Na versão em memória isto era `.filter()` depois de ter o array inteiro em
     * mãos. Aqui vira `WHERE usuario_id = ?`, e o dado dos outros usuários **nunca
     * é lido** — não passa pela rede, não entra na memória do processo, não pode
     * vazar num `console.log` distraído.
     *
     * É o mesmo princípio de sempre, agora com dente: filtre o mais perto
     * possível da fonte.
     */
    async listarPorUsuario(usuarioId) {
      const emprestimos = await cliente.emprestimo.findMany({
        where: { usuarioId },
        orderBy: { pegoEm: 'desc' }, // o mais recente primeiro: é o que a tela mostra
      });
      return emprestimos.map(paraEmprestimo);
    },

    async listarTodos() {
      const emprestimos = await cliente.emprestimo.findMany({ orderBy: { id: 'asc' } });
      return emprestimos.map(paraEmprestimo);
    },

    async criar(dados: NovoEmprestimo) {
      const emprestimo = await cliente.emprestimo.create({
        data: { livroId: dados.livroId, usuarioId: dados.usuarioId },
      });
      return paraEmprestimo(emprestimo);
    },

    async registrarDevolucao(id, devolvidoEm) {
      try {
        const emprestimo = await cliente.emprestimo.update({
          where: { id },
          data: { devolvidoEm },
        });
        return paraEmprestimo(emprestimo);
      } catch {
        return null;
      }
    },
  };
}
