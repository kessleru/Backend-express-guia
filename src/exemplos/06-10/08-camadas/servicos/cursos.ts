/**
 * SERVICE — onde vivem as REGRAS DE NEGÓCIO.
 *
 * Duas coisas que este arquivo NÃO conhece, e não é por acaso:
 *   - `req`, `res`, status code HTTP → é o controller que traduz
 *   - SQL, Prisma, array → é o repositório que guarda
 *
 * O resultado prático: este arquivo é testável sem subir servidor e sem banco
 * (módulo 12), e o mesmo service serve a uma rota HTTP, a um worker de fila
 * (módulo 17) e a um comando de linha.
 */
import type {
  AlterarCurso,
  Curso,
  FiltroCursos,
  NovoCurso,
  RepositorioCursos,
} from '../dominio/curso.ts';
import { conflito, naoEncontrado, requisicaoInvalida } from '../../06-erros/erro-app.ts';

/**
 * INJEÇÃO DE DEPENDÊNCIA SEM FRAMEWORK.
 *
 * O service recebe o repositório como argumento em vez de importá-lo. É só isso
 * — não precisa de NestJS, decorator ou container de DI.
 *
 * O ganho: no teste você passa um repositório falso; em produção, o de verdade.
 * Se ele fosse importado no topo do arquivo, testar exigiria mockar o módulo, o
 * que é frágil e lento.
 */
export function criarServicoCursos(repositorio: RepositorioCursos) {
  const HORAS_MINIMAS_PARA_PUBLICAR = 2;

  return {
    async listar(filtro: FiltroCursos): Promise<Curso[]> {
      return repositorio.listar(filtro);
    },

    /**
     * Note que o service lança `AppError` — não devolve `null` para o controller
     * decidir. Isso concentra a decisão "curso ausente é 404" num lugar só,
     * em vez de repeti-la em cada chamador.
     */
    async buscar(id: number): Promise<Curso> {
      const curso = await repositorio.buscarPorId(id);
      if (!curso) throw naoEncontrado('Curso', id);
      return curso;
    },

    async criar(dados: NovoCurso): Promise<Curso> {
      // REGRA DE NEGÓCIO: precisa consultar os dados, então o Zod não dá conta
      // (módulo 07). Formato é do schema; unicidade é daqui.
      const existente = await repositorio.buscarPorTitulo(dados.titulo);
      if (existente) throw conflito(`Já existe um curso chamado "${dados.titulo}"`);

      return repositorio.criar(dados);
    },

    async alterar(id: number, dados: AlterarCurso): Promise<Curso> {
      const curso = await this.buscar(id); // reusa a regra do 404

      if (dados.titulo && dados.titulo !== curso.titulo) {
        const outro = await repositorio.buscarPorTitulo(dados.titulo);
        if (outro && outro.id !== id) throw conflito('Outro curso já usa esse título');
      }

      const atualizado = await repositorio.atualizar(id, dados);
      // Só chegaria a `null` se alguém removesse o curso entre as duas chamadas —
      // uma condição de corrida real. Num banco de verdade a solução é transação
      // (módulo 09), não uma checagem otimista como esta.
      if (!atualizado) throw naoEncontrado('Curso', id);
      return atualizado;
    },

    /**
     * A regra que justifica a camada existir.
     *
     * Publicar não é "setar `publicado = true`". Tem pré-condições, e elas não
     * podem ficar no controller (aí o worker de fila as ignoraria) nem no
     * repositório (aí o `atualizar` genérico as ignoraria).
     */
    async publicar(id: number): Promise<Curso> {
      const curso = await this.buscar(id);

      if (curso.publicado) throw conflito('Curso já está publicado');
      if (curso.horas < HORAS_MINIMAS_PARA_PUBLICAR) {
        throw requisicaoInvalida(
          `Curso precisa de ao menos ${HORAS_MINIMAS_PARA_PUBLICAR}h para ser publicado`,
        );
      }

      const atualizado = await repositorio.atualizar(id, { publicado: true });
      if (!atualizado) throw naoEncontrado('Curso', id);
      return atualizado;
    },

    async remover(id: number): Promise<void> {
      const curso = await this.buscar(id);

      // Outra regra de negócio: não se apaga curso publicado, despublica antes.
      if (curso.publicado) {
        throw conflito('Curso publicado não pode ser removido. Despublique primeiro.');
      }

      await repositorio.remover(id);
    },
  };
}

/**
 * O tipo do service, derivado da função.
 *
 * `ReturnType<typeof f>` evita escrever a interface à mão e mantê-la em sincronia
 * — mesma ideia do `z.infer` do módulo 07: uma fonte de verdade.
 */
export type ServicoCursos = ReturnType<typeof criarServicoCursos>;
