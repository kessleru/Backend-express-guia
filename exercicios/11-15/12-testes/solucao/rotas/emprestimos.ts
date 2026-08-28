/**
 * Rotas de empréstimo.
 *
 * Duas montagens, porque as URLs vivem em lugares diferentes da hierarquia:
 *
 *   /livros/:id/emprestar   → a ação acontece SOBRE um livro
 *   /emprestimos/meus       → a coleção de empréstimos é o recurso
 *
 * É design de URL REST (módulo 04) encontrando autorização: `/emprestimos/meus`
 * existe em vez de `/emprestimos?usuarioId=X` justamente porque a segunda forma
 * convida ao IDOR — o cliente escolheria de quem é a lista.
 */
import { Router } from 'express';
import { criarControllerEmprestimos } from '../controllers/emprestimos.ts';
import { autenticar, exigirPapel } from '../middlewares/autenticar.ts';
import { validar } from '../middlewares/validar.ts';
import { idSchema } from '../schemas/comuns.ts';
import type { ServicoEmprestimos } from '../servicos/emprestimos.ts';

/** Ações penduradas em `/livros/:id`. Montado com `mergeParams`. */
export function criarRotasEmprestimoDeLivro(servico: ServicoEmprestimos): Router {
  const controller = criarControllerEmprestimos(servico);

  // `mergeParams: true` é obrigatório: sem ele, o `:id` do router PAI não chega
  // em `req.params` deste router filho, e `validados(res, idSchema, 'params')`
  // falharia com "`id` deve ser um inteiro positivo" — um erro que parece do
  // cliente e é de montagem (módulo 04).
  const router = Router({ mergeParams: true });

  router.post(
    '/emprestar',
    autenticar,
    validar(idSchema, 'params'),
    controller.emprestar,
  );

  // Só `autenticar`. NÃO tem `exigirPapel`, porque a regra não é sobre papel: é
  // "dono OU admin", e depende de buscar o empréstimo. Ela está no service.
  router.post('/devolver', autenticar, validar(idSchema, 'params'), controller.devolver);

  return router;
}

/** A coleção `/emprestimos`. */
export function criarRotasEmprestimos(servico: ServicoEmprestimos): Router {
  const controller = criarControllerEmprestimos(servico);
  const router = Router();

  // Literal antes de parâmetro — e aqui o motivo é de segurança, não só de
  // roteamento: se `/:id` viesse primeiro, `/meus` cairia nele e a rota do
  // usuário viraria uma busca por id (módulo 04).
  router.get('/meus', autenticar, controller.meus);

  router.get('/', autenticar, exigirPapel('admin'), controller.todos);

  return router;
}
