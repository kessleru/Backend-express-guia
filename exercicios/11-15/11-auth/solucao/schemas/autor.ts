/**
 * Schemas de autor.
 */
import { z } from 'zod';

const campos = {
  nome: z
    .string({ error: '`nome` deve ser um texto' })
    .trim()
    .min(2, '`nome` precisa de ao menos 2 caracteres')
    .max(100, '`nome` passa de 100 caracteres'),

  nacionalidade: z
    .string({ error: '`nacionalidade` deve ser um texto' })
    .trim()
    .min(2)
    .max(60),

  /**
   * `z.coerce.date()` aceita string ISO e timestamp.
   *
   * `.refine()` em vez de `.max(new Date())`: o `.max()` avaliaria `new Date()`
   * uma única vez, quando o módulo carrega. Num servidor que fica semanas de pé,
   * o limite ficaria congelado no dia do deploy. O `.refine()` roda a cada
   * validação.
   */
  nascimento: z.coerce
    .date({ error: '`nascimento` deve ser uma data válida' })
    .refine((d) => d <= new Date(), '`nascimento` não pode ser no futuro'),
};

export const criarAutorSchema = z
  .object({
    nome: campos.nome,
    nacionalidade: campos.nacionalidade,
    nascimento: campos.nascimento.optional(),
  })
  .strict();

export const atualizarAutorSchema = z.object(campos).partial().strict();

export type CriarAutor = z.infer<typeof criarAutorSchema>;
export type AtualizarAutor = z.infer<typeof atualizarAutorSchema>;
export type Autor = CriarAutor & { id: number };
