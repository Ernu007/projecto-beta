/* =========================================================
   Desenha o mapa de Moçambique dentro da carta (SVG).
   Usa o mesmo contorno e as mesmas coordenadas do site, para
   o mapa da carta e o da landing page serem o mesmo.
   ========================================================= */
(function () {
  const LON_MIN = 28.4, LON_MAX = 41.0;
  const LAT_MIN = 10.4, LAT_MAX = 27.2;
  const L = 260, A = 430;

  const PAIS_LL = [
    [40.6, 11.0], [40.5, 12.5], [40.7, 14.5], [39.9, 16.2], [38.8, 16.5],
    [37.0, 17.2], [35.5, 16.5], [35.0, 15.5], [34.5, 14.0], [34.0, 13.4],
    [34.4, 12.7], [34.2, 12.0], [32.7, 11.2], [32.5, 12.2], [32.0, 13.0],
    [31.0, 13.6], [30.5, 14.5], [30.3, 15.6], [29.6, 16.5], [28.9, 17.6],
    [28.7, 18.5], [29.2, 20.0], [29.8, 21.2], [30.4, 22.4], [31.0, 23.4],
    [31.2, 24.4], [30.9, 25.0], [32.4, 25.9], [32.6, 25.9], [34.8, 24.0],
    [35.5, 22.0], [36.8, 20.0], [40.0, 16.5], [40.6, 14.0],
  ];

  const CIDADES_LL = [
    { nome: 'Palma',     lon: 40.5,  lat: 11.9, dx: 4,  dy: -5, align: 'start' },
    { nome: 'Pemba',     lon: 40.4,  lat: 13.0, dx: 4,  dy: 8,  align: 'start' },
    { nome: 'Lichinga',  lon: 35.4,  lat: 13.3, dx: -4, dy: -5, align: 'end' },
    { nome: 'Nampula',   lon: 39.3,  lat: 15.1, dx: 4,  dy: -5, align: 'start' },
    { nome: 'Quelimane', lon: 36.9,  lat: 17.9, dx: -4, dy: 10, align: 'end' },
    { nome: 'Tete',      lon: 33.6,  lat: 16.2, dx: -4, dy: 2,  align: 'end' },
    { nome: 'Beira',     lon: 34.8,  lat: 19.8, dx: -4, dy: 2,  align: 'end' },
    { nome: 'Chimoio',   lon: 37.1,  lat: 19.0, dx: 4,  dy: 10, align: 'start' },
    { nome: 'Xai-Xai',   lon: 33.9,  lat: 25.2, dx: 4,  dy: -6, align: 'start' },
    { nome: 'Matola',    lon: 32.5,  lat: 25.8, dx: -4, dy: 2,  align: 'end' },
    { nome: 'Maputo',    lon: 32.6,  lat: 25.0, hub: true },
  ];

  const px = (lon) => ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * L;
  const py = (lat) => ((lat - LAT_MIN) / (LAT_MAX - LAT_MIN)) * A;

  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  };

  const gPais = document.getElementById('mapaPais');
  const gRotas = document.getElementById('mapaRotas');
  const gCidades = document.getElementById('mapaCidades');
  const gNomes = document.getElementById('mapaNomes');
  const hubBrilho = document.getElementById('mapaHubBrilho');
  const hub = document.getElementById('mapaHub');
  if (!gPais || !gRotas || !gCidades || !gNomes) return;

  // contorno
  let d = '';
  PAIS_LL.forEach(([lon, lat], i) => {
    d += (i ? 'L' : 'M') + px(lon).toFixed(1) + ' ' + py(lat).toFixed(1) + ' ';
  });
  gPais.appendChild(el('path', {
    d: d + 'Z', fill: 'url(#g)', stroke: '#A9CF44', 'stroke-width': 1.4, 'stroke-linejoin': 'round',
  }));

  const hubC = CIDADES_LL.find((c) => c.hub);
  const hx = px(hubC.lon);
  const hy = py(hubC.lat);
  hub.setAttribute('cx', hx.toFixed(1));
  hub.setAttribute('cy', hy.toFixed(1));
  hubBrilho.setAttribute('cx', hx.toFixed(1));
  hubBrilho.setAttribute('cy', hy.toFixed(1));

  for (const c of CIDADES_LL) {
    const x = px(c.lon);
    const y = py(c.lat);
    if (!c.hub) {
      gRotas.appendChild(el('path', { d: `M${x.toFixed(1)} ${y.toFixed(1)} L${hx.toFixed(1)} ${hy.toFixed(1)}` }));
      gCidades.appendChild(el('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: 2.6 }));
    }
    const t = el('text', {
      x: (x + c.dx).toFixed(1),
      y: (y + c.dy).toFixed(1),
      'text-anchor': c.align || 'start',
    });
    t.textContent = c.nome;
    if (c.hub) t.setAttribute('fill', '#EA8240');
    gNomes.appendChild(t);
  }
})();
