/**
 * O contrato HTTP de entrada. Fica no círculo 3 porque descreve o que chega
 * pela web — um caso de uso não sabe que existe JSON.
 */
import { z } from 'zod';

export const idSchema = z.object({ id: z.coerce.number().int().positive() });

export const criarSchema = z
  .object({
    titulo: z.string().trim().min(3).max(120),
    horas: z.number().int().positive().max(500),
  })
  .strict();

export const listarSchema = z.object({
  publicado: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});
