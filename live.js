// 올림픽공원 안전버스 — 실시간 모드: 지도(Leaflet + OpenStreetMap)에서 목적지 고르기 → 실제 버스 노선으로 혼잡도 계산
// 지도는 키·회원가입이 필요 없는 OpenStreetMap을 씁니다. config.js 의 proxyUrl(중계 서버 주소)만 있으면 켜집니다.
(function () {
  const $ = (id) => document.getElementById(id);
  const C = FLAT.CONFIG || {};
  // 공연장 좌표(WGS84, 대략) — 출발 기준점
  const VENUE_POS = {
    kspo: [127.1270, 37.5197], arena: [127.1240, 37.5164], hall: [127.1296, 37.5190], art: [127.1256, 37.5181],
  };
  let map = null, destMarker = null, layers = [];

  const arr = (x) => (Array.isArray(x) ? x : x ? [x] : []);
  const items = (j) => arr(j && j.msgBody && j.msgBody.itemList);
  const pad5 = (s) => String(s || '').padStart(5, '0');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function toMin(tm, late = true) {
    let d = String(tm || '').replace(/\D/g, '');
    if (d.length >= 12) d = d.slice(8, 12);
    if (d.length < 4) return null;
    const m = +d.slice(0, 2) * 60 + +d.slice(2, 4);
    return late && m < 240 ? m + 1440 : m;
  }
  function distM(x1, y1, x2, y2) {
    const R = 6371000, toR = Math.PI / 180;
    const a = Math.sin(((y2 - y1) * toR) / 2) ** 2 + Math.cos(y1 * toR) * Math.cos(y2 * toR) * Math.sin(((x2 - x1) * toR) / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }
  const isLive = () => !!(C.proxyUrl || FLAT.MOCK_API);

  async function api(path, params) {
    if (FLAT.MOCK_API) return FLAT.MOCK_API(path, params);
    const r = await fetch(C.proxyUrl.replace(/\/$/, '') + path + '?' + new URLSearchParams(params));
    if (!r.ok) throw new Error(`${path} ${r.status}`);
    return r.json();
  }
  const status = (msg, err) => { const s = $('liveStatus'); if (s) { s.innerHTML = msg; s.className = 'live-status' + (err ? ' err' : ''); } };

  // ---------- 화면 ----------
  function render() {
    const panel = $('livePanel');
    if (!panel) return;
    if (!isLive()) {
      panel.innerHTML = `<div class="live-head"><h3 class="card-title" style="margin:0">🗺️ 지도에서 목적지 고르기</h3><span class="badge soon-badge">준비 중</span></div>
        <p class="note" style="margin:8px 0 0">공공데이터 인증키를 연결하면 서울 어디든 목적지로 골라, 그곳에 가는 실제 버스 노선으로 혼잡도를 계산해요. 지금은 아래 예시 노선으로 체험할 수 있어요.</p>`;
      return;
    }
    panel.innerHTML = `<div class="live-head"><h3 class="card-title" style="margin:0">🗺️ 지도에서 목적지 고르기</h3><span class="badge">실시간 노선</span></div>
      <div class="live-row">
        <select id="liveVenue" aria-label="출발 공연장">${Object.keys(VENUE_POS).map((k) => `<option value="${k}">${FLAT.VENUES[k].name}에서 출발</option>`).join('')}</select>
        <input id="liveQ" placeholder="목적지 검색 (예: 강남역, 코엑스)" autocomplete="off">
        <button id="liveGo" class="btn btn-sm" type="button">검색</button>
      </div>
      <div id="liveResults" class="live-results"></div>
      <div id="liveMap" class="live-map"></div>
      <p id="liveStatus" class="live-status">검색하거나 지도를 눌러 목적지를 고르세요.</p>`;
    $('liveGo').addEventListener('click', search);
    $('liveQ').addEventListener('keydown', (e) => { if (e.key === 'Enter') search(); });
    initMap();
  }

  function initMap() {
    if (!window.L) { $('liveMap').innerHTML = '<span class="note">지도를 불러오지 못했어요 (검색은 사용 가능).</span>'; return; }
    if (map) { map.remove(); map = null; }
    map = L.map('liveMap', { scrollWheelZoom: false }).setView([37.5206, 127.1215], 13);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    L.circleMarker([37.5197, 127.1270], { radius: 9, color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 })
      .addTo(map).bindTooltip('올림픽공원', { permanent: true, direction: 'top', offset: [0, -8] });
    map.on('click', (e) => pick({ name: '지도에서 고른 곳', x: e.latlng.lng, y: e.latlng.lat }));
    setTimeout(() => map && map.invalidateSize(), 200);
  }

  async function search() {
    const q = $('liveQ').value.trim();
    if (!q) return;
    status('장소를 찾는 중…');
    try {
      const list = items(await api('/api/poi', { q })).slice(0, 8);
      if (!list.length) { $('liveResults').innerHTML = ''; return status('검색 결과가 없어요. 다른 이름으로 찾아보세요.', true); }
      $('liveResults').innerHTML = list.map((p, i) => `<button type="button" data-i="${i}">${esc(p.poiNm)}</button>`).join('');
      [...$('liveResults').children].forEach((b) => b.addEventListener('click', () => {
        const p = list[+b.dataset.i];
        pick({ name: p.poiNm, x: +p.gpsX, y: +p.gpsY });
      }));
      status('목적지를 골라주세요.');
    } catch (e) { status('장소 검색에 실패했어요: ' + esc(e.message), true); }
  }

  // 교통카드 데이터는 보통 1~2달 늦게 공개되므로 최근 달부터 차례로 시도
  async function cardRows(rteNo) {
    const now = new Date();
    for (let back = 1; back <= 4; back++) {
      const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
      const ym = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
      const j = await api('/api/card', { ym, rte: rteNo });
      const rows = arr(j && j.CardBusTimeNew && j.CardBusTimeNew.row);
      if (rows.length) {
        rows.forEach((r) => { for (const io of ['ON', 'OFF']) for (let h = 0; h < 24; h++) { const k = `HR_${h}_GET_${io}_TNOPE`; if (r[k] == null) r[k] = +(r[`HR_${h}_GET_${io}_NOPE`] || 0); } });
        return { rows, ym, days: new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() };
      }
    }
    return { rows: [], ym: null, days: 30 };
  }

  function clearMap() {
    if (!map) return;
    layers.forEach((l) => map.removeLayer(l)); layers = [];
    if (destMarker) { map.removeLayer(destMarker); destMarker = null; }
  }

  // ---------- 목적지 선택 → 노선 찾기 → 혼잡도 계산 ----------
  async function pick(dest) {
    const venue = ($('liveVenue') && $('liveVenue').value) || 'kspo';
    const [sx, sy] = VENUE_POS[venue];
    clearMap();
    if (map) {
      destMarker = L.circleMarker([dest.y, dest.x], { radius: 9, color: '#fff', weight: 3, fillColor: '#ef4444', fillOpacity: 1 })
        .addTo(map).bindTooltip(esc(dest.name), { permanent: true, direction: 'top', offset: [0, -8] });
    }
    status(`<b>${esc(dest.name)}</b>(으)로 가는 버스를 찾는 중…`);
    try {
      const paths = items(await api('/api/path', { sx, sy, ex: dest.x, ey: dest.y }));
      // 각 경로의 첫 번째 버스 구간 = 올림픽공원 근처에서 타는 버스
      const legs = [];
      let transfer = 0;
      for (const p of paths) {
        const pl = arr(p.pathList);
        if (!pl.length || !pl[0].routeId) continue;
        if (pl.length > 1) transfer++;
        if (!legs.some((l) => l.routeId === pl[0].routeId)) legs.push(pl[0]);
      }
      if (!legs.length) return status('올림픽공원에서 출발하는 버스 경로를 찾지 못했어요.', true);

      const metas = [], rowsAll = [], destIds = new Set(), boards = [];
      let src = null;
      for (const leg of legs.slice(0, 4)) {
        const rid = leg.routeId;
        const [stJ, riJ, card] = await Promise.all([api('/api/stations', { rid }), api('/api/routeinfo', { rid }), cardRows(leg.routeNm)]);
        const stations = items(stJ).sort((a, b) => +a.seq - +b.seq);
        const info = items(riJ)[0] || {};
        if (!card.rows.length || !stations.length) continue;
        const byId = {}, byArs = {};
        card.rows.forEach((r) => { byId[r.STOPS_ID] = r; byArs[pad5(r.STOPS_ARS_NO)] = r; });
        const mapId = (stationId, ars) => { const r = byId[stationId] || byArs[pad5(ars)]; return r ? r.STOPS_ID : null; };
        const stops = [];
        const arsOf = {};
        stations.forEach((s) => { const id = mapId(s.station, s.arsId); if (id && !stops.includes(id)) { stops.push(id); arsOf[id] = s.arsId; } });
        const fromSt = stations.find((s) => s.station === leg.fid) || {};
        const fid = mapId(leg.fid, fromSt.arsId);
        const toSt = stations.find((s) => s.station === leg.tid) || {};
        const tid = mapId(leg.tid, toSt.arsId);
        if (!fid || !tid) continue;
        const meta = {
          RTE_NO: card.rows[0].RTE_NO, RTE_NM: card.rows[0].RTE_NM || `${leg.routeNm}번`,
          headway: +info.term || 10, first: toMin(info.firstBusTm, false) ?? 300, last: toMin(info.lastBusTm),
          stops, minPerStop: 2.0, lastAt: {},
        };
        try {
          const bt = items(await api('/api/bustime', { ars: arsOf[fid] || fromSt.arsId, rid }))[0];
          const last = bt && toMin(bt.lastBusTm);
          if (last != null) meta.lastAt[fid] = last;
        } catch (e) { /* 막차 정보가 없으면 노선 막차로 추정 */ }
        metas.push(meta);
        rowsAll.push(...card.rows);
        destIds.add(tid);
        boards.push({ id: fid, x: +leg.fx, y: +leg.fy });
        src = src || card;
        drawLine(stations, leg, meta.RTE_NM);
      }
      if (!metas.length) return status('찾은 노선의 교통카드 승하차 데이터를 불러오지 못했어요.', true);
      if (map && layers.length) map.fitBounds(L.featureGroup([...layers, destMarker].filter(Boolean)).getBounds(), { padding: [30, 30] });

      // 좌표로 공연장별 가까운 탑승 정류장 비중 계산
      const VENUE_STOPS = {};
      for (const [v, [vx, vy]] of Object.entries(VENUE_POS)) {
        const w = {};
        boards.forEach((b) => { const d = distM(vx, vy, b.x, b.y); if (d <= 800) w[b.id] = (w[b.id] || 0) + 1 / Math.max(50, d); });
        // 800m 안에 정류장이 없으면 거리에 반비례해 모든 탑승 정류장에 나눔 (탑승 정류장은 항상 출발지로 남음)
        if (!Object.keys(w).length) boards.forEach((b) => { w[b.id] = (w[b.id] || 0) + 1 / Math.max(50, distM(vx, vy, b.x, b.y)) ** 2; });
        const tot = Object.values(w).reduce((a, b) => a + b, 0) || 1;
        VENUE_STOPS[v] = Object.fromEntries(Object.entries(w).map(([k, val]) => [k, val / tot]));
      }
      const ym = src.ym;
      const model = FLAT.buildModel({
        CARD_ROWS: rowsAll, ROUTE_META: metas, VENUE_STOPS,
        BUS_SOURCE: { kind: 'real', label: `서울시 교통카드 승하차 인원 (${ym.slice(0, 4)}년 ${+ym.slice(4)}월) · ${metas.length}개 노선`, useYm: ym, days: src.days },
      });
      FLAT.app.useModel(model, { destIds, destLabel: dest.name });
      status(`<b>${esc(dest.name)}</b>까지 가는 버스 <b>${metas.length}개 노선</b>으로 계산했어요.${transfer ? ' (환승 경로는 첫 버스 구간만 계산)' : ''}`);
    } catch (e) {
      status('노선 계산에 실패했어요: ' + esc(e.message), true);
    }
  }

  const LINE_COLORS = ['#2563eb', '#16a34a', '#9333ea', '#ea580c'];
  function drawLine(stations, leg, name) {
    if (!map) return;
    const a = stations.findIndex((s) => s.station === leg.fid), b = stations.findIndex((s) => s.station === leg.tid);
    if (a < 0 || b <= a) return;
    const pts = stations.slice(a, b + 1).map((s) => [+s.gpsY, +s.gpsX]).filter((p) => p[0] && p[1]);
    if (pts.length < 2) return;
    const color = LINE_COLORS[layers.length % LINE_COLORS.length];
    layers.push(L.polyline(pts, { color, weight: 5, opacity: 0.85 }).addTo(map).bindTooltip(esc(name)));
  }

  FLAT.live = { init: () => { clearMap(); render(); }, pick };
  render();
})();
