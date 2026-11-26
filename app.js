// FLAT 올팍 — 화면
(function () {
  const M = FLAT.model;
  const { VENUES, STATIONS, DESTS, PARKING } = FLAT;
  const $ = (id) => document.getElementById(id);
  const WD = ['일', '월', '화', '수', '목', '금', '토'];
  const ST_COLORS = { olpark: '#3b6fb6', mongchon: '#ff7a45', hanseong: '#22a06b', bus: '#8e6cc9' };
  const PK_COLORS = { east: '#3b6fb6', south: '#e2b203', north: '#22a06b' };
  const charts = {};
  const pill = (c) => { const l = M.level(c); return `<span class="pill ${l.cls}">${l.label}</span>`; };
  const n = (x) => Math.round(x).toLocaleString('ko-KR');

  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const dates = M.eventDates();
  const state = {
    date: dates.find((d) => d >= todayIso) || dates[0],
    showId: null,
    dest: 'jamsil',
    comfort: 0.5,
    tab: 'plan',
  };

  let day = null; // {crowd, sim, park}
  function computeDay() {
    const crowd = M.crowdForDay(state.date);
    day = { crowd, sim: M.simulateStations(state.date, crowd), park: M.simulateParking(state.date, crowd) };
  }
  const selShow = () => FLAT.SHOWS[state.showId];

  // ---------- 날짜·공연 ----------
  function renderDates() {
    $('dates').innerHTML = dates.map((d) => {
      const dt = new Date(d + 'T00:00:00');
      const we = M.isWeekend(d);
      return `<button class="date ${d === state.date ? 'on' : ''} ${we ? 'we' : ''}" data-d="${d}">${dt.getMonth() + 1}/${dt.getDate()}<small>${WD[dt.getDay()]}${FLAT.HOLIDAYS.includes(d) ? '·휴일' : ''}</small></button>`;
    }).join('');
    const on = $('dates').querySelector('.on');
    if (on) on.scrollIntoView({ block: 'nearest', inline: 'center' });
  }
  function renderShows() {
    const shows = M.showsOn(state.date);
    if (state.showId == null || !shows.some((s) => s.id === state.showId)) {
      state.showId = shows.slice().sort((a, b) => VENUES[b.venue].cap - VENUES[a.venue].cap)[0].id;
    }
    $('shows').innerHTML = shows.map((s) => {
      const v = VENUES[s.venue];
      return `<button class="show ${s.id === state.showId ? 'on' : ''}" data-id="${s.id}">
        <div class="time">${s.time}</div>
        <div><div class="t">${s.title}</div><div class="v">${v.name}${v.sub ? ' (' + v.sub + ')' : ''} · 종료 예상 ${M.fmt(M.showEnd(s))}</div></div>
      </button>`;
    }).join('');
  }

  // ---------- 귀가 플랜 ----------
  function renderPlan() {
    const s = selShow();
    const r = M.recommend(s, state.dest, state.comfort, day.sim);
    const best = r.pick[0], nv = r.naive;
    const others = M.showsOn(state.date).filter((x) => x.id !== s.id && Math.abs(M.showEnd(x) - r.end) <= 60);
    const card = (o, i) => {
      const st = STATIONS[o.station];
      const go = o.delay === 0 ? '공연 끝나고 바로 출발' : `공연 끝나고 ${o.delay}분 뒤 출발`;
      return `<div class="opt ${i === 0 ? 'best' : ''}">
        <div class="head"><div><div class="rank">${i === 0 ? '추천' : '대안 ' + i}</div><div class="st">${st.name} <span class="meta">${st.lines}</span></div></div>${pill(o.cong)}</div>
        <div class="steps"><span>${go} (${M.fmt(r.end + o.delay)})</span><span>도보 ${o.walk}분</span><span>승차 대기 ${Math.round(o.wait)}분</span><span>이동 ${o.travel}분</span></div>
        <div class="meta">예상 도착 ${M.fmt(o.home)} · 총 ${Math.round(o.total)}분${o.delay ? ' · 기다리는 동안 공원에서 잠시 머무르면 인파가 빠져요' : ''}</div>
      </div>`;
    };
    let compare = '';
    if (nv) {
      const better = best.cong < nv.cong - 0.05;
      compare = `<div class="compare">
        <div>가장 가까운 <b>${STATIONS[nv.station].name}</b>으로 바로 가면 ${pill(nv.cong)} · 승차 대기 ${Math.round(nv.wait)}분 · 도착 ${M.fmt(nv.home)}</div>
        <div style="margin-top:6px">${better ? `FLAT 추천대로 가면 ${pill(nv.cong)} → ${pill(best.cong)} 로 <b>덜 붐비게</b> 갈 수 있어요 (도착 ${M.fmt(best.home)}).` : '오늘은 가까운 역으로 바로 가도 비교적 괜찮아요.'}</div>
      </div>`;
    }
    $('planOut').innerHTML = `
      <p class="note" style="margin-top:12px">공연 종료 예상 <b>${M.fmt(r.end)}</b> (공연 시간 약 ${s.dur}분 기준)${others.length ? ` · 같은 시간대에 <b>${others.map((o) => VENUES[o.venue].name).join(', ')}</b> 공연도 끝나서 더 붐벼요` : ''}</p>
      ${compare}
      <div class="opts">${r.pick.map(card).join('')}</div>`;
  }

  // ---------- 차트 ----------
  function lineChart(id, labels, datasets, opts = {}) {
    if (charts[id]) charts[id].destroy();
    const css = getComputedStyle(document.documentElement);
    const sub = css.getPropertyValue('--sub').trim(), line = css.getPropertyValue('--line').trim();
    charts[id] = new Chart($(id), {
      type: opts.type || 'line',
      data: { labels, datasets },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { labels: { color: sub, boxWidth: 12, font: { size: 11 } } }, tooltip: { callbacks: opts.tip ? { label: opts.tip } : {} } },
        scales: {
          x: { stacked: !!opts.stacked, ticks: { color: sub, maxTicksLimit: 10, font: { size: 11 } }, grid: { color: line } },
          y: { stacked: !!opts.stacked, beginAtZero: true, suggestedMax: opts.max, ticks: { color: sub, font: { size: 11 }, callback: opts.yfmt }, grid: { color: line } },
        },
        elements: { point: { radius: 0 }, line: { tension: 0.3, borderWidth: 2 } },
      },
    });
  }
  function range(fromMin, toMin) {
    const a = M.slot(fromMin), b = M.slot(toMin);
    const idx = []; for (let i = a; i <= b; i++) idx.push(i);
    return { idx, labels: idx.map((i) => M.fmt(M.slotTime(i))) };
  }

  // ---------- 혼잡 예보 ----------
  function renderForecast() {
    const shows = M.showsOn(state.date);
    const firstStart = Math.min(...shows.map((s) => M.hm(s.time)));
    const lastEnd = Math.max(...shows.map(M.showEnd));
    const { idx, labels } = range(Math.min(firstStart - 120, 16 * 60), lastEnd + 90);
    let peak = { c: 0 };
    for (const k in STATIONS) for (const i of idx) if (day.sim[k].cong[i] > peak.c) peak = { c: day.sim[k].cong[i], k, i };
    const s = selShow();
    const startI = M.slot(M.hm(s.time) - 10);
    let pkMax = 0; for (const g in PARKING) pkMax = Math.max(pkMax, day.park[g].occ[startI]);
    $('fcKpis').innerHTML = `
      <div class="kpi"><div class="n">${shows.length}회</div><div class="l">오늘 공연 회차</div></div>
      <div class="kpi"><div class="n">${n(day.crowd.audience)}명</div><div class="l">예상 관객 (예시 계수)</div></div>
      <div class="kpi"><div class="n">${pill(peak.c)}</div><div class="l">가장 붐빌 때: ${STATIONS[peak.k].name} ${M.fmt(M.slotTime(peak.i))}</div></div>
      <div class="kpi"><div class="n">${Math.round(pkMax * 100)}%</div><div class="l">공연 시작 무렵 주차장 최대 점유율</div></div>`;
    const ds = Object.keys(STATIONS).map((k) => ({ label: STATIONS[k].name, data: idx.map((i) => +day.sim[k].cong[i].toFixed(2)), borderColor: ST_COLORS[k], backgroundColor: ST_COLORS[k] }));
    ds.push({ label: '혼잡 기준 (0.8)', data: idx.map(() => 0.8), borderColor: '#999', borderDash: [5, 5], borderWidth: 1 });
    lineChart('cStations', labels, ds, { max: 1.2, tip: (c) => `${c.dataset.label}: ${c.raw} ${c.datasetIndex < 4 ? M.level(c.raw).label : ''}` });
    lineChart('cParking', labels, Object.keys(PARKING).map((g) => ({ label: PARKING[g].name, data: idx.map((i) => Math.round(day.park[g].occ[i] * 100)), borderColor: PK_COLORS[g], backgroundColor: PK_COLORS[g] })), { max: 100, yfmt: (v) => v + '%' });

    // 도착 방법 추천
    const endI = M.slot(M.showEnd(s));
    const gates = Object.keys(PARKING).map((g) => {
      let w = 0; for (let i = endI; i < endI + 9; i++) w = Math.max(w, day.park[g].wait[i]);
      return { g, occ: day.park[g].occ[startI], wait: w };
    });
    const okGates = gates.filter((x) => x.occ < 0.9).sort((a, b) => a.wait - b.wait || a.occ - b.occ);
    const advice = okGates.length === 0
      ? '오늘은 <b>대중교통</b>으로 오세요. 공연 시작 무렵 모든 주차장이 거의 가득 찰 것으로 예상돼요.'
      : pkMax >= 0.85
        ? `주차장이 붐비는 날이에요. 자가용이라면 <b>${PARKING[okGates[0].g].name}</b>을 이용하고, 공연 시작 90분 전 도착을 권해요.`
        : `자가용도 괜찮은 날이에요. 출차가 가장 빠른 곳은 <b>${PARKING[okGates[0].g].name}</b>이에요.`;
    $('fcArrive').innerHTML = `<div class="advice">🚗 도착 방법 추천</div><p style="margin:6px 0 10px">${advice}</p>
      <table><tr><th>주차장</th><th>공연 시작 무렵 점유율</th><th>종료 후 최대 출차 대기</th></tr>
      ${gates.map((x) => `<tr><td>${PARKING[x.g].name}</td><td>${Math.round(x.occ * 100)}%</td><td>${Math.round(x.wait)}분</td></tr>`).join('')}</table>
      <p class="note">선택한 공연(${s.time} ${VENUES[s.venue].name}) 기준</p>`;
  }

  // ---------- 버스 ----------
  function renderBus() {
    const s = selShow();
    const endI = M.slot(M.showEnd(s) + VENUES[s.venue].walk.bus);
    const peak = Math.max(day.sim.bus.load[endI] || 0, day.sim.bus.load[endI + 1] || 0);
    const extra = Math.min(45, Math.round(peak / 8)); // 10분당 약 8대 운행(예시)
    const B = M.BUS;
    const normal = M.busLoad(0), event = M.busLoad(extra);
    $('busNote').innerHTML = `${B.name} · 선택한 공연 종료 직후 올림픽공원 정류장에서 버스 1대당 <b>약 ${extra}명</b>이 추가로 탈 것으로 예측했어요. (노선·승하차 수치는 시연용 예시이며, 실제로는 서울시 정류장별 시간대별 승하차 데이터를 사용)`;
    if (charts.cBus) charts.cBus.destroy();
    const css = getComputedStyle(document.documentElement);
    const sub = css.getPropertyValue('--sub').trim(), line = css.getPropertyValue('--line').trim();
    charts.cBus = new Chart($('cBus'), {
      data: {
        labels: B.stops,
        datasets: [
          { type: 'bar', label: '평소 재차 인원', data: normal, backgroundColor: '#9fb7d8' },
          { type: 'bar', label: '공연 종료 직후 재차 인원', data: event, backgroundColor: '#ff7a45' },
          { type: 'line', label: `최대 탑승 인원 (${B.capacity}명)`, data: B.stops.map(() => B.capacity), borderColor: '#e5484d', borderDash: [5, 5], borderWidth: 1, pointRadius: 0 },
        ],
      },
      options: { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { labels: { color: sub, boxWidth: 12, font: { size: 11 } } } }, scales: { x: { ticks: { color: sub, font: { size: 11 } }, grid: { color: line } }, y: { beginAtZero: true, ticks: { color: sub }, grid: { color: line } } } },
    });
    $('busTable').innerHTML = `<table><tr><th>정류장</th><th>승차</th><th>하차</th><th>공연 추가</th><th>재차 인원</th><th>혼잡도</th></tr>
      ${B.stops.map((st, i) => `<tr><td>${st}</td><td>+${B.on[i]}</td><td>−${B.off[i]}</td><td>${i === B.parkIndex ? '+' + extra : ''}</td><td>${event[i]}명</td><td>${pill(event[i] / B.capacity)} ${(event[i] / B.capacity).toFixed(2)}</td></tr>`).join('')}</table>`;
  }

  // ---------- 운영자 ----------
  function renderOps() {
    const shows = M.showsOn(state.date);
    const firstEnd = Math.min(...shows.map(M.showEnd));
    const lastEnd = Math.max(...shows.map(M.showEnd));
    const { idx, labels } = range(firstEnd - 10, lastEnd + 90);
    let total = 0, peakIn = 0;
    const rows = Object.keys(STATIONS).map((k) => {
      let mx = 0, mc = 0, mci = idx[0], mw = 0;
      for (const i of idx) {
        const a = day.sim[k].load[i]; total += a; mx = Math.max(mx, a);
        if (day.sim[k].cong[i] > mc) { mc = day.sim[k].cong[i]; mci = i; }
        mw = Math.max(mw, day.sim[k].wait[i]);
      }
      peakIn = Math.max(peakIn, mx);
      const staff = Math.max(1, Math.ceil(mx / 300));
      const act = k === 'bus'
        ? (mc >= 0.8 ? '정류장 줄서기 안내 · 임시 증차 요청' : '기본 안내')
        : (mc >= 1 ? '승강장 진입 조절 · 다른 역으로 우회 안내' : mc >= 0.8 ? '출구 안내요원 증원 · 분산 안내 방송' : '기본 안내');
      return { k, mx, mc, mci, mw, staff, act };
    });
    const staffTotal = rows.reduce((a, r) => a + r.staff, 0);
    $('opsKpis').innerHTML = `
      <div class="kpi"><div class="n">${n(day.crowd.audience)}명</div><div class="l">오늘 예상 관객</div></div>
      <div class="kpi"><div class="n">${n(total)}명</div><div class="l">종료 후 대중교통 이동 인원</div></div>
      <div class="kpi"><div class="n">${n(peakIn)}명</div><div class="l">한 역에 10분간 몰리는 최대 인원</div></div>
      <div class="kpi"><div class="n">${staffTotal}명</div><div class="l">권장 안내요원 (10분 유입 300명당 1명, 예시 기준)</div></div>`;
    lineChart('cOps', labels, Object.keys(STATIONS).map((k) => ({ label: STATIONS[k].name, data: idx.map((i) => Math.round(day.sim[k].load[i])), backgroundColor: ST_COLORS[k], borderColor: ST_COLORS[k] })), { type: 'bar', stacked: true, tip: (c) => `${c.dataset.label}: ${c.raw.toLocaleString()}명 / 10분` });
    $('opsTable').innerHTML = `<table><tr><th>역·정류장</th><th>10분 최대 유입</th><th>최대 혼잡</th><th>최대 승차 대기</th><th>권장 인력</th><th>조치</th></tr>
      ${rows.map((r) => `<tr><td>${STATIONS[r.k].name}</td><td>${n(r.mx)}명</td><td>${pill(r.mc)} ${M.fmt(M.slotTime(r.mci))}</td><td>${Math.round(r.mw)}분</td><td>${r.staff}명</td><td>${r.act}</td></tr>`).join('')}</table>`;
  }

  // ---------- 전체 ----------
  function render() {
    renderDates(); renderShows(); computeDay();
    ['plan', 'forecast', 'bus', 'ops'].forEach((t) => $('tab-' + t).classList.toggle('hidden', t !== state.tab));
    document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('on', b.dataset.tab === state.tab));
    ({ plan: renderPlan, forecast: renderForecast, bus: renderBus, ops: renderOps })[state.tab]();
  }

  $('dest').innerHTML = Object.keys(DESTS).map((k) => `<option value="${k}">${DESTS[k].name}</option>`).join('');
  $('dates').addEventListener('click', (e) => { const b = e.target.closest('.date'); if (!b) return; state.date = b.dataset.d; state.showId = null; render(); });
  $('shows').addEventListener('click', (e) => { const b = e.target.closest('.show'); if (!b) return; state.showId = +b.dataset.id; render(); });
  $('tabs').addEventListener('click', (e) => { const b = e.target.closest('.tab'); if (!b) return; state.tab = b.dataset.tab; render(); });
  $('dest').addEventListener('change', (e) => { state.dest = e.target.value; render(); });
  $('comfort').addEventListener('input', (e) => { state.comfort = +e.target.value; render(); });
  render();
})();
