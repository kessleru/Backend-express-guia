/**
 * ADAPTADOR DE ENTRADA (condutor) — linha de comando.
 *
 * É a prova do padrão. O mesmo núcleo que atende HTTP atende um terminal, e a
 * regra das 2 horas vale igual — sem Express, sem `req`, sem status code. Se a
 * regra morasse numa rota, este arquivo teria que copiá-la (e é exatamente o que
 * dá errado em `01-tudo-na-rota/`).
 */
import type { TipoDeErro } from '../../nucleo/curso.ts';
import { ErroDoNucleo } from '../../nucleo/curso.ts';
import type { CatalogoDeCursos } from '../../nucleo/portas.ts';

// O equivalente do `STATUS_POR_TIPO` do adaptador HTTP, na língua do terminal:
// 0 é sucesso, qualquer outro número é falha. Um script que chame este comando
// consegue distinguir "não existe" (2) de "a regra não deixou" (3).
const CODIGO_DE_SAIDA: Record<TipoDeErro, number> = {
  'nao-encontrado': 2,
  conflito: 3,
  'regra-violada': 3,
};

/** Devolve o código de saída do processo. Quem chama decide se encerra. */
export async function executarComando(
  catalogo: CatalogoDeCursos,
  argumentos: string[],
): Promise<number> {
  const [comando, valor] = argumentos;

  try {
    switch (comando) {
      case 'listar': {
        for (const c of await catalogo.listar({})) {
          const estado = c.publicado ? 'publicado' : 'rascunho ';
          console.log(`#${c.id}  ${estado}  ${c.horas}h  ${c.titulo}`);
        }
        return 0;
      }
      case 'publicar': {
        const curso = await catalogo.publicar(Number(valor));
        console.log(`ok: "${curso.titulo}" publicado`);
        return 0;
      }
      default:
        console.error('uso: cli.ts listar | cli.ts publicar <id>');
        return 1;
    }
  } catch (erro) {
    if (erro instanceof ErroDoNucleo) {
      console.error(`erro: ${erro.message}`);
      return CODIGO_DE_SAIDA[erro.tipo];
    }
    throw erro; // bug de verdade: deixa estourar com a stack inteira
  }
}
