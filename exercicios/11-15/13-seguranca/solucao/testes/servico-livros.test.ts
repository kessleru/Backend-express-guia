/**
 * UNITÁRIO — o service de livros, sem HTTP e sem banco.
 *
 * Nenhum `criarApp`, nenhum `request`. O service recebe repositórios e devolve
 * dados ou lança `AppError`. Estes testes rodam em microssegundos e apontam a
 * linha exata.
 */
import { describe, expect, it } from 'vitest';
import { AppError } from '../erros/AppError.ts';
import { criarRepositorioAutores } from '../repositorios/autores-memoria.ts';
import { criarRepositorioLivros } from '../repositorios/livros-memoria.ts';
import { criarServicoAutores } from '../servicos/autores.ts';
import { criarServicoLivros } from '../servicos/livros.ts';
import { autoresDeTeste, livrosDeTeste, umLivro } from './fixtures.ts';

function montar(livros = livrosDeTeste(), autores = autoresDeTeste()) {
  const repoLivros = criarRepositorioLivros(livros);
  const repoAutores = criarRepositorioAutores(autores);
  return {
    repoLivros,
    servico: criarServicoLivros(repoLivros, repoAutores),
    servicoAutores: criarServicoAutores(repoAutores, repoLivros),
  };
}

/**
 * Helper que captura o erro para inspecionar o STATUS.
 *
 * `rejects.toThrow(AppError)` passaria igual se o service lançasse 500 — e a
 * diferença entre 409 e 500 é a diferença entre "o cliente errou" e "eu errei".
 * Este helper aparece em quase todo teste de regra do repositório.
 */
async function statusDoErro(promessa: Promise<unknown>): Promise<number> {
  const erro = (await promessa.catch((e: unknown) => e)) as AppError;
  expect(erro).toBeInstanceOf(AppError);
  return erro.status;
}

describe('criar', () => {
  it('grava e devolve o livro com id', async () => {
    const { servico } = montar();

    const livro = await servico.criar({
      titulo: 'Solaris',
      autorId: 1,
      ano: 1961,
      generos: ['ficcao'],
    });

    expect(livro).toMatchObject({ id: 3, titulo: 'Solaris', disponivel: true });
  });

  it('400 (não 404) para autorId inexistente', async () => {
    const { servico } = montar();

    // 400 e não 404 de propósito: o RECURSO pedido (o livro) não existe ainda —
    // quem está errado é o corpo que o cliente mandou. 404 diria "esta URL não
    // existe", que é falso.
    expect(
      await statusDoErro(
        servico.criar({ titulo: 'X', autorId: 999, ano: 2000, generos: ['ficcao'] }),
      ),
    ).toBe(400);
  });

  it('409 para ISBN duplicado', async () => {
    const { servico } = montar();

    expect(
      await statusDoErro(
        servico.criar({
          titulo: 'Cópia',
          autorId: 1,
          ano: 2000,
          isbn: '9788595084742', // o mesmo de "O Hobbit"
          generos: ['ficcao'],
        }),
      ),
    ).toBe(409);
  });
});

describe('buscar', () => {
  it('devolve o livro existente', async () => {
    const { servico } = montar();
    await expect(servico.buscar(1)).resolves.toMatchObject({ titulo: 'O Hobbit' });
  });

  it('404 para id inexistente', async () => {
    const { servico } = montar();
    expect(await statusDoErro(servico.buscar(999))).toBe(404);
  });
});

describe('remover', () => {
  it('remove livro disponível', async () => {
    const { repoLivros, servico } = montar();

    await servico.remover(1);

    // Asserção sobre o EFEITO (o livro sumiu), não sobre `repo.remover` ter sido
    // chamado. Trocar por soft delete não deveria quebrar este teste.
    await expect(repoLivros.buscarPorId(1)).resolves.toBeNull();
  });

  it('409 para livro emprestado', async () => {
    // O cenário fica explícito no teste, não escondido na fixture.
    const { servico } = montar([umLivro({ id: 1, disponivel: false })]);
    expect(await statusDoErro(servico.remover(1))).toBe(409);
  });
});

describe('autores', () => {
  it('409 ao remover autor que tem livros', async () => {
    const { servicoAutores } = montar();

    // Integridade referencial escrita à mão (módulo 08). No módulo 09 ela virou
    // uma FOREIGN KEY com ON DELETE RESTRICT — e o teste continua o mesmo, que é
    // a prova de que a regra está no lugar certo.
    expect(await statusDoErro(servicoAutores.remover(1))).toBe(409);
  });

  it('remove autor sem livros', async () => {
    const { servicoAutores } = montar([]); // acervo vazio
    await expect(servicoAutores.remover(1)).resolves.toBeUndefined();
  });
});
