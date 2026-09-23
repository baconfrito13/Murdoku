# Maresia — onde surfar em Portugal

App web (PWA) para surfistas, bodyboarders, kiters, windsurfers, wingers e
praticantes de SUP em Portugal: diz **onde ir, a que horas e porquê**, spot a
spot, com previsão real hora a hora para os próximos 7 dias.

- **~65 spots** do Minho ao Algarve, Madeira e Açores, com orientação da praia,
  janela de ondulação, maré preferida, tipo de fundo, nível e perigos.
- **Notas de 0 a 10 por desporto e por nível** (iniciante → expert), com as
  razões por trás de cada nota.
- **Dados reais** da [Open-Meteo](https://open-meteo.com/) (ondulação primária
  e secundária, vaga, período, direção, vento e rajadas, temperatura da água e
  do ar, nível do mar para as marés), obtidos num só pedido para todos os spots.

## Ecrãs

| Ecrã | O que faz |
|---|---|
| **Agora** | Melhor spot para o teu desporto e nível agora, de manhã, à tarde ou noutro dia; o mar a animar-se com a altura, período, vento e sol reais; alternativas; resumo do mar em português; melhores janelas da semana. |
| **Mapa** | Mapa da costa (continente, Madeira, Açores) com os spots coloridos pela nota, setas de ondulação e vento, zoom/arrastar/pinça e uma barra de tempo que anima a semana inteira. |
| **Costa** | Toda a costa × toda a semana num quadro: melhor nota de manhã, meio-dia e tarde de cada dia, de norte para sul. |
| **Spots** | Pesquisa e filtros (região, tipo de onda, nível, distância). |
| **Spot** | Condições à hora escolhida, nota de cada desporto, porquê da nota, gráfico de 7 dias (nota, ondas, vento, maré) navegável, melhores janelas, bússola com a janela de ondulação e o vento terral, guia do spot, prancha/fato/tamanho de kite, sol e spots aqui perto. |
| **Favoritos** | Os teus spots com a semana à vista e a próxima boa janela. |

## Como funciona a nota

1. A ondulação ao largo (altura, período, direção) é filtrada pela **janela de
   exposição** do spot — ondulações de fora da janela só entram por refração,
   mais quanto maior o período — e pelo abrigo do spot (baías, molhes, o canhão
   da Nazaré amplifica).
2. Estima-se a **altura da onda na praia** (face), que depende do período.
3. O **vento** é classificado face à orientação da praia: terral, cruzado-terral,
   cruzado, cruzado-maral ou maral.
4. A **maré** vem da curva de nível do mar: preia-mar e baixa-mar, posição 0–1 e
   se está a encher ou a vazar.
5. Cada desporto combina estes fatores com o **teu nível** (tamanho ideal,
   spots só para avançados, vento que aguentas). No kite, windsurf e wing, vento
   terral é perigoso e dá zero.

As notas são estimativas a partir de modelos: confirma sempre no local.

## Correr

```bash
npx http-server -p 8080 surf     # → http://localhost:8080
```

Sem build nem dependências: HTML, CSS e ES modules. Funciona offline depois da
primeira visita (service worker + última previsão guardada no dispositivo).

```bash
node --test surf/tests/engine.test.mjs   # testes do motor e da base de spots
node surf/scripts/snapshot.mjs           # guarda a previsão atual em data/snapshot.json
node surf/scripts/build-single.mjs       # tudo num só HTML → surf/dist/maresia.html
node surf/scripts/build-geo.mjs          # regenera o mapa (Eurostat GISCO 1:1M)
```

Se a API estiver inacessível, a app usa a última previsão guardada no
dispositivo e, em último caso, o instantâneo incluído (com aviso de "arquivo").

## Créditos

Previsão: Open-Meteo.com (CC BY 4.0). Contornos da costa: © EuroGeographics /
Eurostat GISCO. Alturas de maré aproximadas ao zero hidrográfico — não usar
para navegação.
