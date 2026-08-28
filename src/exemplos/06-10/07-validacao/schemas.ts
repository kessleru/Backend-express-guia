/**
 * Schemas Zod — validação e tipo saindo da MESMA fonte.
 *
 * É o ganho principal do Zod sobre validação manual: a regra é escrita uma vez e
 * o tipo TypeScript é derivado dela. Sem isso, `type Curso` e `validarCurso()`
 * são duas verdades que divergem no primeiro campo novo.
 *
 * Zod 4.
 */
import { z } from 'zod';

const ANO_MIN = 1450;
const ANO_MAX = new Date().getFullYear();

// ---------------------------------------------------------------------
// Os campos, SEM default
// ---------------------------------------------------------------------
// Separar os campos crus do schema de criação parece burocracia, mas resolve uma
// armadilha real — explicada no `atualizarCursoSchema` lá embaixo.

const campos = {
  // Cada `.metodo()` é uma regra encadeada, com mensagem própria.
  titulo: z
    .string({ error: '`titulo` deve ser um texto' })
    .trim() // TRANSFORMA: remove espaços antes de validar o tamanho
    .min(3, '`titulo` precisa de ao menos 3 caracteres')
    .max(120, '`titulo` passa de 120 caracteres'),

  horas: z
    .number({ error: '`horas` deve ser um número' })
    .int('`horas` deve ser inteiro')
    .positive('`horas` deve ser positivo')
    .max(500, '`horas` acima de 500 é improvável'),

  ano: z
    .number()
    .int()
    .min(ANO_MIN, `\`ano\` não pode ser antes de ${ANO_MIN}`)
    .max(ANO_MAX, `\`ano\` não pode ser depois de ${ANO_MAX}`),

  publicado: z.boolean(),

  // Enum de string sem o `enum` do TypeScript, que este repo proíbe
  // (`erasableSyntaxOnly`: o Node só apaga tipos, não transforma código).
  nivel: z.enum(['iniciante', 'intermediario', 'avancado']),

  // No Zod 4 é `z.email()`, não `z.string().email()` — este último está
  // deprecado. E ele valida FORMATO, não existência: ninguém confirma e-mail sem
  // mandar uma mensagem. Lembre disso antes de prometer isso ao produto.
  contato: z.email('`contato` precisa ser um e-mail válido'),

  tags: z.array(z.string().min(2)).max(5),
};

// ---------------------------------------------------------------------
// Schema de criação: campos + defaults
// ---------------------------------------------------------------------

export const criarCursoSchema = z
  .object({
    titulo: campos.titulo,
    horas: campos.horas,
    ano: campos.ano,

    // `.default()` faz o campo ser opcional na ENTRADA e garantido na SAÍDA.
    // É por isso que um schema tem dois tipos (ver abaixo).
    publicado: campos.publicado.default(false),
    nivel: campos.nivel.default('iniciante'),
    tags: campos.tags.default([]),

    contato: campos.contato.optional(),
  })
  // `.strict()` REJEITA campo desconhecido. Sem isso o Zod descarta em silêncio,
  // e o cliente que digitou `hora` em vez de `horas` recebe "campo obrigatório"
  // sem entender por quê. Dizer o que sobrou é mais gentil e mais seguro.
  .strict();

// ---------------------------------------------------------------------
// Os DOIS tipos que um schema gera
// ---------------------------------------------------------------------

/** O que o cliente pode mandar: `publicado`, `nivel` e `tags` opcionais. */
export type CriarCursoEntrada = z.input<typeof criarCursoSchema>;

/** O que sai da validação: defaults aplicados, nada mais opcional. */
export type CriarCurso = z.output<typeof criarCursoSchema>;
// `z.infer` é apelido de `z.output` — é o que você quer 90% das vezes.

// ---------------------------------------------------------------------
// Schema de atualização — a armadilha do .partial()
// ---------------------------------------------------------------------
// ARMADILHA: `criarCursoSchema.partial()` NÃO resolve. `.partial()` torna o campo
// opcional, mas o `.default()` continua valendo — então um
// `PATCH { "horas": 6 }` sairia da validação com `publicado: false` e
// `nivel: 'iniciante'`, sobrescrevendo o que já estava salvo. Um PATCH que apaga
// campo silenciosamente é dos bugs mais difíceis de perceber.
//
// A correção é montar o schema de atualização a partir dos campos SEM default.

export const atualizarCursoSchema = z
  .object({
    titulo: campos.titulo,
    horas: campos.horas,
    ano: campos.ano,
    publicado: campos.publicado,
    nivel: campos.nivel,
    contato: campos.contato,
    tags: campos.tags,
  })
  .partial()
  .strict();

export type AtualizarCurso = z.infer<typeof atualizarCursoSchema>;

// ---------------------------------------------------------------------
// Query params: tudo chega como string
// ---------------------------------------------------------------------

export const listarCursosSchema = z.object({
  titulo: z.string().trim().min(1).optional(),

  // `z.coerce.number()` faz `Number(valor)` antes de validar. Necessário porque
  // `?maxHoras=5` chega como `"5"`, e `z.number()` recusaria — corretamente.
  maxHoras: z.coerce.number().int().positive().optional(),
  pagina: z.coerce.number().int().positive().default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(20),

  // NÃO use `z.coerce.boolean()` em query: `Boolean("false") === true`, então
  // `?publicado=false` filtraria os publicados. O jeito correto é mapear:
  publicado: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

export type ListarCursos = z.infer<typeof listarCursosSchema>;

// ---------------------------------------------------------------------
// Route param
// ---------------------------------------------------------------------

export const idSchema = z.object({
  id: z.coerce.number().int().positive('`id` deve ser um inteiro positivo'),
});

// ---------------------------------------------------------------------
// Regra que depende de outro campo: .refine()
// ---------------------------------------------------------------------
// Uma regra que envolve dois campos não cabe em nenhum dos dois. `.refine()`
// roda depois que todos passaram individualmente.

export const periodoSchema = z
  .object({
    inicio: z.coerce.date(),
    fim: z.coerce.date(),
  })
  .refine((d) => d.fim > d.inicio, {
    message: '`fim` deve ser depois de `inicio`',
    path: ['fim'], // sem isto o erro sai sem campo e o front não sabe onde marcar
  });
