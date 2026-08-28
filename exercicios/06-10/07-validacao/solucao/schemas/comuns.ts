/**
 * Schemas reaproveitados por vários recursos.
 */
import { z } from 'zod';

/**
 * Route param `:id`.
 *
 * `z.coerce` é obrigatório: o que vem da URL é sempre string. `z.number()`
 * recusaria `"1"` — e estaria certo em recusar.
 */
export const idSchema = z.object({
  id: z.coerce.number().int().positive('`id` deve ser um inteiro positivo'),
});

/** Paginação padrão da API. Um lugar só define os limites. */
export const paginacaoSchema = z.object({
  pagina: z.coerce.number().int().positive().default(1),
  // O máximo existe para proteger o SERVIDOR: sem ele, `?porPagina=999999` é um
  // vetor de negação de serviço barato de disparar e caro de responder.
  porPagina: z.coerce.number().int().min(1).max(50).default(10),
});

/**
 * Booleano de query string, feito à mão.
 *
 * `z.coerce.boolean()` é uma armadilha: `Boolean("false") === true`, então
 * `?disponivel=false` filtraria justamente os disponíveis.
 */
export const booleanoDeQuery = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true')
  .optional();
