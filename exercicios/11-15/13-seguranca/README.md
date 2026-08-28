# Exercício 13 — Endurecendo a biblioteca

⏱️ ~40 min · 🎯 Nível: intermediário

> **Importante:**
> 🔒 Quase nenhuma feature nova. Você vai **corrigir vulnerabilidades reais** na
> API que já construiu — e escrever o teste que prova que cada uma foi fechada.
> Os testes do módulo 12 continuam tendo que passar.

## Objetivo

Aplicar as defesas do módulo 13 à API de biblioteca: headers, rate limit por
finalidade, IDOR, enumeração de usuário e path traversal.

## O que construir

Partindo da sua solução do módulo 12:

```
biblioteca/
├── app.ts                  # ← helmet, cors e os limitadores entram aqui
├── middlewares/
│   └── limites.ts          # ← NOVO: um limitador por finalidade
├── servicos/
│   └── emprestimos.ts      # ← corrigir a autorização por dono
├── controllers/
│   └── auth.ts             # ← corrigir a enumeração de usuário
└── testes/
    └── seguranca.test.ts   # ← cresce: um teste por vulnerabilidade fechada
```

### 1. Headers e origem

1. Ligue o `helmet()` **antes** das rotas.
2. Configure o `cors` com uma lista explícita de origens (nada de `'*'` junto
   com `credentials: true` — o navegador recusa a combinação).
3. Garanta que `x-powered-by` não aparece em nenhuma resposta.

### 2. Rate limit por finalidade

Crie **três** limitadores separados, cada um com o próprio balde:

| Limitador | Janela | Limite | Onde                                       |
| --------- | ------ | ------ | ------------------------------------------ |
| `login`   | 1 min  | 5      | `POST /auth/login`, `POST /auth/registrar` |
| `escrita` | 1 min  | 30     | `POST`, `PUT`, `PATCH`, `DELETE`           |
| `leitura` | 1 min  | 100    | `GET`                                      |

Use `standardHeaders: 'draft-8'` e `legacyHeaders: false`. Lembre do módulo 12:
o teste precisa poder **desligar** o rate limit
(`criarApp(deps, { rateLimit: false })`) — nunca afrouxe o limite de produção
para o teste caber.

### 3. IDOR nos empréstimos

Hoje `GET /emprestimos/:id` provavelmente devolve o empréstimo a qualquer
usuário autenticado. Corrija: só o **dono** ou um **admin** podem vê-lo, e a
resposta para quem não pode é **404**, não 403 (senão você confirma que o
recurso existe).

O mesmo vale para `POST /emprestimos/:id/devolver`.

### 4. Enumeração de usuário

No login, unifique as respostas: e-mail inexistente e senha errada devolvem
**exatamente** o mesmo status e o mesmo corpo. Faça também o trabalho de hash
acontecer nos dois caminhos, para o tempo de resposta não denunciar quem existe.

### 5. Path traversal

Se você tiver (ou criar) uma rota que serve arquivo por nome, resolva o caminho
e confirme que ele continua dentro da pasta permitida antes de responder.

### 6. Auditoria

Rode `npm audit --omit=dev` e registre no `README` da sua solução o que
encontrou e o que decidiu fazer — inclusive "nada, porque não roda no meu
contexto", se for o caso. A decisão registrada vale mais que o silêncio.

## Critérios de aceite

- [ ] `GET /livros` responde com `content-security-policy` e `x-content-type-options: nosniff`
- [ ] Nenhuma resposta traz `x-powered-by`
- [ ] `cors` aceita a origem listada e rejeita as demais
- [ ] 6 tentativas de login em 1 minuto → a 6ª responde `429`
- [ ] A resposta `429` traz `retry-after` e o corpo em JSON
- [ ] Navegar (`GET`) não consome a cota do login
- [ ] `GET /emprestimos/:id` de outro usuário → `404` (não 403, não 200)
- [ ] O mesmo empréstimo, pedido pelo dono → `200`
- [ ] Um admin consegue ver o empréstimo de qualquer pessoa
- [ ] Login com e-mail inexistente e login com senha errada → **mesmo** status e corpo
- [ ] `GET /arquivos/../../.env` → `400` (ou `404`), nunca o conteúdo
- [ ] Busca com `'; DROP TABLE livros; --` não altera o banco e responde `200`
- [ ] Os testes do módulo 12 continuam passando
- [ ] `npm run typecheck` limpo

