/* =========================================================
   JVI Carga & Serviços — Luzbox da galeria
   ------------------------------------------------------------
   Acessível por construção: cada imagem é um <button>, por isso
   abre com Enter; o foco fica preso dentro do diálogo, ← → navegam
   e Escape fecha.
   ========================================================= */

export function iniciarGaleria(raiz, luz) {
  if (!raiz || !luz) return;
  const itens = [...raiz.querySelectorAll('[data-gal-src]')];
  if (!itens.length) return;

  const img = luz.querySelector('[data-luz-img]');
  const legenda = luz.querySelector('[data-luz-legenda]');
  const fechar = luz.querySelector('[data-luz-fechar]');
  const ant = luz.querySelector('[data-luz-ant]');
  const prox = luz.querySelector('[data-luz-prox]');
  const botoes = [fechar, ant, prox].filter(Boolean);
  let i = 0;
  let anterior = null;

  function mostrar(k) {
    i = (k + itens.length) % itens.length;
    const it = itens[i];
    img.src = it.dataset.galSrc;
    img.alt = it.dataset.galAlt || '';
    const legendaItem = it.querySelector('.gal__legenda');
    legenda.textContent = `${i + 1} de ${itens.length} · ${(legendaItem?.textContent || '').trim()}`;
  }

  function abrir(k) {
    anterior = document.activeElement;
    mostrar(k);
    luz.dataset.aberto = 'true';
    document.body.classList.add('modal-aberto');
    fechar?.focus();
  }

  function fecharLuz() {
    luz.dataset.aberto = 'false';
    document.body.classList.remove('modal-aberto');
    anterior?.focus();
  }

  itens.forEach((it, k) => it.addEventListener('click', () => abrir(k)));
  fechar?.addEventListener('click', fecharLuz);
  luz.querySelector('[data-luz-fundo]')?.addEventListener('click', fecharLuz);
  ant?.addEventListener('click', () => mostrar(i - 1));
  prox?.addEventListener('click', () => mostrar(i + 1));

  document.addEventListener('keydown', (e) => {
    if (luz.dataset.aberto !== 'true') return;
    if (e.key === 'Escape') { fecharLuz(); return; }
    if (e.key === 'ArrowLeft') { mostrar(i - 1); e.preventDefault(); return; }
    if (e.key === 'ArrowRight') { mostrar(i + 1); e.preventDefault(); return; }
    if (e.key !== 'Tab' || !botoes.length) return;
    const primeiro = botoes[0];
    const ultimo = botoes[botoes.length - 1];
    if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
  });
}

/* =========================================================
   Carrossel (Fase 8B, B7)
   ------------------------------------------------------------
   Uma fotografia de cada vez, a passar sozinha em ciclo contínuo:
   o índice dá a volta no fim em vez de parar na última.

   Só muda o `scrollLeft` da pista; o `scroll-snap` do CSS encaixa a
   fotografia. Pára com o rato por cima, com o foco lá dentro, com o
   separador escondido e com o botão de pausa (WCAG 2.2.2) — e nem
   arranca com `prefers-reduced-motion: reduce`.
   ========================================================= */
const INTERVALO_MS = 4500;

/** O índice da fotografia cujo início (`offsetLeft`) está mais perto do
 *  scroll actual. Era `scrollLeft / clientWidth`, que ignora o intervalo
 *  entre fotografias: o erro acumulava de cartão em cartão, e num ecrã de
 *  312px a penúltima fotografia já contava como a última. */
export function indiceMaisProximo(scrollLeft, inicios) {
  let melhor = 0;
  for (let k = 1; k < inicios.length; k += 1) {
    if (Math.abs(inicios[k] - scrollLeft) < Math.abs(inicios[melhor] - scrollLeft)) melhor = k;
  }
  return melhor;
}

export function iniciarCarrossel(raiz) {
  const pista = raiz?.querySelector('[data-gal-pista]');
  if (!pista) return;
  const itens = [...pista.querySelectorAll('.gal__item')];
  if (itens.length < 2) return;

  const contador = raiz.querySelector('[data-gal-contador]');
  const pausa = raiz.querySelector('[data-gal-pausa]');
  const movimento = window.matchMedia('(prefers-reduced-motion: reduce)');
  let i = 0;
  let relogio = null;
  let pausadoPeloUtilizador = movimento.matches;
  let pairado = false;

  function ir(k) {
    i = (k + itens.length) % itens.length;
    pista.scrollTo({ left: itens[i].offsetLeft, behavior: movimento.matches ? 'auto' : 'smooth' });
    if (contador) contador.textContent = `${i + 1} / ${itens.length}`;
  }

  function parar() { clearInterval(relogio); relogio = null; }
  function arrancar() {
    parar();
    if (pausadoPeloUtilizador || pairado || document.hidden || movimento.matches) return;
    relogio = setInterval(() => ir(i + 1), INTERVALO_MS);
  }

  function marcarPausa() {
    if (!pausa) return;
    pausa.setAttribute('aria-pressed', String(pausadoPeloUtilizador));
    pausa.setAttribute('aria-label', pausadoPeloUtilizador ? 'Retomar o carrossel' : 'Pausar o carrossel');
    pausa.querySelector('[data-ico-pausa]')?.toggleAttribute('hidden', pausadoPeloUtilizador);
    pausa.querySelector('[data-ico-play]')?.toggleAttribute('hidden', !pausadoPeloUtilizador);
  }

  raiz.querySelector('[data-gal-ant]')?.addEventListener('click', () => { ir(i - 1); arrancar(); });
  raiz.querySelector('[data-gal-prox]')?.addEventListener('click', () => { ir(i + 1); arrancar(); });
  pausa?.addEventListener('click', () => {
    pausadoPeloUtilizador = !pausadoPeloUtilizador;
    marcarPausa();
    arrancar();
  });

  /* Quem arrasta a pista à mão muda a fotografia: o índice acompanha,
     senão o próximo passo automático saltava para trás. */
  let fimScroll = null;
  pista.addEventListener('scroll', () => {
    clearTimeout(fimScroll);
    fimScroll = setTimeout(() => {
      i = indiceMaisProximo(pista.scrollLeft, itens.map((it) => it.offsetLeft));
      if (contador) contador.textContent = `${i + 1} / ${itens.length}`;
    }, 120);
  }, { passive: true });

  pista.addEventListener('mouseenter', () => { pairado = true; parar(); });
  pista.addEventListener('mouseleave', () => { pairado = false; arrancar(); });
  pista.addEventListener('focusin', () => { pairado = true; parar(); });
  pista.addEventListener('focusout', () => { pairado = false; arrancar(); });
  document.addEventListener('visibilitychange', arrancar);
  movimento.addEventListener?.('change', () => {
    if (movimento.matches) pausadoPeloUtilizador = true;
    marcarPausa();
    arrancar();
  });

  marcarPausa();
  arrancar();
}
