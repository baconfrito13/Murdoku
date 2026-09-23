// "Definições": rider profile (level per sport, weight), home city, units,
// theme, data status, how scores work, glossary and credits.

import { HOMES, levelOf, load, setLevel, setPref, SPORTS, state } from '../core.js';
import { LEVELS, rating } from '../model.js';
import { fmtAgo, store } from '../util.js';
import { icon } from '../icons.js';
import { scoreClass, toast } from './components.js';

const GLOSSARY = [
  ['Ondulação (swell)', 'Ondas formadas longe, por tempestades no Atlântico. Chegam organizadas, em séries. É o que faz as boas ondas.'],
  ['Vaga (mar de vento)', 'Ondas curtas levantadas pelo vento local. Deixam o mar picado e desarrumado.'],
  ['Período', 'Segundos entre duas ondas. Acima de 12 s há força e ondas limpas; abaixo de 8 s é mar fraco.'],
  ['Terral (offshore)', 'Vento que sopra da terra para o mar. Alisa a parede da onda — o sonho de qualquer surfista.'],
  ['Maral (onshore)', 'Vento do mar para terra. Desfaz as ondas e deixa-as moles. Para kite, é seguro mas difícil de sair.'],
  ['Cruzado (cross-shore)', 'Vento paralelo à praia. Aceitável para surf se fraco; ideal para kite e windsurf.'],
  ['Nortada', 'Vento norte forte das tardes de verão na costa oeste. Estraga o surf à tarde e faz a festa do kite no Guincho e em Viana.'],
  ['Beach break', 'Onda que rebenta em bancos de areia. Muda com as marés e os temporais.'],
  ['Reef / laje', 'Onda sobre fundo de pedra. Mais consistente e potente — e mais perigosa.'],
  ['Point break', 'Onda que corre ao longo de uma ponta ou cabo. Longas direitas ou esquerdas.'],
  ['Shorebreak', 'Onda que rebenta mesmo na areia. Diversão para o bodyboard, perigo para o resto.'],
  ['Preia-mar / baixa-mar', 'Maré cheia / maré vazia. Cada spot tem a sua maré preferida — vê em “O spot”.'],
];

