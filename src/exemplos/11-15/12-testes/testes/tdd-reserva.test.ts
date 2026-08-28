/**
 * TDD numa feature real — o ciclo, com o histórico preservado.
 *
 * O currículo pede TDD "numa feature real", e este arquivo é o registro de como
 * a regra de RESERVA nasceu. Os comentários mostram o que estava escrito em cada
 * etapa, para o ciclo ficar visível — normalmente você não guardaria isso.
 *
 * ---------------------------------------------------------------------
 * O CICLO: RED → GREEN → REFACTOR
 * ---------------------------------------------------------------------
 *   RED      escreva o teste e VEJA-O FALHAR. Um teste que nunca falhou não
 *            prova nada: pode estar testando o vazio, com um `expect` que
 *            sempre passa ou um `await` esquecido.
 *   GREEN    o código MAIS SIMPLES que faz passar. Sem generalizar, sem prever.
 *   REFACTOR arrume com a rede de segurança já armada.
 *
 * ---------------------------------------------------------------------
 * O QUE TDD REALMENTE ENTREGA
 * ---------------------------------------------------------------------
 * O ganho mais citado (menos bugs) é o menos importante. Os dois reais:
 *
 *   1. **Ele força você a projetar a API antes da implementação.** O teste é o
 *      primeiro cliente do seu código. Se for chato de chamar no teste, é chato
 *      de chamar em produção — e você descobre em 2 minutos, não em 2 semanas.
 *   2. **Ele define "pronto".** Sem o teste escrito antes, "pronto" é uma
 *      sensação. Com ele, é uma condição verificável.
 *
 * E o custo honesto: TDD é ruim quando você ainda não sabe o que quer construir.
 * Explorar uma API desconhecida, prototipar, descobrir formato de dado externo —
 * nesses casos, escreva o código, entenda o problema, e ENTÃO escreva os testes.
 * TDD dogmático em código exploratório só produz testes que você joga fora.
 */
import { describe, expect, it } from 'vitest';
import { criarRepositorioMemoria } from '../repositorios/memoria.ts';
import { criarServicoReservas } from '../servico-reservas.ts';
import { AppError } from '../../../06-10/06-erros/erro-app.ts';
import { umLivro } from './fixtures.ts';

function montar(livros = [umLivro({ id: 1 })]) {
  const repo = criarRepositorioMemoria(livros);
  return { repo, servico: criarServicoReservas(repo) };
}

describe('reservar', () => {
  /**
   * PASSO 1 — RED.
   *
   * Este foi o primeiro teste escrito, com `servico-reservas.ts` ainda
   * inexistente. A primeira falha foi de IMPORT ("Cannot find module"), o que já
   * é informação: o red começa antes de existir código.
   *
   * Repare que escrever este teste obrigou a decidir três coisas de design antes
   * de qualquer implementação: o nome do método, que ele recebe `(livroId,
   * usuarioId)` nessa ordem, e que ele devolve a reserva criada em vez de `void`.
   * Isso é o item 1 lá de cima acontecendo.
   */
  it('cria uma reserva para livro emprestado', async () => {
    const { servico } = montar([umLivro({ id: 1, disponivel: false })]);

    const reserva = await servico.reservar(1, 42);

    expect(reserva).toMatchObject({ livroId: 1, usuarioId: 42, posicao: 1 });
  });

  /**
   * PASSO 2 — RED de novo, antes de generalizar.
   *
   * O GREEN do passo 1 foi literalmente `return { livroId, usuarioId, posicao: 1 }`
   * — sem fila, sem nada. Parece trapaça, e é justamente o método: só se escreve
   * a fila quando existe um teste que EXIGE a fila. Este é ele.
   */
  it('a segunda pessoa fica na posição 2', async () => {
    const { servico } = montar([umLivro({ id: 1, disponivel: false })]);

    await servico.reservar(1, 42);
    const segunda = await servico.reservar(1, 43);

    expect(segunda.posicao).toBe(2);
  });

  /**
   * PASSO 3 — as regras de recusa.
   *
   * Cada uma entrou como um red separado. Escrever os três de uma vez e depois
   * implementar funciona, mas você perde a checagem de que cada teste realmente
   * falha pelo motivo que você acha.
   */
  it('recusa reservar livro disponível — é só pegar emprestado', async () => {
    const { servico } = montar([umLivro({ id: 1, disponivel: true })]);

    const erro = (await servico.reservar(1, 42).catch((e: unknown) => e)) as AppError;
    expect(erro.status).toBe(409);
  });

  it('recusa reserva duplicada do mesmo usuário', async () => {
    const { servico } = montar([umLivro({ id: 1, disponivel: false })]);
    await servico.reservar(1, 42);

    const erro = (await servico.reservar(1, 42).catch((e: unknown) => e)) as AppError;
    expect(erro.status).toBe(409);
  });

  it('404 para livro inexistente', async () => {
    const { servico } = montar();

    const erro = (await servico.reservar(999, 42).catch((e: unknown) => e)) as AppError;
    expect(erro.status).toBe(404);
  });
});

describe('fila', () => {
  it('devolve a fila na ordem de chegada', async () => {
    const { servico } = montar([umLivro({ id: 1, disponivel: false })]);

    await servico.reservar(1, 42);
    await servico.reservar(1, 43);

    expect(await servico.fila(1)).toEqual([42, 43]);
  });

  /**
   * PASSO 4 — o teste que só apareceu DEPOIS, ao pensar no caso real.
   *
   * TDD não adivinha requisito. Este caso ("e quando o livro volta?") surgiu ao
   * revisar a feature, não do ciclo. É honesto dizer: TDD organiza a construção,
   * não descobre o que construir.
   */
  it('devolver o livro promove o primeiro da fila', async () => {
    const { servico } = montar([umLivro({ id: 1, disponivel: false })]);
    await servico.reservar(1, 42);
    await servico.reservar(1, 43);

    const promovido = await servico.liberar(1);

    expect(promovido).toBe(42);
    expect(await servico.fila(1)).toEqual([43]);
  });

  it('liberar sem fila devolve null', async () => {
    const { servico } = montar([umLivro({ id: 1, disponivel: false })]);
    await expect(servico.liberar(1)).resolves.toBeNull();
  });
});
