/**
 * NPSH(유효흡입수두) 여유 판정 — 화면/네트워크와 무관한 순수 함수 모음.
 *
 * 부호 규칙(한국 펌프 업계 관례): 흡입높이 hs
 *   +  = 흡상 (액면이 펌프 중심보다 아래, 끌어올림)
 *   −  = 압입 (액면이 펌프 중심보다 위, 물이 걸려 들어옴)
 *
 * NPSHa = Ha − Hv − hs − hf
 *   Ha: 대기압 수두, Hv: 액체 증기압 수두, hs: 흡입높이(위 부호), hf: 흡입배관 손실
 * 판정: NPSHa < NPSHr → insufficient (캐비테이션 발생)
 *       NPSHa < max(1.3 × NPSHr, NPSHr + 0.5) → marginal (여유 부족)
 *       그 외 → sufficient
 */

export const ATM_HEAD_M = 10.33; // 해수면 대기압 수두 (물 기준, m)
export const DEFAULT_TEMP_C = 20;
export const DEFAULT_FRICTION_LOSS_M = 0.5; // 모를 때 쓰는 흡입배관 손실 가정값
export const MARGIN_RATIO = 1.3;
export const MARGIN_MIN_M = 0.5;

// 물의 포화증기압 수두 (m) — 온도(°C) 구간 선형 보간
const VAPOR_HEAD_TABLE = [
  [0, 0.06], [10, 0.12], [20, 0.24], [30, 0.43], [40, 0.76], [50, 1.27],
  [60, 2.06], [70, 3.24], [80, 4.95], [90, 7.36], [100, 10.78],
];

export function vaporHeadM(tempC) {
  const t = Math.min(100, Math.max(0, tempC));
  for (let i = 1; i < VAPOR_HEAD_TABLE.length; i++) {
    const [t1, h1] = VAPOR_HEAD_TABLE[i];
    if (t <= t1) {
      const [t0, h0] = VAPOR_HEAD_TABLE[i - 1];
      return h0 + ((h1 - h0) * (t - t0)) / (t1 - t0);
    }
  }
  return VAPOR_HEAD_TABLE[VAPOR_HEAD_TABLE.length - 1][1];
}

const round1 = (n) => Math.round(n * 10) / 10;

/**
 * @param {{npshr:number, suctionHead:number, tempC?:number, frictionLoss?:number}} input
 * @returns {null | {npshr, suctionHead, tempC, frictionLoss, ha, hv, npsha, required, margin, level}}
 */
export function computeNpsh({ npshr, suctionHead, tempC = DEFAULT_TEMP_C, frictionLoss = DEFAULT_FRICTION_LOSS_M }) {
  if (![npshr, suctionHead, tempC, frictionLoss].every((v) => typeof v === "number" && Number.isFinite(v))) return null;
  if (npshr <= 0 || npshr > 200) return null;
  if (Math.abs(suctionHead) > 100) return null;
  if (frictionLoss < 0 || frictionLoss > 100) return null;
  if (tempC < 0 || tempC > 100) return null;

  const hv = vaporHeadM(tempC);
  const npsha = ATM_HEAD_M - hv - suctionHead - frictionLoss;
  const required = Math.max(npshr * MARGIN_RATIO, npshr + MARGIN_MIN_M);
  const level = npsha < npshr ? "insufficient" : npsha < required ? "marginal" : "sufficient";
  return {
    npshr,
    suctionHead,
    tempC,
    frictionLoss,
    ha: ATM_HEAD_M,
    hv: round1(hv),
    npsha: round1(npsha),
    required: round1(required),
    margin: round1(npsha - npshr),
    level,
  };
}

/* ---------- 자유 텍스트에서 NPSHr / 흡입높이 뽑아내기 ---------- */

const NUM = "([-−–+]?\\s*\\d+(?:\\.\\d+)?)";
const GAP = "[^\\d\\-−–+.]{0,10}?"; // 키워드와 숫자 사이의 조사/기호("가", "는", "=", ":" 등)

const NPSHR_RE = new RegExp(
  `(?:npsh\\s*\\(?\\s*r(?:e|eq|equired)?\\s*\\)?|필요\\s*npsh|요구\\s*npsh|required\\s*npsh|필요\\s*유효\\s*흡입\\s*(?:양정|수두))${GAP}${NUM}`,
  "i"
);
// 한국식 부호(흡상 +, 압입 −)로 읽는 표현
const SUCTION_KO_RE = new RegExp(`(?:흡입\\s*(?:높이|양정|고)|흡상\\s*(?:높이|양정)?|suction\\s*lift)${GAP}${NUM}`, "i");
// 영어권 관례(압입 +)라 부호를 뒤집어 읽는 표현
const SUCTION_EN_FLOODED_RE = new RegExp(`(?:static\\s*suction\\s*head|suction\\s*head)${GAP}${NUM}`, "i");
const FLOODED_RE = new RegExp(`(?:압입\\s*(?:높이|양정)?|flooded\\s*suction)${GAP}(\\d+(?:\\.\\d+)?)`, "i");
const TEMP_RE = new RegExp(`(?:액체\\s*온도|유체\\s*온도|수온|liquid\\s*temp(?:erature)?|water\\s*temp(?:erature)?)${GAP}(\\d+(?:\\.\\d+)?)`, "i");

