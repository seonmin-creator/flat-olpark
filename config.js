// 올림픽공원 안전버스 — 실시간 모드 설정
// proxyUrl(중계 서버 주소)을 채우면 '지도에서 목적지 고르기'가 켜집니다. 비워 두면 예시 데이터 시연 모드로 동작합니다.
// 지도는 키가 필요 없는 OpenStreetMap(Leaflet)을 사용합니다.
window.FLAT = window.FLAT || {};
FLAT.CONFIG = {
  proxyUrl: '',   // 예: 'https://olpark-safebus-proxy.<계정>.workers.dev'
};
