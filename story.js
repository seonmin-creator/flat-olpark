// FLAT BUS 올팍 — 스크롤 스토리 모션
// 장면(.sc)마다 sticky 무대를 두고, 장면의 스크롤 진행도 p(0~1)로 모든 움직임을 계산합니다.
(function () {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const lerp = (a, b, t) => a + (b - a) * t;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const navH = () => $('.nav').offsetHeight;

  const scenes = $$('.sc');
  scenes.forEach((s) => s.style.setProperty('--len', s.dataset.len));

  // ---------- 글자 하나씩 (제목) ----------
  $$('.letters').forEach((h) => {
    let i = 0;
    h.innerHTML = h.dataset.text.split('|').map((ln, li) =>
      `<span class="${li ? 'l2' : ''}" aria-hidden="true" style="display:block;opacity:1;transform:none;filter:none;animation:none">` +
      [...ln].map((ch) => `<span style="animation-delay:${(0.1 + 0.04 * i++).toFixed(2)}s">${ch === ' ' ? '&nbsp;' : ch}</span>`).join('') + '</span>').join('');
  });

  // ---------- 스크롤에 따라 단어가 또렷해짐 ----------
  $$('.words').forEach((el) => {
    const toks = el.textContent.trim().split(/\s+/);
    el.innerHTML = toks.map((w) => (w === '|' ? '<br>' : `<span class="${w.startsWith('*') ? 'hot' : ''}">${w.replace(/^\*/, '')}</span>`)).join(' ');
    el._spans = $$('span', el); el._from = +el.dataset.from; el._to = +el.dataset.to;
  });
  function words(el, p) {
    const n = el._spans.length, step = (el._to - el._from) / n;
    el._spans.forEach((s, i) => {
      const t = clamp((p - (el._from + step * i)) / (step * 2));
      s.style.opacity = (0.12 + 0.88 * t).toFixed(3);
      s.style.transform = `translateY(${(16 * (1 - t)).toFixed(1)}px)`;
      s.style.filter = `blur(${(6 * (1 - t)).toFixed(2)}px)`;
    });
  }
  function counters(scene, p) {
    $$('[data-count]', scene).forEach((b) => {
      const v = +b.dataset.count * smooth(+b.dataset.from, +b.dataset.to, p);
      b.textContent = Math.round(v).toLocaleString('ko-KR');
    });
    $$('.reveal-at', scene).forEach((e) => e.classList.toggle('in', p >= +e.dataset.at));
  }

  // ---------- 시작: 밤의 정류장 ----------
  const crowd = $('#crowd');
  const CROWD = 110;
  {
    let html = '';
    for (let i = 0; i < CROWD; i++) {
      const x = 150 + ((i * 53) % 300) + ((i * 7) % 11);
      const y = 318 + ((i * 29) % 40);
      html += `<g opacity="0"><circle cx="${x}" cy="${y - 12}" r="5.5"/><rect x="${x - 5}" y="${y - 6}" width="10" height="13" rx="4" fill="#93c5fd"/></g>`;
    }
    crowd.innerHTML = html;
  }
  const crowdEls = [...crowd.children];
  const heroCopy = $('.hero-copy'), heroCard = $('.hero-card'), heroCap = $('.hero-cap'), heroBus = $('#heroBus');
  function hero(p) {
    heroCopy.style.opacity = (1 - smooth(0, 0.35, p)).toFixed(3);
    heroCopy.style.transform = `translateY(${(-12 * smooth(0, 0.5, p)).toFixed(2)}vh) scale(${(1 - 0.14 * smooth(0, 0.5, p)).toFixed(3)})`;
    heroCard.style.setProperty('--k', (1 - smooth(0, 0.55, p)).toFixed(4));
    heroCap.style.opacity = smooth(0.6, 0.8, p).toFixed(3);
    heroCap.style.transform = `translateY(${(40 * (1 - smooth(0.6, 0.8, p))).toFixed(1)}px)`;
    const n = Math.round(CROWD * smooth(0.2, 0.7, p));
    crowdEls.forEach((g, i) => g.setAttribute('opacity', i < n ? '1' : '0'));
    heroBus.setAttribute('transform', `translate(${lerp(820, 490, smooth(0.62, 0.95, p)).toFixed(1)} 0)`);
  }

  // ---------- 현실: 사람 점 ----------
  const people = $('#people');
  const PEOPLE = 150;
  people.innerHTML = '<i></i>'.repeat(PEOPLE);
  const peopleEls = [...people.children];
  function real(p) {
    const on = Math.round(PEOPLE * smooth(0.02, 0.4, p));
    const bus = Math.round(PEOPLE * 0.06 * smooth(0.45, 0.8, p));
    peopleEls.forEach((c, i) => {
      c.classList.toggle('on', i < on);
      c.classList.toggle('bus', (i * 37) % PEOPLE < bus);
    });
  }

  // ---------- 원인: 쌓이는 카드 ----------
  const cards = $$('.ccard');
  const ARRIVE = [0, 0.32, 0.64];
  function cause(p) {
    cards.forEach((c, k) => {
      const a = ARRIVE[k];
      const t = k === 0 ? 1 : smooth(a - 0.22, a, p);
      const shrink = ARRIVE.slice(k + 1).reduce((s, b) => s + smooth(b - 0.22, b, p), 0);
      const scale = 1 - 0.06 * shrink;
      c.style.transform = `translateY(${(120 * (1 - t) + shrink * -14).toFixed(1)}%) rotate(${(10 * (1 - t)).toFixed(2)}deg) scale(${scale.toFixed(3)})`;
      c.style.filter = `brightness(${(1 - shrink * 0.06).toFixed(3)})`;
      c.style.zIndex = k + 1;
    });
  }

  // ---------- 원리: 정류장마다 더하고 빼기 (PPT 계산법) ----------
  const CAP = 60;
  const STOPS = [
    { nm: '천호역', on: 7, off: 0 },
    { nm: '강동구청', on: 5, off: 1 },
    { nm: '성내역', on: 4, off: 2 },
    { nm: '올림픽공원', on: 5, off: 2, ev: 40, park: true },
    { nm: '몽촌토성역', on: 2, off: 3 },
    { nm: '잠실역', on: 5, off: 4 },
  ];
  let acc = 0, base = 0;
  STOPS.forEach((s) => { acc += s.on - s.off + (s.ev || 0); base += s.on - s.off; s.load = acc; s.base = base; });
  const stopsBox = $('#calcStops');
  stopsBox.innerHTML = STOPS.map((s, i) => `<div class="stopx${s.park ? ' park' : ''}" style="left:${(i / (STOPS.length - 1)) * 100}%"><div class="dot"></div><div class="nm">${s.nm}</div>
    <div class="chg"><span class="p">+${s.on}</span> <span class="m">−${s.off}</span>${s.ev ? `<span class="e">+${s.ev} 공연 관객</span>` : ''}</div></div>`).join('');
  const stopEls = $$('.stopx', stopsBox);
  const miniBus = $('#miniBus'), roadFill = $('#roadFill'), loadNum = $('#loadNum'), loadPill = $('#loadPill');
  const meterFill = $('#meterFill'), meterGhost = $('#meterGhost'), meterNote = $('#meterNote'), formula = $('.formula-big');
  const LV = [[0.5, 'lv0', '여유', '#22c55e'], [0.8, 'lv1', '보통', '#eab308'], [1.0, 'lv2', '혼잡', '#f97316'], [9, 'lv3', '매우 혼잡', '#ef4444']];
  const lvOf = (c) => LV.find((l) => c < l[0]);
  function calc(p) {
    const q = smooth(0.06, 0.88, p) * (STOPS.length - 1);
    const reached = Math.floor(q + 0.02);
    miniBus.style.left = `calc(var(--rm) + (100% - 2 * var(--rm)) * ${(q / (STOPS.length - 1)).toFixed(4)})`;
    roadFill.style.width = `${(q / (STOPS.length - 1)) * 100}%`;
    stopEls.forEach((e, i) => e.classList.toggle('on', i <= reached));
    const s = STOPS[clamp(reached, 0, STOPS.length - 1)];
    const load = s.load;
    loadNum.textContent = load;
    const lv = lvOf(load / CAP);
    loadPill.className = `pill ${lv[1]}`; loadPill.textContent = lv[2];
    meterFill.style.width = `${Math.min(100, (load / CAP) * 100)}%`; meterFill.style.background = lv[3];
    const atPark = STOPS.findIndex((x) => x.park) <= reached;
    formula.classList.toggle('ev', atPark);
    meterGhost.style.opacity = atPark ? 1 : 0;
    meterGhost.style.width = `${(s.base / CAP) * 100}%`;
    meterNote.innerHTML = atPark
      ? `공연이 끝난 관객 <b style="color:#ea580c">+40명</b> — 평소라면 ${s.base}명(점선)이지만 오늘은 <b>${load}명</b>`
      : `교통카드 승하차 데이터로 계산 · 정류장 ${reached + 1}/${STOPS.length}`;
  }

  // ---------- 데이터: 두 데이터가 만남 ----------
  const srcL = $('.src-l'), srcR = $('.src-r'), core = $('#core'), mergeOut = $('#mergeOut');
  const linkPaths = $$('.links path');
  function data(p) {
    const t = smooth(0, 0.5, p);
    const wide = innerWidth > 900;
    srcL.style.transform = wide ? `translateX(${lerp(-8, 0, t).toFixed(2)}vw)` : `translateY(${lerp(30, 0, t).toFixed(1)}px)`;
    srcR.style.transform = wide ? `translateX(${lerp(8, 0, t).toFixed(2)}vw)` : `translateY(${lerp(30, 0, t).toFixed(1)}px)`;
    srcL.style.opacity = srcR.style.opacity = lerp(0.35, 1, t).toFixed(3);
    const d = smooth(0.25, 0.55, p);
    linkPaths.forEach((pth) => { pth.style.opacity = d.toFixed(3); pth.style.strokeDashoffset = `${(-60 * p).toFixed(1)}`; });
    const c = smooth(0.45, 0.65, p);
    const pop = c < 1 ? c * (1 + 0.25 * Math.sin(Math.PI * c)) : 1;
    core.style.transform = `scale(${pop.toFixed(3)}) rotate(${(-120 * (1 - c)).toFixed(1)}deg)`;
    mergeOut.classList.toggle('in', p > 0.66);
  }

  // ---------- 사용법: 단계 카드 ----------
  const steps = $$('.step');
  const STEP_AT = [0.08, 0.36, 0.64];
  function stepsFn(p) {
    let cur = -1;
    steps.forEach((s, k) => { const on = p >= STEP_AT[k]; s.classList.toggle('in', on); if (on) cur = k; });
    steps.forEach((s, k) => s.classList.toggle('cur', k === cur));
  }
  // 마우스를 따라 살짝 기울어지는 카드
  steps.forEach((s) => {
    s.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || !s.classList.contains('in')) return;
      const r = s.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      s.style.transform = `perspective(900px) rotateX(${(-y * 9).toFixed(2)}deg) rotateY(${(x * 9).toFixed(2)}deg)`;
    });
    s.addEventListener('pointerleave', () => { s.style.transform = ''; });
  });
  // 포인터를 따라 끌려오는 버튼
  $$('.magnet').forEach((b) => {
    b.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const r = b.getBoundingClientRect();
      b.style.transform = `translate(${((e.clientX - r.left - r.width / 2) * 0.3).toFixed(1)}px, ${((e.clientY - r.top - r.height / 2) * 0.3).toFixed(1)}px)`;
    });
    b.addEventListener('pointerleave', () => { b.style.transform = ''; });
  });

  const UPDATE = {
    '시작': hero,
    '질문': (p, s) => words($('.words', s), p),
    '현실': (p, s) => { counters(s, p); real(p); },
    '원인': cause,
    '원리': calc,
    '데이터': data,
    '사용법': stepsFn,
    '비전': (p, s) => { words($('.words', s), p); counters(s, p); },
  };

  // ---------- 배경 모핑 도형 ----------
  const N = 72;
  const polar = (r) => Array.from({ length: N }, (_, k) => { const a = (k / N) * Math.PI * 2 - Math.PI / 2; const d = r(a); return [d * Math.cos(a), d * Math.sin(a)]; });
  const SHAPES = [
    polar((a) => 70 / (Math.abs(Math.cos(a)) ** 5 + Math.abs(Math.sin(a) * 1.5) ** 5) ** 0.2),   // 버스 모양
    polar((a) => 60 + 14 * Math.sin(2 * a + 0.6) + 5 * Math.cos(6 * a)),
    polar((a) => 62 + 10 * Math.sin(8 * a)),
    polar((a) => 64 + 10 * Math.sin(3 * a) + 6 * Math.cos(5 * a + 1)),
    polar((a) => 40 + 36 * Math.cos(a) ** 2),
    polar(() => 70),
    polar((a) => 66 + 8 * Math.sin(5 * a)),
    polar((a) => 70 / (Math.abs(Math.cos(a)) ** 4 + Math.abs(Math.sin(a)) ** 4) ** 0.25),
  ];
  const PLACES = [
    { x: 0, y: -4, s: 1.2, o: 0.9 }, { x: -24, y: 2, s: 0.9, o: 0.8 }, { x: 26, y: 4, s: 0.95, o: 0.75 }, { x: 28, y: 6, s: 1, o: 0.7 },
    { x: 0, y: 8, s: 1.3, o: 0.55 }, { x: 0, y: 0, s: 1.15, o: 0.7 }, { x: -28, y: 8, s: 0.95, o: 0.7 }, { x: 0, y: 0, s: 1.2, o: 0.8 },
  ];
  function toPath(pts) {
    const f = (p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
    let d = `M${f(pts[0])}`;
    for (let i = 0; i < pts.length; i++) {
      const p0 = pts[(i - 1 + pts.length) % pts.length], p1 = pts[i], p2 = pts[(i + 1) % pts.length], p3 = pts[(i + 2) % pts.length];
      d += `C${f([p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6])} ${f([p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6])} ${f(p2)}`;
    }
    return d + 'Z';
  }
  const blob = $('#blob'), blobPath = $('#blobPath');
  function drawBlob(i, t) {
    const j = Math.min(i + 1, SHAPES.length - 1), A = SHAPES[i], B = SHAPES[j], pa = PLACES[i], pb = PLACES[j];
    const mix = (u, w) => u + (w - u) * t;
    blobPath.setAttribute('d', toPath(A.map((pt, k) => [pt[0] + (B[k][0] - pt[0]) * t, pt[1] + (B[k][1] - pt[1]) * t])));
    blob.style.transform = `translate(-50%,-50%) translate(${mix(pa.x, pb.x)}vw,${mix(pa.y, pb.y)}vh) rotate(${((i + t) * 22).toFixed(1)}deg) scale(${mix(pa.s, pb.s).toFixed(3)})`;
    blob.style.opacity = mix(pa.o, pb.o).toFixed(3);
  }

  // ---------- 목차 점 ----------
  const dots = $('#dots');
  dots.innerHTML = scenes.map((s) => `<button aria-label="${s.dataset.name}"><span>${s.dataset.name}</span></button>`).join('');
  const dotEls = [...dots.children];
  dotEls.forEach((b, i) => b.addEventListener('click', () => {
    const s = scenes[i];
    scrollTo({ top: s.getBoundingClientRect().top + scrollY - navH() + 1, behavior: 'smooth' });
  }));

  // ---------- 매 프레임 ----------
  let ticking = false;
  function frame() {
    ticking = false;
    const nav = navH(), stageH = innerHeight - nav;
    let cur = 0, curT = 0, inside = false;
    scenes.forEach((s, i) => {
      const r = s.getBoundingClientRect();
      const span = Math.max(1, s.offsetHeight - stageH);
      const raw = (nav - r.top) / span;
      const p = reduce ? 1 : clamp(raw);
      if (raw >= -0.001) { cur = i; curT = clamp(raw); }
      if (raw > -0.5 && raw < 1.02) inside = true;
      // 화면 근처의 장면만 갱신
      if (r.bottom > -200 && r.top < innerHeight + 200) {
        s.style.setProperty('--p', p.toFixed(4));
        const fn = UPDATE[s.dataset.name]; if (fn) fn(p, s);
      }
    });
    drawBlob(cur, reduce ? 0 : smooth(0.55, 1, curT));
    const past = scenes[scenes.length - 1].getBoundingClientRect().bottom < innerHeight * 0.6;
    blob.classList.toggle('out', past);
    dots.classList.toggle('out', past || !inside);
    dotEls.forEach((b, i) => b.classList.toggle('on', i === cur));
  }
  const request = () => { if (!ticking) { ticking = true; requestAnimationFrame(frame); } };
  addEventListener('scroll', request, { passive: true });
  addEventListener('resize', request);
  frame();
})();
