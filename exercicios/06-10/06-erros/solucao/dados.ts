/**
 * O "banco" da biblioteca: arrays em memória.
 *
 * Os dois routers importam daqui, e nenhum importa o outro — é o que evita
 * importação circular (que em ESM dá `undefined` em runtime, não erro claro).
 *
 * A partir do módulo 09 este arquivo vira SQLite. O resto da API não deveria
 * precisar mudar por causa disso — é exatamente essa a promessa da camada de
 * repositório do módulo 08.
 */

export type Autor = { id: number; nome: string; nacionalidade: string };

export type Livro = {
  id: number;
  titulo: string;
  autorId: number; // era `autor: string`; agora é uma referência de verdade
  ano: number;
  disponivel: boolean;
};

export const autores: Autor[] = [
  { id: 1, nome: 'J.R.R. Tolkien', nacionalidade: 'britânica' },
  { id: 2, nome: 'Frank Herbert', nacionalidade: 'estadunidense' },
];

export const livros: Livro[] = [
  { id: 1, titulo: 'O Hobbit', autorId: 1, ano: 1937, disponivel: true },
  { id: 2, titulo: 'Duna', autorId: 2, ano: 1965, disponivel: true },
  { id: 3, titulo: 'O Senhor dos Anéis', autorId: 1, ano: 1954, disponivel: false },
];

// Contadores em módulo funcionam porque um módulo ESM é avaliado uma única vez —
// todo import recebe a MESMA instância. Some no reinício do processo, claro.
let ultimoIdLivro = 3;
let ultimoIdAutor = 2;

export const proximoIdLivro = () => ++ultimoIdLivro;
export const proximoIdAutor = () => ++ultimoIdAutor;
