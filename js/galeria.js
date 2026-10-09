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
   Carrossel automático (Fase 10B, 10B.6)
   ------------------------------------------------------------
   Uma fotografia de cada vez, a passar sozinha (2 s) em ciclo contínuo:
   o índice dá a volta no fim. Sem setas e sem botão de pausa — o cliente
   não os quer; a acessibilidade (WCAG 2.2.2) cumpre-se por gestos:

     - pausa com o rato por cima (só rato, não o "hover" emulado do toque),
     - pausa enquanto se toca / se segura o dedo,
     - pausa quando um elemento do carrossel recebe o foco do teclado,
     - pausa fora do ecrã (IntersectionObserver) e com o separador oculto,
     - com `prefers-reduced-motion: reduce` NÃO roda sozinho (mostra a
       primeira; o deslize com o dedo e as setas do teclado continuam).

   Só muda `data-estado` (e `inert`) dos itens: o CSS anima `opacity` e
   `transform`, sem layout. As fotografias não ativas ficam `inert`, para o
   teclado e os leitores de ecrã não passarem por cartões invisíveis.
   ========================================================= */
export const INTERVALO_MS = 2000;
const LIMITE_DESLIZE = 40; // px: abaixo disto é um toque, não um deslize

export function iniciarCarrossel(raiz) {
  const palco = raiz?.querySelector('[data-gal-pista]');
  if (!palco) return;
  const itens = [...palco.querySelectorAll('.gal__item')];
  if (itens.length < 2) return;

  const pontos = [...raiz.querySelectorAll('[data-gal-ponto]')];
  const contador = raiz.querySelector('[data-gal-contador]');
  const movimento = window.matchMedia('(prefers-reduced-motion: reduce)');
  let i = 0;
  let relogio = null;
  /* Razões para estar parado; o relógio só corre com todas a falso. */
  const pausa = { rato: false, toque: false, foco: false, fora: false };

  function ir(k) {
    i = (k + itens.length) % itens.length;
    itens.forEach((it, j) => {
      const activo = j === i;
      it.dataset.estado = activo ? 'ativo' : 'inactivo';
      it.toggleAttribute('inert', !activo);
    });
    pontos.forEach((p, j) => { if (j === i) p.dataset.estado = 'ativo'; else delete p.dataset.estado; });
    if (contador) contador.textContent = `${i + 1} / ${itens.length}`;
  }

  function parar() { clearInterval(relogio); relogio = null; }
  function arrancar() {
    parar();
    /* Fase 10D: roda SEMPRE, também com "reduzir movimento". No Android
       ("Remover animações", ligado em muitos telemóveis) o carrossel ficava
       parado na primeira foto, e o cliente quer que passe sozinho. O que o
       reduced-motion tira é a transição (galeria.css): a troca é instantânea. */
    if (document.hidden || Object.values(pausa).some(Boolean)) return;
    relogio = setInterval(() => ir(i + 1), INTERVALO_MS);
  }

  /* Rato: só o ponteiro de rato. No toque o browser emula mouseenter e ele
     ficava "preso" por cima. */
  palco.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { pausa.rato = true; parar(); } });
  palco.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { pausa.rato = false; arrancar(); } });

  /* Toque e deslize: segurar o dedo pára; um deslize horizontal muda de foto. */
  let inicio = null;
  let deslizou = false;
  palco.addEventListener('pointerdown', (e) => {
    inicio = { x: e.clientX, y: e.clientY };
    deslizou = false;
    if (e.pointerType !== 'mouse') { pausa.toque = true; parar(); }
  });
  const largar = (e) => {
    if (inicio && e.type === 'pointerup') {
      const dx = e.clientX - inicio.x;
      const dy = e.clientY - inicio.y;
      if (Math.abs(dx) >= LIMITE_DESLIZE && Math.abs(dx) > Math.abs(dy)) {
        deslizou = true;
        ir(i + (dx < 0 ? 1 : -1));
      }
    }
    inicio = null;
    pausa.toque = false;
    arrancar();
  };
  palco.addEventListener('pointerup', largar);
  palco.addEventListener('pointercancel', largar);
  /* Um deslize não é um clique: não abre a luzbox. (Captura: corre antes
     do clique do botão.) */
  palco.addEventListener('click', (e) => {
    if (deslizou) { e.preventDefault(); e.stopPropagation(); deslizou = false; }
  }, true);

  /* Teclado: o foco dentro do carrossel pára-o; ← → mudam de fotografia. */
  palco.addEventListener('focusin', () => { pausa.foco = true; parar(); });
  palco.addEventListener('focusout', () => { pausa.foco = false; arrancar(); });
  palco.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    ir(i + (e.key === 'ArrowRight' ? 1 : -1));
    /* O item activo mudou: o foco acompanha-o (o anterior ficou `inert`). */
    itens[i].focus();
  });

  /* Fora do ecrã e separador oculto. */
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => {
      pausa.fora = !e.isIntersecting;
      arrancar();
    }, { threshold: 0.35 }).observe(palco);
  }
  document.addEventListener('visibilitychange', arrancar);
  movimento.addEventListener?.('change', arrancar);

  ir(0);
  arrancar();
}
