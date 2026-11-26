"""실제 교통카드 승하차 데이터로 bus_data.js 만들기.

필요한 인증키 (둘 다 무료, 본인이 직접 발급):
  SEOUL_KEY : 서울 열린데이터광장(data.seoul.go.kr) 일반 인증키
              → 「서울시 버스노선별 정류장별 시간대별 승하차 인원 정보」(CardBusTimeNew)
  DATA_KEY  : 공공데이터포털(data.go.kr) 「서울특별시_노선정보조회 서비스」 활용신청 인증키(Decoding)
              → 노선 ID, 배차간격, 정류장 순서(getStaionByRoute)

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


def get_json(url):
    with urllib.request.urlopen(url, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


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


def route_info(rte_no):
    q = urllib.parse.urlencode({"serviceKey": DATA_KEY, "strSrch": rte_no, "resultType": "json"})
    items = get_json(f"http://ws.bus.go.kr/api/rest/busRouteInfo/getBusRouteList?{q}")["msgBody"]["itemList"] or []
    it = next((i for i in items if i["busRouteNm"] == rte_no), items[0])
    return it


def route_stops(route_id):
    q = urllib.parse.urlencode({"serviceKey": DATA_KEY, "busRouteId": route_id, "resultType": "json"})
    items = get_json(f"http://ws.bus.go.kr/api/rest/busRouteInfo/getStaionByRoute?{q}")["msgBody"]["itemList"] or []
    return sorted(items, key=lambda i: int(i["seq"]))


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
        info = route_info(no)
        stops = route_stops(info["busRouteId"])
        by_ars = {r["STOPS_ARS_NO"].zfill(5): r for r in rows}
        seq_ids = []
        for s in stops:
            r = by_ars.get(str(s.get("arsId", "")).zfill(5))
            if r and r["STOPS_ID"] not in seq_ids:
                seq_ids.append(r["STOPS_ID"])
        first = str(info.get("firstBusTm", "") or "")
        first_min = int(first[8:10]) * 60 + int(first[10:12]) if len(first) >= 12 else 5 * 60
        meta.append({"RTE_NO": no, "RTE_NM": rows[0]["RTE_NM"], "headway": int(info.get("term") or 10),
                     "first": first_min, "stops": seq_ids, "minPerStop": 2.0})
        all_rows += rows
        print(f"[{no}] 정류장 {len(seq_ids)}곳, 승하차 {len(rows)}행, 배차 {info.get('term')}분")
    days = 31 if ym[4:] in ("01", "03", "05", "07", "08", "10", "12") else 30 if ym[4:] != "02" else 28
    js = ("// 자동 생성 파일 — tools/fetch_seoul_bus.py (서울시 교통카드 승하차 실제 데이터)\n"
          "window.FLAT = window.FLAT || {};\n"
          f"FLAT.BUS_SOURCE = {json.dumps({'kind': 'real', 'label': f'서울시 버스노선별 정류장별 시간대별 승하차 인원 ({ym[:4]}년 {int(ym[4:])}월, 교통카드)', 'useYm': ym, 'days': days}, ensure_ascii=False)};\n"
          f"FLAT.ROUTE_META = {json.dumps(meta, ensure_ascii=False)};\n"
          f"FLAT.CARD_ROWS = {json.dumps(all_rows, ensure_ascii=False)};\n")
    OUT.write_text(js, encoding="utf-8")
    print(f"wrote {OUT.name}")


if __name__ == "__main__":
    main()
