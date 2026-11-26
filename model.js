// FLAT 올팍 — 혼잡 예측 모델 (기획서 3-2 알고리즘 구현)
(function () {
  const { VENUES, STATIONS, PARKING, PARAMS, SHOWS, HOLIDAYS } = FLAT;
  const T0 = 12 * 60;          // 타임라인 시작 12:00
  const STEP = 10;             // 10분 단위
  const N = (26 * 60 - T0) / STEP; // 다음날 02:00 까지

  const hm = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
  const fmt = (t) => { const h = Math.floor(t / 60) % 24, m = Math.round(t % 60); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; };
  const slot = (t) => Math.max(0, Math.min(N - 1, Math.floor((t - T0) / STEP)));
  const slotTime = (i) => T0 + i * STEP;
  const hourOf = (i) => Math.min(25, Math.floor(slotTime(i) / 60));

  function isWeekend(date) {
    const d = new Date(date + 'T00:00:00');
    return d.getDay() === 0 || d.getDay() === 6 || HOLIDAYS.includes(date);
  }
  const showsOn = (date) => SHOWS.filter((s) => s.date === date);
  const eventDates = () => [...new Set(SHOWS.map((s) => s.date))].sort();
  const showEnd = (s) => hm(s.time) + s.dur;

  // 관객을 역별로 나누는 비율: 노선 가중치 ÷ 도보시간
  function stationShares(venueKey) {
    const v = VENUES[venueKey];
    const raw = {};
    let sum = 0;
    for (const k in STATIONS) { raw[k] = STATIONS[k].pref / v.walk[k]; sum += raw[k]; }
    for (const k in raw) raw[k] /= sum;
    return raw;
  }

  // ① 공연별 추가 수요 → 역별·10분 단위 도착 인원, 주차장별 차량
  function crowdForDay(date) {
    const shows = showsOn(date);
    const arrivals = {}; for (const k in STATIONS) arrivals[k] = new Array(N).fill(0);
    const carsIn = {}, carsOut = {}; for (const g in PARKING) { carsIn[g] = new Array(N).fill(0); carsOut[g] = new Array(N).fill(0); }
    let audience = 0;
    for (const s of shows) {
      const v = VENUES[s.venue];
      const start = hm(s.time), end = start + s.dur;
      const att = v.cap * PARAMS.fill;
      audience += att;
      const transit = att * (1 - PARAMS.carShare);
      const shares = stationShares(s.venue);
      for (const k in STATIONS) {
        PARAMS.exitDist.forEach((p, j) => {
          arrivals[k][slot(end + j * STEP + v.walk[k])] += transit * shares[k] * p;
        });
      }
      const cars = (att * PARAMS.carShare) / PARAMS.personsPerCar;
      for (const g in PARKING) {
        const c = cars * v.gate[g];
        // 입차: 공연 시작 90분 전~시작 사이 고르게
        for (let t = start - 90; t < start; t += STEP) carsIn[g][slot(t)] += c / 9;
        PARAMS.exitDist.forEach((p, j) => { carsOut[g][slot(end + j * STEP)] += c * p; });
      }
    }
    return { shows, arrivals, carsIn, carsOut, audience };
  }

  // ② 역별 혼잡도 시뮬레이션 (대기열 방식)
  function simulateStations(date, crowd) {
    const prof = isWeekend(date) ? PARAMS.baseWeekend : PARAMS.baseWeekday;
    const out = {};
    for (const k in STATIONS) {
      const cap0 = STATIONS[k].absorb;
      let q = 0;
      const cong = [], wait = [], base = [], load = [];
      for (let i = 0; i < N; i++) {
        const b = prof[hourOf(i)] ?? 0.1;
        const cap = cap0 * (1 - 0.5 * b);
        const demand = q + crowd.arrivals[k][i];
        const served = Math.min(demand, cap);
        q = demand - served;
        let c = b + (1 - b) * (served / cap);
        if (q > 0) c += Math.min(0.6, (q / cap) * 0.4);
        cong.push(Math.min(1.6, c));
        wait.push((q / cap) * STEP);
        base.push(b);
        load.push(crowd.arrivals[k][i]);
      }
      out[k] = { cong, wait, base, load };
    }
    return out;
  }

  // 주차장 점유율·출차 대기
  function simulateParking(date, crowd) {
    const prof = isWeekend(date) ? PARAMS.parkBaseWeekend : PARAMS.parkBaseWeekday;
    const out = {};
    for (const g in PARKING) {
      const cap = PARKING[g].cap;
      let present = 0, q = 0;
      const occ = [], wait = [];
      for (let i = 0; i < N; i++) {
        present += crowd.carsIn[g][i] - crowd.carsOut[g][i];
        present = Math.max(0, present);
        const base = (prof[hourOf(i)] ?? 0.02) * cap;
        occ.push(Math.min(1.2, (base + present) / cap));
        const demand = q + crowd.carsOut[g][i];
        const served = Math.min(demand, PARAMS.gateExitPer10);
        q = demand - served;
        wait.push((q / PARAMS.gateExitPer10) * STEP);
      }
      out[g] = { occ, wait };
    }
    return out;
  }

  function level(c) {
    if (c < 0.5) return { label: '여유', cls: 'lv0' };
    if (c < 0.8) return { label: '보통', cls: 'lv1' };
    if (c < 1.0) return { label: '혼잡', cls: 'lv2' };
    return { label: '매우 혼잡', cls: 'lv3' };
  }

  // ③ 추천 점수 = 소요시간 + α×혼잡도 + β×출발 대기
  function recommend(show, destKey, comfort, sim) {
    const v = VENUES[show.venue];
    const end = showEnd(show);
    const dest = FLAT.DESTS[destKey];
    const alpha = 10 + comfort * 80;  // 편하게 갈수록 혼잡 가중↑
    const beta = 1.0 - comfort * 0.8; // 편하게 갈수록 늦게 출발하는 부담↓
    const opts = [];
    for (const k in STATIONS) {
      for (const d of [0, 10, 20, 30, 40]) {
        const arrive = end + d + v.walk[k];
        const i = slot(arrive);
        const wait = sim[k].wait[i];
        const cong = sim[k].cong[i];
        const total = d + v.walk[k] + wait + dest.travel[k];
        const score = (total - d) + beta * d + alpha * cong;
        opts.push({ station: k, delay: d, walk: v.walk[k], wait, cong, travel: dest.travel[k], total, score, home: end + total });
      }
    }
    opts.sort((a, b) => a.score - b.score);
    // 상위 3개: 서로 다른 역 우선
    const pick = [];
    for (const o of opts) { if (!pick.some((p) => p.station === o.station)) pick.push(o); if (pick.length === 3) break; }
    // 비교 기준: 가장 가까운 역으로 바로 출발
    const nearest = Object.keys(STATIONS).filter((k) => k !== 'bus').sort((a, b) => v.walk[a] - v.walk[b])[0];
    const naive = opts.find((o) => o.station === nearest && o.delay === 0);
    return { pick, naive, end };
  }

  // 버스 차내 혼잡도: 재차(i) = 재차(i-1) + 승차(i) − 하차(i) + 공연 추가 승차(i)
  const BUS = {
    name: '예시 노선 (공원 경유 간선버스)',
    capacity: 70,
    stops: ['잠실역', '잠실나루역', '몽촌토성', '올림픽공원', '방이역', '오금역', '개롱역', '거여역', '마천역'],
    on:  [18, 6, 4, 5, 6, 5, 2, 2, 0],
    off: [0, 3, 2, 3, 7, 8, 6, 7, 8],
    parkIndex: 3,
  };
  function busLoad(extra) {
    let r = 0;
    return BUS.stops.map((_, i) => {
      r = Math.max(0, r + BUS.on[i] - BUS.off[i] + (i === BUS.parkIndex ? extra : 0));
      return r;
    });
  }

  FLAT.model = { T0, STEP, N, hm, fmt, slot, slotTime, isWeekend, showsOn, eventDates, showEnd, crowdForDay, simulateStations, simulateParking, level, recommend, BUS, busLoad };
})();
