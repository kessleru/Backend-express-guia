/**
 * ❌ O JEITO QUE DÓI — tudo dentro da rota.
 *
 * Este arquivo existe para ser comparado com os outros três desta pasta, e ele
 * FUNCIONA: a API responde igual à dos outros. O problema não aparece no dia em
 * que você escreve. Aparece no dia em que alguém precisa da mesma regra em outro
 * lugar — e a regra está presa dentro de um `(req, res) => { ... }`.
 *
 * O caso concreto está no fim do arquivo: `POST /publicar-todos`, escrito "meses
 * depois", que copia a regra de publicar e esquece uma das condições.
 *
 * Rodar:  node src/exemplos/06-10/08-arquiteturas/01-tudo-na-rota/servidor.ts
 */
import express from 'express';
import { z } from 'zod';

type Curso = { id: number; titulo: string; horas: number; publicado: boolean };

// ❌ Estado no topo do módulo. Qualquer handler lê e altera o array direto: não
// existe um lugar só por onde toda escrita passa, então não existe um lugar só
// onde uma regra possa morar.
const cursos: Curso[] = [
  { id: 1, titulo: 'Fundamentos de HTTP', horas: 4, publicado: true },
  { id: 2, titulo: 'Express do zero', horas: 8, publicado: false },
  { id: 3, titulo: 'Curso relâmpago', horas: 1, publicado: false }, // < 2h: não publica
];
let proximoId = 4;

const app = express();
app.use(express.json());

app.get('/api/v1/cursos', (req, res) => {
  let resultado = cursos;
  if (req.query.publicado === 'true') resultado = cursos.filter((c) => c.publicado);
  if (req.query.publicado === 'false') resultado = cursos.filter((c) => !c.publicado);
  res.json(resultado);
});

app.post('/api/v1/cursos', (req, res) => {
  // Formato, regra e gravação misturados no mesmo bloco. Para testar "título
  // repetido dá 409" é preciso subir o Express e mandar HTTP — não há função
  // que dê para chamar sozinha.
  const entrada = z
    .object({
      titulo: z.string().trim().min(3).max(120),
      horas: z.number().int().positive().max(500),
    })
    .strict()
    .safeParse(req.body ?? {});
  if (!entrada.success) return res.status(400).json({ erro: 'Dados inválidos' });

  const alvo = entrada.data.titulo.toLowerCase();
  if (cursos.some((c) => c.titulo.toLowerCase() === alvo)) {
    return res.status(409).json({ erro: 'Já existe um curso com esse título' });
  }

  const curso: Curso = { id: proximoId++, ...entrada.data, publicado: false };
  cursos.push(curso);
  res.status(201).location(`/api/v1/cursos/${curso.id}`).json(curso);
});

app.get('/api/v1/cursos/:id', (req, res) => {
  const curso = cursos.find((c) => c.id === Number(req.params.id));
  // ❌ O formato do erro é digitado à mão em cada handler. Basta um esquecer o
  // mesmo `{ erro }` para o cliente precisar de um `if` por endpoint.
  if (!curso) return res.status(404).json({ erro: 'Curso não encontrado' });
  res.json(curso);
});

app.post('/api/v1/cursos/:id/publicar', (req, res) => {
  const curso = cursos.find((c) => c.id === Number(req.params.id));
  if (!curso) return res.status(404).json({ erro: 'Curso não encontrado' });

  // A REGRA DE PUBLICAR, na versão completa: duas condições.
  if (curso.publicado) return res.status(409).json({ erro: 'Curso já está publicado' });
  if (curso.horas < 2) {
    return res
      .status(400)
      .json({ erro: 'Curso precisa de ao menos 2h para ser publicado' });
  }

  curso.publicado = true;
  res.json(curso);
});

app.delete('/api/v1/cursos/:id', (req, res) => {
  const indice = cursos.findIndex((c) => c.id === Number(req.params.id));
  if (indice === -1) return res.status(404).json({ erro: 'Curso não encontrado' });
  if (cursos[indice]!.publicado) {
    return res.status(409).json({ erro: 'Curso publicado não pode ser removido' });
  }
  cursos.splice(indice, 1);
  res.status(204).send();
});

// ---------------------------------------------------------------------------
// ❌ MESES DEPOIS: "precisamos publicar todos os rascunhos de uma vez".
//
// A regra de publicar mora DENTRO do handler de cima. Não há função para
// chamar — ela está misturada com `req.params` e `res.status`. A saída que
// sobra é copiar. E a cópia, escrita por outra pessoa, com pressa, esquece a
// condição das 2 horas: o "Curso relâmpago" (1h) é publicado sem reclamar.
//
// Ninguém errou de propósito. O desenho é que deixou a regra sem endereço.
// Compare com `03-clean/casos-de-uso/publicar-curso.ts`: lá a regra tem um
// endereço, e uma rota nova só precisa chamá-lo.
// ---------------------------------------------------------------------------
app.post('/api/v1/cursos/publicar-todos', (_req, res) => {
  const publicados: Curso[] = [];
  for (const curso of cursos) {
    if (!curso.publicado) {
      curso.publicado = true;
      publicados.push(curso);
    }
  }
  res.json({ publicados: publicados.length, cursos: publicados });
});

const PORT = 5081;
app.listen(PORT, () => {
  console.log(`Tudo na rota em http://localhost:${PORT}/api/v1/cursos`);
});
