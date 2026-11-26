// FLAT BUS 올팍 — 화면
(function () {
  let M = FLAT.model; // 지도에서 목적지를 고르면 실제 노선 데이터로 만든 모델로 바뀝니다 (live.js)
  const $ = (id) => document.getElementById(id);
  const WD = ['일', '월', '화', '수', '목', '금', '토'];
  const r1 = (x) => Math.round(x);
  const pill = (c) => { const l = M.level(c); return `<span class="pill ${l.cls}">${l.label}</span>`; };
  const lvColor = (c) => `var(--${M.level(c).cls})`;
  let chart = null;

  // ---- 초기 상태 ----
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const eventDays = M.eventDates();
  const dates = [];
  for (let d = new Date(todayIso + 'T00:00:00'), i = 0; i < 36; i++, d.setDate(d.getDate() + 1)) {
    dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }
  const firstEvent = dates.find((d) => eventDays.includes(d)) || dates[0];
  const st = { date: firstEvent, time: defaultTime(firstEvent), origin: 'all', dest: '', sort: 'comfort', pick: 0 };

  function defaultTime(date) {
    const shows = M.showsOn(date);
    if (!shows.length) return 18 * 60;
    const big = shows.slice().sort((a, b) => FLAT.VENUES[b.venue].cap - FLAT.VENUES[a.venue].cap)[0];
    return Math.ceil((M.showEnd(big) + 5) / 10) * 10;
  }

  // ---- 입력 ----
  function setSource() {
    $('srcBadge').textContent = M.source.kind === 'real' ? '실제 교통카드 데이터' : '시연용 예시 데이터';
    $('srcLabel').textContent = M.source.label;
    $('origin').innerHTML = `<option value="all">올림픽공원 정류장 전체</option>` + M.parkStops.map((id) => `<option value="${id}">${M.stopName[id]}</option>`).join('');
  }
  setSource();
  $('capTxt').textContent = FLAT.BUS_CAPACITY;
  const times = []; for (let t = 6 * 60; t <= 24 * 60; t += 10) times.push(t);
  $('time').innerHTML = times.map((t) => `<option value="${t}">${M.fmt(t)}</option>`).join('');

  const originIds = () => (st.origin === 'all' ? M.parkStops : [st.origin]);
  // 지도에서 고른 목적지는 하차 정류장 ID 묶음으로, 목록에서 고른 목적지는 정류장 이름으로 계산
  const destArg = () => (st.destIds ? { ids: st.destIds } : st.dest);
  function refreshDest() {
    if (st.destIds) { $('dest').value = st.dest; return; }
    const list = M.destinations(originIds());
    $('destList').innerHTML = list.map((n) => `<option value="${n}">`).join('');
    if (!list.includes(st.dest)) st.dest = list.includes('잠실역') ? '잠실역' : list[0];
    $('dest').value = st.dest;
  }

  function renderDates() {
    $('dates').innerHTML = dates.map((d) => {
      const dt = new Date(d + 'T00:00:00');
      const ev = eventDays.includes(d);
      return `<button class="date ${d === st.date ? 'on' : ''}" data-d="${d}">${dt.getMonth() + 1}/${dt.getDate()}${ev ? ' 🎵' : ''}<small>${WD[dt.getDay()]}</small></button>`;
    }).join('');
  }

  function renderEvent() {
    const shows = M.showsOn(st.date);
    if (!shows.length) { $('eventBox').innerHTML = `<div class="event none">이 날은 올림픽공원 공연이 없어요. 교통카드 평균 승하차 인원만으로 계산해요.</div>`; return; }
    const allLast = M.lastBuses(M.parkStops);
    const latest = allLast.length ? allLast[allLast.length - 1].last : null;
    const lastWarn = (s) => {
      if (latest == null) return '';
      const left = latest - (M.showEnd(s) + 15); // 퇴장·도보 15분
      if (left < 5) return ` <span class="warn">⚠ 공연이 끝나면 올림픽공원 버스 막차가 이미 끊겨요</span>`;
      if (left < 60) return ` <span class="warn">⚠ 마지막 막차까지 약 ${Math.round(left)}분</span>`;
      return '';
    };
    $('eventBox').innerHTML = `<div class="event"><b>🎵 이 날 올림픽공원 공연</b> <span class="note">(한국체육산업개발 공연정보)</span><br>` +
      shows.map((s) => `${s.time} ${FLAT.VENUES[s.venue].name} · ${s.title} <span class="note">→ 종료 예상 ${M.fmt(M.showEnd(s))}</span>${lastWarn(s)}`).join('<br>') +
      `<div class="note" style="margin-top:4px">공연이 끝나면 관객이 올림픽공원 정류장에서 버스를 타기 때문에, 그 시간대 승차 인원을 더해서 혼잡도를 계산해요.</div></div>`;
  }

  // ---- 경로 안내 ----
  let opts = [];
  function renderLast() {
    const list = M.lastBuses(originIds(), destArg());
    if (!list.length) { $('lastBox').innerHTML = ''; return; }
    const soon = list.filter((x) => x.last >= st.time && x.last - st.time <= 40);
    const gone = list.every((x) => x.last < st.time);
    const cls = gone ? 'lastbox gone' : soon.length ? 'lastbox soon' : 'lastbox';
    const head = gone ? '🚫 이 시간에는 모든 노선의 막차가 끊겼어요' : soon.length ? `⏰ 막차가 얼마 남지 않았어요 — ${soon.map((x) => `${x.route.RTE_NM} ${Math.round(x.last - st.time)}분 후`).join(', ')}` : '🌙 막차 시간';
    $('lastBox').innerHTML = `<div class="${cls}"><b>${head}</b><div class="lastlist">${list.map((x) => `<span class="${x.last < st.time ? 'off' : ''}">${x.route.RTE_NM} · ${x.origin} <b>${M.fmt(x.last)}</b></span>`).join('')}</div>
      <div class="note">정류소별 노선 첫차/막차 예정시간 기준</div></div>`;
  }

  function renderOptions() {
    renderLast();
    opts = M.options(originIds(), destArg(), st.date, st.time);
    if (!opts.length) { $('opts').innerHTML = '<p class="note">이 시간 이후 운행하는 버스가 없어요. 위의 막차 시간을 확인해 주세요.</p>'; $('tipBox').innerHTML = ''; return; }
    const LV = { lv0: 0, lv1: 1, lv2: 2, lv3: 3 };
    const comfort = (o) => o.arrive + 30 * LV[M.level(o.maxCong).cls] + 20 * o.maxCong;
    const score = (o) => (st.sort === 'fast' ? o.arrive : comfort(o));
    opts.sort((a, b) => score(a) - score(b));
    st.pick = Math.min(st.pick, opts.length - 1);
    $('opts').innerHTML = opts.slice(0, 6).map((o, i) => {
      const seg = o.ride.slice(o.oi, o.di);
      return `<button class="opt ${i === st.pick ? 'on' : ''}" data-i="${i}">
        <div class="head"><div class="rt">${o.route.RTE_NM}${o.isLast ? ' <span class="lasttag">막차</span>' : ''}</div>${pill(o.maxCong)}</div>
        <div class="meta">🚏 ${o.origin} <b>${M.fmt(o.arriveO)}</b> 탑승 (${r1(o.wait)}분 후) → ${o.ride[o.di].name} <b>${M.fmt(o.arrive)}</b> 도착${st.destIds && o.ride[o.di].name !== st.dest ? ' <span class="lasttag" style="background:#0ea5e9">환승</span>' : ''} · ${r1(o.travel)}분 · ${o.di - o.oi}정류장</div>
        <div class="strip" title="정류장별 차내 혼잡도">${seg.map((s) => `<i style="background:${lvColor(s.cong)}"></i>`).join('')}</div>
        ${o.extra > 0.5 ? `<div class="meta">🎵 공연이 끝난 관객 약 <b>${r1(o.extra)}명</b>이 함께 타요 · 공연 없을 때는 ${pill(o.baseMax)}</div>` : ''}
      </button>`;
    }).join('');
    // '덜 붐비게' 팁: 가장 먼저 오는 버스 vs 추천 버스
    const first = opts.slice().sort((a, b) => a.arriveO - b.arriveO)[0];
    const best = opts.slice().sort((a, b) => comfort(a) - comfort(b))[0];
    $('tipBox').innerHTML = (first !== best && best.maxCong < first.maxCong - 0.05)
      ? `<div class="tip">가장 먼저 오는 <b>${first.route.RTE_NM}</b> ${M.fmt(first.arriveO)} 버스는 ${pill(first.maxCong)} 상태예요. <b>${r1(best.arriveO - first.arriveO)}분</b>만 더 기다려 <b>${best.route.RTE_NM}</b> ${M.fmt(best.arriveO)} 버스를 타면 ${pill(best.maxCong)} 상태로 갈 수 있어요.</div>`
      : `<div class="tip">지금 가장 먼저 오는 <b>${first.route.RTE_NM}</b> ${M.fmt(first.arriveO)} 버스를 타는 게 좋아요. ${pill(first.maxCong)}</div>`;
  }

  // ---- 계산 과정 상세 ----
  function renderDetail() {
    const o = opts[st.pick];
    if (!o) { $('dTable').innerHTML = ''; return; }
    $('dTitle').textContent = `혼잡도 계산 과정 — ${o.route.RTE_NM}, ${o.origin} ${M.fmt(o.arriveO)} 버스`;
    const at = o.ride[o.oi];
    const h = Math.floor(at.t / 60);
    $('dNote').innerHTML = `예) ${at.name} ${h}시대 버스 1대 평균 승차 = 월간 승차 인원 ÷ ${M.source.days}일 ÷ 시간당 ${(60 / o.route.headway).toFixed(1)}대(배차 ${o.route.headway}분) ≈ <b>${at.on.toFixed(1)}명</b>` +
      (at.extra > 0.5 ? ` + 공연 추가 승차 <b>${r1(at.extra)}명</b>` : '');
    const css = getComputedStyle(document.documentElement);
    const sub = css.getPropertyValue('--sub').trim(), line = css.getPropertyValue('--line').trim();
    if (chart) chart.destroy();
    chart = new Chart($('cLoad'), {
      data: {
        labels: o.ride.map((s) => s.name),
        datasets: [
          { type: 'bar', label: '평소 (교통카드 평균)', data: o.base.map((s) => r1(s.load)), backgroundColor: '#9fb7d8' },
          { type: 'bar', label: '이 날 (공연 반영)', data: o.ride.map((s) => r1(s.load)), backgroundColor: o.ride.map((s) => lvColor(s.cong).replace('var(--lv0)', '#22a06b').replace('var(--lv1)', '#e2b203').replace('var(--lv2)', '#f5832a').replace('var(--lv3)', '#e5484d')) },
          { type: 'line', label: `최대 탑승 인원 ${FLAT.BUS_CAPACITY}명`, data: o.ride.map(() => FLAT.BUS_CAPACITY), borderColor: '#e5484d', borderDash: [5, 5], borderWidth: 1, pointRadius: 0 },
        ],
      },
      options: { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { labels: { color: sub, boxWidth: 12, font: { size: 11 } } } },
        scales: { x: { ticks: { color: sub, font: { size: 10 }, maxRotation: 60 }, grid: { color: line } }, y: { beginAtZero: true, title: { display: true, text: '차내 인원(명)', color: sub }, ticks: { color: sub }, grid: { color: line } } } },
    });
    $('dTable').innerHTML = `<table><tr><th>정류장</th><th>도착</th><th>승차</th><th>하차</th><th>공연 추가</th><th>현재 탑승 인원</th><th>혼잡도</th></tr>` +
      o.ride.map((s, i) => `<tr class="${i >= o.oi && i < o.di ? 'ride' : ''}"><td>${s.name}${i === o.oi ? ' <b>(탑승)</b>' : i === o.di ? ' <b>(하차)</b>' : ''}</td><td>${M.fmt(s.t)}</td>
        <td class="plus">+${s.on.toFixed(1)}</td><td class="minus">−${s.off.toFixed(1)}</td><td class="ev">${s.extra > 0.5 ? '+' + r1(s.extra) : ''}</td>
        <td>${r1(s.load)}명</td><td>${pill(s.cong)} ${s.cong.toFixed(2)}</td></tr>`).join('') + `</table>
      <p class="note">색칠된 줄 = 내가 타고 가는 구간. 혼잡도 0.5 미만 여유 · 0.8 미만 보통 · 1.0 미만 혼잡 · 1.0 이상 매우 혼잡</p>`;
  }

  function render() {
    if (!opts) opts = [];
    renderDates(); renderEvent();
    $('time').value = st.time; $('origin').value = st.origin;
    document.querySelectorAll('#sort button').forEach((b) => b.classList.toggle('on', b.dataset.s === st.sort));
    renderOptions(); renderDetail();
  }

  // ---- 이벤트 ----
  $('dates').addEventListener('click', (e) => { const b = e.target.closest('.date'); if (!b) return; st.date = b.dataset.d; st.time = defaultTime(st.date); st.pick = 0; render(); });
  $('time').addEventListener('change', (e) => { st.time = +e.target.value; st.pick = 0; render(); });
  $('origin').addEventListener('change', (e) => { st.origin = e.target.value; refreshDest(); st.pick = 0; render(); });
  $('dest').addEventListener('change', (e) => { const v = e.target.value.trim(); if (M.destinations(originIds()).includes(v)) { st.dest = v; st.destIds = null; st.pick = 0; render(); } else { e.target.value = st.dest; } });
  $('sort').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; st.sort = b.dataset.s; st.pick = 0; render(); });
  $('opts').addEventListener('click', (e) => { const b = e.target.closest('.opt'); if (!b) return; st.pick = +b.dataset.i; render(); $('detail').scrollIntoView({ behavior: 'smooth', block: 'start' }); });

  refreshDest();
  render();

  // live.js(네이버 지도 연동)가 실제 노선 데이터로 만든 모델을 넘겨주는 통로
  FLAT.app = {
    useModel(model, o) {
      M = model; st.destIds = o.destIds; st.dest = o.destLabel; st.origin = 'all'; st.pick = 0;
      setSource(); refreshDest(); render();
    },
    reset() { M = FLAT.model; st.destIds = null; st.dest = ''; st.pick = 0; setSource(); refreshDest(); render(); },
  };
})();
