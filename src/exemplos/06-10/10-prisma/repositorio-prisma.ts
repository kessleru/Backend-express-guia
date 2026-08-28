/**
 * `RepositorioCursos` sobre Prisma — a TERCEIRA implementação da mesma interface.
 *
 *   módulo 08: array em memória
 *   módulo 09: node:sqlite, SQL na mão
 *   módulo 10: Prisma  ← aqui
 *
 * O service de `08-camadas/servicos/cursos.ts` não muda em nenhuma das três.
 *
 * Compare o tamanho deste arquivo com
 * `src/exemplos/06-10/09-sqlite/repositorio-sqlite.ts`: sumiram a conversão
 * `snake_case` → `camelCase`, a conversão `0/1` → boolean, a montagem manual do
 * `WHERE` e a do `SET`. É isso que o ORM entrega.
 */
import type {
  AtualizacaoCurso,
  Curso,
  FiltroCursos,
  NovoCurso,
  RepositorioCursos,
} from '../08-camadas/dominio/curso.ts';
import { prisma } from './db.ts';

export function criarRepositorioPrisma(): RepositorioCursos {
  return {
    async listar(filtro: FiltroCursos) {
      // O `where` é um objeto TIPADO, não string de SQL. Escrever `titulu` aqui
      // é erro de compilação — no módulo 09 seria uma query que roda e devolve
      // zero linhas, e você caçaria o bug no runtime.
      return prisma.curso.findMany({
        where: {
          ...(filtro.titulo ? { titulo: { contains: filtro.titulo } } : {}),
          ...(filtro.publicado !== undefined ? { publicado: filtro.publicado } : {}),
        },
        orderBy: { id: 'asc' },
      });
      // Nenhum `.map(paraCurso)`: o modelo do Prisma já TEM a forma de `Curso`,
      // porque o schema foi escrito assim. `@map` no schema é o que permite o
      // banco usar snake_case sem o código saber.
    },

    async buscarPorId(id: number) {
      // `findUnique` só aceita campo único (`id`, `titulo`, que é `@unique`).
      // Para qualquer outro, `findFirst`. Devolve `null` — a interface encaixa.
      return prisma.curso.findUnique({ where: { id } });
    },

    async buscarPorTitulo(titulo: string) {
      // O SQLite não tem `mode: 'insensitive'` (é recurso do Postgres). Como
      // `LIKE` do SQLite já ignora maiúscula para ASCII, `equals` seria
      // sensível — então usamos a comparação exata e o service normaliza.
      // Exemplo concreto de "o ORM não apaga as diferenças entre bancos".
      return prisma.curso.findFirst({ where: { titulo: titulo.trim() } });
    },

    async criar(dados: NovoCurso) {
      return prisma.curso.create({
        data: { titulo: dados.titulo, horas: dados.horas },
        // `publicado` não vai aqui: o `@default(false)` do schema resolve.
      });
    },

    async atualizar(id: number, dados: AtualizacaoCurso) {
      // O Prisma trata `undefined` como "não mexe neste campo" e `null` como
      // "grave NULL" — o que resolveria o UPDATE parcial sozinho.
      //
      // ATRITO REAL com o nosso tsconfig: `data: { titulo: dados.titulo }` NÃO
      // compila. Os tipos gerados declaram `titulo?: string` (sem `| undefined`),
      // e o `exactOptionalPropertyTypes: true` recusa chave presente valendo
      // `undefined` — que é exatamente o idioma do Prisma.
      //
      // A saída é o spread condicional. Mais verboso que a promessa do ORM,
      // ainda muito melhor que montar `SET` em string como no módulo 09.
      try {
        return await prisma.curso.update({
          where: { id },
          data: {
            ...(dados.titulo !== undefined ? { titulo: dados.titulo } : {}),
            ...(dados.horas !== undefined ? { horas: dados.horas } : {}),
            ...(dados.publicado !== undefined ? { publicado: dados.publicado } : {}),
          },
        });
      } catch {
        // `update` com id inexistente LANÇA (código P2025). A interface pede
        // `null`. Traduzir erro de banco para o vocabulário do domínio é
        // justamente o trabalho desta camada.
        return null;
      }
    },

    async remover(id: number) {
      try {
        await prisma.curso.delete({ where: { id } });
        return true;
      } catch {
        return false; // não existia — não é erro, é informação
      }
    },
  };
}

/** Seed do exemplo. Idempotente: `upsert` em vez de `create`. */
export async function seedCursos(): Promise<void> {
  const cursos: Curso[] = [
    { id: 1, titulo: 'Fundamentos de HTTP', horas: 4, publicado: true },
    { id: 2, titulo: 'Express do zero', horas: 8, publicado: false },
    { id: 3, titulo: 'Curso relâmpago', horas: 1, publicado: false },
  ];

  for (const curso of cursos) {
    await prisma.curso.upsert({ where: { id: curso.id }, update: {}, create: curso });
  }
}
