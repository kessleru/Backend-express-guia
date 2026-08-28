/**
 * Rotas de livros, agora com autorização por papel.
 *
 * A mudança do módulo 11 está visível linha a linha: leitura é pública, escrita
 * é de admin. Colocar o `exigirPapel` NA ROTA que ele protege — em vez de num
 * `app.use` distante — é o que torna esta lista auditável: dá para responder
 * "quem pode apagar um livro?" lendo um arquivo só.
 *
 * `POST /:id/emprestar` e `POST /:id/devolver` saíram daqui. Elas viraram um
 * router próprio (`rotas/emprestimos.ts`) montado sobre `/:id`, porque a ação
 * deixou de mexer só no livro: ela cria um empréstimo com dono.
 */
import { Router } from 'express';
import { criarControllerLivros } from '../controllers/livros.ts';
import { autenticar, exigirPapel } from '../middlewares/autenticar.ts';
import { validar } from '../middlewares/validar.ts';
import { idSchema } from '../schemas/comuns.ts';
import {
  atualizarLivroSchema,
  criarLivroSchema,
  listarLivrosSchema,
} from '../schemas/livro.ts';
import type { ServicoEmprestimos } from '../servicos/emprestimos.ts';
import type { ServicoLivros } from '../servicos/livros.ts';
import { criarRotasEmprestimoDeLivro } from './emprestimos.ts';

export function criarRotasLivros(
  servico: ServicoLivros,
  servicoEmprestimos: ServicoEmprestimos,
): Router {
  const controller = criarControllerLivros(servico);
  const router = Router();

  /**
   * O par que protege toda escrita, declarado uma vez.
   *
   * Repetir `autenticar, exigirPapel('admin')` em três rotas é a chance de
   * esquecer um deles em uma — e esse descuido não quebra nada visivelmente: a
   * rota continua respondendo, só que para qualquer um. Buraco silencioso é o
   * pior tipo.
   */
  const soAdmin = [autenticar, exigirPapel('admin')];

  // Literal antes de parâmetro (módulo 04).
  router.get('/disponiveis', controller.listarDisponiveis);

  // --- Leitura: pública ---
  // Catálogo de biblioteca é informação pública. Exigir login para ver o acervo
  // afastaria o usuário antes de ele ter motivo para criar conta.
  router.get('/', validar(listarLivrosSchema, 'query'), controller.listar);
  router.get('/:id', validar(idSchema, 'params'), controller.buscar);

  // --- Escrita: só admin ---
  router.post('/', soAdmin, validar(criarLivroSchema), controller.criar);
  router.patch(
    '/:id',
    soAdmin,
    validar(idSchema, 'params'),
    validar(atualizarLivroSchema),
    controller.alterar,
  );
  router.delete('/:id', soAdmin, validar(idSchema, 'params'), controller.remover);

  // --- Empréstimo: qualquer usuário autenticado ---
  // Sub-router montado sobre o mesmo `/:id`. Vem por último: `router.use` casa
  // por PREFIXO, então declarado antes ele interceptaria `/1` e companhia.
  router.use('/:id', criarRotasEmprestimoDeLivro(servicoEmprestimos));

  return router;
}
