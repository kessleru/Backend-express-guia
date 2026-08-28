/**
 * SUÍTE DE CONTRATO — os mesmos testes, contra as duas implementações.
 *
 * ---------------------------------------------------------------------
 * O PROBLEMA QUE ELA RESOLVE
 * ---------------------------------------------------------------------
 * Os outros arquivos desta pasta montam o app com os repositórios em MEMÓRIA.
 * É o certo: a suíte roda em segundos, sem banco, sem migration e sem limpar
 * tabela entre casos.
 *
 * O risco disso é específico e conhecido: **o dublê desvia da implementação
 * real.** O teste passa em memória, a produção quebra no SQL, e nada na suíte
 * avisou — porque nenhum teste jamais tocou a implementação que vai para
 * produção.
 *
 * Esta suíte fecha esse buraco sem desfazer o ganho. Ela roda o MESMO conjunto
 * de asserções contra as duas implementações da mesma interface. Se as duas
 * passam, o dublê é fiel naquilo que os testes afirmam; quando uma passa e a
 * outra falha, você achou a divergência antes da produção.
 *
 *   | Resultado                         | O que significa                    |
 *   | --------------------------------- | ---------------------------------- |
 *   | passa nas duas                    | o contrato vale nas duas           |
 *   | passa em memória, falha no Prisma | o erro está na tradução para o SQL |
 *   | falha nas duas                    | o erro está no teste ou no contrato |
 *
 * ---------------------------------------------------------------------
 * POR QUE ELA É PULADA QUANDO NÃO HÁ CLIENT GERADO
 * ---------------------------------------------------------------------
 * O Prisma Client é código GERADO: num clone novo ele não existe até alguém
 * rodar `npm run db:generate`. Sem cuidado, este arquivo derrubaria a suíte
 * inteira num clone limpo, com um erro de import que não explica nada.
 *
 * A saída é o import DINÂMICO: a implementação Prisma só entra na lista quando o
 * client existe. Sem ele, a suíte roda só contra memória e nada quebra.
 *
 * Só que isso, sozinho, tem um defeito — e ele foi descoberto testando: com a
 * lista mais curta, os casos do Prisma **somem da saída em silêncio**. Ninguém
 * vê 26 testes a menos num total de 245. Um teste que desaparece sem aviso é
 * pior que um que falha, porque a suíte fica verde afirmando menos do que
 * ontem.
 *
 * Por isso existe o `describe.runIf` no fim deste arquivo: quando o client não
 * está gerado, ele produz um caso PULADO, com o motivo no nome. O Vitest imprime
 * `1 skipped` no resumo, e aí a ausência é visível.
 *
 * Princípio: **teste que exige infraestrutura é pulado com aviso, nunca sumido
 * em silêncio.**
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { RepositorioEmprestimos } from '../dominio/emprestimo.ts';
import type { Livro, RepositorioLivros } from '../dominio/livro.ts';
import type { RepositorioRefresh, RepositorioUsuarios } from '../dominio/usuario.ts';
import { criarRepositorioEmprestimos } from '../repositorios/emprestimos-memoria.ts';
import { criarRepositorioLivros } from '../repositorios/livros-memoria.ts';
import { criarRepositorioRefresh } from '../repositorios/refresh-memoria.ts';
import { criarRepositorioUsuarios } from '../repositorios/usuarios-memoria.ts';
import { livrosDeTeste } from './fixtures.ts';

const RAIZ = resolve(import.meta.dirname, '../../../../..');
const CLIENT_GERADO = join(RAIZ, 'src/exemplos/06-10/10-prisma/gerado/client.ts');
const temPrismaGerado = existsSync(CLIENT_GERADO);

/**
 * Um banco temporário por execução, descartado no fim.
 *
 * Rodar contra `data/prisma-10.sqlite` seria o erro óbvio: o teste apagaria os
 * dados com que você estava brincando no servidor, e a ordem dos casos passaria
 * a depender do que sobrou da última vez. **Teste que compartilha banco com
 * desenvolvimento não é teste, é sabotagem agendada.**
 */
const pastaTemp = mkdtempSync(join(tmpdir(), 'contrato-'));
const bancoTemp = join(pastaTemp, 'teste.sqlite');