// 숫자 바로 뒤의 단위가 m(수두)가 아니면 그 값은 버린다 (ft, bar, psi …).
const BAD_UNIT_RE = /^\s*(?:ft|feet|foot|bar|psi|kpa|mpa|kg|mm|cm|inch|in\b|%)/i;

function grab(text, re, { negate = false } = {}) {
  const m = re.exec(text);
  if (!m) return null;
  const after = text.slice(m.index + m[0].length);
  if (BAD_UNIT_RE.test(after)) return null;
  let v = Number(m[1].replace(/\s+/g, "").replace(/[−–]/g, "-"));
  if (!Number.isFinite(v)) return null;
  if (negate) v = -v;
  return v;
}

/** 텍스트에서 찾은 값만 담아 돌려준다. 못 찾은 항목은 키 자체가 없다. */
export function extractNpshInputs(text) {
  const out = {};
  if (!text) return out;
  const npshr = grab(text, NPSHR_RE);
  if (npshr !== null) out.npshr = npshr;

  let hs = grab(text, SUCTION_KO_RE);
  if (hs === null) hs = grab(text, SUCTION_EN_FLOODED_RE, { negate: true });
  if (hs === null) {
    const f = grab(text, FLOODED_RE);
    if (f !== null) hs = -Math.abs(f);
  }
  if (hs !== null) out.suctionHead = hs;

  const temp = grab(text, TEMP_RE);
  if (temp !== null) out.tempC = temp;
  return out;
}

/** 텍스트에 NPSHr와 흡입높이가 모두 있으면 바로 계산해서 돌려준다. 아니면 null. */
export function computeNpshFromText(text) {
  const x = extractNpshInputs(text);
  if (x.npshr === undefined || x.suctionHead === undefined) return null;
  return computeNpsh(x);
}

/** 화면에 보여줄 한 줄/여러 줄 설명 (lang: "ko" | "en") */
export function describeNpsh(r, lang = "ko") {
  const sign = (n) => (n > 0 ? `+${n}` : `${n}`);
  if (lang === "en") {
    const setup =
      r.suctionHead < 0
        ? `flooded suction (liquid level ${Math.abs(r.suctionHead)} m above the pump)`
        : r.suctionHead > 0
        ? `suction lift (liquid level ${r.suctionHead} m below the pump)`
        : "liquid level at pump centerline";
    const verdict = { insufficient: "INSUFFICIENT — cavitation expected", marginal: "thin margin", sufficient: "sufficient" }[r.level];
    return (
      `NPSH check: ${setup}.\n` +
      `NPSHa ≈ ${r.ha} (atmosphere) − ${r.hv} (vapor, ${r.tempC}°C water) ${r.suctionHead >= 0 ? "−" : "+"} ${Math.abs(r.suctionHead)} (suction) − ${r.frictionLoss} (piping loss) = ${r.npsha} m\n` +
      `NPSHr ${r.npshr} m → margin ${sign(r.margin)} m (target ≥ ${r.required} m): ${verdict}.`
    );
  }
  const setup =
    r.suctionHead < 0
      ? `압입 조건 (액면이 펌프보다 ${Math.abs(r.suctionHead)} m 위)`
      : r.suctionHead > 0
      ? `흡상 조건 (액면이 펌프보다 ${r.suctionHead} m 아래)`
      : "액면이 펌프 중심과 같은 높이";
  const verdict = { insufficient: "부족 — 캐비테이션 발생 조건", marginal: "여유 부족", sufficient: "충분" }[r.level];
  return (
    `NPSH 검토: ${setup}으로 해석했습니다.\n` +
    `NPSHa ≈ ${r.ha}(대기압) − ${r.hv}(증기압, ${r.tempC}°C 물) ${r.suctionHead >= 0 ? "−" : "+"} ${Math.abs(r.suctionHead)}(흡입높이) − ${r.frictionLoss}(배관손실) = ${r.npsha} m\n` +
    `NPSHr ${r.npshr} m 대비 여유 ${sign(r.margin)} m (권장 ${r.required} m 이상) → ${verdict}.`
  );
}

/** 체크리스트 답변/기록용 짧은 라벨 */
export function npshAnswerLabel(r, lang = "ko") {
  const lvl = {
    ko: { insufficient: "부족", marginal: "여유 부족", sufficient: "충분" },
    en: { insufficient: "insufficient", marginal: "thin margin", sufficient: "sufficient" },
  }[lang][r.level];
  const hs = r.suctionHead > 0 ? `+${r.suctionHead}` : `${r.suctionHead}`;
  return lang === "en"
    ? `NPSHr ${r.npshr} m · suction ${hs} m → NPSHa ≈ ${r.npsha} m (${lvl})`
    : `NPSHr ${r.npshr} m · 흡입높이 ${hs} m → NPSHa ≈ ${r.npsha} m (${lvl})`;
}
