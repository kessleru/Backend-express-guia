/**
 * Service de arquivos — o único lugar que sabe onde as capas moram.
 *
 * ---------------------------------------------------------------------
 * PATH TRAVERSAL: o bug de uma linha
 * ---------------------------------------------------------------------
 * A rota é inocente: recebe um nome de arquivo e devolve o arquivo. A versão
 * ingênua tem exatamente uma linha, e é a linha:
 *
 *   const caminho = `${RAIZ}/${nome}`;   // ❌
 *
 * Com `nome = '../../.env'`, o caminho resultante aponta para fora da pasta de
 * capas, e a API entrega as suas variáveis de ambiente — segredo de JWT, senha
 * do banco — com status 200 e sem nenhum erro no log.
 *
 * A correção é `resolve` + confinamento, abaixo. E a ordem das duas operações é
 * o ponto do módulo: **normalize primeiro, confira depois.**
 */
import { existsSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { AppError } from '../erros/AppError.ts';

/**
 * A raiz é calculada a partir da localização deste arquivo, não do diretório de
 * onde o processo foi iniciado.
 *
 * `resolve('capas')` usaria `process.cwd()` — e aí a pasta servida mudaria
 * conforme o terminal de quem sobe o servidor. Rodando de dentro de `exercicios/`
 * a API serviria uma pasta diferente da que serve rodando da raiz do repo, sem
 * erro nenhum avisando.
 */
const RAIZ_CAPAS = resolve(import.meta.dirname, '..', 'capas');

export function criarServicoArquivos(raiz: string = RAIZ_CAPAS) {
  return {
    /** Só para o teste e para a mensagem de erro saberem qual pasta é. */
    raiz,

    /**
     * Resolve o nome pedido para um caminho absoluto CONFINADO na raiz.
     *
     * O `..` é normalizado por `resolve` — `resolve('/capas', '../../.env')` já
     * devolve `/.env`, e é sobre esse resultado que a checagem acontece.
     *
     * ---------------------------------------------------------------
     * O FALSO AMIGO: checar a string ANTES de resolver
     * ---------------------------------------------------------------
     * A defesa que parece certa e não é:
     *
     *   if (nome.includes('..')) throw ...   // ❌ insuficiente
     *
     * Ela falha por dois motivos. O primeiro é codificação: o cliente manda
     * `..%2f..%2f.env`, o Express decodifica em `req.params`, e a string que
     * chega ao seu `includes` já passou pela checagem que ficou lá atrás — ou
     * pior, você checou a versão codificada, que não contém `..` nenhum.
     *
     * O segundo é que ela recusa nome legítimo: um arquivo chamado
     * `edicao..2024.svg` é bloqueado sem motivo.
     *
     * Princípio: a checagem tem que ser feita sobre o CAMINHO FINAL, depois de
     * toda normalização. É o único valor que corresponde ao que o sistema de
     * arquivos vai abrir de fato.
     */
    resolverCapa(nome: string): string {
      // Byte nulo trunca strings em chamadas de sistema de camadas mais baixas:
      // 'capa.svg\0.txt' já foi tratado como 'capa.svg' por bibliotecas em C.
      // O Node lança nesse caso, e um `throw` cru viraria 500 — recusar aqui
      // devolve 400, que é a verdade: o pedido é inválido.
      if (nome.includes('\0')) throw new AppError('Nome de arquivo inválido', 400);

      const alvo = resolve(raiz, nome);

      // `sep` no fim é obrigatório. Sem ele, `startsWith(raiz)` aceitaria
      // `/app/capas-secretas/x.svg` como se estivesse dentro de `/app/capas` —
      // um prefixo de string não é um prefixo de diretório.
      if (!alvo.startsWith(raiz + sep)) {
        throw new AppError('Caminho de arquivo inválido', 400);
      }

      // 404 sem revelar o caminho absoluto tentado. Devolver `alvo` na mensagem
      // entregaria a estrutura de pastas do servidor de graça — informação que o
      // atacante usa para escolher o próximo palpite.
      if (!existsSync(alvo)) throw new AppError('Capa não encontrada', 404);

      return alvo;
    },
  };
}

export type ServicoArquivos = ReturnType<typeof criarServicoArquivos>;
