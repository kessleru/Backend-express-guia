/**
 * Controller de empréstimos.
 *
 * Repare no que estes quatro métodos têm em comum: **nenhum lê identidade do
 * body ou da query.** `idDoUsuario(res)` e `usuarioAutenticado(res).papel` leem
 * do token, que o middleware já verificou.
 *
 * É a tradução em código da regra do enunciado: o `usuarioId` vem do token,
 * nunca do cliente. Aceitá-lo do body deixaria qualquer pessoa pegar livro no
 * nome de outra — e o pior é que o código pareceria correto.
 */
import type { Request, Response } from 'express';
import { idDoUsuario, usuarioAutenticado } from '../middlewares/autenticar.ts';
import { validados } from '../middlewares/validar.ts';
import { idSchema } from '../schemas/comuns.ts';
import type { Solicitante, ServicoEmprestimos } from '../servicos/emprestimos.ts';

/**
 * Monta o `Solicitante` a partir do TOKEN — uma vez, num lugar só.
 *
 * Espalhar `{ id: idDoUsuario(res), papel: usuarioAutenticado(res).papel }` por
 * cada método seria repetir a mesma linha em quatro lugares; e é justamente o
 * tipo de linha em que um descuido (ler o papel do body "só para testar") vira
 * escalada de privilégio.
 */
function solicitante(res: Response): Solicitante {
  return { id: idDoUsuario(res), papel: usuarioAutenticado(res).papel };
}

export function criarControllerEmprestimos(servico: ServicoEmprestimos) {
  return {
    async emprestar(_req: Request, res: Response) {
      const { id } = validados(res, idSchema, 'params');
      const emprestimo = await servico.emprestar(id, idDoUsuario(res));
      res.status(201).json(emprestimo);
    },

    async devolver(_req: Request, res: Response) {
      const { id } = validados(res, idSchema, 'params');
      const { papel } = usuarioAutenticado(res);

      // O papel também vem do token. Passá-lo como argumento (em vez de o
      // service ler de um contexto global) é o que mantém o service testável
      // sem Express — módulo 12.
      res.json(await servico.devolver(id, idDoUsuario(res), papel));
    },

    /**
     * `GET /emprestimos/:id` — a rota que o módulo 13 acrescenta.
     *
     * O controller não sabe nada sobre dono: ele só entrega o id pedido e QUEM
     * pediu. A decisão de mostrar ou responder 404 é do service, porque depende
     * dos dados.
     *
     * `solicitante(res)` monta o objeto a partir do token. Nenhum campo dele
     * pode vir de `req.body` ou `req.query` — se viesse, bastaria mandar
     * `?papel=admin` para ler o empréstimo de qualquer pessoa.
     */
    async buscar(_req: Request, res: Response) {
      const { id } = validados(res, idSchema, 'params');
      res.json(await servico.buscarPorId(id, solicitante(res)));
    },

    /** `POST /emprestimos/:id/devolver` — devolve pelo id do EMPRÉSTIMO. */
    async devolverPorEmprestimo(_req: Request, res: Response) {
      const { id } = validados(res, idSchema, 'params');
      res.json(await servico.devolverPorEmprestimo(id, solicitante(res)));
    },

    async meus(_req: Request, res: Response) {
      res.json(await servico.listarMeus(idDoUsuario(res)));
    },

    async todos(_req: Request, res: Response) {
      // Sem checagem de papel aqui: quem garante é o `exigirPapel('admin')` na
      // rota. Repetir a checagem no controller daria dois lugares para manter —
      // e o dia em que divergirem, ninguém sabe qual vale.
      res.json(await servico.listarTodos());
    },
  };
}
