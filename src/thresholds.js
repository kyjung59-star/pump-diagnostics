/**
 * 현장 측정값 임계값 판정 — 화면/네트워크와 무관한 순수 함수 모음.
 * 기준 출처: 원심펌프 고장 증상별 Root Cause 추적 및 현장 진단 종합 보고서
 *   - 진동 속도: ISO 10816-3 기준 (mm/s RMS)  <4.5 정상 / 4.5~7.1 주의 / >7.1 위험
 *   - 베이스라인 대비: 평소 대비 2.5배 이상 급증 → 절대값과 무관하게 내부 결함 급진행 경고,
 *     2배 이상 급증 → 즉시 정지 판단 기준(Stop-or-Run)
 *   - 모터 전류: 전부하 전류(FLA)의 105% 초과 → 조치 대상
 *   - 흡입/토출 압력: 설계 기준 대비 10% 초과 편차 → 조치 대상
 * (베어링 온도 기준은 사용자 지정 정책이 App.jsx에 이미 있어 여기서 다루지 않는다.)
 */

export const VIB_ACCEPTABLE_MMS = 4.5;
export const VIB_CRITICAL_MMS = 7.1;
export const VIB_SPIKE_WARN_RATIO = 2.5;
export const VIB_SPIKE_STOP_RATIO = 2.0;
export const CURRENT_LIMIT_PCT_FLA = 105;
export const PRESSURE_DEVIATION_LIMIT_PCT = 10;

const round1 = (n) => Math.round(n * 10) / 10;
const isNum = (v) => typeof v === "number" && Number.isFinite(v);

/** 진동 속도(mm/s RMS) → "normal" | "caution" | "critical" */
export function classifyVibrationVelocity(mms) {
  if (!isNum(mms) || mms < 0 || mms > 200) return null;
  if (mms > VIB_CRITICAL_MMS) return "critical";
  if (mms >= VIB_ACCEPTABLE_MMS) return "caution";
  return "normal";
}

/**
 * 베이스라인 대비 급증 판정.
 * @returns null | { ratio, level: "none" | "warn" | "stop" }
 */
export function baselineSpike(current, baseline) {
  if (!isNum(current) || !isNum(baseline) || baseline <= 0 || current < 0) return null;
  const ratio = round1(current / baseline);
  const level = ratio >= VIB_SPIKE_STOP_RATIO ? "stop" : "none"; // 2배 이상 급증 = 정지 판단 기준(2.5배 이상은 같은 방향의 더 강한 경고)
  return { ratio, level };
}

/** 모터 전류(%FLA) 판정 → "normal" | "over" */
export function classifyMotorCurrent(pctFla) {
  if (!isNum(pctFla) || pctFla <= 0 || pctFla > 400) return null;
  return pctFla > CURRENT_LIMIT_PCT_FLA ? "over" : "normal";
}

/**
 * 진동 측정값 입력 → 판정 결과.
 * 둘 다 없거나 범위 밖이면 null.
 * @param {{velocity?:number, baseline?:number}} input
 */
export function evaluateVibration({ velocity, baseline } = {}) {
  const level = classifyVibrationVelocity(velocity);
  if (level === null) return null;
  const spike = baselineSpike(velocity, baseline);
  return {
    velocity,
    baseline: isNum(baseline) && baseline > 0 ? baseline : null,
    level,
    spike: spike ? spike.level === "stop" : false,
    ratio: spike ? spike.ratio : null,
    stop: level === "critical" || (spike ? spike.level === "stop" : false),
  };
}

export function describeVibration(r, lang = "ko") {
  const lvl = {
    ko: { normal: "정상 범위 (4.5 mm/s 미만)", caution: "주의 구간 (4.5~7.1 mm/s)", critical: "위험 구간 (7.1 mm/s 초과)" },
    en: { normal: "acceptable (below 4.5 mm/s)", caution: "investigate (4.5-7.1 mm/s)", critical: "critical (above 7.1 mm/s)" },
  }[lang][r.level];
  let spikeText = "";
  if (r.ratio !== null) {
    spikeText =
      lang === "en"
        ? `\nBaseline ${r.baseline} mm/s → ×${r.ratio}${r.spike ? " — sharp jump versus baseline" : ""}.`
        : `\n평소(베이스라인) ${r.baseline} mm/s 대비 ${r.ratio}배${r.spike ? " — 평소 대비 급증" : ""}.`;
  }
  const action = r.stop
    ? lang === "en"
      ? "\nStop-or-run rule: over 7.1 mm/s or a 2× jump versus baseline means stop and plan repair."
      : "\n정지 판단 규칙: 7.1 mm/s 초과이거나 베이스라인 대비 2배 이상 급증하면 정지 후 정비를 계획합니다."
    : r.level === "caution"
    ? lang === "en"
      ? "\nShorten the monitoring interval to daily and start FFT trending."
      : "\n감시 주기를 일일로 단축하고 FFT 스펙트럼 추적을 시작하세요."
    : "";
  return lang === "en"
    ? `Vibration check: ${r.velocity} mm/s RMS — ${lvl}.${spikeText}${action}`
    : `진동 측정 검토: ${r.velocity} mm/s RMS — ${lvl}.${spikeText}${action}`;
}

export function vibrationAnswerLabel(r, lang = "ko") {
  const lvl = {
    ko: { normal: "정상", caution: "주의", critical: "위험" },
    en: { normal: "acceptable", caution: "caution", critical: "critical" },
  }[lang][r.level];
  const base = r.ratio !== null ? ` · ×${r.ratio}` : "";
  return lang === "en" ? `${r.velocity} mm/s RMS (${lvl})${base}` : `${r.velocity} mm/s RMS (${lvl})${base}`;
}
