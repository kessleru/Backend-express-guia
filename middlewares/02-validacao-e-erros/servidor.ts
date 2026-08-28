/**
 * Demo do grupo 02 — validação e erros. Não é aplicação: é a pilha montada com
 * as quatro pastas e o mínimo de rota para cada uma aparecer num `curl`.
 *
 * Rodar: `node middlewares/02-validacao-e-erros/servidor.ts` — porta 6102.
 */
import express from 'express';
import { z } from 'zod';

import { assincrono, encaminharErro } from './assincrono/middleware.ts';
import { rotaNaoEncontrada } from './nao-encontrado/middleware.ts';
import {
  AppError,
  naoEncontrado,
  tratadorDeErros,
} from './tratador-de-erros/middleware.ts';
import { validados, validar } from './validar/middleware.ts';

const app = express();
const PORTA = 6102;

const chamados = [
  {
    id: 1,
    titulo: 'Impressora do 3º andar sem tinta',
    prioridade: 'baixa',
    contrato: 'ACM-1042',
  },
  {
    id: 2,
    titulo: 'VPN cai a cada dez minutos',
    prioridade: 'alta',
    contrato: 'ACM-1042',
  },
];

const criarChamadoSchema = z
  .object({
    titulo: z.string().trim().min(5, '`titulo` precisa de 5+ caracteres').max(120),
    prioridade: z
      .enum(['baixa', 'media', 'alta'], {
        error: '`prioridade` deve ser baixa, media ou alta',
      })
      .default('media'),
    contrato: z
      .string()
      .regex(/^[A-Z]{3}-\d{4}$/, '`contrato` segue o formato AAA-0000')
      // O segundo lado do falso amigo do Zod: as checagens de um schema NÃO
      // param na primeira que falha. Este `.refine()` roda mesmo quando o
      // `.regex()` acima já reprovou o valor — com `"xx"`, `"1"`, `""`.
      //
      // ❌ `valor.split('-')[1]!.length === 4` — em `"xx"` o índice 1 é
      //    `undefined`, o `.length` lança TypeError DE DENTRO do `safeParse`, e
      //    um 422 com a lista de campos vira um 500 sem explicação nenhuma.
      // ✅ Só comparação, e o `undefined` cai no caminho seguro:
      .refine(
        (valor) => valor.split('-')[0] !== 'TST',
        '`contrato` de teste não abre chamado',
      ),
  })
  // `.strict()` recusa campo desconhecido em vez de descartá-lo em silêncio:
  // quem digitou `titulo` errado descobre agora, não depois de salvar vazio.
  .strict();

const idSchema = z.object({
  // Parâmetro de rota é sempre TEXTO: `/chamados/7` chega como `"7"`. Sem
  // `z.coerce`, um `z.number()` reprovaria todo id válido.
  id: z.coerce.number({ error: '`id` deve ser um número' }).int().positive(),
});

const listarSchema = z
  .object({
    pagina: z.coerce.number().int().positive().default(1),
    limite: z.coerce
      .number()
      .int()
      .positive()
      .max(50, '`limite` máximo é 50')
      .default(10),
  })
  .strict();

app.use(express.json());

app.post('/chamados', validar(criarChamadoSchema), (_req, res) => {
  const dados = validados(res, criarChamadoSchema);
  const chamado = { id: chamados.length + 1, ...dados };
  chamados.push(chamado);
  res.status(201).json(chamado);
});

app.get('/chamados', validar(listarSchema, 'query'), (_req, res) => {
  const { pagina, limite } = validados(res, listarSchema, 'query');
  const inicio = (pagina - 1) * limite;
  res.json({ pagina, limite, itens: chamados.slice(inicio, inicio + limite) });
});

app.get('/chamados/:id', validar(idSchema, 'params'), (_req, res) => {
  const { id } = validados(res, idSchema, 'params');
  const chamado = chamados.find((c) => c.id === id);
  // Erro ESPERADO: o tratador sabe o status e a mensagem, e responde os dois.
  if (!chamado) throw naoEncontrado('Chamado', id);
  res.json(chamado);
});

// Erro INESPERADO: ninguém previu, então a mensagem real ("...is not a
// function") fica só no log e o cliente recebe a frase genérica.
app.get('/falha-inesperada', () => {
  const nulo = null as unknown as { salvar: () => void };
  nulo.salvar();
});

// As duas rotas que provam o ponto da pasta `assincrono`: mesma rejeição, mesma
// resposta. Uma com o wrapper de sempre, outra sem wrapper nenhum.
app.get(
  '/async/com-wrapper',
  assincrono(async () => {
    await new Promise((resolva) => setTimeout(resolva, 5));
    throw new AppError('O sistema de chamados não respondeu a tempo', 503);
  }),
);

app.get('/async/sem-wrapper', async () => {
  await new Promise((resolva) => setTimeout(resolva, 5));
  throw new AppError('O sistema de chamados não respondeu a tempo', 503);
});

// O que continua NÃO sendo automático. Sem o `encaminharErro`, este `throw`
// acontece depois que o handler retornou: vira `uncaughtException` e derruba o
// processo — a demo inteira sai do ar, não só esta requisição.
app.get('/async/fora-da-pilha', (_req, _res, next) => {
  setTimeout(() => {
    encaminharErro(next, () => {
      throw new Error('o worker de notificação falhou');
    });
  }, 5);
});

// A ordem destes dois é a entrega do grupo: 404 depois de TODAS as rotas,
// tratador de erro sempre por último.
app.use(rotaNaoEncontrada);
app.use(tratadorDeErros);

app.listen(PORTA, () => {
  console.log(`Demo do grupo 02 em http://localhost:${PORTA}`);
});
