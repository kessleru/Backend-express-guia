/**
 * Conexão e migrations escritas à mão.
 *
 * Migration é um arquivo de SQL versionado que leva o banco de um estado ao
 * próximo. Por que não simplesmente rodar `CREATE TABLE` na mão? Porque:
 *   - o banco de produção não pode ser recriado do zero
 *   - o schema precisa estar no git, junto do código que depende dele
 *   - dois desenvolvedores precisam chegar ao mesmo estado
 *
 * Aqui a tabela `_migrations` guarda o que já rodou. O Prisma (módulo 10) faz
 * exatamente isso — com uma tabela `_prisma_migrations`.
 */
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export type Migration = { nome: string; sql: string };

export const migrations: Migration[] = [
  {
    nome: '001_criar_cursos',
    sql: `
      CREATE TABLE cursos (
        id        INTEGER PRIMARY KEY,
        titulo    TEXT    NOT NULL,
        horas     INTEGER NOT NULL CHECK (horas > 0),
        publicado INTEGER NOT NULL DEFAULT 0   -- SQLite não tem BOOLEAN: 0/1
      );

      -- UNIQUE com NOCASE: a regra "não pode haver dois cursos com o mesmo
      -- título" que o service do módulo 08 checava em memória, agora garantida
      -- pelo banco — e imune a corrida entre duas requisições simultâneas.
      CREATE UNIQUE INDEX idx_cursos_titulo ON cursos(titulo COLLATE NOCASE);
    `,
  },
  {
    nome: '002_indice_publicado',
    sql: `
      -- Índice para o filtro mais usado da API. Confira o ganho com:
      --   EXPLAIN QUERY PLAN SELECT * FROM cursos WHERE publicado = 1
      CREATE INDEX idx_cursos_publicado ON cursos(publicado);
    `,
  },
];

/**
 * Abre o banco e aplica o que falta.
 *
 * Migration é IMUTÁVEL: nunca edite uma que já rodou em produção — o banco de lá
 * não vai reexecutá-la. Precisa mudar algo? Nova migration.
 */
export function abrirBanco(caminho: string): DatabaseSync {
  if (caminho !== ':memory:') mkdirSync(dirname(caminho), { recursive: true });

  const db = new DatabaseSync(caminho);

  // Sem este PRAGMA o SQLite IGNORA suas chaves estrangeiras, silenciosamente.
  // Ele é por conexão, não por banco — repita em toda conexão nova.
  db.exec('PRAGMA foreign_keys = ON');

  // WAL: leitores não bloqueiam o escritor e vice-versa. Para uma API com várias
  // leituras concorrentes a diferença é grande. Não funciona em `:memory:`.
  if (caminho !== ':memory:') db.exec('PRAGMA journal_mode = WAL');

  db.exec(`CREATE TABLE IF NOT EXISTS _migrations (
    nome       TEXT PRIMARY KEY,
    aplicada_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);

  const jaAplicadas = new Set(
    db
      .prepare('SELECT nome FROM _migrations')
      .all()
      .map((linha) => (linha as { nome: string }).nome),
  );

  const registrar = db.prepare('INSERT INTO _migrations (nome) VALUES (?)');

  for (const migration of migrations) {
    if (jaAplicadas.has(migration.nome)) continue;

    // DDL + registro na MESMA transação. Sem isso, uma falha no meio deixaria a
    // tabela criada e a migration não registrada — e a próxima execução tentaria
    // criá-la de novo, falhando para sempre.
    db.exec('BEGIN');
    try {
      db.exec(migration.sql);
      registrar.run(migration.nome);
      db.exec('COMMIT');
      console.log(`  migration aplicada: ${migration.nome}`);
    } catch (erro) {
      db.exec('ROLLBACK');
      throw new Error(`Migration ${migration.nome} falhou: ${(erro as Error).message}`);
    }
  }

  return db;
}