/**
 * Aplica as migrations à mão, em ordem.
 *
 * `prisma migrate deploy` faria o mesmo, mas como subprocesso — segundos por
 * execução. Aqui fica claro o que uma migration é: **arquivos `.sql` aplicados
 * em ordem alfabética**, que é por isso que o nome deles começa com data.
 */
function aplicarMigrations(caminho: string) {
  const db = new DatabaseSync(caminho);
  const pasta = join(RAIZ, 'prisma/migrations');
  for (const dir of readdirSync(pasta).sort()) {
    const sql = join(pasta, dir, 'migration.sql');
    if (existsSync(sql)) db.exec(readFileSync(sql, 'utf8'));
  }
  db.close();
}

/** O que cada implementação precisa entregar para a suíte rodar contra ela. */
type Mundo = {
  livros: RepositorioLivros;
  usuarios: RepositorioUsuarios;
  emprestimos: RepositorioEmprestimos;
  refresh: RepositorioRefresh;
  /** Um livro que já existe — o empréstimo precisa de um para apontar. */
  livroId: number;
};

type Implementacao = { nome: string; criar: () => Promise<Mundo> };

const implementacoes: Implementacao[] = [
  {
    nome: 'memória',
    criar: async () => {
      const livros = livrosDeTeste();
      return {
        livros: criarRepositorioLivros(livros),
        usuarios: criarRepositorioUsuarios(),
        emprestimos: criarRepositorioEmprestimos(),
        refresh: criarRepositorioRefresh(),
        livroId: livros[0]!.id,
      };
    },
  },
];

if (temPrismaGerado) {
  aplicarMigrations(bancoTemp);

  // Import DINÂMICO: com `import` estático no topo, um clone sem
  // `npm run db:generate` falharia ao carregar o arquivo, e o `skipIf` nem
  // chegaria a ser avaliado.
  const { PrismaClient } =
    await import('../../../../../src/exemplos/06-10/10-prisma/gerado/client.ts');
  const { PrismaBetterSqlite3 } = await import('@prisma/adapter-better-sqlite3');
  const repos = {
    livros: await import('../repositorios/livros-prisma.ts'),
    usuarios: await import('../repositorios/usuarios-prisma.ts'),
    emprestimos: await import('../repositorios/emprestimos-prisma.ts'),
    refresh: await import('../repositorios/refresh-prisma.ts'),
  };

  const cliente = new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: `file:${bancoTemp}` }),

    // O `log` é declarado com a MESMA expressão de `db/prisma.ts`, e não por
    // capricho: o tipo `PrismaClient` é genérico sobre os eventos de log, então
    // `log: []` aqui produziria `PrismaClient<never>` e o TypeScript recusaria
    // passá-lo a um repositório que espera `PrismaClient<'query'>`.
    //
    // É um erro de tipo que parece burocracia e está certo: ele diz que os dois
    // clientes não são intercambiáveis. Construir o de teste igual ao de
    // produção é a resposta — e de quebra o `PRISMA_LOG=1` funciona na suíte.
    log: process.env.PRISMA_LOG ? ['query'] : [],
  });

  implementacoes.push({
    nome: 'prisma',
    criar: async () => {
      // A ORDEM DAS EXCLUSÕES É A DAS CHAVES ESTRANGEIRAS.
      //
      // `usuarios` tem `onDelete: Restrict` vindo de `emprestimos`: apagar o
      // usuário antes do empréstimo é recusado pelo banco. Inverter estas quatro
      // linhas produz um erro de constraint que parece bug do teste e é o
      // desenho do schema funcionando.
      await cliente.emprestimo.deleteMany();
      await cliente.refreshToken.deleteMany();
      await cliente.usuario.deleteMany();
      await cliente.livro.deleteMany();
      await cliente.autor.deleteMany();

      const autor = await cliente.autor.create({
        data: { nome: 'Tolkien', nacionalidade: 'britânica' },
      });
      const livro = await cliente.livro.create({
        data: { titulo: 'O Hobbit', ano: 1937, autorId: autor.id },
      });
      await cliente.livro.create({
        data: { titulo: 'Duna', ano: 1965, autorId: autor.id },
      });

      return {
        livros: repos.livros.criarRepositorioLivrosPrisma(cliente),
        usuarios: repos.usuarios.criarRepositorioUsuariosPrisma(cliente),
        emprestimos: repos.emprestimos.criarRepositorioEmprestimosPrisma(cliente),
        refresh: repos.refresh.criarRepositorioRefreshPrisma(cliente),
        livroId: livro.id,
      };
    },
  });

  afterAll(async () => {
    await cliente.$disconnect();
    rmSync(pastaTemp, { recursive: true, force: true });
  });
}

