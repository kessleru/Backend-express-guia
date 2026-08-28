/**
 * `criarApp()` — a mudança estrutural que este módulo exige.
 *
 * ---------------------------------------------------------------------
 * O PROBLEMA
 * ---------------------------------------------------------------------
 * Todos os exemplos até o módulo 11 terminam assim:
 *
 *   const app = express();
 *   // ...rotas...
 *   app.listen(5059);
 *
 * Importar esse arquivo num teste SOBE UM SERVIDOR de verdade, numa porta de
 * verdade. Consequências, todas ruins:
 *
 *   - dois arquivos de teste em paralelo brigam pela mesma porta (`EADDRINUSE`);
 *   - o processo do teste não termina, porque o servidor segue ouvindo;
 *   - o teste passa a depender da rede da máquina que o roda.
 *
 * ---------------------------------------------------------------------
 * A SOLUÇÃO
 * ---------------------------------------------------------------------
 * Separar **construir o app** de **começar a ouvir**. `criarApp()` devolve o app
 * montado sem `listen`; `servidor.ts` é o único que chama `listen`.
 *
 * O Supertest então usa o app diretamente: ele mesmo abre um socket efêmero,
 * dispara a requisição e fecha. Sem porta fixa, sem conflito, sem espera.
 *
 * Princípio, que vale muito além de teste: **separe a construção do objeto do
 * seu ciclo de vida.** É a mesma ideia que permite subir o app num serverless,
 * num worker ou atrás de outro processo sem tocar em nada.
 *
 * > Os módulos 01–11 NÃO foram reescritos para isto. A regra do repositório é
 * > não refazer módulo pronto por preferência de estilo — e ver os dois formatos
 * > lado a lado deixa a diferença clara.
 */
import express, { Router } from 'express';
import { z } from 'zod';
import { rotaNaoEncontrada, tratarErro } from '../../06-10/06-erros/tratador.ts';
import { validados, validar } from '../../06-10/07-validacao/validar.ts';
import type { RepositorioLivros } from './dominio.ts';
import { criarServicoLivros } from './servico.ts';

const idSchema = z.object({ id: z.coerce.number().int().positive() });

const criarLivroSchema = z
  .object({
    titulo: z.string().trim().min(1, '`titulo` não pode ser vazio'),
    autorId: z.number().int().positive(),
    ano: z.number().int(),
  })
  .strict();

const alterarLivroSchema = z
  .object({ titulo: z.string().trim().min(1), ano: z.number().int() })
  .partial()
  .strict();

/**
 * O repositório entra por PARÂMETRO — é o composition root do módulo 08 virando
 * ferramenta de teste.
 *
 * O mesmo `criarApp` roda com o repositório em memória (teste rápido), com
 * SQLite `:memory:` (teste de integração) e com o banco de verdade (produção).
 * Nenhuma linha de rota, controller ou service muda entre os três.
 */
export function criarApp(repo: RepositorioLivros) {
  const servico = criarServicoLivros(repo);
  const app = express();

  app.use(express.json());

  const livros = Router();

  livros.get('/', async (_req, res) => {
    res.json(await servico.listar());
  });

  livros.get('/:id', validar(idSchema, 'params'), async (_req, res) => {
    const { id } = validados(res, idSchema, 'params');
    res.json(await servico.buscar(id));
  });

  livros.post('/', validar(criarLivroSchema), async (req, res) => {
    const livro = await servico.criar(validados(res, criarLivroSchema));
    res.status(201).location(`${req.baseUrl}/${livro.id}`).json(livro);
  });

  livros.patch(
    '/:id',
    validar(idSchema, 'params'),
    validar(alterarLivroSchema),
    async (_req, res) => {
      const { id } = validados(res, idSchema, 'params');
      res.json(await servico.alterar(id, validados(res, alterarLivroSchema)));
    },
  );

  livros.delete('/:id', validar(idSchema, 'params'), async (_req, res) => {
    const { id } = validados(res, idSchema, 'params');
    await servico.remover(id);
    res.status(204).send();
  });

  livros.post('/:id/emprestar', validar(idSchema, 'params'), async (_req, res) => {
    const { id } = validados(res, idSchema, 'params');
    res.json(await servico.emprestar(id));
  });

  app.use('/livros', livros);

  /** Rota que explode de propósito — usada no teste de vazamento de stack. */
  app.get('/boom', () => {
    throw new Error('erro interno com segredo: senha=123');
  });

  app.use(rotaNaoEncontrada);
  app.use(tratarErro);

  return app;
}

/** O tipo do app, para as fixtures não precisarem repetir `ReturnType<...>`. */
export type App = ReturnType<typeof criarApp>;
