/**
 * O último middleware da pilha: transforma qualquer erro numa resposta JSON de
 * formato único. Conceito principal: módulo 06.
 *
 * Copiável: o `AppError` está definido aqui. Se o seu projeto já tem um, apague
 * a classe e mantenha o `ehEsperado()` — é ele, e não o `instanceof`, que
 * decide o que vira resposta descrita e o que vira 500 genérico.
 */
import type { NextFunction, Request, Response } from 'express';

/**
 * O erro que você criou de propósito: já sabe o status e a mensagem que o
 * cliente pode ler. Quem lança não conhece `res` — por isso um service dá para
 * reusar fora do HTTP (módulo 08).
 */
export class AppError extends Error {
  readonly status: number;
  readonly esperado = true;
  readonly detalhes: unknown;

  constructor(mensagem: string, status = 400, detalhes?: unknown) {
    super(mensagem);
    this.name = 'AppError';
    this.status = status;
    this.detalhes = detalhes;
  }
}

// As fábricas nomeadas não existem para digitar menos: existem para o status de
// cada situação ser decidido em UM lugar. Sem elas, metade do código responde
// 404 e a outra metade 400 para o mesmo caso, e a API fica sem contrato.
export const naoEncontrado = (recurso: string, id: string | number) =>
  new AppError(`${recurso} ${id} não encontrado`, 404);

export const conflito = (mensagem: string) => new AppError(mensagem, 409);

/**
 * O que conta como erro esperado. É uma checagem ESTRUTURAL de propósito: o
 * `instanceof AppError` só é `true` para a classe exatamente desta cópia, e num
 * projeto real há mais de uma (a cópia de outra pasta, duas versões do mesmo
 * pacote em `node_modules`, o processo filho). Quando o `instanceof` dá `false`
 * por um motivo desses, um 404 legítimo sai como 500 e nada quebra — é o tipo
 * de bug que só aparece em produção.
 */
function ehEsperado(
  erro: unknown,
): erro is { status: number; message: string; detalhes?: unknown } {
  if (typeof erro !== 'object' || erro === null) return false;
  const candidato = erro as { status?: unknown; esperado?: unknown; message?: unknown };
  return (
    candidato.esperado === true &&
    typeof candidato.status === 'number' &&
    typeof candidato.message === 'string'
  );
}

/**
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ QUATRO ARGUMENTOS. O Express reconhece o tratador de erro contando os    │
 * │ parâmetros que a função DECLARA — a aridade. Três, é middleware comum;   │
 * │ quatro, é tratador.                                                     │
 * │                                                                         │
 * │ Apagar o `_next` porque "não está sendo usado" — e o editor vai sugerir  │
 * │ isso — transforma esta função num middleware comum. Ela continua na      │
 * │ pilha, o projeto continua compilando, os testes de rota feliz continuam  │
 * │ passando, e o tratamento de erro do projeto inteiro fica DESLIGADO em    │
 * │ silêncio: o erro passa a cair no tratador padrão do Express, que         │
 * │ responde HTML com a stack trace dentro para quem provocar o erro.       │
 * │                                                                         │
 * │ Não existe aviso. A única defesa é o teste do módulo 12 que provoca um   │
 * │ erro e confere o formato da resposta.                                   │
 * └─────────────────────────────────────────────────────────────────────────┘
 */
export function tratadorDeErros(
  erro: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  // Erro depois que a resposta começou a sair: os cabeçalhos já foram enviados,
  // `res.status()` não muda mais nada e um segundo `res.json()` lança
  // ERR_HTTP_HEADERS_SENT em cima do erro original. O único desfecho honesto é
  // devolver ao Express, que derruba a conexão — o cliente recebe uma resposta
  // truncada, que é a verdade do que aconteceu.
  if (res.headersSent) return _next(erro);

  if (ehEsperado(erro)) {
    return res.status(erro.status).json({
      erro: erro.message,
      status: erro.status,
      // `?? undefined`: chave sem valor some do JSON em vez de virar
      // `"detalhes": null`, que o cliente teria de tratar como caso extra.
      detalhes: erro.detalhes ?? undefined,
    });
  }

  // O `express.json()` lança este `SyntaxError` quando o corpo não é JSON
  // válido. É culpa do cliente, não do servidor: sem este ramo, quem manda uma
  // vírgula sobrando recebe 500 e vai abrir chamado achando que a API caiu.
  if (erro instanceof SyntaxError && 'body' in erro) {
    return res
      .status(400)
      .json({ erro: 'JSON inválido no corpo da requisição', status: 400 });
  }

  // Daqui para baixo é bug: ninguém previu, então ninguém sabe o que a mensagem
  // contém. A stack vai INTEIRA para o log do servidor — caminho de arquivo,
  // nome de função, número de linha — e NUNCA para o corpo da resposta: ela
  // entrega a quem lê o layout do projeto, as bibliotecas e a versão delas, e
  // com frequência o valor que causou a falha (que pode ser a senha do
  // usuário). O cliente recebe uma frase genérica.
  console.error('[erro não tratado]', erro);

  return res.status(500).json({ erro: 'Erro interno do servidor', status: 500 });
}
