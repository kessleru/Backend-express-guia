/**
 * Desafio extra: repositório DECORATOR.
 *
 * Recebe outro repositório, delega tudo e imprime cada chamada. Funciona porque
 * tudo depende da INTERFACE, não da implementação — o service não tem como
 * perceber a diferença.
 *
 * Comparado a pôr o log dentro de `livros-memoria.ts`:
 *   - o log passa a valer para QUALQUER implementação (SQLite, Prisma) de graça
 *   - liga e desliga trocando uma linha no `servidor.ts`, sem editar código
 *   - o repositório de memória continua fazendo uma coisa só
 *
 * É o mesmo princípio dos middlewares do módulo 05: envolver em vez de alterar.
 */
import type { RepositorioLivros } from '../dominio/livro.ts';

export function comLog(interno: RepositorioLivros, prefixo = 'repo'): RepositorioLivros {
  /** Envolve um método, medindo o tempo e imprimindo o resultado. */
  function registrar<Args extends unknown[], R>(
    nome: string,
    fn: (...args: Args) => Promise<R>,
  ): (...args: Args) => Promise<R> {
    return async (...args: Args) => {
      const inicio = performance.now();
      const resultado = await fn(...args);
      const ms = (performance.now() - inicio).toFixed(2);
      console.log(
        `  [${prefixo}] ${nome}(${JSON.stringify(args).slice(1, -1)}) — ${ms}ms`,
      );
      return resultado;
    };
  }

  // Cada método é envolvido individualmente. Um `Proxy` faria isso genericamente
  // em 5 linhas, mas perderia a tipagem — e aqui o tipo é o que garante que o
  // decorator satisfaz a interface inteira.
  return {
    listar: registrar('listar', interno.listar.bind(interno)),
    listarDisponiveis: registrar(
      'listarDisponiveis',
      interno.listarDisponiveis.bind(interno),
    ),
    buscarPorId: registrar('buscarPorId', interno.buscarPorId.bind(interno)),
    buscarPorIsbn: registrar('buscarPorIsbn', interno.buscarPorIsbn.bind(interno)),
    contarPorAutor: registrar('contarPorAutor', interno.contarPorAutor.bind(interno)),
    criar: registrar('criar', interno.criar.bind(interno)),
    atualizar: registrar('atualizar', interno.atualizar.bind(interno)),
    remover: registrar('remover', interno.remover.bind(interno)),
  };
}
