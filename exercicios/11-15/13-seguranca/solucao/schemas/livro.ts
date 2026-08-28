/**
 * Schemas de livro. O tipo `Livro` nasce daqui — não existe mais um `type Livro`
 * escrito à mão para divergir.
 */
import { z } from 'zod';
import { booleanoDeQuery, paginacaoSchema } from './comuns.ts';

const ANO_MIN = 1450;
const ANO_MAX = new Date().getFullYear();

export const GENEROS = ['ficcao', 'fantasia', 'tecnico', 'biografia'] as const;

// ---------------------------------------------------------------------
// Os campos crus, SEM default
// ---------------------------------------------------------------------
// Guardar os campos separados é o que permite montar criação e atualização sem
// duplicar regra e sem o `.default()` vazar para o PATCH.

const campos = {
  titulo: z
    .string({ error: '`titulo` deve ser um texto' })
    .trim()
    .min(1, '`titulo` não pode ser vazio')
    .max(200, '`titulo` passa de 200 caracteres'),

  autorId: z
    .number({ error: '`autorId` deve ser um número' })
    .int('`autorId` deve ser inteiro')
    .positive('`autorId` deve ser positivo'),

  ano: z
    .number({ error: '`ano` deve ser um número' })
    .int()
    .min(ANO_MIN, `\`ano\` não pode ser antes de ${ANO_MIN}`)
    .max(ANO_MAX, `\`ano\` não pode ser depois de ${ANO_MAX}`),

  // Regex valida FORMATO. O dígito verificador do ISBN-13 é uma conta que o
  // regex não faz — seria `.refine()` com a fórmula, se o negócio exigir.
  isbn: z.string().regex(/^\d{13}$/, '`isbn` deve ter exatamente 13 dígitos'),

  generos: z
    .array(z.enum(GENEROS), { error: '`generos` deve ser uma lista' })
    .min(1, '`generos` precisa de ao menos 1 item')
    .max(3, '`generos` aceita no máximo 3 itens'),
};

// ---------------------------------------------------------------------
// Criação: campos + defaults + strict
// ---------------------------------------------------------------------

export const criarLivroSchema = z
  .object({
    titulo: campos.titulo,
    autorId: campos.autorId,
    ano: campos.ano,
    isbn: campos.isbn.optional(), // livro antigo pode não ter ISBN
    generos: campos.generos.default(['ficcao']),
  })
  // Sem `.strict()`, `{"titluo": "x"}` é descartado calado e o cliente recebe
  // "`titulo` é obrigatório" sem entender o motivo. Com ele, recebe o typo de
  // volta. Também fecha a porta para campo que você nunca quis aceitar.
  .strict();

// ---------------------------------------------------------------------
// Atualização: os MESMOS campos, sem default
// ---------------------------------------------------------------------
// `criarLivroSchema.partial()` estaria errado: `.partial()` torna o campo
// opcional mas o `.default(['ficcao'])` continua valendo. Um
// `PATCH {"ano":1955}` sairia com `generos: ['ficcao']` e apagaria os gêneros
// salvos — um PATCH que apaga campo em silêncio.

export const atualizarLivroSchema = z.object(campos).partial().strict();

// ---------------------------------------------------------------------
// Query de listagem
// ---------------------------------------------------------------------

export const listarLivrosSchema = paginacaoSchema.extend({
  /**
   * O texto da busca.
   *
   * `.max(100)` não é frescura de tamanho: campo de texto sem teto é entrada
   * para consumo de CPU e memória — 2 MB de string chegam num GET sem esforço
   * nenhum. Validar o tamanho é a defesa mais barata do módulo 13.
   *
   * O que ele NÃO faz é sanitizar o conteúdo. Aspas, `--` e `DROP TABLE` passam
   * inteiros de propósito: tentar limpar caractere perigoso é a defesa errada
   * (sempre falta um). Quem torna o valor inofensivo é a consulta parametrizada
   * lá no repositório — módulo 09.
   */
  q: z.string().trim().min(1).max(100).optional(),
  autorId: z.coerce.number().int().positive().optional(),
  disponivel: booleanoDeQuery,
  ordenar: z.enum(['ano', 'titulo']).optional(),
});

// ---------------------------------------------------------------------
// Os tipos, derivados
// ---------------------------------------------------------------------

/** O que sai da validação de criação (defaults já aplicados). */
export type CriarLivro = z.infer<typeof criarLivroSchema>;

/** O que o cliente pode mandar (antes dos defaults). */
export type CriarLivroEntrada = z.input<typeof criarLivroSchema>;

export type AtualizarLivro = z.infer<typeof atualizarLivroSchema>;
export type ListarLivros = z.infer<typeof listarLivrosSchema>;

/**
 * O registro como ele vive no "banco": o que o cliente manda + o que o servidor
 * controla. `id` e `disponivel` ficam de fora do schema justamente porque o
 * cliente não pode escrevê-los.
 */
export type Livro = CriarLivro & { id: number; disponivel: boolean };
