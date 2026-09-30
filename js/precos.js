/* =========================================================
   JVI Carga & Serviços — Cálculo do preço de transporte
   ------------------------------------------------------------
   Regra confirmada pelo cliente:

     ATÉ 10 kg      -> 3 000 MT base
     ACIMA DE 10 kg -> 255 MT por kg
     IVA            -> 16%

   O PISO de 3 000 MT é obrigatório. Sem ele a fórmula quebra
   entre 10 e 12 kg (aos 11 kg dava 2 805 MT, menos que aos 10 kg,
   que dá 3 000 MT) e o cliente passava a ver "quanto maior o
   peso, menos se paga". O piso garante monotonia: o total é uma
   função não-decrescente do peso.

   Módulo puro, sem DOM: é importado pelo browser e pelo runner
   de testes em Node sem adaptar nada.
   ========================================================= */

export const PESO_LIMITE = 10;
export const PISO_BASE = 3000;
export const TARIFA_KG = 255;
export const IVA = 0.16;

/* Arredonda ao metical. Assim o total é sempre a soma exacta
   das partes (base + iva), que é o que o cliente vê no resumo. */
const mt = (n) => Math.round(n);

/**
 * Calcula o orçamento de uma carga.
 *
 * Aceita número ou string; numa string aceita vírgula decimal
 * ("11,7"), que é como o teclado local escreve.
 *
 * @param {number|string} peso - peso em kg
 * @returns {{peso:number, base:number, iva:number, total:number,
 *            aplicadoPiso:boolean}|null}
 *   null quando o peso não é um número finito maior que zero.
 */
export function calcularPreco(peso) {
  const brutoPeso = typeof peso === 'string' ? peso.trim().replace(',', '.') : peso;
  const kg = Number(brutoPeso);
  if (!Number.isFinite(kg) || kg <= 0) return null;

  const tarifado = kg <= PESO_LIMITE ? PISO_BASE : kg * TARIFA_KG;
  const base = mt(Math.max(tarifado, PISO_BASE)); // <-- piso
  const iva = mt(base * IVA);

  return {
    peso: kg,
    base,
    iva,
    total: base + iva,
    aplicadoPiso: tarifado < PISO_BASE,
  };
}

/**
 * "3 480 MT" — espaço de milhares, sem decimais, como se escreve
 * um preço em Moçambique. Implementado à mão (e não com Intl)
 * para o resultado ser determinístico no teste.
 */
export function formatarMT(valor) {
  const n = Math.round(Number(valor) || 0);
  const negativo = n < 0;
  const digitos = String(Math.abs(n));
  let saida = '';
  for (let i = 0; i < digitos.length; i += 1) {
    if (i > 0 && (digitos.length - i) % 3 === 0) saida += ' ';
    saida += digitos[i];
  }
  return `${negativo ? '-' : ''}${saida} MT`;
}
