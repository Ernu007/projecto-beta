/* =========================================================
   JVI Carga & Serviços — direcções para o terminal (Fase 7A)
   ------------------------------------------------------------
   A Fase 7 do briefing (BRIEFING-FASE7-GEOLOC.md) previa duas
   coisas: mostrar o caminho para a empresa (7A) e avisar a JVI
   quando o cliente está a chegar (7B).

   O cliente decidiu SEM API KEY do Google. A 7B fica DESACTIVADA —
   sem `duration_in_traffic` não há estimativa de tempo, e sem
   estimativa não há como saber se o cliente está a 5 minutos. Ver
   `docs/decisoes.md`.

   A 7A entrega-se sem key, com o link oficial de direcções do Google
   Maps, que é gratuito e não exige conta.

   Este módulo é PURO e não toca no `document`, para correr no runner
   de testes sem shim. E é importado só pelos testes: o `href` do
   botão está escrito à mão no `index.html` de propósito, para o link
   funcionar sem JavaScript e sem pedir consentimento a ninguém.
   `tests/rota.test.js` compara as duas cópias byte a byte — é o que
   impede o HTML de divergir daqui.
   ========================================================= */

/**
 * A morada da JVI, confirmada pelo cliente. É a mesma que o site já
 * usa na secção Contactos, no JSON-LD e na política de privacidade.
 *
 * Se a JVI se mudar, muda-se AQUI e nesses três sítios.
 *
 * A morada é para a PESSOA: é a etiqueta que o cliente lê no ecrã e nos
 * contactos. Já não é o destino do link — esse é o `PLUS_CODE_JVI`,
 * abaixo, que é para a máquina.
 */
export const MORADA_JVI = 'Av. 19 de Outubro, Terminal de Cargas Nº 113, Aeroporto de Maputo';

/**
 * A localização OFICIAL da JVI no Google Maps, em Plus Code. Foi o
 * cliente que a confirmou (3 de Outubro de 2026), e foi verificada a
 * resolver em https://www.google.com/maps/place/3H9C%2BVJ8,+Maputo/ nas
 * coordenadas -25.9303375, 32.5715781 — junto ao Aeroporto de Maputo,
 * coerente com a `MORADA_JVI`.
 *
 * É o destino do botão "Como chegar à JVI". O texto da morada deixava o
 * Google resolvê-la por si, e podia cair no aeroporto em geral em vez de
 * no terminal de cargas; o Plus Code aponta para o sítio exacto.
 *
 * O `+` TEM de ir no link como `%2B`: cru, o Maps lê-o como espaço e a
 * localização falha. É o `encodeURIComponent` de `linkDirecoes` que o
 * faz, e o `tests/rota.test.js` que o garante.
 */
export const PLUS_CODE_JVI = '3H9C+VJ8, Maputo';

/**
 * As coordenadas em que o `PLUS_CODE_JVI` foi verificado a resolver. NÃO
 * vão no link — o destino é o Plus Code, que é o que o cliente confirmou.
 * Servem o `geo` do JSON-LD, que o `tests/rota.test.js` confere daqui.
 */
export const COORDENADAS_JVI = { latitude: -25.9303375, longitude: 32.5715781 };

/** A JVI recebe carga por estrada: a rota útil é de carro. */
export const MODO_POR_OMISSAO = 'driving';

/**
 * Link de direcções do Google Maps, sem API key e sem tracking.
 *
 * O `origin` é deliberadamente OMITIDO. É ele que faria o Maps usar a
 * localização de quem clica — mas essa pergunta é feita pelo Google, no
 * consentimento do próprio utilizador, e o resultado não passa por nós.
 * Mandar `origin` era enviar a posição do cliente para o servidor do
 * Maps por nossa conta, e é exactamente o que a 7B faria com a 7B
 * desligada ninguém ganha nada. A única informação no link é o destino.
 *
 * @param {string} [destino] Plus Code ou endereço, em texto simples (por omissão, o `PLUS_CODE_JVI`)
 * @param {string} [travelmode] `driving` (predefinido), `walking`, `bicycling` ou `transit`
 * @returns {string} URL completo
 */
export function linkDirecoes(destino = PLUS_CODE_JVI, travelmode = MODO_POR_OMISSAO) {
  const d = String(destino ?? '').trim();
  const modo = String(travelmode ?? '').trim() || MODO_POR_OMISSAO;
  return `https://www.google.com/maps/dir/?api=1`
    + `&destination=${encodeURIComponent(d || PLUS_CODE_JVI)}`
    + `&travelmode=${encodeURIComponent(modo)}`;
}

/**
 * O percurso até à JVI, em passos com seta, para mostrar no ecrã junto
 * ao botão "Como chegar à JVI".
 *
 * NÃO É UMA ROTA CALCULADA, e é de propósito. O projecto tem três nomes
 * confirmados pelo cliente — os da `MORADA_JVI` — e o ponto de chegada
 * (`PLUS_CODE_JVI`), e mais nada: não tem cruzamentos e não sabe de onde
 * o cliente parte.
 * Por isso os passos vão do sítio maior para o mais pequeno (aeroporto,
 * avenida, terminal), todos com a seta de seguir em frente, e nenhum diz
 * para que lado se vira. Uma viragem à direita inventada manda metade
 * dos clientes para o lado errado; as viragens ficam para o Maps, que é
 * o que o botão abre.
 *
 * `local` tem de ser um pedaço literal da `MORADA_JVI`. O
 * `tests/percurso.test.js` verifica-o, e compara estes passos com os
 * que estão escritos à mão no `index.html`.
 */
export const PASSOS_PERCURSO = [
  { seta: '↑', texto: 'Siga para o', local: 'Aeroporto de Maputo' },
  { seta: '↑', texto: 'Siga pela', local: 'Av. 19 de Outubro' },
  { seta: 'chegada', texto: 'A JVI fica no', local: 'Terminal de Cargas Nº 113' },
];

/** O que o ecrã diz sobre o que os passos NÃO dizem. */
export const NOTA_PERCURSO = 'As viragens dependem de onde parte: o botão acima abre o caminho completo no Google Maps.';
