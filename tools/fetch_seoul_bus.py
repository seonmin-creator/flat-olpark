"""실제 교통카드 승하차 데이터로 bus_data.js 만들기.

필요한 인증키 (모두 무료, 본인이 직접 발급):
  SEOUL_KEY : 서울 열린데이터광장(data.seoul.go.kr) 일반 인증키
              → 「서울시 버스노선별 정류장별 시간대별 승하차 인원 정보」(CardBusTimeNew)
  DATA_KEY  : 공공데이터포털(data.go.kr) 인증키(Decoding). 아래 서비스를 각각 활용신청해야 합니다.
              → 서울특별시_노선정보조회 서비스 (노선 ID, 배차간격, 정류장 순서)
              → 서울특별시_정류소정보조회 서비스 (좌표기반 근접정류소 getStationByPos,
                                                  정류소별 노선 첫차/막차 getBustimeByStation)

실행 (PowerShell):
  $env:SEOUL_KEY="..."; $env:DATA_KEY="..."; python -I tools/fetch_seoul_bus.py 202510 3412 3413 30
  (첫 인자: 사용년월 YYYYMM, 그 뒤: 올림픽공원을 지나는 버스 번호들)
"""
import json
import os
import sys
import urllib.parse
import urllib.request
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "bus_data.js"
SEOUL_KEY = os.environ.get("SEOUL_KEY", "")
DATA_KEY = os.environ.get("DATA_KEY", "")
WS = "http://ws.bus.go.kr/api/rest"

# 공연장 대략 좌표(WGS84) — 근접정류소 검색용. 지도에서 확인 후 필요하면 수정하세요.
VENUE_POS = {
    "kspo": (127.1270, 37.5197),   # KSPO DOME
    "arena": (127.1240, 37.5164),  # 티켓링크 라이브 아레나(핸드볼경기장)
    "hall": (127.1296, 37.5190),   # 올림픽홀
    "art": (127.1256, 37.5181),    # 우리금융아트홀
}
RADIUS_M = 500


