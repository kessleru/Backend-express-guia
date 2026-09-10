/**
 * Os mesmos três cursos dos outros exemplos, num arquivo à parte porque aqui há
 * DOIS pontos de montagem (`servidor.ts` e `cli.ts`) e os dois precisam deles.
 */
import type { Curso } from './nucleo/curso.ts';

export const cursosIniciais: Curso[] = [
  { id: 1, titulo: 'Fundamentos de HTTP', horas: 4, publicado: true },
  { id: 2, titulo: 'Express do zero', horas: 8, publicado: false },
  { id: 3, titulo: 'Curso relâmpago', horas: 1, publicado: false }, // < 2h: não publica
];
