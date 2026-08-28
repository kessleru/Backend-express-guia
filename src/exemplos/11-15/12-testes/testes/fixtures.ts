/**
 * FIXTURES — os dados de partida dos testes.
 *
 * O princípio: **um teste ruim é um teste que você não entende ao ler.** Se cada
 * `it` monta 15 linhas de objeto, o que importa (a asserção) fica soterrado.
 *
 * A regra que evita o problema oposto — a fixture gigante que serve a todos e
 * não serve a ninguém — é: a fixture dá o CENÁRIO, o teste explicita o que ele
 * depende. Se um teste afirma "livro emprestado não é removível", ele deve
 * deixar visível QUAL livro está emprestado, não confiar que a fixture manteve
 * `disponivel: false` no item 2.
 */
import type { Livro } from '../dominio.ts';

/**
 * FUNÇÃO, não constante.
 *
 * `export const LIVROS = [...]` seria o mesmo array em todos os testes do
 * arquivo: um `.push()` ou uma mutação num teste vazaria para o próximo. Chamar
 * a função devolve objetos novos toda vez.
 *
 * É a mesma razão de o repositório em memória copiar os itens no construtor.
 */
export function livrosDeTeste(): Livro[] {
  return [
    { id: 1, titulo: 'O Hobbit', autorId: 1, ano: 1937, disponivel: true },
    { id: 2, titulo: 'Duna', autorId: 2, ano: 1965, disponivel: true },
    { id: 3, titulo: 'Neuromancer', autorId: 3, ano: 1984, disponivel: false },
  ];
}

/**
 * Um "object mother": monta um livro válido e deixa você sobrescrever só o campo
 * que o teste está exercitando.
 *
 *   const antigo = umLivro({ ano: 1400 });   // o resto não importa
 *
 * O ganho aparece no dia em que `Livro` ganha um campo obrigatório: sem isso,
 * 40 testes param de compilar; com isso, você conserta uma função.
 */
export function umLivro(sobrescrever: Partial<Livro> = {}): Livro {
  return {
    id: 1,
    titulo: 'Livro de Teste',
    autorId: 1,
    ano: 2000,
    disponivel: true,
    ...sobrescrever,
  };
}
