/**
 * TESTE UNITÁRIO — a base da pirâmide.
 *
 * Testa o SERVICE isolado: sem HTTP, sem banco, sem servidor. São os testes que
 * você quer ter às centenas, porque rodam em milissegundos e apontam exatamente
 * a linha errada.
 *
 * O que se testa aqui: **regra de negócio**. "Livro emprestado não é removível",
 * "ano antes de 1450 é inválido", "id inexistente dá 404".
 *
 * O que NÃO se testa aqui: se a rota está registrada, se o JSON sai no formato
 * certo, se o SQL funciona. Isso é dos outros dois níveis.
 */
import { describe, expect, it, vi } from 'vitest';
import { criarRepositorioMemoria } from '../repositorios/memoria.ts';
import { criarServicoLivros } from '../servico.ts';
import type { RepositorioLivros } from '../dominio.ts';
import { AppError } from '../../../06-10/06-erros/erro-app.ts';
import { livrosDeTeste, umLivro } from './fixtures.ts';

/**
 * Uma FÁBRICA por teste, nunca um `beforeEach` com estado de módulo.
 *
 * Cada `it` chama `montar()` e ganha um repositório novo. Não há ordem entre
 * testes, e por isso eles podem rodar em paralelo — que é como o Vitest roda por
 * padrão, um worker por arquivo.
 */
function montar(iniciais = livrosDeTeste()) {
  const repo = criarRepositorioMemoria(iniciais);
  return { repo, servico: criarServicoLivros(repo) };
}

describe('criar', () => {
  it('grava e devolve o livro com id', async () => {
    const { servico } = montar();

    const livro = await servico.criar({ titulo: 'Solaris', autorId: 4, ano: 1961 });

    // `toEqual` compara estrutura; `toBe` compara identidade (===). Para objeto,
    // `toBe` só passa se for a MESMA referência — quase nunca o que se quer.
    expect(livro).toEqual({
      id: 4,
      titulo: 'Solaris',
      autorId: 4,
      ano: 1961,
      disponivel: true,
    });
  });

  it('recusa ano anterior à imprensa', async () => {
    const { servico } = montar();

    // A forma de testar rejeição de promise. Sem o `await` na frente do
    // `expect`, o teste PASSA MESMO QUANDO FALHA: a asserção vira uma promise
    // solta que ninguém espera, e o `it` termina antes de ela resolver.
    //
    // É o erro mais comum em teste assíncrono, e ele é silencioso — o pior tipo.
    await expect(
      servico.criar({ titulo: 'Impossível', autorId: 1, ano: 1200 }),
    ).rejects.toThrow(AppError);
  });

  it('o erro de ano carrega status 400', async () => {
    const { servico } = montar();

    // Verificar o STATUS, não só o tipo. `rejects.toThrow(AppError)` passaria
    // igual se o service lançasse um 500 — e a diferença entre 400 e 500 é a
    // diferença entre "o cliente errou" e "eu errei".
    const erro = await servico
      .criar({ titulo: 'Impossível', autorId: 1, ano: 1200 })
      .catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(AppError);
    expect((erro as AppError).status).toBe(400);
  });
});

describe('buscar', () => {
  it('devolve o livro existente', async () => {
    const { servico } = montar();
    await expect(servico.buscar(1)).resolves.toMatchObject({ titulo: 'O Hobbit' });
  });

  it('lança 404 para id inexistente', async () => {
    const { servico } = montar();
    const erro = (await servico.buscar(999).catch((e: unknown) => e)) as AppError;
    expect(erro.status).toBe(404);
  });
});

