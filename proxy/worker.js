// 올림픽공원 안전버스 — API 중계 서버 (Cloudflare Workers)
// 브라우저에서 공공데이터 API를 바로 부르면 인증키가 노출되고 CORS로 막히므로,
// 이 Worker가 인증키를 숨긴 채 정해진 API만 대신 불러 JSON을 돌려줍니다.
//
// 비밀값(Worker Secrets):  DATA_KEY  = 공공데이터포털 인증키(Decoding)
//                          SEOUL_KEY = 서울 열린데이터광장 인증키
// 선택 환경변수:           ALLOW_ORIGIN = https://seonmin-creator.github.io  (다른 사이트에서 못 쓰게)

const WS = 'http://ws.bus.go.kr/api/rest';

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const p = url.searchParams;
    const origin = env.ALLOW_ORIGIN || '*';
    const headers = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Content-Type': 'application/json; charset=utf-8',
    };
    if (req.method === 'OPTIONS') return new Response(null, { headers });
    if (req.method !== 'GET') return json({ error: 'GET only' }, 405, headers);

    const ws = (path, params) => `${WS}/${path}?` + new URLSearchParams({ serviceKey: env.DATA_KEY, resultType: 'json', ...params });
    const need = (...keys) => keys.every((k) => p.get(k));
    let target, ttl = 300;

    switch (url.pathname) {
      case '/api/poi': // 장소(목적지) 검색 — 대중교통환승경로: getLocationInfo
        if (!need('q')) break;
        target = ws('pathinfo/getLocationInfo', { stSrch: p.get('q') });
        break;
      case '/api/path': // 출발지→목적지 버스 경로 — 대중교통환승경로: getPathInfoByBus
        if (!need('sx', 'sy', 'ex', 'ey')) break;
        target = ws('pathinfo/getPathInfoByBus', { startX: p.get('sx'), startY: p.get('sy'), endX: p.get('ex'), endY: p.get('ey') });
        break;
      case '/api/stations': // 노선의 정류장 순서 — 노선정보조회: getStaionByRoute
        if (!need('rid')) break;
        target = ws('busRouteInfo/getStaionByRoute', { busRouteId: p.get('rid') }); ttl = 86400;
        break;
      case '/api/routeinfo': // 배차간격·첫차·막차 — 노선정보조회: getRouteInfo
        if (!need('rid')) break;
        target = ws('busRouteInfo/getRouteInfo', { busRouteId: p.get('rid') }); ttl = 86400;
        break;
      case '/api/bustime': // 정류소별 노선 첫차/막차 — 정류소정보조회: getBustimeByStation
        if (!need('ars', 'rid')) break;
        target = ws('stationinfo/getBustimeByStation', { arsId: p.get('ars'), busRouteId: p.get('rid') }); ttl = 86400;
        break;
      case '/api/near': // 좌표기반 근접정류소 — 정류소정보조회: getStationByPos
        if (!need('x', 'y')) break;
        target = ws('stationinfo/getStationByPos', { tmX: p.get('x'), tmY: p.get('y'), radius: p.get('r') || '500' }); ttl = 86400;
        break;
      case '/api/card': // 교통카드 승하차 — 서울 열린데이터광장: CardBusTimeNew
        if (!need('ym', 'rte') || !/^\d{6}$/.test(p.get('ym'))) break;
        target = `http://openapi.seoul.go.kr:8088/${env.SEOUL_KEY}/json/CardBusTimeNew/1/1000/${p.get('ym')}/${encodeURIComponent(p.get('rte'))}/`; ttl = 86400;
        break;
      case '/api/health':
        return json({ ok: true, dataKey: !!env.DATA_KEY, seoulKey: !!env.SEOUL_KEY }, 200, headers);
      default:
        return json({ error: 'not found' }, 404, headers);
    }
    if (!target) return json({ error: 'missing parameters' }, 400, headers);

    try {
      const r = await fetch(target, { cf: { cacheTtl: ttl, cacheEverything: true } });
      return new Response(await r.text(), { status: r.status, headers: { ...headers, 'Cache-Control': `public, max-age=${ttl}` } });
    } catch (e) {
      return json({ error: 'upstream failed', detail: String(e) }, 502, headers);
    }
  },
};

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), { status, headers });
}
