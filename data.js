// FLAT 올팍 — 데이터
// 공연 일정: 올림픽공원 공식 공연/행사 일정안내(2026.11~12) 기준 (한국체육산업개발 '올림픽공원 공연정보'와 동일 출처)
// 그 외 수치(수용인원, 도보시간, 소요시간, 혼잡 계수 등)는 데모용 예시값입니다.
// 실제 서비스에서는 한국체육산업개발 연계 데이터(입출차·공연·날씨)와 서울시 승하차 데이터로 산출한 값으로 교체합니다.
window.FLAT = window.FLAT || {};

FLAT.VENUES = {
  kspo:  { name: 'KSPO DOME', sub: '올림픽체조경기장', cap: 15000, walk: { mongchon: 12, olpark: 10, hanseong: 9, bus: 6 }, gate: { east: 0.25, south: 0.55, north: 0.20 } },
  arena: { name: '티켓링크 라이브 아레나', sub: '핸드볼경기장', cap: 5000, walk: { mongchon: 14, olpark: 5, hanseong: 12, bus: 5 }, gate: { east: 0.65, south: 0.20, north: 0.15 } },
  hall:  { name: '올림픽홀', sub: '뮤즈라이브', cap: 3000, walk: { mongchon: 9, olpark: 9, hanseong: 13, bus: 6 }, gate: { east: 0.35, south: 0.20, north: 0.45 } },
  art:   { name: '우리금융아트홀', sub: '올림픽역도경기장', cap: 1200, walk: { mongchon: 8, olpark: 9, hanseong: 14, bus: 5 }, gate: { east: 0.30, south: 0.20, north: 0.50 } },
};

// absorb: 10분 동안 추가로 받아낼 수 있는 인원(예시), pref: 관객 분산 가중치(노선 수·접근성)
FLAT.STATIONS = {
  olpark:   { name: '올림픽공원역', lines: '5·9호선', absorb: 1800, pref: 1.5 },
  mongchon: { name: '몽촌토성역', lines: '8호선', absorb: 800, pref: 1.0 },
  hanseong: { name: '한성백제역', lines: '9호선', absorb: 1000, pref: 0.8 },
  bus:      { name: '공원 주변 버스정류장', lines: '간선·지선 버스', absorb: 900, pref: 0.5 },
};

// 목적지별 역에서 출발한 뒤 예상 소요시간(분, 예시)
FLAT.DESTS = {
  jamsil:   { name: '잠실·강남', travel: { mongchon: 22, olpark: 26, hanseong: 24, bus: 30 } },
  gangdong: { name: '강동·하남', travel: { mongchon: 34, olpark: 18, hanseong: 30, bus: 24 } },
  seongnam: { name: '성남·분당', travel: { mongchon: 30, olpark: 42, hanseong: 40, bus: 45 } },
  center:   { name: '서울 도심(종로·광화문)', travel: { mongchon: 46, olpark: 40, hanseong: 44, bus: 55 } },
  yeouido:  { name: '여의도·서울 서남부', travel: { mongchon: 55, olpark: 42, hanseong: 38, bus: 65 } },
};

FLAT.PARKING = {
  east:  { name: '동2문 주차장', cap: 900 },
  south: { name: '남2문 주차장', cap: 1000 },
  north: { name: '북2문 주차장', cap: 600 },
};

FLAT.PARAMS = {
  fill: 0.92,            // 좌석 점유율(예시)
  carShare: 0.15,        // 자가용 이용 비율(예시) — 실제: 공연일/비공연일 차량 수 차이로 산출
  personsPerCar: 2.2,
  exitDist: [0.30, 0.28, 0.18, 0.12, 0.07, 0.05], // 종료 후 10분 단위 퇴장 비율 — 실제: 입출차 기록을 종료 시각 기준 정렬해 산출
  gateExitPer10: 130,    // 주차장 출구 10분당 출차 처리 대수(예시)
  // 평상시 역 혼잡 기준값(시간대별 0~1, 예시) — 실제: 서울시 역별 시간대별 승하차·서울교통공사 혼잡도
  baseWeekday: { 12: .35, 13: .35, 14: .35, 15: .4, 16: .5, 17: .7, 18: .75, 19: .55, 20: .45, 21: .4, 22: .35, 23: .25, 24: .1, 25: .05 },
  baseWeekend: { 12: .4, 13: .45, 14: .45, 15: .45, 16: .45, 17: .45, 18: .45, 19: .4, 20: .35, 21: .3, 22: .28, 23: .2, 24: .1, 25: .05 },
  parkBaseWeekday: { 12: .35, 13: .35, 14: .35, 15: .35, 16: .3, 17: .25, 18: .2, 19: .18, 20: .15, 21: .1, 22: .06, 23: .04, 24: .02, 25: .02 },
  parkBaseWeekend: { 12: .55, 13: .6, 14: .6, 15: .55, 16: .5, 17: .4, 18: .3, 19: .22, 20: .15, 21: .1, 22: .06, 23: .04, 24: .02, 25: .02 },
};

FLAT.HOLIDAYS = ['2026-12-25', '2027-01-01'];

