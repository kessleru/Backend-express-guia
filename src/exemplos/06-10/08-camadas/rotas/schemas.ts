/**
 * Schemas de entrada. Ficam junto das rotas porque descrevem o CONTRATO HTTP —
 * o que o cliente pode mandar. O domínio não depende deles.
 */
import { z } from 'zod';

export const idSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const criarCursoSchema = z
  .object({
    titulo: z.string().trim().min(3, '`titulo` precisa de 3+ caracteres').max(120),
    horas: z.number().int().positive().max(500),
  })
  .strict();

export const alterarCursoSchema = criarCursoSchema.partial();
// Aqui `.partial()` é seguro porque nenhum campo tem `.default()` — a armadilha
// do módulo 07 só aparece quando existe default para vazar.

export const listarSchema = z.object({
  titulo: z.string().trim().min(1).optional(),
  publicado: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});
