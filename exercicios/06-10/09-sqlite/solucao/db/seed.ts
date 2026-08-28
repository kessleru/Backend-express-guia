/**
 * Dados iniciais, idempotentes.
 *
 * `INSERT OR IGNORE` com id fixo em vez de "só insere se a tabela está vazia":
 * assim rodar o seed depois de você ter cadastrado seus próprios livros não
 * duplica nada nem falha.
 */
import type { DatabaseSync } from 'node:sqlite';

export function rodarSeed(db: DatabaseSync): void {
  const autores = db.prepare(
    'INSERT OR IGNORE INTO autores (id, nome, nacionalidade, nascimento) VALUES (?, ?, ?, ?)',
  );
  autores.run(1, 'J.R.R. Tolkien', 'britânica', '1892-01-03');
  autores.run(2, 'Frank Herbert', 'estadunidense', '1920-10-08');

  const livros = db.prepare(
    'INSERT OR IGNORE INTO livros (id, titulo, autor_id, ano, isbn, disponivel) VALUES (?, ?, ?, ?, ?, ?)',
  );
  livros.run(1, 'O Hobbit', 1, 1937, '9788595084742', 1);
  livros.run(2, 'Duna', 2, 1965, null, 1);
  livros.run(3, 'O Senhor dos Anéis', 1, 1954, '9788595084759', 0);

  // Gêneros já vieram na migration 002. Aqui só as ligações.
  // Subquery pelo NOME em vez de id fixo: se a ordem de inserção dos gêneros
  // mudar numa migration futura, isto continua correto.
  const ligar = db.prepare(`
    INSERT OR IGNORE INTO livros_generos (livro_id, genero_id)
    VALUES (?, (SELECT id FROM generos WHERE nome = ?))
  `);
  ligar.run(1, 'fantasia');
  ligar.run(2, 'ficcao');
  ligar.run(3, 'fantasia');
  ligar.run(3, 'ficcao');

  const { total } = db.prepare('SELECT COUNT(*) AS total FROM livros').get() as {
    total: number;
  };
  console.log(`  ✓ seed conferido (${total} livros no acervo)`);
}
