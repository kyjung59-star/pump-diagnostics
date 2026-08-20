/**
 * Pump Diagnostics 서비스 워커
 * --------------------------------------------------------
 * PWA 설치 가능성(installability) 요건 중 하나가 "서비스 워커 등록"이라
 * 이 파일이 필요하다. 전략은 단순하게:
 *   - 정적 자산(JS/CSS/아이콘/manifest)은 캐시 우선(cache-first)
 *   - API 호출(/api/*)은 항상 네트워크로 (오프라인 캐싱 대상 아님 —
 *     AI 진단은 서버 연결이 필수이므로 캐시하면 안 됨)
 *   - 캐시된 적 없는 요청은 네트워크로 가되, 성공하면 캐시에 저장
 *
 * 오프라인일 때는 이미 방문한 화면(앱 셸)만 열리고, 새 진단 요청 등
 * API가 필요한 동작은 여전히 인터넷이 있어야 한다 — 이 점은 앱 설명에
 * 명시해두는 게 좋다(완전 오프라인 앱이 아님).
 */

const CACHE_NAME = "pump-diagnostics-v1";
const APP_SHELL = ["/", "/index.html", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // API 호출은 절대 캐시하지 않고 항상 네트워크로 보낸다
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // GET 요청이 아니면 그대로 통과
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match("/index.html"));
    })
  );
});