## Dicas

<details><summary>Dica 1 — a ordem dos middlewares</summary>

`helmet()` e `cors()` precisam vir **antes** das rotas para valerem em todas
elas. Rate limit vai na rota (ou no grupo) que ele protege, não global — senão
todas as rotas dividem o mesmo balde.

</details>

<details><summary>Dica 2 — desligar o rate limit no teste</summary>

O mesmo padrão do módulo 12:

```ts
export function criarApp(deps: Deps, opcoes: { rateLimit?: boolean } = {}) {
  const usarLimite = opcoes.rateLimit ?? true;
  const talvez = (m: RequestHandler): RequestHandler =>
    usarLimite ? m : (_req, _res, next) => next();

  app.post('/auth/login', talvez(limites.login), controllers.login);
}
```

E um teste específico que liga o limite para provar que ele funciona.

</details>

<details><summary>Dica 3 — onde a autorização por dono mora</summary>

Não é no middleware. O middleware não sabe de quem é o empréstimo sem buscá-lo
no banco — e buscar é trabalho do service. Assinatura sugerida:

```ts
async buscarPorId(id: number, solicitante: { id: number; papel: Papel }) {
  const emp = await this.repo.buscarPorId(id);
  if (!emp) throw naoEncontrado('empréstimo não encontrado');
  const podeVer = emp.usuarioId === solicitante.id || solicitante.papel === 'admin';
  if (!podeVer) throw naoEncontrado('empréstimo não encontrado'); // MESMO erro
  return emp;
}
```

Repare que os dois caminhos lançam o **mesmo** erro. É de propósito.

</details>

<details><summary>Dica 4 — tempo constante no login</summary>

O problema: `if (!usuario) return 401` responde em ~1ms, e o caminho com Argon2
leva ~200ms. Cronometrando, dá para saber quem é cliente.

Guarde um hash descartável no boot e verifique contra ele quando o usuário não
existir, para os dois caminhos custarem o mesmo:

```ts
const HASH_DESCARTAVEL = await argon2.hash(randomUUID());
const confere = usuario
  ? await argon2.verify(usuario.senhaHash, senha)
  : (await argon2.verify(HASH_DESCARTAVEL, senha), false);
```

</details>

<details><summary>Dica 5 — testar header é fácil, testar 429 tem pegadinha</summary>

```ts
it('bloqueia na 6ª tentativa', async () => {
  const app = criarApp(deps, { rateLimit: true }); // ligado SÓ neste teste
  for (let i = 0; i < 5; i++) {
    await request(app).post('/auth/login').send({ email: 'a@b.c', senha: 'x' });
  }
  const r = await request(app).post('/auth/login').send({ email: 'a@b.c', senha: 'x' });
  expect(r.status).toBe(429);
});
```

A pegadinha: o balde é do **processo**. Se dois testes usarem limitadores que
compartilham estado, o segundo começa com a cota já gasta. Crie o app (e o
limitador) dentro do teste, não no escopo do arquivo.

</details>

<details><summary>Dica 6 — provar que o path traversal foi barrado</summary>

Teste com o caminho codificado também (`%2e%2e%2f`), não só com `../`. Se a sua
checagem for feita na string crua antes de resolver, a versão codificada passa —
e é exatamente esse o bug.

</details>

<details><summary>Dica 7 — o teste que prova a não-enumeração</summary>

```ts
const a = await request(app)
  .post('/auth/login')
  .send({ email: 'nao@existe.com', senha: 'x' });
const b = await request(app)
  .post('/auth/login')
  .send({ email: usuarioReal.email, senha: 'errada' });
expect(a.status).toBe(b.status);
expect(a.body).toEqual(b.body); // corpo idêntico, não "parecido"
```

</details>

## Desafio extra

Escreva um teste que **falha hoje** contra a sua API antiga (a do módulo 12,
antes das correções) e passa depois — commitando os dois estados. É a melhor
forma de provar que a vulnerabilidade era real, e não teórica.

Se quiser ir além: meça o tempo de resposta do login com e-mail existente e
inexistente, 20 vezes cada, e compare as médias antes e depois da correção de
tempo constante. O número é mais convincente que o argumento.

---

Terminou? Compare com [`solucao/`](./solucao/).
