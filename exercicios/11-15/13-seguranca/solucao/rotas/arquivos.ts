/**
 * Rota que serve capas de livro a partir de um nome vindo do cliente.
 *
 * Ela existe neste módulo por um motivo só: é o formato de rota mais comum a
 * carregar path traversal. Qualquer coisa que receba um NOME e monte um CAMINHO
 * com ele tem o mesmo risco — avatar, anexo, relatório baixado por id, tema de
 * página.
 */
import { Router } from 'express';
import type { Request, Response } from 'express';
import type { ServicoArquivos } from '../servicos/arquivos.ts';

export function criarRotasArquivos(servico: ServicoArquivos): Router {
  const router = Router();

  /**
   * Capa é conteúdo público do catálogo, como o próprio livro (ver
   * `rotas/livros.ts`) — não leva `autenticar`.
   *
   * O que ela leva é o limitador de leitura, montado em `/api` no `app.ts`:
   * servir arquivo é a rota mais barata de abusar, porque cada chamada custa
   * disco e banda do servidor e quase nada de quem pede.
   */
  /**
   * `/:nome` casa com UM segmento de caminho, e isso muda o que a rota vê.
   *
   * `GET /arquivos/../../.env` tem quatro segmentos: não casa, e o Express
   * responde 404 sem chamar este handler. A defesa abaixo nem roda.
   *
   * `GET /arquivos/..%2f..%2f.env` tem um segmento só — `%2f` não é barra para o
   * roteador. Casa, o Express decodifica ao montar `req.params`, e a string
   * `../../.env` chega aqui. É a forma que testa a defesa de verdade.
   *
   * Por que isso importa: quem confere só a forma crua vê 404 e conclui que está
   * protegido. O 404 veio do ROTEAMENTO, e roteamento muda — trocar `/:nome` por
   * `/*nome` (wildcard, módulo 04) faz os quatro segmentos passarem a casar, e a
   * proteção que ninguém tinha escrito deixa de existir sem aviso.
   */
  router.get('/:nome', (req: Request, res: Response) => {
    // `req.params.nome` é `string | undefined` com `noUncheckedIndexedAccess`.
    // E ele chega DECODIFICADO: o cliente que manda `..%2f..%2f.env` entrega a
    // string `../../.env` aqui. É por isso que a checagem não pode ser feita na
    // URL crua — ver `servicos/arquivos.ts`.
    const caminho = servico.resolverCapa(String(req.params.nome ?? ''));

    /**
     * ARMADILHA: SVG é executável no navegador.
     *
     * Um `.svg` pode conter `<script>`. Servido do MESMO domínio da sua API, ele
     * roda com acesso aos cookies do usuário — é XSS armazenado com outro nome.
     * Aqui os arquivos são nossos, mas o dia em que essa pasta receber upload
     * (módulo 19) a conta chega.
     *
     * As duas defesas, ambas baratas: `nosniff` (o `helmet` já ligou) impede o
     * navegador de adivinhar o tipo, e servir arquivo de usuário de um DOMÍNIO
     * SEPARADO tira o script do alcance do cookie da sua aplicação.
     */
    res.sendFile(caminho);
  });

  return router;
}