export function mount(el) {
  function render() {
    const p = state.prefs;
    const geoOk = typeof navigator !== 'undefined' && 'geolocation' in navigator;
    el.innerHTML = `<div class="settings">
      <div class="section-head" style="margin-top:4px"><h1 class="section-title" style="font-size:34px">Definições</h1></div>

      <section class="set-group"><h2>O teu perfil</h2><div class="card">
        ${SPORTS.map((s) => `<div class="set-row"><label for="lvl-${s.id}">${s.name}</label>
          <select id="lvl-${s.id}" data-level="${s.id}">${LEVELS.map((l) => `<option value="${l.id}" ${l.id === levelOf(s.id) ? 'selected' : ''}>${l.name}</option>`).join('')}</select></div>`).join('')}
        <div class="set-row"><label for="weight">Peso<small>Para o tamanho de kite, vela e wing</small></label>
          <input id="weight" type="number" min="35" max="130" step="1" value="${p.weight}" inputmode="numeric" style="width:120px"> </div>
      </div></section>

      <section class="set-group"><h2>De onde partes</h2><div class="card">
        <div class="set-row"><label for="home">Cidade<small>Mostra tempos de viagem e filtra por distância</small></label>
          <select id="home"><option value="">— nenhuma —</option>${HOMES.map((h) => `<option value="${h.id}" ${p.home?.name === h.name ? 'selected' : ''}>${h.name}</option>`).join('')}${p.home && !HOMES.some((h) => h.name === p.home.name) ? `<option value="custom" selected>${p.home.name}</option>` : ''}</select></div>
        ${geoOk ? `<div class="set-row"><span class="lbl">Localização atual<small>Usada só neste dispositivo</small></span><button type="button" class="btn btn-sm" data-geo>${icon('locate', { size: 16 })} Usar</button></div>` : ''}
      </div></section>

      <section class="set-group"><h2>Unidades e aspeto</h2><div class="card">
        <div class="set-row"><label for="hunit">Altura das ondas</label><select id="hunit"><option value="m" ${p.hUnit === 'm' ? 'selected' : ''}>Metros</option><option value="ft" ${p.hUnit === 'ft' ? 'selected' : ''}>Pés</option></select></div>
        <div class="set-row"><label for="wunit">Vento</label><select id="wunit"><option value="kn" ${p.wUnit === 'kn' ? 'selected' : ''}>Nós</option><option value="kmh" ${p.wUnit === 'kmh' ? 'selected' : ''}>km/h</option><option value="ms" ${p.wUnit === 'ms' ? 'selected' : ''}>m/s</option></select></div>
        <div class="set-row"><label for="theme">Tema</label><select id="theme"><option value="auto" ${p.theme === 'auto' ? 'selected' : ''}>Automático</option><option value="light" ${p.theme === 'light' ? 'selected' : ''}>Claro</option><option value="dark" ${p.theme === 'dark' ? 'selected' : ''}>Escuro</option></select></div>
      </div></section>

      <section class="set-group"><h2>Dados</h2><div class="card">
        <div class="set-row"><span class="lbl">Previsão<small>${state.fc ? `Obtida ${fmtAgo(state.fc.fetchedAt)} · ${state.source === 'live' ? 'ao vivo' : state.source === 'cache' ? 'guardada' : 'instantâneo'}` : 'Sem dados'}</small></span><button type="button" class="btn btn-sm" data-refresh>${icon('refresh', { size: 16 })} Atualizar</button></div>
        <div class="set-row"><span class="lbl">Repor preferências<small>Favoritos, níveis e unidades voltam ao início</small></span><button type="button" class="btn btn-sm" data-reset>Repor</button></div>
      </div></section>

      <section class="set-group"><h2>Como funcionam as notas</h2><div class="card pad about">
        <p>Para cada spot e cada hora, a Maresia pega na ondulação ao largo (altura, período e direção), calcula quanto dela entra no spot pela sua janela de exposição e abrigo, e estima a altura da onda na praia. Depois cruza com o vento em relação à orientação da praia (terral, cruzado, maral), a maré preferida do spot e o teu nível.</p>
        <p style="margin-top:8px">No kite, windsurf e wing conta sobretudo a força e direção do vento (vento terral é perigoso e dá nota zero); no SUP, a calma. A nota vai de 0 a 10:</p>
        <div class="legend-row" style="margin-top:10px">${[0, 2, 4, 6, 7.5, 9].map((v) => `<span class="item"><span class="score xs ${scoreClass(v)}" aria-hidden="true">${Math.round(v)}</span>${rating(v).name}</span>`).join('')}</div>
        <p style="margin-top:10px">As notas são estimativas a partir de modelos. Confirma sempre as condições no local, respeita a sinalização e os nadadores-salvadores, e nunca entres sozinho em mar grande.</p>
      </div></section>

      <section class="set-group"><h2>Glossário</h2><div class="card">
        ${GLOSSARY.map(([t, d]) => `<div class="set-row" style="display:block"><b>${t}</b><small style="margin-top:2px;font-size:13.5px">${d}</small></div>`).join('')}
      </div></section>

      <section class="set-group"><h2>Sobre</h2><div class="card pad about">
        <p><b>Maresia</b> — onde surfar em Portugal. Previsão hora a hora de ondulação, vento, temperatura da água e marés: <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo.com</a> (CC BY 4.0). Contornos da costa: © EuroGeographics / Eurostat GISCO. Alturas de maré aproximadas ao zero hidrográfico — não usar para navegação.</p>
      </div></section>
    </div>`;
  }

  el.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.level) {
      setLevel(t.dataset.level, +t.value);
      toast('Nível atualizado');
    } else if (t.id === 'weight') {
      const w = Math.max(35, Math.min(130, Math.round(+t.value || 75)));
      setPref('weight', w);
    } else if (t.id === 'home') {
      const h = HOMES.find((x) => x.id === t.value);
      setPref('home', h ? { name: h.name, lat: h.lat, lon: h.lon } : null);
    } else if (t.id === 'hunit') setPref('hUnit', t.value);
    else if (t.id === 'wunit') setPref('wUnit', t.value);
    else if (t.id === 'theme') setPref('theme', t.value);
  });

  el.addEventListener('click', async (e) => {
    if (e.target.closest('[data-refresh]')) {
      toast('A atualizar a previsão…');
      await load(true);
      toast(state.source === 'live' ? 'Previsão atualizada' : 'Sem ligação — a usar dados guardados');
      render();
      return;
    }
    if (e.target.closest('[data-reset]')) {
      store.del('maresia.prefs.v1');
      toast('Preferências repostas — a recarregar');
      setTimeout(() => location.reload(), 600);
      return;
    }
    if (e.target.closest('[data-geo]')) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setPref('home', { name: 'A minha localização', lat: pos.coords.latitude, lon: pos.coords.longitude });
          toast('Localização guardada neste dispositivo');
          render();
        },
        () => toast('Não foi possível obter a localização — escolhe uma cidade'),
        { timeout: 10000, maximumAge: 600000 },
      );
    }
  });

  render();
  return {
    update(what) {
      if (['data', 'level', 'prefs'].includes(what)) {
        const active = document.activeElement?.id;
        render();
        if (active) document.getElementById(active)?.focus();
      }
    },
  };
}
