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
import type { ServicoEmprestimos } from '../servicos/emprestimos.ts';

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
