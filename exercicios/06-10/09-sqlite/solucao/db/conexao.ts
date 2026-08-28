/**
 * Abertura do banco, PRAGMAs e execução das migrations.
 */
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { migrations } from './migrations.ts';

export function abrirBanco(caminho: string): DatabaseSync {
  if (caminho !== ':memory:') mkdirSync(dirname(caminho), { recursive: true });

  const db = new DatabaseSync(caminho);

  // POR CONEXÃO, não por banco. Sem isto o SQLite ACEITA autor_id inexistente e
  // você descobre meses depois, com o banco cheio de órfãos.
  db.exec('PRAGMA foreign_keys = ON');

  if (caminho !== ':memory:') {
    // WAL: leitores não bloqueiam o escritor. Numa API com muita leitura
    // concorrente a diferença é grande. Não se aplica a :memory:.
    db.exec('PRAGMA journal_mode = WAL');
    // NORMAL em vez de FULL: não espera o fsync a cada commit. Troca um risco
    // ínfimo (perder os últimos commits numa queda de energia, não corromper o
    // banco) por uma escrita bem mais rápida.
    db.exec('PRAGMA synchronous = NORMAL');
  }

  aplicarMigrations(db);
  return db;
}

function aplicarMigrations(db: DatabaseSync): void {
  db.exec(`CREATE TABLE IF NOT EXISTS _migrations (
    nome        TEXT PRIMARY KEY,
    aplicada_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);

  const aplicadas = new Set(
    db
      .prepare('SELECT nome FROM _migrations')
      .all()
      .map((l) => (l as { nome: string }).nome),
  );

  const registrar = db.prepare('INSERT INTO _migrations (nome) VALUES (?)');

  for (const migration of migrations) {
    if (aplicadas.has(migration.nome)) continue; // idempotência

    // DDL + registro na MESMA transação. Sem isso, uma falha no meio deixaria a
    // tabela criada e a migration não registrada — e a próxima execução tentaria
    // criar de novo, falhando para sempre. É a atomicidade do ACID resolvendo um
    // problema bem concreto.
    db.exec('BEGIN');
    try {
      db.exec(migration.sql);
      registrar.run(migration.nome);
      db.exec('COMMIT');
      console.log(`  ✓ migration ${migration.nome}`);
    } catch (erro) {
      db.exec('ROLLBACK');
      throw new Error(`Migration ${migration.nome} falhou: ${(erro as Error).message}`);
    }
  }
}
