# Padrão de escrita dos módulos

> Esta é a régua de qualidade de ensino — vale acima das outras regras de estilo.
> O `CLAUDE.md` traz o resumo; aqui está o detalhe, o template e os exemplos.

A meta é o leitor **entender**, não passar rápido pelo texto. Cobertura completa
e explicação completa: o corte é por redundância, nunca por concisão.

> **Atenção:**
> Aqui dizia "cobertura completa, **texto curto**". Essa frase produziu módulos
> que citavam conceito sem explicar, e foi trocada na revisão de 2026-08-13.
> Módulo longo não é defeito; módulo em que o leitor trava numa palavra é.

## Template obrigatório de cada `docs/NN-*.md`

```markdown
# NN — Título

**Em uma frase:** o que é isso.

## Por que importa

3 bullets, no máximo. Que problema resolve.

## Conceitos

Um conceito por vez, e cada um pelas cinco camadas na ordem: problema →
mecânica → princípio → trade-off → consequência. Abre no caso mínimo e cresce.
Tabela serve para comparar e enumerar, **depois** da explicação — nunca no
lugar dela.

## Na prática

O exemplo do módulo rodando, com os comandos e a saída que eles devolvem
de verdade.

## Erros comuns

| Erro | O que acontece | Correção |

## Cheatsheet

O resumo que você volta pra consultar depois.

## Os princípios deste módulo

Tabela: o princípio em frase comum + em que módulos ele reaparece. É recapitulação
do que o leitor já viu no corpo — nunca a primeira aparição da ideia.

## Se quiser ir mais fundo

Comparação com outros frameworks, nome acadêmico do padrão, caso de borda,
detalhe de implementação. Tudo que é verdade mas atrapalha a primeira leitura.
Some a seção inteira se o módulo não tiver nada assim.

## Para ir além

Referências externas comentadas — por que ler cada uma.

## Pratique

Link para `exercicios/NN-*/` + 1 desafio extra opcional.
```

## Regras

| Regra             | Limite                                                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tamanho do módulo | **Sem limite.** Acaba quando o assunto acaba, não na linha N.                                                                                     |
| Parágrafo         | **Uma ideia.** O limite é a ideia, não a linha: um parágrafo de 8 linhas que desenvolve um raciocínio fica; dois de 3 dizendo a mesma coisa saem. |
| Prosa e código    | Código mostra o **quê**; o texto ao redor diz o **porquê** e o que observar. Bloco de código entre dois títulos, sem texto, é defeito.            |
| Listas e tabelas  | Preferidas a texto corrido para comparação e enumeração — **não** para substituir a explicação que precede a comparação.                          |
| Teoria            | Só a que muda uma decisão sua. História e curiosidade ficam de fora.                                                                              |
| Repetição         | Conceito já explicado vira link para o módulo, não é reexplicado.                                                                                 |

## Qualidade de ensino — o padrão que vale acima de tudo

"Enxuto" nunca é desculpa para raso. **Corte redundância, não profundidade.** Um
módulo que cabe em 100 linhas mas deixa o leitor sem entender _por que_ a coisa
funciona assim falhou — e precisa crescer.

O teste de cada módulo: depois de lê-lo, o leitor consegue **decidir sozinho**
num caso que o módulo não mostrou?

### As cinco camadas obrigatórias de todo conceito

Todo conceito que entra num módulo passa pelas cinco, **nesta ordem**. Faltou
uma, o conceito está pela metade; fora de ordem, o leitor trava:

| #   | Camada           | Pergunta que responde                               | Como cortar se ficar longo                 |
| --- | ---------------- | --------------------------------------------------- | ------------------------------------------ |
| 1   | **Problema**     | Que dor existia antes disto?                        | Vira uma frase, nunca some                 |
| 2   | **Mecânica**     | Como funciona por baixo?                            | **Não corte. É o que responde "por quê".** |
| 3   | **Princípio**    | Que ideia geral isto que você acabou de ver mostra? | Vira uma frase, sempre depois da mecânica  |
| 4   | **Trade-off**    | O que isto custa e quando **não** usar?             | Vira linha de tabela                       |
| 5   | **Consequência** | O que muda no código de quem usa?                   | Vira o exemplo executável                  |

