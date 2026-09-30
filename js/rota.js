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
 * Se a JVI se mudar, muda-se AQUI e nesses três sítios — e não há
 * coordenada nenhuma neste ficheiro de propósito: sem API de
 * geocodificação não se obtém um lat/long de confiança, e uma
 * coordenada errada em produção manda o cliente para o mato. O Maps
 * resolve o endereço por si.
 */
export const MORADA_JVI = 'Av. 19 de Outubro, Terminal de Cargas Nº 113, Aeroporto de Maputo';

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
 * @param {string} [destino] endereço, já em texto simples
 * @param {string} [travelmode] `driving` (predefinido), `walking`, `bicycling` ou `transit`
 * @returns {string} URL completo
 */
export function linkDirecoes(destino = MORADA_JVI, travelmode = MODO_POR_OMISSAO) {
  const d = String(destino ?? '').trim();
  const modo = String(travelmode ?? '').trim() || MODO_POR_OMISSAO;
  return `https://www.google.com/maps/dir/?api=1`
    + `&destination=${encodeURIComponent(d || MORADA_JVI)}`
    + `&travelmode=${encodeURIComponent(modo)}`;
}
