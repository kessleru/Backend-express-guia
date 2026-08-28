/**
 * Cache condicional: manda uma etiqueta (`ETag`), lê o `If-None-Match` que o
 * cliente devolve e responde `304 Not Modified` sem corpo quando nada mudou.
 *
 * Conceito de middleware: docs/05-middlewares.md. Status e cabeçalhos:
 * docs/01-fundamentos-http.md. Cache é o módulo 15, que ainda não existe —
 * esta pasta é a versão avulsa dele.
 */
import { createHash } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/**
 * Devolve o dado BARATO que identifica a versão atual da resposta: um
 * `atualizadoEm`, um número de revisão, um contador de escritas.
 *
 * O tipo é o coração da pasta. Ele obriga quem usa o middleware a ter em mãos
 * algo que responde "mudou?" ANTES de montar o corpo — que é exatamente o que
 * o ETag automático do Express não tem, porque ele só existe depois do corpo
 * pronto.
 *
 * `undefined` é a saída de emergência: quando não dá para versionar aquela
 * requisição, o middleware sai de cena e a resposta segue normal, sem etiqueta.
 * Emitir uma etiqueta errada é pior do que não emitir nenhuma — o cliente
 * guardaria conteúdo velho achando que está em dia.
 */
export type Versao = (req: Request) => string | number | undefined;

export type OpcoesCache = {
  /**
   * Por quantos segundos o cliente pode usar a cópia SEM perguntar nada.
   * Zero manda revalidar em toda requisição: você economiza o corpo, nunca a
   * viagem. Acima de zero você economiza a viagem também, e paga com dado
   * potencialmente velho por esse tempo.
   */
  segundos?: number;
  /**
   * `private` proíbe cache compartilhado (CDN, proxy da empresa) de guardar a
   * resposta. É o padrão porque a resposta pode depender de quem pediu, e um
   * proxy que guarda o acervo de um leitor e entrega para outro é vazamento,
   * não lentidão.
   */
  compartilhavel?: boolean;
};

export function cacheCondicional(obterVersao: Versao, opcoes: OpcoesCache = {}) {
  const { segundos = 30, compartilhavel = false } = opcoes;

  return (req: Request, res: Response, next: NextFunction) => {
    const versao = obterVersao(req);
    if (versao === undefined) return next();

    const etiqueta = etiquetaDe(versao);
    res.setHeader('ETag', etiqueta);
    // Etiqueta sem política de cache resolve metade: o `ETag` diz COMO
    // perguntar "mudou?", o `Cache-Control` diz QUANDO perguntar. Sem ele cada
    // cliente inventa uma heurística própria e o comportamento vira loteria.
    res.setHeader(
      'Cache-Control',
      `${compartilhavel ? 'public' : 'private'}, max-age=${segundos}, must-revalidate`,
    );

    if (combina(req.headers['if-none-match'], etiqueta)) {
      // `.end()` e não `.json()`: um 304 não pode ter corpo, e o corpo é
      // justamente o que se economiza. Se você mandar JSON aqui, o cliente
      // descarta o que veio e a resposta ficou mais cara que o 200.
      return res.status(304).end();
    }

    // O `next()` é o caso caro: o handler roda e monta a resposta inteira.
    // Todo o ganho está em NÃO chegar nesta linha quando a etiqueta bate.
    next();
  };
}

/**
 * O hash não existe por segurança — existe por formato. A etiqueta viaja num
 * cabeçalho, então não pode conter `"` nem quebra de linha, e um `atualizadoEm`
 * cru entregaria de graça a data em que o dado mudou. O `sha1` normaliza os
 * dois problemas de uma vez, sobre ~30 bytes de versão em vez de sobre o corpo.
 *
 * Sem o `W/` na frente, a etiqueta é FORTE: promete bytes idênticos. Isso só é
 * verdade se a mesma versão sempre gerar o mesmo corpo — um `geradoEm: Date.now()`
 * dentro do JSON quebra a promessa e exige `W/` (etiqueta fraca, "equivalente
 * o bastante").
 */
function etiquetaDe(versao: string | number): string {
  return `"${createHash('sha1').update(String(versao)).digest('base64url')}"`;
}

/**
 * O `If-None-Match` não é um valor só: o cliente pode devolver uma LISTA de
 * etiquetas que já tem em mãos, ou `*` para dizer "qualquer versão serve".
 * Comparar o cabeçalho inteiro com `===` funciona no teste manual, com uma
 * etiqueta só, e para de funcionar em produção com o navegador de verdade.
 */
function combina(cabecalho: string | undefined, etiqueta: string): boolean {
  if (!cabecalho) return false;
  return (
    cabecalho
      .split(',')
      .map((valor) => valor.trim())
      // Proxy e CDN podem enfraquecer a etiqueta no caminho, devolvendo `W/"x"`
      // onde você mandou `"x"`. Comparar sem o prefixo evita o 200 desnecessário.
      .some((valor) => valor === '*' || semPrefixo(valor) === semPrefixo(etiqueta))
  );
}

const semPrefixo = (valor: string) => valor.replace(/^W\//, '');