/**
 * `describe.each` sobre as implementações: cada `it` abaixo roda uma vez por
 * implementação, e o nome do caso diz qual é. É o que torna a saída legível
 * quando só uma das duas falha.
 */
describe.each(implementacoes)('contrato do repositório [$nome]', ({ criar }) => {
  let mundo: Mundo;

  beforeEach(async () => {
    mundo = await criar();
  });

  describe('usuários', () => {
    const novo = {
      email: 'ana@exemplo.com',
      senhaHash: 'hash-falso',
      papel: 'leitor' as const,
    };

    it('cria e busca por id', async () => {
      const criado = await mundo.usuarios.criar(novo);
      expect(criado.id).toBeGreaterThan(0);
      expect(criado.criadoEm).toBeInstanceOf(Date);

      const achado = await mundo.usuarios.buscarPorId(criado.id);
      expect(achado?.email).toBe('ana@exemplo.com');
    });

    /**
     * O CASO QUE JUSTIFICA A SUÍTE INTEIRA.
     *
     * Em memória, a comparação é `a.toLowerCase() === b.toLowerCase()` — passa
     * sem esforço. No SQLite, `=` sobre TEXT é **sensível a caixa**, então
     * `findUnique({ email: 'ANA@EXEMPLO.COM' })` não acharia nada se o
     * repositório não normalizasse antes de consultar.
     *
     * Sem este teste, a divergência apareceria como "não consigo logar" para o
     * usuário que digitou o e-mail com maiúscula — em produção, e só nela.
     */
    it('acha o usuário independentemente da caixa do e-mail', async () => {
      await mundo.usuarios.criar({ ...novo, email: 'Ana@Exemplo.com' });

      const achado = await mundo.usuarios.buscarPorEmail('ANA@EXEMPLO.COM');
      expect(achado).not.toBeNull();
      // E o que foi GRAVADO está normalizado, não só o que foi buscado.
      expect(achado?.email).toBe('ana@exemplo.com');
    });

    it('conta sem trazer as linhas', async () => {
      expect(await mundo.usuarios.contar()).toBe(0);
      await mundo.usuarios.criar(novo);
      expect(await mundo.usuarios.contar()).toBe(1);
    });

    it('atualizarSenha devolve null para id inexistente', async () => {
      // A interface pede `null`. O Prisma LANÇA P2025 nesse caso, e o
      // repositório traduz — se alguém remover aquele `try/catch`, este teste
      // fica vermelho só na implementação Prisma. É o valor da suíte.
      expect(await mundo.usuarios.atualizarSenha(9999, 'outro')).toBeNull();
    });
  });

  describe('empréstimos', () => {
    async function comUsuario() {
      return mundo.usuarios.criar({
        email: `u${Date.now()}@x.com`,
        senhaHash: 'h',
        papel: 'leitor',
      });
    }

    it('nasce aberto: devolvidoEm AUSENTE, não null', async () => {
      const usuario = await comUsuario();
      const emp = await mundo.emprestimos.criar({
        livroId: mundo.livroId,
        usuarioId: usuario.id,
      });

      // A distinção importa: o banco guarda NULL, o domínio declara o campo
      // OPCIONAL. `toBeUndefined` falharia se o repositório Prisma repassasse o
      // `null` cru — e o `if (emprestimo.devolvidoEm)` do service só funcionaria
      // por acidente.
      expect(emp.devolvidoEm).toBeUndefined();
      expect(emp.pegoEm).toBeInstanceOf(Date);
    });

    it('buscarAbertoPorLivro acha o aberto e ignora o devolvido', async () => {
      const usuario = await comUsuario();
      const emp = await mundo.emprestimos.criar({
        livroId: mundo.livroId,
        usuarioId: usuario.id,
      });

      expect((await mundo.emprestimos.buscarAbertoPorLivro(mundo.livroId))?.id).toBe(
        emp.id,
      );

      await mundo.emprestimos.registrarDevolucao(emp.id, new Date());
      expect(await mundo.emprestimos.buscarAbertoPorLivro(mundo.livroId)).toBeNull();
    });

    it('listarPorUsuario devolve só os do dono', async () => {
      const a = await comUsuario();
      const b = await comUsuario();
      await mundo.emprestimos.criar({ livroId: mundo.livroId, usuarioId: a.id });

      expect(await mundo.emprestimos.listarPorUsuario(a.id)).toHaveLength(1);
      expect(await mundo.emprestimos.listarPorUsuario(b.id)).toHaveLength(0);
    });

    it('registrarDevolucao devolve null para id inexistente', async () => {
      expect(await mundo.emprestimos.registrarDevolucao(9999, new Date())).toBeNull();
    });
  });

  /**
   * ---------------------------------------------------------------
   * A BUSCA POR TÍTULO, E A INJEÇÃO DE SQL DE VERDADE
   * ---------------------------------------------------------------
   * Este bloco é o motivo pelo qual valeu trazer o Prisma para o exercício 13.
   *
   * Enquanto os repositórios eram só arrays em memória, o critério de aceite
   * "busca com `'; DROP TABLE livros; --` não altera o banco" passava **sem
   * mérito nenhum**: não havia SQL, logo não havia injeção a resistir. O teste
   * dizia "verde" sem ter exercitado defesa alguma.
   *
   * Rodando contra `[prisma]`, a string vai para um banco SQLite real. Se o
   * repositório concatenasse a busca na consulta (`$queryRawUnsafe`), a tabela
   * `livros` seria apagada e a asserção do fim deste teste ficaria vermelha.
   *
   * Repare que a defesa não é filtrar caractere perigoso: a string chega inteira
   * ao banco. O que a torna inofensiva é chegar como PARÂMETRO.
   */
  describe('busca por título', () => {
    it('acha por trecho do título', async () => {
      const pagina = await mundo.livros.listar({ q: 'hobbit', pagina: 1, porPagina: 10 });
      expect(pagina.dados.map((l: Livro) => l.titulo)).toContain('O Hobbit');
    });

    /**
     * -------------------------------------------------------------
     * O FALSO AMIGO: "testei com DROP TABLE e não aconteceu nada"
     * -------------------------------------------------------------
     * O payload famoso é `'; DROP TABLE livros; --`, e ele **não apaga a tabela**
     * aqui nem numa versão vulnerável — foi verificado sabotando o repositório de
     * propósito. O motivo não tem nada a ver com a sua defesa: o driver
     * (`better-sqlite3`, como o `node:sqlite`) recusa executar mais de uma
     * instrução por consulta, e o `;` é o que torna o payload duas.
     *
     * Quem testa só com ele conclui que está protegido. Está protegido do payload
     * de camiseta, não de injeção.
     *
     * O que passa é o payload de UMA instrução: `' OR 1=1 --` fecha a aspa,
     * neutraliza o filtro e comenta o resto. Numa consulta concatenada ele
     * devolve a TABELA INTEIRA — que é o vazamento de dados que a maioria dos
     * incidentes reais de injeção realmente é. Apagar tabela é o caso raro.
     *
     * Por isso este teste afirma as duas coisas: a busca não quebra, e o filtro
     * continua filtrando.
     */
    it.each([
      ['payload clássico', "'; DROP TABLE livros; --"],
      ['payload de uma instrução', "' OR 1=1 --"],
    ])('%s é tratado como texto comum', async (_nome, ataque) => {
      const todos = await mundo.livros.listar({ pagina: 1, porPagina: 50 });
      expect(todos.total).toBeGreaterThan(0);

      const resultado = await mundo.livros.listar({
        q: ataque,
        pagina: 1,
        porPagina: 50,
      });

      // A ASSERÇÃO QUE IMPORTA: o filtro continuou filtrando.
      //
      // Numa consulta concatenada, `' OR 1=1 --` devolveria `todos.total` linhas.
      // Aqui devolve zero, porque nenhum livro se chama assim — o valor foi
      // comparado como texto, não interpretado como condição.
      expect(resultado.dados).toEqual([]);

      // E a consulta seguinte prova que o banco continua íntegro: se algo
      // tivesse sido executado, ela lançaria em vez de repetir o total.
      const depois = await mundo.livros.listar({ pagina: 1, porPagina: 50 });
      expect(depois.total).toBe(todos.total);
    });

    it('aspas e hífens duplos em título legítimo funcionam', async () => {
      // O outro lado da moeda: uma defesa que "limpasse" caracteres perigosos
      // recusaria ou mutilaria buscas válidas. `O'Neill` é título possível, não
      // ataque — e numa consulta concatenada ele quebraria o SQL, devolvendo 500
      // para um usuário que não fez nada de errado.
      const pagina = await mundo.livros.listar({
        q: "O'Neill",
        pagina: 1,
        porPagina: 10,
      });
      expect(pagina.dados).toEqual([]); // não achou, e não quebrou
    });
  });

  describe('refresh tokens', () => {
    async function comUsuario() {
      return mundo.usuarios.criar({
        email: `r${Date.now()}@x.com`,
        senhaHash: 'h',
        papel: 'leitor',
      });
    }

    it('guarda, busca e revoga', async () => {
      const usuario = await comUsuario();
      await mundo.refresh.guardar({
        jti: 'jti-1',
        usuarioId: usuario.id,
        criadoEm: new Date(),
      });

      expect((await mundo.refresh.buscar('jti-1'))?.usuarioId).toBe(usuario.id);
      expect(await mundo.refresh.revogar('jti-1')).toBe(true);
      expect(await mundo.refresh.buscar('jti-1')).toBeNull();
    });

    it('revogar um jti que não existe devolve false, sem lançar', async () => {
      // É o caminho do logout com token já expirado — caso normal, não erro.
      // No Prisma, `delete` lançaria P2025 aqui; o repositório usa `deleteMany`.
      expect(await mundo.refresh.revogar('nunca-existiu')).toBe(false);
    });

    it('revogarDoUsuario derruba todas as sessões daquele usuário', async () => {
      const a = await comUsuario();
      const b = await comUsuario();
      const agora = new Date();
      await mundo.refresh.guardar({ jti: 'a1', usuarioId: a.id, criadoEm: agora });
      await mundo.refresh.guardar({ jti: 'a2', usuarioId: a.id, criadoEm: agora });
      await mundo.refresh.guardar({ jti: 'b1', usuarioId: b.id, criadoEm: agora });

      expect(await mundo.refresh.revogarDoUsuario(a.id)).toBe(2);
      expect(await mundo.refresh.buscar('a1')).toBeNull();
      // A sessão do OUTRO usuário sobrevive — trocar a senha de A não desloga B.
      expect(await mundo.refresh.buscar('b1')).not.toBeNull();
    });
  });
});

/**
 * O AVISO VISÍVEL — ver o bloco no topo do arquivo.
 *
 * Um `if` comum, e não `describe.runIf(!temPrismaGerado)`. A diferença foi
 * descoberta rodando: **`runIf(false)` marca o bloco como PULADO em vez de não
 * registrá-lo**, então o aviso "rode db:generate" aparecia no resumo até quando
 * o Prisma estava rodando normalmente — um aviso mentiroso, que é pior que
 * nenhum.
 *
 * Com o `if`, o bloco só existe no cenário ruim, e o `it.skip` dentro dele
 * garante a linha de "skipped" no resumo do Vitest. É a diferença entre "não
 * rodou e você sabe" e "não rodou".
 */
if (!temPrismaGerado) {
  describe('contrato contra a implementação real', () => {
    it.skip('PULADO: rode `npm run db:generate` para exercitar o repositório Prisma', () => {
      // Vazio de propósito: o valor deste caso é o NOME dele aparecer na saída.
    });
  });
}