> **Atenção:**
> **A ordem é obrigatória.** Princípio antes da mecânica foi o defeito que
> motivou a revisão de 2026-08-13: o leitor ouvia o nome de uma coisa que ainda
> não tinha visto acontecer, e parava ali.
>
> O caso que provocou a mudança estava no módulo 05: _"middleware é composição de
> funções sobre um valor mutável — a mágica do framework é uma lista de funções e
> um índice que anda"_. A lista e o índice nunca eram mostrados. O leitor
> perguntou, com razão: **que valor mutável? que índice?**

A camada 3 continua sendo a razão de o repositório existir — Express, Zod e
Prisma mudam; "não confie no cliente" e "estado compartilhado precisa de
coordenação" não. Mas ela é **conclusão, não premissa**: só entra depois que o
leitor viu a coisa funcionar, e é escrita em frase comum.

> **Cuidado:**
> Se a frase precisa ser decorada para fazer sentido, ela está errada.
>
> "**A senha nunca é armazenada**" é princípio: qualquer pessoa entende, e
> continua valendo quando o argon2 for substituído.
>
> "**Middleware é composição de funções sobre um valor mutável**" é aforismo:
> soa profundo, exige três definições que não foram dadas, e não ensina ninguém
> a decidir nada.

### Regras de material e exemplo

| Regra                              | Detalhe                                                                                                                            |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Princípio derivado**             | Aparece **depois** da mecânica que o sustenta, em frase comum. O leitor tem que conseguir dizer "ah, é isso que eu acabei de ver". |
| **Mostre a dor primeiro**          | O jeito ruim (comentado como ruim) antes do bom. Ferramenta sem dor prévia vira ritual.                                            |
| **Toda decisão tem um porquê**     | Nenhum número, flag ou opção entra sem a frase que explica a escolha. `memoryCost: 19456` — por quê?                               |
| **Diga o custo**                   | Toda técnica tem contrapartida. Módulo que só elogia a ferramenta não ensina a escolher.                                           |
| **Exemplo é progressivo**          | Começa mínimo e cresce. Um arquivo de 200 linhas despejado de uma vez não ensina, só impressiona.                                  |
| **Exemplo é real**                 | Reusa o domínio da biblioteca. Nada de `foo`/`bar` — o leitor tem que reconhecer o problema.                                       |
| **Erro comum é reproduzível**      | A tabela "Erros comuns" descreve o sintoma exato (mensagem, status, comportamento), não "pode dar erro".                           |
| **Falso amigo explicitado**        | O que "parece certo e está errado" (`.partial()` no PATCH, `decode` no lugar de `verify`) vira destaque.                           |
| **Fecha o ciclo**                  | O módulo lembra o que veio antes e diz qual módulo resolve o que ficou em aberto (`// TODO`).                                      |
| **Saída prometida é saída rodada** | Todo status, mensagem ou número que o texto promete tem que ter sido observado antes de ser escrito. Ver o alerta abaixo.          |

> **Atenção:** um trecho do módulo 01 prometia `400` onde o servidor devolve
> `201` — o exemplo ignora o `Content-Type` e tenta `JSON.parse` em qualquer
> corpo. Saída errada no texto ensina errado e destrói a confiança no material,
> porque o leitor que rodou vê uma coisa e lê outra. **Rode antes de prometer.**

### Três regras que entraram na revisão de 2026-08-13

| Regra                           | Detalhe                                                                                                                                                                                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Termo definido na estreia**   | Toda palavra técnica é explicada na primeira vez que aparece, na própria linha ou na seguinte, e entra em [`docs/00-glossario.md`](../docs/00-glossario.md). Escreveu "aridade" sem dizer que é o número de parâmetros? O leitor parou ali. |
| **Diagrama não adianta módulo** | Um mermaid só pode conter o que já foi ensinado **até aquele módulo**. `helmet` num fluxo do 05 é ruído: o leitor vê sete caixas e reconhece duas. O que depende de módulo futuro vai para `## Se quiser ir mais fundo`.                    |
| **Rampa**                       | `## Conceitos` abre no caso mínimo e cresce. Comparação com outro framework, caso de borda e nome acadêmico do padrão saem do corpo do módulo.                                                                                              |