def get_json(url):
    with urllib.request.urlopen(url, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


def ws(path, **params):
    q = urllib.parse.urlencode({"serviceKey": DATA_KEY, "resultType": "json", **params})
    body = get_json(f"{WS}/{path}?{q}")
    return (body.get("msgBody") or {}).get("itemList") or []


def card_rows(ym, rte_no):
    """CardBusTimeNew: 1회 최대 1000건, 노선번호로 필터."""
    rows, start = [], 1
    while True:
        url = f"http://openapi.seoul.go.kr:8088/{SEOUL_KEY}/json/CardBusTimeNew/{start}/{start + 999}/{ym}/{urllib.parse.quote(rte_no)}/"
        d = get_json(url).get("CardBusTimeNew", {})
        part = d.get("row", [])
        rows += part
        if len(part) < 1000:
            break
        start += 1000
    for r in rows:  # 원본 데이터의 필드명 표기 차이(HR_1_GET_ON_NOPE) 통일
        for io in ("ON", "OFF"):
            for h in range(24):
                k = f"HR_{h}_GET_{io}_TNOPE"
                if k not in r:
                    r[k] = float(r.get(f"HR_{h}_GET_{io}_NOPE", 0) or 0)
    return rows


def to_min(tm, late=True):
    """'20251126233000' / '233000' / '2330' → 분. 새벽(0~3시)은 다음날로 보고 +1440."""
    d = "".join(ch for ch in str(tm or "") if ch.isdigit())
    if len(d) >= 12:
        d = d[8:12]
    if len(d) < 4:
        return None
    m = int(d[:2]) * 60 + int(d[2:4])
    return m + 1440 if late and m < 4 * 60 else m


def main():
    if not SEOUL_KEY or not DATA_KEY or len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    ym, routes = sys.argv[1], sys.argv[2:]
    all_rows, meta = [], []
    for no in routes:
        rows = card_rows(ym, no)
        if not rows:
            print(f"[{no}] 승하차 데이터 없음 — 건너뜀")
            continue
        items = ws("busRouteInfo/getBusRouteList", strSrch=no)
        info = next((i for i in items if i.get("busRouteNm") == no), items[0] if items else {})
        stops = sorted(ws("busRouteInfo/getStaionByRoute", busRouteId=info["busRouteId"]), key=lambda i: int(i["seq"]))
        by_ars = {r["STOPS_ARS_NO"].zfill(5): r for r in rows}
        seq_ids = []
        for s in stops:
            r = by_ars.get(str(s.get("arsId", "")).zfill(5))
            if r and r["STOPS_ID"] not in seq_ids:
                seq_ids.append(r["STOPS_ID"])
        meta.append({"RTE_NO": no, "RTE_NM": rows[0]["RTE_NM"], "busRouteId": info["busRouteId"],
                     "headway": int(info.get("term") or 10), "first": to_min(info.get("firstBusTm"), late=False) or 5 * 60,
                     "last": to_min(info.get("lastBusTm")), "stops": seq_ids, "minPerStop": 2.0, "lastAt": {}})
        all_rows += rows
        print(f"[{no}] 정류장 {len(seq_ids)}곳, 승하차 {len(rows)}행, 배차 {info.get('term')}분")

    # ---- 좌표기반 근접정류소: 공연장마다 가까운 정류장과 비중 ----
    ars_to_id = {r["STOPS_ARS_NO"].zfill(5): r["STOPS_ID"] for r in all_rows}
    on_route = {sid for m in meta for sid in m["stops"]}
    venue_stops = {}
    for v, (x, y) in VENUE_POS.items():
        near = ws("stationinfo/getStationByPos", tmX=x, tmY=y, radius=RADIUS_M)
        w = {}
        for s in near:
            sid = ars_to_id.get(str(s.get("arsId", "")).zfill(5))
            if sid in on_route:
                w[sid] = w.get(sid, 0) + 1 / max(50.0, float(s.get("dist") or 50))
        tot = sum(w.values()) or 1
        venue_stops[v] = {k: round(val / tot, 3) for k, val in w.items()}
        print(f"[{v}] 반경 {RADIUS_M}m 정류장 {len(near)}곳 중 대상 노선 경유 {len(w)}곳")
    park_ids = {sid for d in venue_stops.values() for sid in d}

    # ---- 정류소별 노선 첫차/막차: 공연장 근처 정류장만 조회 ----
    id_to_ars = {v: k for k, v in ars_to_id.items()}
    for m in meta:
        for sid in m["stops"]:
            if sid not in park_ids:
                continue
            for it in ws("stationinfo/getBustimeByStation", arsId=id_to_ars[sid], busRouteId=m["busRouteId"]):
                last = to_min(it.get("lastBusTm"))
                if last is not None:
                    m["lastAt"][sid] = last
        print(f"[{m['RTE_NO']}] 공연장 근처 정류장 막차 {len(m['lastAt'])}곳")

    days = 31 if ym[4:] in ("01", "03", "05", "07", "08", "10", "12") else 30 if ym[4:] != "02" else 28
    js = ("// 자동 생성 파일 — tools/fetch_seoul_bus.py (서울시 교통카드 승하차·노선·정류소 실제 데이터)\n"
          "window.FLAT = window.FLAT || {};\n"
          f"FLAT.BUS_SOURCE = {json.dumps({'kind': 'real', 'label': f'서울시 버스노선별 정류장별 시간대별 승하차 인원 ({ym[:4]}년 {int(ym[4:])}월, 교통카드)', 'useYm': ym, 'days': days}, ensure_ascii=False)};\n"
          f"FLAT.ROUTE_META = {json.dumps(meta, ensure_ascii=False)};\n"
          f"FLAT.VENUE_STOPS = {json.dumps(venue_stops, ensure_ascii=False)};\n"
          f"FLAT.CARD_ROWS = {json.dumps(all_rows, ensure_ascii=False)};\n")
    OUT.write_text(js, encoding="utf-8")
    print(f"wrote {OUT.name}")


if __name__ == "__main__":
    main()
