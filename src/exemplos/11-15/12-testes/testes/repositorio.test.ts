/**
 * TESTE DE INTEGRAÇÃO COM BANCO — SQLite `:memory:`.
 *
 * Este arquivo responde a uma pergunta que o teste unitário não pode responder:
 * **o SQL está certo?**
 *
 * O service passa nos testes com o repositório em memória porque ele só conhece
 * a interface. Mas `criarRepositorioSqlite` traduz para SQL — e é aí que moram
 * os erros que o TypeScript não pega: coluna com nome errado, booleano gravado
 * como texto, `UPDATE` sem `SET`, `NOT NULL` esquecido.
 *
 * ---------------------------------------------------------------------
 * A SUÍTE DE CONTRATO
 * ---------------------------------------------------------------------
 * Como as duas implementações prometem a MESMA interface, os mesmos testes
 * deveriam passar nas duas. É o que a `describe.each` abaixo faz — e é a técnica
 * mais útil deste arquivo:
 *
 *   - se um teste passa em memória e falha no SQLite, o bug é da tradução;
 *   - se falha nos dois, o bug é de entendimento do contrato;
 *   - e o dia em que entrar um repositório Prisma, ele herda a suíte inteira.
 *
 * Princípio: **quem define o contrato define os testes do contrato.**
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { RepositorioLivros } from '../dominio.ts';
import { criarRepositorioMemoria } from '../repositorios/memoria.ts';
import { criarRepositorioSqlite } from '../repositorios/sqlite.ts';

type Fabrica = { nome: string; criar: () => RepositorioLivros & { fechar?: () => void } };

const implementacoes: Fabrica[] = [
  { nome: 'memória', criar: () => criarRepositorioMemoria() },
  // `:memory:` é o padrão da fábrica — banco novo por conexão, some ao fechar.
  { nome: 'sqlite', criar: () => criarRepositorioSqlite() },
];

describe.each(implementacoes)('contrato: $nome', ({ criar }) => {
  let repo: RepositorioLivros & { fechar?: () => void };

  beforeEach(() => {
    repo = criar();
  });

  // Fechar a conexão importa: uma conexão SQLite aberta por arquivo de teste
  // vaza descritor de arquivo, e num CI com centenas de testes isso vira
  // "EMFILE: too many open files" — um erro que não aponta para lugar nenhum.
  afterEach(() => {
    repo.fechar?.();
  });

  it('começa vazio', async () => {
    await expect(repo.listar()).resolves.toEqual([]);
  });

  it('criar devolve o id gerado pelo banco', async () => {
    const livro = await repo.criar({ titulo: 'Duna', autorId: 2, ano: 1965 });

    // `toBeGreaterThan(0)` e não `toBe(1)`: o id é decisão do banco. Fixar o
    // valor faria o teste depender do AUTOINCREMENT ter começado em 1 — verdade
    // hoje, e falso no dia em que a fixture inserir algo antes.
    expect(livro.id).toBeGreaterThan(0);
    expect(livro).toMatchObject({ titulo: 'Duna', disponivel: true });
  });

  it('buscarPorId devolve null (não undefined, não lança) quando não existe', async () => {
    // A diferença importa: o service faz `if (!livro)`, que trata os dois — mas
    // um `undefined` vazando para o `res.json` viraria corpo vazio com 200.
    // Contrato explícito, teste explícito.
    await expect(repo.buscarPorId(999)).resolves.toBeNull();
  });

  it('atualizar mexe só no campo enviado', async () => {
    const criado = await repo.criar({ titulo: 'Duna', autorId: 2, ano: 1965 });

    const atualizado = await repo.atualizar(criado.id, { ano: 1966 });

    // O TÍTULO TEM QUE SOBREVIVER. É o bug do spread (`{...atual, ...dados}`)
    // do módulo 08: uma chave `titulo: undefined` presente no objeto apagaria o
    // título salvo. Em memória e em SQL o erro é o mesmo, e o teste pega os dois.
    expect(atualizado).toMatchObject({ ano: 1966, titulo: 'Duna' });
  });

  it('atualizar devolve null para id inexistente', async () => {
    await expect(repo.atualizar(999, { ano: 2000 })).resolves.toBeNull();
  });

  it('o booleano sobrevive à ida e volta', async () => {
    // A tradução que só o teste de banco valida: SQLite não tem BOOLEAN, guarda
    // 0/1. Sem a conversão em `paraLivro`, `disponivel` voltaria como `0` — que
    // é FALSY em JavaScript, então metade do código funcionaria e a outra
    // metade (`=== false`, `JSON` da resposta) não.
    const criado = await repo.criar({ titulo: 'X', autorId: 1, ano: 2000 });
    await repo.atualizar(criado.id, { disponivel: false });

    const lido = await repo.buscarPorId(criado.id);
    expect(lido?.disponivel).toBe(false);
  });

  it('remover devolve false para id inexistente', async () => {
    await expect(repo.remover(999)).resolves.toBe(false);
  });

  it('cada instância do repositório começa do zero', async () => {
    await repo.criar({ titulo: 'Efêmero', autorId: 1, ano: 2020 });

    // A prova do isolamento: outra instância não enxerga nada. Com um arquivo
    // `.sqlite` em disco compartilhado, este teste falharia na segunda execução
    // — e é exatamente esse tipo de teste "que só falha na segunda vez" que faz
    // gente desistir de testar.
    const outro = criar();
    await expect(outro.listar()).resolves.toEqual([]);
    outro.fechar?.();
  });
});
