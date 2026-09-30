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
