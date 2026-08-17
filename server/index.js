/**
 * Pump Diagnostics — 백엔드 프록시 서버
 * --------------------------------------------------------
 * 역할 두 가지:
 *   1) 빌드된 정적 프론트엔드(dist/)를 서빙
 *   2) POST /api/claude — Anthropic API를 대신 호출하는 프록시.
 *      API 키는 이 서버의 환경변수(ANTHROPIC_API_KEY)에만 존재하고,
 *      브라우저(클라이언트)에는 절대 노출되지 않는다.
 *
 * 프론트엔드(src/App.jsx)의 callClaude()는 api.anthropic.com을 직접 부르는 대신
 * 이 서버의 "/api/claude"를 호출하도록 이미 수정되어 있다.
 */

import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 8787;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

app.post("/api/claude", async (req, res) => {
  if (!ANTHROPIC_API_KEY) {
    // 키가 없으면 즉시 명확한 에러를 반환한다 (서버가 죽지 않고, 클라이언트가 곧바로
    // 오프라인 추정 로직으로 폴백할 수 있게 — App.jsx의 callClaude()는 이 실패를
    // try/catch로 잡아 시뮬레이션 모드로 자동 전환한다).
    return res.status(500).json({ error: "ANTHROPIC_API_KEY is not configured on the server." });
  }

  const { max_tokens, messages } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Request body must include a non-empty 'messages' array." });
  }

  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: max_tokens || 600,
        messages,
      }),
    });

    const data = await upstream.json();
    // Anthropic이 반환한 상태코드/본문을 그대로 클라이언트에 전달한다
    // (인증 실패, 레이트리밋 등도 클라이언트가 동일하게 감지할 수 있도록).
    res.status(upstream.status).json(data);
  } catch (err) {
    console.error("Anthropic API 프록시 호출 실패:", err);
    res.status(502).json({ error: "Failed to reach the Anthropic API.", detail: String(err) });
  }
});

// 헬스체크 — 배포 플랫폼이 서버 정상 여부를 확인할 때 사용
app.get("/api/health", (req, res) => {
  res.json({ ok: true, hasApiKey: Boolean(ANTHROPIC_API_KEY) });
});

// 빌드된 정적 프론트엔드 서빙
const distPath = path.join(__dirname, "..", "dist");
app.use(express.static(distPath));
// SPA 라우팅 대응 catch-all — Express 5의 path-to-regexp가 "*" 패턴을 더 이상
// 허용하지 않으므로, 라우트 패턴 대신 마지막 순서의 일반 미들웨어로 처리한다.
app.use((req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Pump Diagnostics 서버 실행 중 — http://localhost:${PORT}`);
  console.log(`ANTHROPIC_API_KEY 설정됨: ${Boolean(ANTHROPIC_API_KEY)}`);
});
