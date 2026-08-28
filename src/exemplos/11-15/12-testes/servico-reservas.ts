/**
 * Service de reservas — a feature construída por TDD.
 *
 * Cada trecho aqui existe porque um teste em `testes/tdd-reserva.test.ts` o
 * exigiu. Nada foi escrito "porque vai precisar depois": a fila só virou array
 * quando o teste da posição 2 apareceu, e `liberar` só nasceu no passo 4.
 *
 * O resultado colateral é visível: não há um único método sem teste, e não há
 * um único campo que nenhum teste leia. Código escrito depois dos testes tende a
 * ter menos sobra — você para de implementar quando o red vira green.
 */
import type { RepositorioLivros } from './dominio.ts';
import { conflito, naoEncontrado } from '../../06-10/06-erros/erro-app.ts';

export type Reserva = {
  livroId: number;
  usuarioId: number;
  /** 1 = próximo da fila. Sai da posição no array, não é guardado. */
  posicao: number;
};

export function criarServicoReservas(repo: RepositorioLivros) {
  // A fila vive no closure, como nos repositórios em memória. Num projeto real
  // isto seria uma tabela `reservas` com `criada_em` — e a "posição" viria de um
  // `ORDER BY`, nunca de um campo gravado (que ficaria errado na primeira
  // remoção do meio da fila).
  const filas = new Map<number, number[]>();

  const filaDe = (livroId: number) => filas.get(livroId) ?? [];

  return {
    async reservar(livroId: number, usuarioId: number): Promise<Reserva> {
      const livro = await repo.buscarPorId(livroId);
      if (!livro) throw naoEncontrado('Livro', livroId);

      // 409: o pedido está correto, o estado é que não pede reserva.
      if (livro.disponivel) {
        throw conflito('Livro está disponível — pegue emprestado em vez de reservar');
      }

      const fila = filaDe(livroId);
      if (fila.includes(usuarioId)) {
        throw conflito('Você já está na fila deste livro');
      }

      fila.push(usuarioId);
      filas.set(livroId, fila);

      return { livroId, usuarioId, posicao: fila.length };
    },

    async fila(livroId: number): Promise<number[]> {
      return [...filaDe(livroId)];
    },

    /** Devolve quem foi promovido, ou `null` se não havia fila. */
    async liberar(livroId: number): Promise<number | null> {
      const fila = filaDe(livroId);
      const proximo = fila.shift();
      filas.set(livroId, fila);
      return proximo ?? null;
    },
  };
}
