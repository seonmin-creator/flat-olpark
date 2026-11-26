// FLAT BUS 올팍 — 버스 차내 혼잡도 계산 모델
// 현재 버스 탑승 인원 = 기존 인원 + (승차 인원 − 하차 인원) [+ 공연 추가 승차]
// 혼잡도 = 현재 예상 승객 수 ÷ 최대 탑승 가능 승객 수
(function () {
  const { CARD_ROWS, ROUTE_META, BUS_SOURCE, SHOWS, VENUES, EVENT, BUS_CAPACITY, HOLIDAYS } = FLAT;
  const STEP = 10;

  const hm = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
  const fmt = (t) => { const h = Math.floor(t / 60) % 24, m = Math.round(t % 60); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; };
  const cleanName = (s) => s.replace(/\(\d+\)\s*$/, '').trim();
  const isPark = (name) => name.includes(EVENT.parkKeyword);

  // ---- 교통카드 데이터 색인 ----
  const rowByRouteStop = {};
  const stopName = {};
  for (const r of CARD_ROWS) {
    (rowByRouteStop[r.RTE_NO] = rowByRouteStop[r.RTE_NO] || {})[r.STOPS_ID] = r;
    stopName[r.STOPS_ID] = cleanName(r.SBWY_STNS_NM);
  }
  const routes = ROUTE_META.filter((m) => m.stops.length > 1);
  // 공연장 근처 정류장: 좌표기반 근접정류소 결과(FLAT.VENUE_STOPS)가 있으면 그것을, 없으면 이름으로 찾음
  const VENUE_STOPS = FLAT.VENUE_STOPS || null;
  const onRoute = new Set(routes.flatMap((m) => m.stops));
  const parkSet = new Set(VENUE_STOPS
    ? Object.values(VENUE_STOPS).flatMap((d) => Object.keys(d)).filter((id) => onRoute.has(id))
    : [...onRoute].filter((id) => isPark(stopName[id])));
  const parkStops = [...parkSet];
  // 정류소별 막차 (정류소정보조회 getBustimeByStation) — 없으면 노선 막차 + 정류장 순서로 추정
  function lastAt(route, i) {
    const id = route.stops[i];
    if (route.lastAt && route.lastAt[id] != null) return route.lastAt[id];
    if (route.last != null) return route.last + i * route.minPerStop;
    return 24 * 60 + 30;
  }
  const routesAtStop = (id) => routes.filter((m) => m.stops.includes(id));

  // 한 달 합계 → 버스 1대 평균: 월 승차 ÷ 일수 ÷ 시간당 운행 대수
  function perBus(route, stopId, hour) {
    const row = rowByRouteStop[route.RTE_NO][stopId];
    if (!row) return { on: 0, off: 0 };
    const h = ((hour % 24) + 24) % 24;
    const busesPerHour = 60 / route.headway;
    const k = BUS_SOURCE.days * busesPerHour;
    return { on: (row[`HR_${h}_GET_ON_TNOPE`] || 0) / k, off: (row[`HR_${h}_GET_OFF_TNOPE`] || 0) / k };
  }

  // ---- 공연 → 올림픽공원 정류장 추가 승차 (한국체육산업개발 공연정보) ----
  const showsOn = (date) => SHOWS.filter((s) => s.date === date);
  const eventDates = () => [...new Set(SHOWS.map((s) => s.date))].sort();
  const showEnd = (s) => hm(s.time) + s.dur;
  function stopWeight(venue, stopId) {
    if (VENUE_STOPS && VENUE_STOPS[venue]) return VENUE_STOPS[venue][stopId] || 0;
    const name = stopName[stopId];
    const w = VENUES[venue].stop;
    const keys = Object.keys(w).filter((k) => name.includes(k));
    if (keys.length) return keys.reduce((a, k) => a + w[k], 0);
    return 1 / Math.max(1, parkStops.length); // 실제 데이터에서 정류장 이름이 다르면 균등 분배
  }
  // 시각 t에 stopId에 도착하는 route 버스 1대에 더해지는 공연 관객 수
  function eventExtra(date, route, stopId, t) {
    if (!parkSet.has(stopId)) return { extra: 0, shows: [] };
    let people = 0;
    const hit = [];
    for (const s of showsOn(date)) {
      const j = Math.floor((t - showEnd(s) - EVENT.walkToStop) / STEP);
      if (j < 0 || j >= EVENT.exitDist.length) continue;
      const p = VENUES[s.venue].cap * EVENT.fill * EVENT.busShare * stopWeight(s.venue, stopId) * EVENT.exitDist[j];
      people += p;
      hit.push(s);
    }
    const nRoutes = routesAtStop(stopId).length || 1;
    const busesPer10 = STEP / route.headway;
    return { extra: people / nRoutes / busesPer10, shows: hit };
  }

  // ---- 버스 1대의 정류장별 재차 인원 계산 ----
  function runBus(route, depFirst, date, withEvent) {
    let load = 0;
    return route.stops.map((id, i) => {
      const t = depFirst + i * route.minPerStop;
      const { on, off } = perBus(route, id, Math.floor(t / 60));
      const ev = withEvent ? eventExtra(date, route, id, t) : { extra: 0, shows: [] };
      const realOff = Math.min(load, off);
      load = load - realOff + on + ev.extra;
      if (i === route.stops.length - 1) load = 0;
      return { id, name: stopName[id], t, on, off: realOff, extra: ev.extra, load, cong: load / BUS_CAPACITY, shows: ev.shows };
    });
  }

  function level(c) {
    if (c < 0.5) return { label: '여유', cls: 'lv0' };
    if (c < 0.8) return { label: '보통', cls: 'lv1' };
    if (c < 1.0) return { label: '혼잡', cls: 'lv2' };
    return { label: '매우 혼잡', cls: 'lv3' };
  }

  // 목적지 후보: 올림픽공원 정류장 이후에 나오는 정류장
  function destinations(originIds) {
    const set = new Map();
    for (const m of routes) for (const o of originIds) {
      const oi = m.stops.indexOf(o);
      if (oi < 0) continue;
      m.stops.slice(oi + 1).forEach((id) => { if (!parkSet.has(id)) set.set(stopName[id], true); });
    }
    return [...set.keys()].sort((a, b) => a.localeCompare(b, 'ko'));
  }

  // ---- 경로 후보 (노선 × 다음 버스 3대) ----
  function options(originIds, destName, date, t) {
    const out = [];
    for (const m of routes) for (const o of originIds) {
      const oi = m.stops.indexOf(o);
      const di = m.stops.findIndex((id, i) => i > oi && stopName[id] === destName);
      if (oi < 0 || di < 0) continue;
      const offset = oi * m.minPerStop;
      const last = lastAt(m, oi);
      let k = Math.max(0, Math.ceil((t - offset - m.first) / m.headway));
      for (let n = 0; n < 6; n++, k++) {
        const depFirst = m.first + k * m.headway;
        const arriveO = depFirst + offset;
        if (arriveO > last + 0.5) break; // 막차 이후 버스는 없음
        const ride = runBus(m, depFirst, date, true);
        const base = runBus(m, depFirst, date, false);
        const seg = ride.slice(oi, di);
        const maxCong = Math.max(...seg.map((s) => s.cong));
        out.push({
          route: m, oi, di, depFirst, arriveO, wait: arriveO - t,
          arrive: ride[di].t, travel: ride[di].t - arriveO, ride, base,
          maxCong, baseMax: Math.max(...base.slice(oi, di).map((s) => s.cong)),
          extra: ride[oi].extra, origin: stopName[o], last, isLast: arriveO + m.headway > last + 0.5,
        });
      }
    }
    return out;
  }

  // 출발 정류장에서 목적지로 가는 노선들의 막차 시각
  function lastBuses(originIds, destName) {
    const out = [];
    for (const m of routes) for (const o of originIds) {
      const oi = m.stops.indexOf(o);
      if (oi < 0) continue;
      if (destName && !m.stops.some((id, i) => i > oi && stopName[id] === destName)) continue;
      out.push({ route: m, origin: stopName[o], last: lastAt(m, oi) });
    }
    return out.sort((a, b) => a.last - b.last);
  }

  const isWeekend = (date) => { const d = new Date(date + 'T00:00:00'); return d.getDay() === 0 || d.getDay() === 6 || HOLIDAYS.includes(date); };

  FLAT.model = { hm, fmt, stopName, routes, parkStops, showsOn, eventDates, showEnd, runBus, level, destinations, options, lastBuses, isWeekend };
})();