### O mesmo padrão no código

Comentário de exemplo é material didático, não anotação. Ele explica o
**princípio e a armadilha**, não a sintaxe:

```ts
// ❌ Descreve o óbvio — sai
const hash = await argon2.hash(senha); // faz o hash da senha

// ✅ Explica a decisão — fica
// O salt não é passado: o argon2 gera um por senha e o embute no resultado. É o
// que faz duas senhas iguais terem hashes diferentes — e o que impede uma
// rainbow table de servir para todos os usuários de uma vez.
const hash = await argon2.hash(senha, CUSTO);
```

## Recursos de Markdown (só o padrão)

Os `.md` usam **Markdown puro** — nada que dependa de extensão. Tudo abaixo
renderiza igual no preview do VS Code (`Ctrl+K V`) e no GitHub.

| Recurso                 | Onde                                                  |
| ----------------------- | ----------------------------------------------------- |
| ` ```mermaid `          | Fluxo, sequência, camadas, ER, estado                 |
| `> **Atenção:** …`      | Armadilha e erro caro (citação com rótulo em negrito) |
| `<details>`             | Aprofundamento opcional — nunca o conteúdo principal  |
| Linguagem em todo bloco | ` ```ts `, ` ```sql `, ` ```http `, ` ```bash `       |
| `- [ ]`                 | Critérios de aceite                                   |

**Diagrama substitui prosa, não soma** — ao inserir um, corte o parágrafo que
ficou redundante.

**Não use** `> [!NOTE]`/`[!WARNING]`/`[!CAUTION]` nem sintaxe do Markdown
Preview Enhanced (`{cmd=true}`, `@import "[TOC]"`): a primeira é ruído visual
fora do GitHub, e a segunda não renderiza sem aquela extensão instalada.

## Comentários no código

Comentário é para o que muda uma decisão: o ponto-chave do trecho, a armadilha, o
porquê. `// TODO` marca o que um módulo à frente resolve. Código errado só
aparece se vier acompanhado da versão correta logo abaixo.

## O que **não** entrar

- História do protocolo/biblioteca, salvo se explicar um comportamento estranho.
- Enumerar API completa — para isso existe a documentação oficial, com link.
- Três formas de fazer a mesma coisa. Mostre a recomendada; cite as outras em
  uma linha.
- Aviso genérico tipo "lembre-se de sempre testar". Ou é específico, ou sai.

## Exercícios — um por módulo

Todo módulo tem uma pasta `exercicios/NN-nome/`. É a parte que fixa o conteúdo:
ler código pronto dá sensação de aprendizado, escrever do zero mostra o que você
realmente sabe.

**Formato do `exercicios/NN-nome/README.md`:**

```markdown
# Exercício NN — Título

⏱️ ~30 min · 🎯 Nível: iniciante | intermediário | avançado

## Objetivo

Uma frase.

## O que construir

Requisitos numerados e verificáveis. Nada vago.

## Critérios de aceite

- [ ] Checklist do que precisa funcionar.

## Dicas

<details><summary>Dica 1</summary>Empurrão pequeno.</details>
<details><summary>Dica 2</summary>Empurrão maior.</details>

## Desafio extra

Opcional, para quem terminou rápido.
```

**Regras dos exercícios:**

| Regra               | Detalhe                                                                   |
| ------------------- | ------------------------------------------------------------------------- |
| Onde resolver       | Em `src/playground/`. O enunciado nunca manda editar `src/exemplos/`.     |
| Tamanho             | 20–45 min. Exercício de 3h vira projeto e ninguém termina.                |
| Critérios de aceite | Sempre verificáveis — "retorna 404 com `{ error }`", não "trate o erro".  |
| Dicas               | Progressivas e escondidas em `<details>`, para não entregar de graça.     |
| Solução             | Em `solucao/`, comentada explicando as decisões — não só o código pronto. |
| Progressão          | O exercício usa só o que já foi ensinado até aquele módulo.               |

A partir do módulo 03 os exercícios formam um **projeto contínuo** (uma API de
biblioteca: livros, autores, empréstimos, usuários), que cresce junto com o
currículo — no fim você tem uma API completa que construiu do zero, e não 20
exercícios soltos.