describe('remover', () => {
  it('remove livro disponível', async () => {
    const { repo, servico } = montar();

    await servico.remover(1);

    // A asserção é sobre o EFEITO observável (o livro sumiu), não sobre o fato
    // de `repo.remover` ter sido chamado. Testar a chamada acopla o teste à
    // implementação: trocar `remover` por um soft delete quebraria o teste sem
    // que nada tivesse deixado de funcionar.
    //
    // Princípio: **teste o resultado, não o caminho.**
    await expect(repo.buscarPorId(1)).resolves.toBeNull();
  });

  it('recusa remover livro emprestado, com 409', async () => {
    // O cenário fica EXPLÍCITO no teste, não escondido na fixture. Quem lê não
    // precisa abrir outro arquivo para entender por que 409.
    const { servico } = montar([umLivro({ id: 1, disponivel: false })]);

    const erro = (await servico.remover(1).catch((e: unknown) => e)) as AppError;
    expect(erro.status).toBe(409);
  });
});

describe('emprestar', () => {
  it('marca como indisponível', async () => {
    const { servico } = montar();
    await expect(servico.emprestar(1)).resolves.toMatchObject({ disponivel: false });
  });

  it('recusa emprestar duas vezes', async () => {
    const { servico } = montar();
    await servico.emprestar(1);

    const erro = (await servico.emprestar(1).catch((e: unknown) => e)) as AppError;
    expect(erro.status).toBe(409);
  });
});

// ---------------------------------------------------------------------
// DUBLÊS: quando o repositório em memória não basta
// ---------------------------------------------------------------------
describe('dublês de teste', () => {
  /**
   * STUB — devolve resposta pronta. Serve para montar um cenário que o
   * repositório real dificilmente produziria.
   *
   * Aqui: `atualizar` devolvendo `null` significa "o livro sumiu entre o
   * `buscarPorId` e o `atualizar`" — uma corrida entre duas requisições. Com o
   * repositório em memória isso não acontece nunca; com um banco sob carga,
   * acontece. É exatamente o caminho que fica sem cobertura se você só testa o
   * caminho feliz.
   */
  it('trata o livro que some no meio da atualização', async () => {
    const repoInstavel: RepositorioLivros = {
      ...criarRepositorioMemoria(livrosDeTeste()),
      async atualizar() {
        return null;
      },
    };

    const servico = criarServicoLivros(repoInstavel);
    const erro = (await servico.emprestar(1).catch((e: unknown) => e)) as AppError;
    expect(erro.status).toBe(404);
  });

  /**
   * SPY — grava as chamadas, mas deixa o comportamento real acontecer.
   *
   * Aqui a asserção sobre a chamada se justifica: o ponto do teste é que a regra
   * do 409 acontece ANTES de tocar no repositório. "Não escreveu" não é
   * observável pelo resultado — a única forma de afirmar isso é olhar a chamada.
   *
   * Fora desse caso, prefira asserção sobre o efeito.
   */
  it('não chama o repositório quando a regra já barrou', async () => {
    const repo = criarRepositorioMemoria([umLivro({ id: 1, disponivel: false })]);
    const espiaoRemover = vi.spyOn(repo, 'remover');

    const servico = criarServicoLivros(repo);
    await servico.remover(1).catch(() => undefined);

    expect(espiaoRemover).not.toHaveBeenCalled();
  });

  /**
   * FAKE — implementação de verdade, simplificada. É o que
   * `criarRepositorioMemoria` é: ele funciona, guarda estado, responde
   * corretamente. Só não persiste.
   *
   * A hierarquia de preferência, do melhor para o pior:
   *   1. objeto real (quando é barato)
   *   2. FAKE   — funciona de verdade, sem I/O
   *   3. STUB   — resposta fixa, para cenário difícil
   *   4. SPY    — quando a chamada É o que importa
   *   5. MOCK de módulo (`vi.mock`) — último recurso
   *
   * `vi.mock` é o último porque ele intercepta o sistema de módulos: o teste
   * passa a depender de COMO o código importa suas dependências, e uma
   * refatoração inofensiva (mudar de import nomeado para default) quebra tudo.
   * Se você precisa dele com frequência, o problema é acoplamento, não teste.
   */
  it('o fake é uma implementação real do contrato', async () => {
    const repo = criarRepositorioMemoria();
    await repo.criar({ titulo: 'Anotações', autorId: 1, ano: 2020 });
    await expect(repo.listar()).resolves.toHaveLength(1);
  });
});
