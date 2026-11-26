"""시연용 예시 데이터 생성기.

서울시 「버스노선별 정류장별 시간대별 승하차 인원」(교통카드, OpenAPI CardBusTimeNew)과
똑같은 필드 구조로 예시 데이터를 만들어 bus_data.js 로 저장합니다.
실제 데이터는 tools/fetch_seoul_bus.py 로 받아 같은 파일을 덮어쓰면 됩니다.

실행: python -I tools/make_sample.py
"""
import json
import random
from pathlib import Path

random.seed(2026)
OUT = Path(__file__).resolve().parent.parent / "bus_data.js"
USE_YM = "202510"
DAYS = 31

PARK_N = "올림픽공원(평화의문)"
PARK_S = "올림픽공원(남2문)"

# 예시 노선 — 정류장 이름은 올림픽공원 주변 지명, 노선 구성은 시연용
ROUTES = [
    {"no": "A", "last": 23 * 60 + 50, "nm": "간선 A(천호역~강남역)", "headway": 8, "first": 5 * 60 + 10,
     "stops": ["천호역", "강동구청", "성내역", PARK_N, "몽촌토성역", "잠실나루역", "잠실역", "잠실새내역", "종합운동장", "삼성역", "강남역"]},
    {"no": "B", "last": 23 * 60 + 20, "nm": "간선 B(하남시청~잠실새내역)", "headway": 10, "first": 5 * 60 + 20,
     "stops": ["하남시청", "미사역", "상일동역", "고덕역", "둔촌동역", PARK_S, "방이역", "송파구청", "잠실역", "잠실새내역"]},
    {"no": "C", "last": 22 * 60 + 55, "nm": "지선 C(마천역~문정역)", "headway": 12, "first": 5 * 60 + 30,
     "stops": ["마천역", "거여역", "개롱역", "오금역", "방이역", PARK_S, "한성백제역", "석촌역", "가락시장역", "문정역"]},
    {"no": "D", "last": 24 * 60 + 10, "nm": "간선 D(잠실역~하남검단산)", "headway": 9, "first": 5 * 60 + 15,
     "stops": ["잠실역", "잠실나루역", PARK_N, "둔촌동역", "상일동역", "미사역", "하남시청", "하남검단산역"]},
    {"no": "E", "last": 23 * 60 + 40, "nm": "간선 E(강남역~암사역)", "headway": 10, "first": 5 * 60 + 5,
     "stops": ["강남역", "삼성역", "종합운동장", "잠실역", "몽촌토성역", PARK_N, "성내역", "강동구청", "천호역", "암사역"]},
]
HUBS = {"잠실역": 2.2, "강남역": 2.0, "천호역": 1.8, "삼성역": 1.6, "하남시청": 1.5, "가락시장역": 1.3, PARK_N: 1.3, PARK_S: 1.2}

# 버스 1대가 노선 전체에서 태우는 평균 승차 인원 (시간대별, 예시)
PER_BUS_BOARD = {5: 15, 6: 30, 7: 70, 8: 85, 9: 55, 10: 40, 11: 40, 12: 45, 13: 45, 14: 45, 15: 50,
                 16: 55, 17: 75, 18: 85, 19: 60, 20: 45, 21: 38, 22: 32, 23: 20}

stop_ids, ars = {}, {}
rows, meta = [], []
for r in ROUTES:
    n = len(r["stops"])
    w_on = []
    for i, s in enumerate(r["stops"]):
        pop = HUBS.get(s, random.uniform(0.6, 1.2))
        w_on.append(0 if i == n - 1 else pop * (1 - i / n) ** 0.6)
    tot = sum(w_on)
    w_on = [w / tot for w in w_on]
    off_rate = []
    for i, s in enumerate(r["stops"]):
        pop = HUBS.get(s, random.uniform(0.6, 1.2))
        off_rate.append(1.0 if i == n - 1 else 0 if i == 0 else min(0.85, 0.12 * pop * (0.5 + i / n)))
    buses_per_hour = 60 / r["headway"]
    hr = {i: {} for i in range(n)}
    for h in range(24):
        D = PER_BUS_BOARD.get(h, 0)
        load = 0.0
        for i in range(n):
            off = load * off_rate[i]
            on = D * w_on[i] * random.uniform(0.9, 1.1)
            load = load - off + on
            scale = buses_per_hour * DAYS
            hr[i][h] = (round(on * scale), round(off * scale))
    for i, s in enumerate(r["stops"]):
        if s not in stop_ids:
            stop_ids[s] = f"1240{len(stop_ids):05d}"
            ars[s] = f"24{len(ars):03d}"
        row = {"USE_YM": USE_YM, "RTE_NO": r["no"], "RTE_NM": r["nm"], "STOPS_ID": stop_ids[s],
               "STOPS_ARS_NO": ars[s], "SBWY_STNS_NM": f"{s}({ars[s]})"}
        for h in range(24):
            on, off = hr[i][h]
            row[f"HR_{h}_GET_ON_TNOPE"] = float(on)
            row[f"HR_{h}_GET_OFF_TNOPE"] = float(off)
        rows.append(row)
    mps = 2.5
    meta.append({"RTE_NO": r["no"], "RTE_NM": r["nm"], "headway": r["headway"], "first": r["first"], "last": r["last"],
                 "stops": [stop_ids[s] for s in r["stops"]], "minPerStop": mps,
                 # 정류소별 막차 (예시: 첫 정류장 막차 + 정류장 수 × 2.5분)
                 "lastAt": {stop_ids[s]: round(r["last"] + i * mps) for i, s in enumerate(r["stops"]) if s in (PARK_N, PARK_S)}})

# 좌표기반 근접정류소 결과와 같은 형식 (공연장별 가까운 정류장 비중, 예시)
VENUE_STOPS = {
    "kspo": {stop_ids[PARK_N]: 0.5, stop_ids[PARK_S]: 0.5},
    "arena": {stop_ids[PARK_N]: 0.3, stop_ids[PARK_S]: 0.7},
    "hall": {stop_ids[PARK_N]: 0.7, stop_ids[PARK_S]: 0.3},
    "art": {stop_ids[PARK_N]: 0.6, stop_ids[PARK_S]: 0.4},
}

js = ("// 자동 생성 파일 — tools/make_sample.py (시연용 예시 데이터, 실제 데이터와 동일한 필드 구조)\n"
      "window.FLAT = window.FLAT || {};\n"
      f"FLAT.BUS_SOURCE = {json.dumps({'kind': 'sample', 'label': '시연용 예시 데이터 (서울시 교통카드 승하차 데이터와 동일 형식)', 'useYm': USE_YM, 'days': DAYS}, ensure_ascii=False)};\n"
      f"FLAT.ROUTE_META = {json.dumps(meta, ensure_ascii=False)};\n"
      f"FLAT.VENUE_STOPS = {json.dumps(VENUE_STOPS, ensure_ascii=False)};\n"
      f"FLAT.CARD_ROWS = {json.dumps(rows, ensure_ascii=False)};\n")
OUT.write_text(js, encoding="utf-8")
print(f"wrote {OUT.name}: {len(rows)} rows, {len(meta)} routes")
