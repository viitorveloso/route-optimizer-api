# route-optimizer-api

![CI](https://github.com/SEU-USUARIO/route-optimizer-api/actions/workflows/ci.yml/badge.svg)
![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)
![Dependencies](https://img.shields.io/badge/dependencies-0-blue)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

API REST em **Node.js puro (zero dependências)** que resolve um problema real de logística: dada uma lista de paradas de entrega, **qual a melhor ordem de visita?**

Esse é o clássico **Problema do Caixeiro Viajante (TSP)** — um problema NP-difícil onde a solução exata explode fatorialmente. Este projeto implementa a resposta pragmática usada na indústria: heurística construtiva (**Nearest Neighbor**) refinada por busca local (**2-opt**), validada contra um solver exato (**força bruta**) nas instâncias pequenas onde isso é viável.

> **Contexto:** nasceu da minha experiência mantendo um sistema de vendas por rota (PHP/MySQL, ~61k linhas) para uma distribuidora real. Sequenciar entregas é um problema que eu vivo no dia a dia — aqui ele está isolado, resolvido e medido.

## Por que zero dependências?

O `package.json` deste projeto não tem **nenhuma** dependência. É uma escolha deliberada: tudo que normalmente vem "de graça" de um framework está implementado na mão, para ficar claro **como funciona por baixo**:

| Normalmente feito por... | Aqui implementado em... |
|---|---|
| Express (rotas, 404/405) | `src/router.js` (~50 linhas) |
| body-parser (JSON + limite de tamanho) | `src/http/parseBody.js` |
| Joi / Zod (validação) | `src/http/validate.js` |
| express-rate-limit | `src/infra/rateLimiter.js` (token bucket) |
| node-cache / Redis | `src/infra/lruCache.js` (LRU + TTL, O(1)) |
| Jest / Mocha | `node:test` nativo |
| Bull / fila externa | `node:worker_threads` |

## Algoritmos e complexidade

| Algoritmo | Complexidade | Papel |
|---|---|---|
| Força bruta | **O(n!)** | Verdade absoluta para n ≤ 10; valida a heurística em testes e benchmark |
| Nearest Neighbor | **O(n²)** | Constrói rota inicial gulosa: sempre vai à parada mais próxima |
| 2-opt | **O(n²)** por passada | Refina a rota "descruzando" arestas até atingir um ótimo local |
| Haversine | O(1) | Distância geográfica real entre coordenadas (sem lib de geo) |

Detalhes de implementação que valem leitura:

- O **2-opt avalia cada troca em O(1)**: compara só as 2 arestas removidas vs as 2 adicionadas, em vez de recalcular a rota inteira (`src/core/twoOpt.js`).
- A **força bruta gera permutações in-place** com swaps e backtracking — zero alocação de arrays por ramo (`src/core/bruteForce.js`).
- A **matriz de distâncias calcula só o triângulo superior** e espelha (distância é simétrica): metade das chamadas de haversine.
- O núcleo inteiro (`src/core/`) é feito de **funções puras** — sem I/O, sem estado global. É o que permite testá-lo sem mocks e rodá-lo num worker thread sem mudar uma linha.

## Benchmark (medido, reproduzível)

Pontos gerados por PRNG com seed fixa (mulberry32) dentro do bounding box de São Luís/MA — rode `npm run benchmark` e obtenha exatamente os mesmos números:

| n | Ordem original | NN+2opt | Economia | Ótimo (força bruta) | Gap | Tempo heurística | Tempo força bruta |
|---|---|---|---|---|---|---|---|
| 6 | 45,1 km | 28,4 km | 37,0% | 28,4 km | **0,00%** | 0,2 ms | 0,3 ms |
| 8 | 70,4 km | 32,8 km | 53,5% | 32,8 km | **0,00%** | <0,1 ms | 7,2 ms |
| 9 | 78,9 km | 33,3 km | 57,9% | 33,3 km | **0,00%** | <0,1 ms | 8,6 ms |
| 25 | 256,0 km | 79,6 km | 68,9% | — | — | 0,7 ms | inviável (25!) |
| 100 | 995,9 km | 159,5 km | 84,0% | — | — | 11,4 ms | inviável (100!) |
| 500 | 4.951,1 km | 332,6 km | 93,3% | — | — | 14,9 ms | inviável (500!) |

Leitura: nas instâncias onde o ótimo é verificável, a heurística **empata com a solução exata** — gastando milissegundos onde a força bruta já leva 100x mais. Em n=9 a força bruta avalia 40.320 permutações; em n=15 levaria horas. A heurística resolve **500 paradas em ~15 ms**.

## Arquitetura

```
src/
├── index.js              # entry point + graceful shutdown (SIGINT/SIGTERM)
├── server.js             # factory createApp(config): pipeline + error handler central
├── router.js             # router manual com 404 e 405 (Allow header)
├── config.js             # toda configuração via env, com defaults
├── core/                 # ★ lógica pura — zero I/O, zero estado global
│   ├── haversine.js
│   ├── distanceMatrix.js
│   ├── routeDistance.js
│   ├── nearestNeighbor.js
│   ├── twoOpt.js
│   ├── bruteForce.js
│   └── optimizer.js      # pipeline: matriz → NN → 2-opt → métricas
├── http/                 # parsing, validação e resposta
├── infra/                # rate limiter, cache LRU, dispatcher de workers
├── controllers/          # orquestração do endpoint /optimize
└── workers/              # entry point do worker thread
```

A separação `createApp(config)` (em `server.js`) vs `listen()` (em `index.js`) é o que permite aos testes de integração subir a aplicação **real** numa porta aleatória, com configuração customizada, sem subprocessos.

## Conceitos de back-end implementados na mão

**Rate limiting (token bucket)** — cada IP tem um balde com N tokens; cada request consome 1; tokens recarregam continuamente. Refill *lazy*: recalculado a partir do tempo decorrido a cada request, sem nenhum timer por balde. Excedeu → `429` com header `Retry-After`.

**Cache LRU com TTL** — chave = SHA-256 do payload canônico (só os campos que afetam o resultado). Construído sobre uma propriedade do `Map` do JavaScript: ele preserva ordem de inserção, então `delete + set` move a entrada pro fim (mais recente) e a primeira chave da iteração é sempre a LRU. `get` e `set` em **O(1)**. Resposta indica `X-Cache: HIT|MISS`.

**Worker threads** — Node é single-thread para JavaScript: um 2-opt de 500 paradas na main thread bloquearia o event loop e travaria até o `GET /health`. A partir de `WORKER_THRESHOLD` paradas (default 150), o cálculo vai para um worker thread e o servidor segue respondendo. Instâncias pequenas rodam inline — gastar ~10 ms criando uma thread para um cálculo de 1 ms não compensa. O campo `meta.computedIn` da resposta mostra onde rodou.

**Clock injetável** — rate limiter e cache recebem `now()` como parâmetro. Os testes de TTL e refill controlam o tempo deterministicamente, sem nenhum `sleep` na suíte.

**Outros detalhes:** limite de body verificado *durante* o streaming (rejeita `413` antes de bufferizar tudo); error handler central que nunca vaza stack trace (`500` genérico, erro real só no log); graceful shutdown com timeout de 5s; `405 Method Not Allowed` com header `Allow`.

## API

### `POST /optimize`

```bash
curl -X POST http://localhost:3000/optimize \
  -H "Content-Type: application/json" \
  -d @examples/sao-luis-stops.json
```

Payload: a **primeira parada é o ponto de partida** (depósito). Campos extras (como `name`) são preservados na resposta.

```json
{
  "stops": [
    { "id": "deposito", "name": "Depósito - Centro", "lat": -2.5297, "lng": -44.3028 },
    { "id": "c05", "name": "Cliente - Calhau", "lat": -2.4856, "lng": -44.2367 }
  ],
  "options": { "roundTrip": true }
}
```

Resposta real para o exemplo incluso (11 paradas em São Luís/MA):

```json
{
  "route": [
    { "position": 1, "id": "deposito", "name": "Depósito - Centro", "lat": -2.5297, "lng": -44.3028 },
    { "position": 2, "id": "c02", "name": "Cliente - São Francisco", "lat": -2.5052, "lng": -44.2906 }
  ],
  "distances": {
    "originalKm": 61.504,
    "optimizedKm": 53.679,
    "savedKm": 7.825,
    "improvementPercent": 12.72
  },
  "meta": {
    "stops": 11,
    "roundTrip": true,
    "algorithm": "nearest-neighbor + 2-opt",
    "elapsedMs": 0.73,
    "computedIn": "event-loop"
  }
}
```

Códigos de resposta: `200` ok · `400` JSON inválido ou body vazio · `404` rota inexistente · `405` método errado · `413` payload acima do limite · `422` validação (com lista completa de erros) · `429` rate limit (com `Retry-After`).

### `GET /health`

Liveness check: `{ "status": "ok", "uptimeSeconds": 42 }`

## Como rodar

Requisito único: **Node.js ≥ 20**. Não existe `npm install` — não há o que instalar.

```bash
node src/index.js        # ou: npm start
npm test                 # 64 testes (unitários + integração HTTP real)
npm run benchmark        # tabela comparativa dos algoritmos
```

Configuração via variáveis de ambiente (todas com default): `PORT`, `MAX_STOPS`, `MAX_BODY_BYTES`, `WORKER_THRESHOLD`, `WORKER_TIMEOUT_MS`, `RATE_LIMIT_CAPACITY`, `RATE_LIMIT_REFILL`, `CACHE_MAX_ENTRIES`, `CACHE_TTL_MS`.

## Testes

64 testes com o runner nativo (`node:test`), sem framework externo:

- **Unitários do núcleo:** propriedades matemáticas (simetria, diagonal zero), casos construídos com resposta conhecida, e a garantia central — *2-opt nunca piora uma rota e o ótimo exato nunca perde da heurística*.
- **Unitários de infra:** eviction do LRU, expiração por TTL e refill do rate limiter testados com **clock falso injetado** — suíte 100% determinística, zero sleeps.
- **Integração:** sobe o servidor real em porta aleatória e exercita a API por HTTP de verdade: contratos de status code, header `X-Cache` virando HIT, despacho para worker thread em instância grande, `429` com `Retry-After`.

## Decisões e trade-offs

- **Heurística vs exato:** TSP é NP-difícil; o ótimo garantido é inviável acima de ~10 paradas. NN+2-opt entrega resultado a poucos % do ótimo em milissegundos — e o benchmark *prova* isso em vez de assumir.
- **Worker por request, não pool:** mais simples e com isolamento total. Sob tráfego pesado constante, um pool fixo amortizaria o custo de spawn (~10 ms) — está documentado como evolução natural.
- **Cache em memória, não Redis:** zero dependências é o ponto do projeto. A interface (`get`/`set`) é a mesma; trocar a implementação por Redis não tocaria o controller.
- **Distância haversine, não malha viária:** o foco é o problema de *sequenciamento*. Plugar uma matriz do OSRM/Google é trocar a entrada — os algoritmos permanecem idênticos.

## Evoluções possíveis

Matriz de distâncias reais via OSRM · janelas de tempo por cliente (TSPTW) · múltiplos veículos (VRP) · pool fixo de workers · Or-opt e simulated annealing pós 2-opt.

## Licença

[MIT](LICENSE)
