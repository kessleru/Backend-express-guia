/**
 * As migrations da biblioteca.
 *
 * REGRA DE OURO: migration que já rodou é IMUTÁVEL. O banco de produção não vai
 * reexecutá-la, então editá-la faz os ambientes divergirem em silêncio. Precisa
 * mudar algo? Nova migration.
 */

export type Migration = { nome: string; sql: string };

export const migrations: Migration[] = [
  {
    nome: '001_inicial',
    sql: `
      CREATE TABLE autores (
        id            INTEGER PRIMARY KEY,
        nome          TEXT NOT NULL,
        nacionalidade TEXT NOT NULL,
        -- SQLite não tem tipo DATE. Guarde ISO 8601 em TEXT: ordena
        -- lexicograficamente igual à ordem cronológica, o que faz
        -- ORDER BY e BETWEEN funcionarem de graça.
        nascimento    TEXT
      );

      CREATE TABLE livros (
        id         INTEGER PRIMARY KEY,
        titulo     TEXT    NOT NULL,
        autor_id   INTEGER NOT NULL,
        ano        INTEGER NOT NULL CHECK (ano BETWEEN 1450 AND 2100),
        -- UNIQUE aceita vários NULL: livros antigos sem ISBN convivem.
        isbn       TEXT    UNIQUE,
        -- Não existe BOOLEAN no SQLite. 0/1, convertido no repositório.
        disponivel INTEGER NOT NULL DEFAULT 1 CHECK (disponivel IN (0, 1)),

        -- RESTRICT: recusa apagar autor com livros. É a mesma regra que o
        -- service do exercício 08 checava à mão — agora garantida pelo banco,
        -- e portanto imune a script de importação e a console de produção.
        FOREIGN KEY (autor_id) REFERENCES autores(id) ON DELETE RESTRICT
      );
    `,
  },
  {
    nome: '002_generos',
    sql: `
      CREATE TABLE generos (
        id   INTEGER PRIMARY KEY,
        nome TEXT UNIQUE NOT NULL
      );

      -- Tabela de JUNÇÃO para o N-N. Um livro tem vários gêneros e um gênero
      -- pertence a vários livros; não há onde guardar isso nas duas tabelas.
      CREATE TABLE livros_generos (
        livro_id  INTEGER NOT NULL REFERENCES livros(id)  ON DELETE CASCADE,
        genero_id INTEGER NOT NULL REFERENCES generos(id) ON DELETE RESTRICT,
        -- Chave primária COMPOSTA: o par é único, então o mesmo gênero não entra
        -- duas vezes no mesmo livro. Restrição no banco dispensa checar no código.
        PRIMARY KEY (livro_id, genero_id)
      );

      -- CASCADE no livro_id e RESTRICT no genero_id, de propósito:
      -- apagar um livro deve apagar suas ligações (elas não existem sem ele),
      -- mas apagar um gênero usado deve falhar (é dado de catálogo).

      INSERT INTO generos (nome) VALUES ('ficcao'), ('fantasia'), ('tecnico'), ('biografia');
    `,
  },
  {
    nome: '003_indices',
    sql: `
      -- Colunas que aparecem em WHERE e JOIN das queries que a API realmente
      -- roda. Confira o ganho com:
      --   EXPLAIN QUERY PLAN SELECT * FROM livros WHERE autor_id = 1
      -- SCAN → SEARCH USING INDEX
      CREATE INDEX idx_livros_autor      ON livros(autor_id);
      CREATE INDEX idx_livros_disponivel ON livros(disponivel);

      -- Índice não é grátis: ocupa espaço e deixa INSERT/UPDATE mais lentos,
      -- porque o índice também é atualizado. Indexe o que você consulta.
    `,
  },
  {
    nome: '004_emprestimos',
    sql: `
      -- Desafio extra: histórico de empréstimos.
      CREATE TABLE emprestimos (
        id           INTEGER PRIMARY KEY,
        livro_id     INTEGER NOT NULL REFERENCES livros(id) ON DELETE CASCADE,
        quem         TEXT    NOT NULL,
        pego_em      TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        devolvido_em TEXT
      );

      -- Índice parcial: só as linhas em aberto. Menor e mais rápido que indexar
      -- a tabela inteira, porque a query que importa é sempre
      -- "qual o empréstimo ABERTO deste livro?".
      CREATE INDEX idx_emprestimos_abertos
        ON emprestimos(livro_id) WHERE devolvido_em IS NULL;
    `,
  },
];