// ---- 공연 일정 (회차 단위) ----
(function () {
  const S = [];
  const add = (date, time, title, venue, dur = 150) => S.push({ date, time, title, venue, dur });

  add('2026-11-27', '19:00', '2026 조용필 & 위대한탄생 콘서트', 'kspo');
  add('2026-11-28', '18:00', '2026 조용필 & 위대한탄생 콘서트', 'kspo');
  add('2026-11-29', '17:00', '2026 조용필 & 위대한탄생 콘서트', 'kspo');
  add('2026-11-27', '20:00', '2026 다이나믹 듀오 단독 콘서트 "가끔씩 오래 보자"', 'hall');
  add('2026-11-28', '18:00', '2026 다이나믹 듀오 단독 콘서트 "가끔씩 오래 보자"', 'hall');
  add('2026-11-29', '17:00', '2026 다이나믹 듀오 단독 콘서트 "가끔씩 오래 보자"', 'hall');

  add('2026-12-04', '19:00', '이승철 40주년 콘서트 [THE VOICE]', 'kspo');
  add('2026-12-05', '16:00', '이승철 40주년 콘서트 [THE VOICE]', 'kspo');
  add('2026-12-06', '16:00', '이승철 40주년 콘서트 [THE VOICE]', 'kspo');
  add('2026-12-05', '18:00', '2026 비(RAIN) CONCERT [THE SMOKE]', 'hall');
  add('2026-12-06', '17:00', '2026 비(RAIN) CONCERT [THE SMOKE]', 'hall');

  add('2026-12-11', '19:00', '2026 박지현 팬콘서트 〈멤버쉽 시즌2〉', 'hall');
  add('2026-12-12', '17:00', '2026 박지현 팬콘서트 〈멤버쉽 시즌2〉', 'hall');
  add('2026-12-13', '16:00', '2026 박지현 팬콘서트 〈멤버쉽 시즌2〉', 'hall');
  add('2026-12-12', '18:00', '2026 DAVICHI CONCERT 〈IN OUR SCENES〉', 'kspo');
  add('2026-12-13', '17:00', '2026 DAVICHI CONCERT 〈IN OUR SCENES〉', 'kspo');

  add('2026-12-18', '19:00', "2026 DAY6 Special Concert 'The Present'", 'kspo');
  add('2026-12-19', '18:00', "2026 DAY6 Special Concert 'The Present'", 'kspo');
  add('2026-12-20', '17:00', "2026 DAY6 Special Concert 'The Present'", 'kspo');
  add('2026-12-18', '20:00', '자우림 단독 콘서트 [MIDNIGHT EXPRESS]', 'hall');
  add('2026-12-19', '18:00', '자우림 단독 콘서트 [MIDNIGHT EXPRESS]', 'hall');
  add('2026-12-20', '17:00', '자우림 단독 콘서트 [MIDNIGHT EXPRESS]', 'hall');
  add('2026-12-18', '19:30', '2026 XIA Musical Concert with Orchestra Vol.9', 'arena');
  add('2026-12-19', '18:00', '2026 XIA Musical Concert with Orchestra Vol.9', 'arena');
  add('2026-12-20', '17:00', '2026 XIA Musical Concert with Orchestra Vol.9', 'arena');

  add('2026-12-24', '19:30', '2026 THE BOYZ CONCERT : ZENERATION III', 'kspo');
  add('2026-12-25', '18:00', '2026 THE BOYZ CONCERT : ZENERATION III', 'kspo');
  add('2026-12-26', '17:00', '2026 THE BOYZ CONCERT : ZENERATION III', 'kspo');
  add('2026-12-27', '16:00', '2026 THE BOYZ CONCERT : ZENERATION III', 'kspo');
  add('2026-12-24', '20:00', '2026 박진영 콘서트 〈WET〉', 'hall');
  add('2026-12-25', '17:00', '2026 박진영 콘서트 〈WET〉', 'hall');
  add('2026-12-26', '18:00', '2026 박진영 콘서트 〈WET〉', 'hall');
  add('2026-12-25', '18:30', '2026 CRUSH CONCERT [CRUSH H♥UR]', 'arena');
  add('2026-12-26', '18:00', '2026 CRUSH CONCERT [CRUSH H♥UR]', 'arena');

  add('2026-12-31', '21:00', '2026 성시경 연말 콘서트 〈성시경〉', 'kspo', 180);

  // 최현우 30주년 기념 공연 - LEGACY (2026.11.28~2027.1.3, 수목금 19:30 / 토 15·19시 / 일 14시, 일자별 변동 가능)
  const title = '최현우 30주년 기념 공연 - LEGACY';
  for (let d = new Date(2026, 10, 28); d <= new Date(2026, 11, 31); d.setDate(d.getDate() + 1)) {
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const w = d.getDay();
    if (w >= 3 && w <= 5) add(iso, '19:30', title, 'art', 120);
    if (w === 6) { add(iso, '15:00', title, 'art', 120); add(iso, '19:00', title, 'art', 120); }
    if (w === 0) add(iso, '14:00', title, 'art', 120);
  }
  S.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  S.forEach((s, i) => (s.id = i));
  FLAT.SHOWS = S;
})();
