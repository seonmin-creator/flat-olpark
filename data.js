// FLAT BUS 올팍 — 공연 데이터 (한국체육산업개발 「올림픽공원 공연정보」)
// 공연 일정: 올림픽공원 공식 공연/행사 일정안내(2026.11~12) 기준
// 수용인원·버스 이용 비율·퇴장 분포는 시연용 예시값 (정식 서비스: 올림픽공원 입출차·공연 연계 데이터로 보정)
window.FLAT = window.FLAT || {};

FLAT.VENUES = {
  kspo:  { name: 'KSPO DOME', sub: '올림픽체조경기장', cap: 15000, stop: { '평화의문': 0.5, '남2문': 0.5 } },
  arena: { name: '티켓링크 라이브 아레나', sub: '핸드볼경기장', cap: 5000, stop: { '평화의문': 0.3, '남2문': 0.7 } },
  hall:  { name: '올림픽홀', sub: '뮤즈라이브', cap: 3000, stop: { '평화의문': 0.7, '남2문': 0.3 } },
  art:   { name: '우리금융아트홀', sub: '올림픽역도경기장', cap: 1200, stop: { '평화의문': 0.6, '남2문': 0.4 } },
};

FLAT.EVENT = {
  fill: 0.92,                 // 좌석 점유율(예시)
  busShare: 0.06,             // 관객 중 버스 이용 비율(예시)
  walkToStop: 7,              // 공연장 → 정류장 도보(분, 예시)
  exitDist: [0.30, 0.28, 0.18, 0.12, 0.07, 0.05], // 종료 후 10분 단위 퇴장 비율(예시)
  parkKeyword: '올림픽공원',  // 이 이름이 들어간 정류장 = 공연 관객이 타는 정류장
};

FLAT.BUS_CAPACITY = 60;       // 버스 1대 최대 탑승 가능 인원(예시: 좌석+입석)
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
