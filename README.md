# Pump Diagnostics — 정적 프론트엔드 + 백엔드 프록시 서버

React + Vite로 만든 펌프 트러블슈팅 챗봇과, Claude API 키를 안전하게 보관하며
대신 호출해주는 Express 백엔드 프록시 서버로 구성되어 있습니다.

```
pump-site/
├── src/            프론트엔드 소스 (App.jsx, main.jsx)
├── server/         백엔드 프록시 서버 (index.js)
├── dist/           빌드된 정적 파일 (npm run build로 생성)
├── .env.example    환경변수 예시 (복사해서 .env로 사용)
└── package.json
```

## 로컬에서 실행하기

```bash
npm install
cp .env.example .env
# .env 파일을 열어 ANTHROPIC_API_KEY에 실제 키를 입력

npm run build     # 프론트엔드를 dist/ 에 빌드
npm start         # 서버 실행 (http://localhost:8787) — 프론트엔드+API를 한 번에 서빙
```

개발 중에는 `npm run dev`(Vite 개발서버, :5173)와 `npm run server:dev`(API 서버, :8787)를
따로 띄우고 Vite의 프록시 설정을 추가해서 쓰는 것도 가능하지만, 가장 간단한 건 위처럼
`npm run build && npm start`로 한 서버에서 같이 서빙하는 것입니다.

## 배포 방법

이제 **정적 호스팅만으로는 안 되고, Node.js를 실행할 수 있는 서버 호스팅**이 필요합니다.
(API 키를 서버에서만 다루기 위한 구조상 자연스러운 변화입니다.)

### 추천 — Railway / Render / Fly.io (Node 앱 배포)

1. 이 프로젝트 폴더를 GitHub 저장소에 올립니다.
2. Railway(railway.app) 또는 Render(render.com)에서 "새 웹 서비스 → GitHub 저장소 연결"
3. 빌드 명령: `npm install && npm run build`
4. 시작 명령: `npm start`
5. 환경변수(Environment Variables)에 `ANTHROPIC_API_KEY`를 추가 — **여기에만 실제 키를 넣습니다.**
6. 배포하면 `https://your-app.up.railway.app` 같은 URL이 생기고, 그 안에서
   프론트엔드와 `/api/claude` 프록시가 함께 동작합니다.

### 대안 — Vercel (서버리스 함수로 변환하고 싶다면)
`server/index.js`의 `/api/claude` 라우트 로직을 `api/claude.js` 서버리스 함수로
옮기면 Vercel에 프론트+백을 한 번에 배포할 수 있습니다. 필요하시면 이 형태로도
변환해드릴 수 있습니다.

### 기존 정적 전용 호스팅(Netlify Drop, GitHub Pages 등)은 이제 부족합니다
API 프록시는 실행 중인 서버가 필요하므로, 순수 정적 파일만 올리는 호스팅으로는
"오프라인 추정 분류"로만 동작합니다(그 자체로도 앱은 정상 작동하니 급하면 그대로
써도 되지만, 실제 AI 판단은 못 씁니다).

## 환경변수

`.env.example` 참고:
- `ANTHROPIC_API_KEY` (필수) — Anthropic API 키. **절대 프론트엔드 코드나 커밋에 넣지 마세요.**
- `PORT` (선택, 기본 8787)
- `ANTHROPIC_MODEL` (선택, 기본 claude-sonnet-4-6)

## 동작 확인용 엔드포인트

- `GET /api/health` — `{"ok": true, "hasApiKey": true/false}` 반환. 배포 후 키가
  제대로 설정됐는지 바로 확인할 수 있습니다.
- `POST /api/claude` — 프론트엔드가 내부적으로 호출하는 프록시. 직접 테스트하려면:
  ```bash
  curl -X POST https://your-app-url/api/claude \
    -H "Content-Type: application/json" \
    -d '{"max_tokens":50,"messages":[{"role":"user","content":"hello"}]}'
  ```

## 진단 기록 저장

원래 Claude 아티팩트의 `window.storage` API 대신, `src/main.jsx`에 넣어둔
**localStorage 기반 폴리필**로 브라우저별 진단 기록이 저장됩니다.
(서버가 아니라 사용자 브라우저에 저장되므로, 기기·브라우저를 바꾸면 안 보입니다.
여러 사용자의 기록을 서버 DB에 모아 보고 싶다면 별도 백엔드 저장소 연동이 필요합니다.)

## 폰트

`IBM Plex Mono`/`IBM Plex Sans`를 Google Fonts에서 불러옵니다. 배포 환경에
인터넷 연결이 있다면 자동으로 로드됩니다.

