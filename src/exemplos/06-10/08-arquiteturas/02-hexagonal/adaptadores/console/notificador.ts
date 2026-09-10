/**
 * ADAPTADOR DE SAÍDA (conduzido) — "avisa" imprimindo no terminal.
 *
 * Em produção, este arquivo daria lugar a um que manda e-mail ou põe uma
 * mensagem numa fila (módulo 17). Num teste, a um que só guarda os avisos num
 * array para o teste conferir. O núcleo não muda em nenhum dos três casos.
 */
import type { Notificador } from '../../nucleo/portas.ts';

export function criarNotificadorDeConsole(): Notificador {
  return {
    async avisarPublicacao(curso) {
      console.log(`[aviso] curso publicado: #${curso.id} "${curso.titulo}"`);
    },
  };
}
