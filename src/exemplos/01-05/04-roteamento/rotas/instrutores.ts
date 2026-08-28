/**
 * Router de instrutores — mostra dois recursos convivendo sem se conhecer.
 *
 * Cada arquivo cuida do seu recurso. Adicionar um terceiro recurso amanhã não
 * toca em nenhum destes arquivos, só no `servidor.ts` que monta.
 */
import { Router } from 'express';
import { cursos } from './cursos.ts'; // extensão .ts é obrigatória em ESM

type Instrutor = { id: number; nome: string };

const instrutores: Instrutor[] = [
  { id: 1, nome: 'Ana Souza' },
  { id: 2, nome: 'Bruno Lima' },
];

export const rotasInstrutores = Router();

rotasInstrutores.get('/', (_req, res) => {
  res.json(instrutores);
});

rotasInstrutores.get('/:id', (req, res) => {
  const instrutor = instrutores.find((i) => i.id === Number(req.params.id));
  if (!instrutor) return res.status(404).json({ erro: 'Instrutor não encontrado' });
  res.json(instrutor);
});

// Sub-recurso de leitura: "os cursos DESTE instrutor".
// Alternativa igualmente válida: `GET /cursos?instrutorId=2`. A hierarquia é
// melhor quando a relação é forte; o filtro é melhor quando você quer combinar
// vários critérios de uma vez.
rotasInstrutores.get('/:id/cursos', (req, res) => {
  const id = Number(req.params.id);
  if (!instrutores.some((i) => i.id === id)) {
    return res.status(404).json({ erro: 'Instrutor não encontrado' });
  }
  res.json(cursos.filter((c) => c.instrutorId === id));
});
