import React, { useState, useRef, useEffect, useCallback } from "react";
import { AlertTriangle, Send, RotateCcw, Activity, Wrench, ShieldAlert, ChevronRight, History as HistoryIcon, X, Trash2, Globe, Droplets } from "lucide-react";

/* =====================================================================
   THEME — industrial diagnostic console
   ===================================================================== */
const T = {
  bg: "#14171A",
  panel: "#1C2024",
  panelAlt: "#20252A",
  border: "#2C3238",
  borderStrong: "#3A4149",
  text: "#E9EDF0",
  textMuted: "#8B939B",
  textFaint: "#5B636B",
  amber: "#F2A93B",
  teal: "#35C9B0",
  orange: "#FF7A45",
  red: "#E5484D",
  mono: "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
  sans: "'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif",
};

// bi = "bilingual" 짧은 헬퍼. { ko, en } 객체와 현재 lang을 받아 해당 언어 문자열을 반환.
const bi = (obj, lang) => (obj ? obj[lang] ?? obj.ko ?? "" : "");

const SEVERITY_META = {
  LOW: { label: { ko: "경미", en: "Minor" }, color: T.teal, idx: 0 },
  MEDIUM: { label: { ko: "주의", en: "Caution" }, color: T.amber, idx: 1 },
  MEDIUM_HIGH: { label: { ko: "주의(심화)", en: "Caution (Elevated)" }, color: T.orange, idx: 2 },
  HIGH: { label: { ko: "긴급", en: "Urgent" }, color: T.red, idx: 3 },
};

/* =====================================================================
   DATA — ported from cause_symptom_matrix.json / diagnostic_checklists.json
   / action_plan_db.json ; all display strings are bilingual { ko, en }
   ===================================================================== */
const CATEGORY_LABEL = {
  NOISE_VIBRATION: { ko: "소음/진동", en: "Noise / Vibration" },
  FLOW_LOW: { ko: "유량 부족/변동", en: "Low / Fluctuating Flow" },
  PRESSURE_ABNORMAL: { ko: "압력 이상", en: "Abnormal Pressure" },
  LEAKAGE: { ko: "누설", en: "Leakage" },
  OVERHEATING: { ko: "과열", en: "Overheating" },
  MOTOR_ELECTRICAL: { ko: "모터/전기 이상", en: "Motor / Electrical Issue" },
  START_FAILURE: { ko: "시동 불가/정지", en: "Fails to Start / Stops" },
  OTHER_COMPLEX: { ko: "기타/복합 증상", en: "Other / Complex Symptom" },
};
// 사용자가 직접 선택할 때 보여줄 실제 진단 카테고리 (OTHER_COMPLEX는 체크리스트가 없는 fallback이라 제외)
const REAL_CATEGORIES = Object.keys(CATEGORY_LABEL).filter((c) => c !== "OTHER_COMPLEX");

// 원인 코드 → 사람이 읽을 이름 (진단 문구/기록에 사용)
const CAUSE_LABEL = {
  CAVITATION: { ko: "캐비테이션", en: "Cavitation" },
  BEARING_WEAR: { ko: "베어링 마모", en: "Bearing wear" },
  MISALIGNMENT: { ko: "축 정렬 불량", en: "Shaft misalignment" },
  AIR_ENTRAINMENT: { ko: "공기 유입", en: "Air entrainment" },
  IMPELLER_WEAR_OR_CLOG: { ko: "임펠러 마모/막힘", en: "Impeller wear or clogging" },
  VALVE_MISCONFIGURED: { ko: "밸브 설정 이상", en: "Valve misconfiguration" },
  SYSTEM_RESISTANCE_CHANGE: { ko: "시스템 저항 변화", en: "System resistance change" },
  IMPELLER_DAMAGE: { ko: "임펠러 손상", en: "Impeller damage" },
  PIPING_LEAK_OR_AIR_INGRESS: { ko: "배관 누설/공기유입", en: "Piping leak or air ingress" },
  MECHANICAL_SEAL_WEAR: { ko: "메커니컬씰 마모", en: "Mechanical seal wear" },
  GASKET_DAMAGE: { ko: "개스킷 손상", en: "Gasket damage" },
  LUBRICATION_FAILURE: { ko: "윤활 불량", en: "Lubrication failure" },
  DEADHEAD_OPERATION: { ko: "Dead-head 운전", en: "Dead-head operation" },
  MOTOR_OVERLOAD: { ko: "모터 과부하", en: "Motor overload" },
  IMPELLER_JAMMED: { ko: "임펠러 고착", en: "Impeller jammed" },
  VOLTAGE_IMBALANCE: { ko: "전압 불균형", en: "Voltage imbalance" },
  AIRLOCK: { ko: "에어락", en: "Airlock" },
  PROTECTION_RELAY_TRIP: { ko: "보호계전기 트립", en: "Protection relay trip" },
};

const CHECKLISTS = {
  NOISE_VIBRATION: [
    { key: "noise_type", text: { ko: "소음의 종류는 어떤가요?", en: "What type of noise is it?" }, options: [
      ["gravel_sound", { ko: "자갈 굴러가는 소리", en: "Gravel-rolling sound" }],
      ["metallic_friction", { ko: "금속성 마찰음", en: "Metallic friction noise" }],
      ["periodic_knocking", { ko: "주기적 덜컹거림", en: "Periodic knocking" }],
      ["low_humming", { ko: "웅웅거리는 저음", en: "Low humming" }],
    ] },
    { key: "noise_location", text: { ko: "소음이 주로 어디서 발생하나요?", en: "Where does the noise mainly occur?" }, options: [
      ["suction_side", { ko: "흡입측", en: "Suction side" }],
      ["discharge_side", { ko: "토출측", en: "Discharge side" }],
      ["motor_side", { ko: "모터측", en: "Motor side" }],
    ] },
    { key: "flow_pressure_change", text: { ko: "유량이나 압력에도 변화가 있나요?", en: "Is there also a change in flow or pressure?" }, options: [
      ["yes", { ko: "예", en: "Yes" }], ["no", { ko: "아니오", en: "No" }],
    ] },
    { key: "operating_point_changed", text: { ko: "최근 운전점(유량/양정)이 설계값 대비 변경되었나요?", en: "Has the operating point (flow/head) recently shifted from the design value?" }, options: [
      ["yes", { ko: "예", en: "Yes" }], ["no", { ko: "아니오", en: "No" }],
    ] },
    { key: "vibration_location", text: { ko: "진동이 느껴지는 부위는 어디인가요?", en: "Where do you feel the vibration?" }, options: [
      ["motor", { ko: "모터", en: "Motor" }],
      ["coupling", { ko: "커플링", en: "Coupling" }],
      ["bearing_housing", { ko: "베어링 하우징", en: "Bearing housing" }],
      ["piping", { ko: "배관", en: "Piping" }],
      ["none", { ko: "없음", en: "None" }],
    ] },
    { key: "recent_maintenance", text: { ko: "최근 정비/부품 교체 이력이 있나요?", en: "Any recent maintenance or part replacement?" }, options: [
      ["yes_part_replaced", { ko: "예 (부품 교체함)", en: "Yes (parts replaced)" }],
      ["no_long_term", { ko: "아니오 (오래 정비 안함)", en: "No (not serviced for a long time)" }],
      ["none", { ko: "특별한 이력 없음", en: "No notable history" }],
    ] },
    { key: "suction_gauge_abnormal", text: { ko: "흡입측 압력계/진공계 수치에 이상이 있나요?", en: "Is the suction-side pressure/vacuum gauge reading abnormal?" }, options: [
      ["yes", { ko: "예", en: "Yes" }], ["no", { ko: "아니오", en: "No" }],
    ] },
    { key: "overheating_bearing", text: { ko: "베어링 부위에 과열이 동반되나요?", en: "Is overheating present at the bearing?" }, options: [
      ["yes", { ko: "예", en: "Yes" }], ["no", { ko: "아니오", en: "No" }],
    ] },
    { key: "lubrication_check", text: { ko: "윤활유/그리스 점검·교체 이력은 어떤가요?", en: "What's the lubricant/grease inspection or replacement history?" }, options: [
      ["recent", { ko: "최근 점검함", en: "Checked recently" }],
      ["overdue", { ko: "오래됨/미실시", en: "Overdue / not done" }],
    ] },
    { key: "suction_level_dropped", text: { ko: "최근 흡입조/저수조 수위가 낮아진 적이 있나요?", en: "Has the suction tank/reservoir level recently dropped?" }, options: [
      ["yes", { ko: "예", en: "Yes" }], ["no", { ko: "아니오", en: "No" }],
    ] },
  ],
  FLOW_LOW: [
    { key: "flow_decline_pattern", text: { ko: "유량 저하가 점진적인가요, 급격한가요?", en: "Is the flow decline gradual or sudden?" }, options: [
      ["gradual", { ko: "점진적", en: "Gradual" }], ["sudden", { ko: "급격함", en: "Sudden" }],
    ] },
    { key: "suction_gauge_abnormal", text: { ko: "흡입측 압력계/진공계 수치에 이상이 있나요?", en: "Is the suction-side pressure/vacuum gauge reading abnormal?" }, options: [
      ["yes", { ko: "예", en: "Yes" }], ["no", { ko: "아니오", en: "No" }],
    ] },
    { key: "valve_opening_checked", text: { ko: "흡입/토출 밸브 개도 상태를 확인했나요?", en: "Have you checked the suction/discharge valve opening?" }, options: [
      ["normal", { ko: "정상", en: "Normal" }],
      ["abnormal_or_partially_closed", { ko: "비정상/일부 잠김", en: "Abnormal / partially closed" }],
    ] },
    { key: "strainer_clogged", text: { ko: "스트레이너/필터 막힘을 점검했나요?", en: "Have you checked for a clogged strainer/filter?" }, options: [
      ["yes", { ko: "막힘 확인됨", en: "Clog confirmed" }],
      ["no", { ko: "막히지 않음", en: "Not clogged" }],
      ["not_checked", { ko: "확인 안함", en: "Not checked" }],
    ] },
    { key: "parallel_pump_status", text: { ko: "병렬운전 중이라면 다른 펌프 상태는 어떤가요?", en: "If running in parallel, what's the status of the other pump?" }, options: [
      ["other_pump_abnormal", { ko: "다른 펌프도 이상", en: "Other pump also abnormal" }],
      ["other_pump_normal", { ko: "다른 펌프는 정상", en: "Other pump normal" }],
      ["not_applicable", { ko: "해당없음", en: "Not applicable" }],
    ] },
    { key: "operating_point_changed", text: { ko: "최근 운전점(유량/양정)이 설계값 대비 변경되었나요?", en: "Has the operating point (flow/head) recently shifted from the design value?" }, options: [
      ["yes", { ko: "예", en: "Yes" }], ["no", { ko: "아니오", en: "No" }],
    ] },
  ],
  PRESSURE_ABNORMAL: [
    { key: "pressure_pattern", text: { ko: "압력이 저하되는 패턴인가요, 맥동하는 패턴인가요?", en: "Is the pressure steadily declining or pulsating?" }, options: [
      ["steady_decline", { ko: "점진적 저하", en: "Steady decline" }],
      ["pulsating", { ko: "맥동/변동", en: "Pulsating / fluctuating" }],
    ] },
    { key: "discharge_valve_opening", text: { ko: "토출측 밸브 개도는 정상인가요?", en: "Is the discharge valve opening normal?" }, options: [
      ["normal", { ko: "정상", en: "Normal" }], ["abnormal", { ko: "비정상", en: "Abnormal" }],
    ] },
    { key: "piping_leak_signs", text: { ko: "시스템 배관에 누설/공기유입 흔적이 있나요?", en: "Any signs of leakage or air ingress in the system piping?" }, options: [
      ["yes", { ko: "예", en: "Yes" }], ["no", { ko: "아니오", en: "No" }],
    ] },
    { key: "impeller_history", text: { ko: "임펠러 마모/손상 이력이 있나요?", en: "Any known history of impeller wear or damage?" }, options: [
      ["wear_or_damage_known", { ko: "이력 있음", en: "History known" }],
      ["none_known", { ko: "이력 없음", en: "No known history" }],
    ] },
  ],
  LEAKAGE: [
    { key: "leak_location", text: { ko: "누설 위치는 어디인가요?", en: "Where is the leak located?" }, options: [
      ["shaft_seal", { ko: "축봉(메커니컬씰)", en: "Shaft seal (mechanical seal)" }],
      ["casing_joint", { ko: "케이싱 조인트", en: "Casing joint" }],
      ["piping_connection", { ko: "배관 연결부", en: "Piping connection" }],
    ] },
    { key: "leak_amount", text: { ko: "누설량은 미세한가요, 다량인가요?", en: "Is the leak minor or significant?" }, options: [
      ["minor_seeping", { ko: "미세하게 스며듦", en: "Minor seeping" }],
      ["significant", { ko: "다량", en: "Significant" }],
    ] },
    { key: "seal_service_time", text: { ko: "씰 교체/정비 이력 및 사용 시간은 어떤가요?", en: "What's the seal's replacement history and time in service?" }, options: [
      ["recent", { ko: "최근 교체함", en: "Replaced recently" }],
      ["long_overdue", { ko: "교체 오래됨", en: "Long overdue for replacement" }],
    ] },
    { key: "vibration_location", text: { ko: "축 진동/정렬 이상이 동반되나요?", en: "Is shaft vibration/misalignment also present?" }, options: [
      ["coupling", { ko: "커플링", en: "Coupling" }],
      ["bearing_housing", { ko: "베어링 하우징", en: "Bearing housing" }],
      ["none", { ko: "없음", en: "None" }],
    ] },
  ],
  OVERHEATING: [
    { key: "overheating_location", text: { ko: "과열 부위는 어디인가요?", en: "Where is the overheating located?" }, options: [
      ["motor_body", { ko: "모터 본체", en: "Motor body" }],
      ["bearing", { ko: "베어링", en: "Bearing" }],
      ["seal_area", { ko: "씰 부위", en: "Seal area" }],
    ] },
    { key: "temperature_rise_pattern", text: { ko: "운전시간 대비 온도 상승 패턴은 어떤가요?", en: "How does temperature rise relative to run time?" }, options: [
      ["gradual", { ko: "점진적", en: "Gradual" }], ["sudden", { ko: "급격함", en: "Sudden" }],
    ] },
    { key: "lubrication_check", text: { ko: "윤활유/그리스 점검·교체 이력은 어떤가요?", en: "What's the lubricant/grease inspection or replacement history?" }, options: [
      ["recent", { ko: "최근 점검함", en: "Checked recently" }],
      ["overdue", { ko: "오래됨/미실시", en: "Overdue / not done" }],
    ] },
    { key: "deadhead_history", text: { ko: "토출측 밸브가 잠긴 채 장시간 운전(Dead-head)된 적이 있나요?", en: "Has it run for a long time with the discharge valve closed (dead-head)?" }, options: [
      ["yes", { ko: "예", en: "Yes" }], ["no", { ko: "아니오", en: "No" }],
    ] },
  ],
  MOTOR_ELECTRICAL: [
    { key: "motor_trip_type", text: { ko: "과전류 트립인가요, 기동 불가인가요?", en: "Is it an overcurrent trip or a failure to start?" }, options: [
      ["overcurrent", { ko: "과전류 트립", en: "Overcurrent trip" }],
      ["fail_to_start", { ko: "기동 불가", en: "Fails to start" }],
    ] },
    { key: "voltage_check", text: { ko: "3상 전압 불균형을 확인했나요?", en: "Have you checked for 3-phase voltage imbalance?" }, options: [
      ["imbalanced", { ko: "불균형 확인됨", en: "Imbalance confirmed" }],
      ["normal", { ko: "정상", en: "Normal" }],
      ["not_checked", { ko: "확인 안함", en: "Not checked" }],
    ] },
    { key: "impeller_locked_check", text: { ko: "임펠러가 손으로 돌아가는지(고착 여부) 확인했나요?", en: "Have you checked whether the impeller turns freely by hand (seized or not)?" }, options: [
      ["free_rotation", { ko: "자유롭게 회전함", en: "Rotates freely" }],
      ["locked_or_hard_to_rotate", { ko: "고착/회전 어려움", en: "Seized / hard to rotate" }],
    ] },
    { key: "recent_load_change", text: { ko: "최근 부하 변동(공정 조건 변경)이 있었나요?", en: "Any recent load change (process condition change)?" }, options: [
      ["yes", { ko: "예", en: "Yes" }], ["no", { ko: "아니오", en: "No" }],
    ] },
  ],
  START_FAILURE: [
    { key: "start_failure_type", text: { ko: "기동 즉시 정지인가요, 아예 기동이 안 되나요?", en: "Does it trip immediately after starting, or fail to start at all?" }, options: [
      ["trips_immediately", { ko: "즉시 정지", en: "Trips immediately" }],
      ["fails_to_start_at_all", { ko: "아예 기동 안됨", en: "Fails to start at all" }],
    ] },
    { key: "priming_status", text: { ko: "흡입 배관에 에어락 가능성이 있나요? (프라이밍 상태)", en: "Could there be an airlock in the suction piping? (priming status)" }, options: [
      ["complete", { ko: "정상 완료", en: "Completed normally" }],
      ["incomplete_or_suspected_airlock", { ko: "불완전/에어락 의심", en: "Incomplete / airlock suspected" }],
    ] },
    { key: "relay_trip_signs", text: { ko: "보호계전기/인터록이 작동해서 정지된 흔적이 있나요?", en: "Any sign the protection relay/interlock tripped and stopped it?" }, options: [
      ["yes", { ko: "예", en: "Yes" }], ["no", { ko: "아니오", en: "No" }],
    ] },
    { key: "recent_wiring_work", text: { ko: "최근 배선/제어반 작업 이력이 있나요?", en: "Any recent wiring or control panel work?" }, options: [
      ["yes", { ko: "예", en: "Yes" }], ["no", { ko: "아니오", en: "No" }],
    ] },
  ],
};

const MATRIX = {
  CAVITATION: { category: "NOISE_VIBRATION", base: 30, rules: [["noise_type", "gravel_sound", 40], ["noise_type", "metallic_friction", -10], ["flow_pressure_change", "yes", 20], ["suction_gauge_abnormal", "yes", 25], ["operating_point_changed", "yes", 15], ["recent_maintenance", "yes_part_replaced", -5]] },
  BEARING_WEAR: { category: "NOISE_VIBRATION", base: 25, rules: [["noise_type", "metallic_friction", 35], ["noise_type", "periodic_knocking", 30], ["vibration_location", "bearing_housing", 30], ["overheating_bearing", "yes", 25], ["lubrication_check", "overdue", 20], ["recent_maintenance", "no_long_term", 10]] },
  MISALIGNMENT: { category: "NOISE_VIBRATION", base: 20, rules: [["vibration_location", "coupling", 30], ["noise_type", "periodic_knocking", 20], ["recent_maintenance", "yes_part_replaced", 15]] },
  AIR_ENTRAINMENT: { category: "NOISE_VIBRATION", base: 15, rules: [["noise_location", "suction_side", 20], ["suction_gauge_abnormal", "yes", 20], ["flow_pressure_change", "yes", 15], ["suction_level_dropped", "yes", 20]] },
  IMPELLER_WEAR_OR_CLOG: { category: "FLOW_LOW", base: 20, rules: [["flow_decline_pattern", "gradual", 25], ["strainer_clogged", "yes", 30], ["suction_gauge_abnormal", "yes", 15], ["valve_opening_checked", "normal", 10]] },
  VALVE_MISCONFIGURED: { category: "FLOW_LOW", base: 15, rules: [["valve_opening_checked", "abnormal_or_partially_closed", 45], ["flow_decline_pattern", "sudden", 20]] },
  SYSTEM_RESISTANCE_CHANGE: { category: "FLOW_LOW", base: 15, rules: [["parallel_pump_status", "other_pump_abnormal", 25], ["flow_decline_pattern", "gradual", 15], ["operating_point_changed", "yes", 20]] },
  IMPELLER_DAMAGE: { category: "PRESSURE_ABNORMAL", base: 15, rules: [["pressure_pattern", "steady_decline", 25], ["impeller_history", "wear_or_damage_known", 40], ["flow_decline_pattern", "gradual", 15]] },
  PIPING_LEAK_OR_AIR_INGRESS: { category: "PRESSURE_ABNORMAL", base: 15, rules: [["pressure_pattern", "pulsating", 30], ["piping_leak_signs", "yes", 35], ["discharge_valve_opening", "normal", 10]] },
  MECHANICAL_SEAL_WEAR: { category: "LEAKAGE", base: 20, rules: [["leak_location", "shaft_seal", 40], ["seal_service_time", "long_overdue", 30], ["leak_amount", "minor_seeping", 10]] },
  GASKET_DAMAGE: { category: "LEAKAGE", base: 15, rules: [["leak_location", "casing_joint", 40], ["leak_amount", "significant", 20]] },
  LUBRICATION_FAILURE: { category: "OVERHEATING", base: 20, rules: [["overheating_location", "bearing", 35], ["lubrication_check", "overdue", 35], ["temperature_rise_pattern", "gradual", 15]] },
  DEADHEAD_OPERATION: { category: "OVERHEATING", base: 15, rules: [["deadhead_history", "yes", 45], ["temperature_rise_pattern", "sudden", 20]] },
  MOTOR_OVERLOAD: { category: "MOTOR_ELECTRICAL", base: 20, rules: [["motor_trip_type", "overcurrent", 35], ["recent_load_change", "yes", 25], ["impeller_locked_check", "free_rotation", 10]] },
  IMPELLER_JAMMED: { category: "MOTOR_ELECTRICAL", base: 15, rules: [["impeller_locked_check", "locked_or_hard_to_rotate", 45], ["motor_trip_type", "fail_to_start", 25]] },
  VOLTAGE_IMBALANCE: { category: "MOTOR_ELECTRICAL", base: 15, rules: [["voltage_check", "imbalanced", 45], ["motor_trip_type", "overcurrent", 15]] },
  AIRLOCK: { category: "START_FAILURE", base: 15, rules: [["priming_status", "incomplete_or_suspected_airlock", 45], ["start_failure_type", "trips_immediately", 15]] },
  PROTECTION_RELAY_TRIP: { category: "START_FAILURE", base: 15, rules: [["relay_trip_signs", "yes", 40], ["recent_wiring_work", "yes", 15]] },
};

const ACTION_PLAN_DB = {
  CAVITATION: { severity: "MEDIUM",
    immediate: [{ ko: "토출측 밸브가 과도하게 조여있지 않은지 확인", en: "Check that the discharge valve isn't throttled too far" }, { ko: "흡입측 스트레이너/필터 막힘 여부 육안 점검", en: "Visually inspect the suction strainer/filter for clogging" }, { ko: "현재 운전 유량이 설계 BEP 대비 얼마나 벗어났는지 확인", en: "Check how far the current operating flow deviates from the design BEP" }],
    maintenance: [{ ko: "흡입배관 NPSH available 재계산 및 배관 경로 점검", en: "Recalculate NPSH available for the suction piping and inspect the piping route" }, { ko: "임펠러 표면 침식 상태 육안/초음파 점검", en: "Visually or ultrasonically inspect the impeller surface for erosion" }],
    escalation: [{ ko: "임펠러 침식이 확인되면 제조사 또는 정비 전문가에게 교체 상담 요청", en: "If impeller erosion is confirmed, consult the manufacturer or a service specialist about replacement" }] },
  BEARING_WEAR: { severity: "MEDIUM_HIGH",
    immediate: [{ ko: "베어링 하우징 온도를 측정", en: "Measure the bearing housing temperature" }, { ko: "윤활유/그리스 상태 및 최근 보충 이력 확인", en: "Check lubricant/grease condition and recent replenishment history" }],
    maintenance: [{ ko: "베어링 진동 정밀 진단(FFT 분석 등) 실시", en: "Perform detailed bearing vibration diagnostics (e.g., FFT analysis)" }, { ko: "베어링 교체 주기 대비 사용시간 점검", en: "Check service hours against the bearing replacement interval" }],
    escalation: [{ ko: "진동/온도가 계속 상승하면 즉시 정비 인력 호출", en: "If vibration/temperature keeps rising, call maintenance staff immediately" }] },
  MISALIGNMENT: { severity: "MEDIUM",
    immediate: [{ ko: "커플링 가드 개방 후 정렬 상태 육안 확인", en: "Open the coupling guard and visually check alignment" }, { ko: "최근 정비/재조립 이력 확인", en: "Check recent maintenance/reassembly history" }],
    maintenance: [{ ko: "레이저 얼라인먼트 장비로 축정렬 정밀 측정", en: "Precisely measure shaft alignment with laser alignment equipment" }, { ko: "베이스플레이트 볼트 조임 상태 점검", en: "Check baseplate bolt tightness" }],
    escalation: [{ ko: "정렬 불량이 심할 경우 전문가와 함께 축 손상 여부 점검", en: "If misalignment is severe, check for shaft damage together with a specialist" }] },
  AIR_ENTRAINMENT: { severity: "LOW",
    immediate: [{ ko: "흡입조/저수조 수위가 최소 침수깊이 이상인지 확인", en: "Check that the suction tank/reservoir level is above the minimum submergence depth" }, { ko: "흡입배관 플랜지/씰 부위 공기 유입 흔적 확인", en: "Check suction piping flanges/seals for signs of air ingress" }],
    maintenance: [{ ko: "흡입배관 경로 및 와류방지장치 설치 여부 검토", en: "Review the suction piping route and whether a vortex breaker is installed" }],
    escalation: [{ ko: "반복 발생 시 흡입배관 재설계 필요 여부를 엔지니어와 상담", en: "If it recurs, consult an engineer about redesigning the suction piping" }] },
  IMPELLER_WEAR_OR_CLOG: { severity: "MEDIUM",
    immediate: [{ ko: "스트레이너/필터 개방 후 이물질 점검 및 청소", en: "Open the strainer/filter, check for debris, and clean it" }, { ko: "흡입/토출 밸브가 100% 개방 상태인지 확인", en: "Check that the suction/discharge valves are fully open" }],
    maintenance: [{ ko: "펌프 분해 후 임펠러 마모/막힘 상태 점검", en: "Disassemble the pump and check the impeller for wear or clogging" }],
    escalation: [{ ko: "임펠러 마모가 심하면 교체 부품 소싱 및 정비 일정 협의", en: "If impeller wear is severe, source replacement parts and schedule maintenance" }] },
  VALVE_MISCONFIGURED: { severity: "LOW",
    immediate: [{ ko: "흡입/토출 밸브 개도를 설계 조건에 맞게 재조정", en: "Readjust the suction/discharge valve opening to match design conditions" }, { ko: "밸브 액추에이터/수동조작 이력 확인", en: "Check the valve actuator/manual operation history" }],
    maintenance: [{ ko: "밸브 개도 표시계 오차 여부 점검", en: "Check for error in the valve position indicator" }],
    escalation: [] },
  SYSTEM_RESISTANCE_CHANGE: { severity: "LOW",
    immediate: [{ ko: "병렬 운전 중인 타 펌프의 상태 확인", en: "Check the status of other pumps running in parallel" }, { ko: "최근 공정 조건 변경 여부 확인", en: "Check for recent process condition changes" }],
    maintenance: [{ ko: "시스템 저항곡선을 실측 데이터로 재산정", en: "Recalculate the system resistance curve using measured data" }],
    escalation: [] },
  IMPELLER_DAMAGE: { severity: "MEDIUM_HIGH",
    immediate: [{ ko: "토출 압력계 지시값 변동 패턴 기록", en: "Record the discharge pressure gauge's fluctuation pattern" }],
    maintenance: [{ ko: "펌프 분해 후 임펠러 마모/손상 상태 정밀 점검", en: "Disassemble the pump and closely inspect the impeller for wear or damage" }],
    escalation: [{ ko: "손상이 확인되면 제조사에 교체 부품 사양 문의", en: "If damage is confirmed, ask the manufacturer about replacement part specifications" }] },
  PIPING_LEAK_OR_AIR_INGRESS: { severity: "MEDIUM",
    immediate: [{ ko: "배관 플랜지/이음부 육안 누설 점검", en: "Visually inspect piping flanges/joints for leaks" }, { ko: "토출측 밸브 개도 정상 여부 확인", en: "Check that the discharge valve opening is normal" }],
    maintenance: [{ ko: "배관 압력시험 또는 초음파 누설탐지 실시", en: "Perform a piping pressure test or ultrasonic leak detection" }],
    escalation: [{ ko: "누설 부위 특정이 어려우면 배관 전문 정비팀 투입 요청", en: "If the leak location is hard to pinpoint, request a piping specialist team" }] },
  MECHANICAL_SEAL_WEAR: { severity: "MEDIUM",
    immediate: [{ ko: "누설 부위와 누설량 기록", en: "Record the leak location and amount" }, { ko: "씰 냉각/플러싱 라인 정상 작동 여부 확인", en: "Check that the seal cooling/flushing line is working normally" }],
    maintenance: [{ ko: "메커니컬씰 교체(사용시간 대비 교체주기 확인)", en: "Replace the mechanical seal (check service hours against the replacement interval)" }],
    escalation: [{ ko: "누설량이 급증하면 즉시 운전 중지 후 씰 교체 필요", en: "If leakage suddenly increases, stop operation immediately and replace the seal" }] },
  GASKET_DAMAGE: { severity: "LOW",
    immediate: [{ ko: "케이싱 조인트 볼트 조임 토크 확인", en: "Check the casing joint bolt tightening torque" }, { ko: "개스킷 열화 상태 육안 점검", en: "Visually inspect the gasket for degradation" }],
    maintenance: [{ ko: "개스킷 교체 및 규정 토크로 재조립", en: "Replace the gasket and reassemble to the specified torque" }],
    escalation: [] },
  LUBRICATION_FAILURE: { severity: "MEDIUM_HIGH",
    immediate: [{ ko: "윤활유/그리스 잔량 및 오염 상태 확인", en: "Check lubricant/grease level and contamination" }, { ko: "베어링 온도 측정", en: "Measure the bearing temperature" }],
    maintenance: [{ ko: "윤활유 교체 및 윤활 주기 점검표 정비", en: "Replace the lubricant and update the lubrication schedule" }],
    escalation: [{ ko: "온도가 계속 상승하면 즉시 가동 중지 후 베어링 손상 여부 점검", en: "If temperature keeps rising, stop operation immediately and check for bearing damage" }] },
  DEADHEAD_OPERATION: { severity: "HIGH",
    immediate: [{ ko: "토출측 밸브가 장시간 잠긴 상태로 운전되고 있지 않은지 즉시 확인", en: "Immediately check whether it's running with the discharge valve closed for an extended period" }, { ko: "최소유량 바이패스 라인 작동 여부 확인", en: "Check whether the minimum-flow bypass line is operating" }],
    maintenance: [{ ko: "최소유량 보호 로직/바이패스 밸브 설정 재점검", en: "Recheck the minimum-flow protection logic/bypass valve settings" }],
    escalation: [{ ko: "Dead-head 상태가 지속 중이면 즉시 가동 중지", en: "If the dead-head condition persists, stop operation immediately" }] },
  MOTOR_OVERLOAD: { severity: "HIGH",
    immediate: [{ ko: "최근 공정 부하 변동 여부 확인", en: "Check for recent process load changes" }, { ko: "임펠러가 자유롭게 회전하는지 확인", en: "Check that the impeller rotates freely" }],
    maintenance: [{ ko: "모터 전류값을 정격전류와 비교 점검", en: "Compare the motor current against the rated current" }],
    escalation: [{ ko: "과전류가 반복 트립되면 전기 정비팀과 정밀 진단 필요", en: "If overcurrent trips repeatedly, arrange detailed diagnostics with the electrical maintenance team" }] },
  IMPELLER_JAMMED: { severity: "HIGH",
    immediate: [{ ko: "전원 차단 후 임펠러 수동 회전 가능 여부 확인(안전 우선)", en: "Cut power first, then check whether the impeller can be turned by hand (safety first)" }, { ko: "펌프 내부 이물질 유입 흔적 확인", en: "Check for signs of foreign debris inside the pump" }],
    maintenance: [{ ko: "펌프 분해 후 고착 원인 제거", en: "Disassemble the pump and remove the cause of seizure" }],
    escalation: [{ ko: "고착 원인이 불명확하면 정비 전문가 호출", en: "If the cause of seizure is unclear, call a maintenance specialist" }] },
  VOLTAGE_IMBALANCE: { severity: "HIGH",
    immediate: [{ ko: "3상 전압을 상별로 측정하여 불균형률 확인", en: "Measure the 3-phase voltage per phase to check the imbalance ratio" }],
    maintenance: [{ ko: "전원 공급단(변압기/배전반) 점검", en: "Inspect the power supply side (transformer/switchboard)" }],
    escalation: [{ ko: "전압 불균형이 지속되면 전기 안전 점검을 위해 전기기술자 호출", en: "If voltage imbalance persists, call an electrician for a safety inspection" }] },
  AIRLOCK: { severity: "MEDIUM",
    immediate: [{ ko: "펌프 케이싱 상단 에어벤트를 열어 공기 배출 시도", en: "Open the air vent at the top of the pump casing to try to release trapped air" }, { ko: "프라이밍 상태 확인", en: "Check the priming status" }],
    maintenance: [{ ko: "자동 에어벤트/프라이밍 시스템 정상 작동 여부 점검", en: "Check that the automatic air vent/priming system is working correctly" }],
    escalation: [{ ko: "반복 발생 시 배관 배치 재설계 검토", en: "If it recurs, consider redesigning the piping layout" }] },
  PROTECTION_RELAY_TRIP: { severity: "MEDIUM_HIGH",
    immediate: [{ ko: "제어반의 트립 이력/알람 코드 확인", en: "Check the control panel's trip history/alarm codes" }, { ko: "최근 배선/제어반 작업 이력 확인", en: "Check recent wiring/control panel work history" }],
    maintenance: [{ ko: "보호계전기 설정값이 정격에 맞는지 점검", en: "Check that the protection relay settings match the rated values" }],
    escalation: [{ ko: "트립 원인이 불명확하면 전기 정비팀 호출", en: "If the trip cause is unclear, call the electrical maintenance team" }] },
};

// 위험 신호 키워드는 UI 언어와 무관하게 항상 한/영 둘 다 감지한다 (사용자가 어느 언어로 입력하든 안전 감지가 동작해야 하므로).
const CRITICAL_TEXT_SIGNALS = {
  smoke_or_burning_smell: { ko: ["연기", "타는 냄새", "타는냄새", "탄내"], en: ["smoke", "burning smell", "burnt smell"] },
  electrical_spark: { ko: ["스파크", "불꽃", "감전"], en: ["spark", "sparks", "electric shock"] },
  severe_visible_vibration: { ko: ["심하게 흔들", "심한 진동", "흔들려서", "떨어질 것 같"], en: ["shaking badly", "severe vibration", "about to fall off", "shaking a lot"] },
  severe_overheating: { ko: ["뜨거", "과열", "만지기 힘들", "화상"], en: ["hot", "overheat", "too hot to touch", "burn"] },
  sudden_loud_noise: { ko: ["갑자기 큰 소리", "굉음", "펑", "쾅"], en: ["loud bang", "sudden loud noise", "bang", "boom"] },
};
// severe_overheating은 여기 포함하지 않는다 — "뜨겁다"는 표현만으로 즉시 긴급 판정하지 않고,
// 얼마나 뜨거운지 먼저 되물어 확인한 뒤 심각도를 정한다 (아래 heat_clarify 흐름 참고).
const HARD_SIGNAL_CODES = new Set(["smoke_or_burning_smell", "electrical_spark", "severe_visible_vibration", "sudden_loud_noise"]);

// 베어링 하우징 온도 기준 (사용자 지정 정책)
// - 75~80°C 이상: 점검 대상 (경계 구간이므로 보수적으로 낮은 쪽 75°C를 기준점으로 사용)
// - 85~90°C 이상: 무조건 정지 후 오버홀(분해 정비) 검토 (보수적으로 낮은 쪽 85°C를 기준점으로 사용)
const BEARING_TEMP_INSPECT_C = 75;
const BEARING_TEMP_STOP_C = 85;

// 실측 온도를 모를 때 감각으로 답할 수 있는 대체 선택지 (위 온도 기준과 매칭)
const HEAT_CLARIFY_OPTIONS = [
  { value: "mild", label: { ko: "미지근~따뜻한 정도 (계속 만질 수 있음)", en: "Lukewarm to warm (can keep touching it)" }, note: { ko: `${BEARING_TEMP_INSPECT_C}°C 미만으로 추정`, en: `Below ${BEARING_TEMP_INSPECT_C}°C (estimated)` }, severity: "LOW" },
  { value: "hot", label: { ko: "손을 대면 바로 뗄 정도로 뜨거움", en: "Hot enough that you'd pull your hand away" }, note: { ko: `약 ${BEARING_TEMP_INSPECT_C}~${BEARING_TEMP_STOP_C}°C 로 추정 (점검 대상 구간)`, en: `About ${BEARING_TEMP_INSPECT_C}-${BEARING_TEMP_STOP_C}°C (estimated, inspection range)` }, severity: "MEDIUM_HIGH" },
  { value: "danger", label: { ko: "만지기 어렵거나 화상 위험이 있음", en: "Too hot to touch / burn risk" }, note: { ko: `약 ${BEARING_TEMP_STOP_C}°C 이상으로 추정 (즉시 정지 기준)`, en: `About ${BEARING_TEMP_STOP_C}°C or higher (estimated, immediate-stop threshold)` }, severity: "HIGH" },
];
const CRITICAL_ANSWER_SIGNALS = [
  ["deadhead_history", "yes", "deadhead_operation_confirmed"],
  ["voltage_check", "imbalanced", "voltage_imbalance_confirmed"],
  ["impeller_locked_check", "locked_or_hard_to_rotate", "impeller_jammed_confirmed"],
];
const SIGNAL_LABEL = {
  smoke_or_burning_smell: { ko: "연기/탄내", en: "Smoke / burning smell" },
  electrical_spark: { ko: "전기 스파크", en: "Electrical spark" },
  severe_visible_vibration: { ko: "심한 진동", en: "Severe vibration" },
  severe_overheating: { ko: "심한 과열", en: "Severe overheating" },
  sudden_loud_noise: { ko: "갑작스런 큰 소음", en: "Sudden loud noise" },
  deadhead_operation_confirmed: { ko: "Dead-head 운전 확인", en: "Dead-head operation confirmed" },
  voltage_imbalance_confirmed: { ko: "전압 불균형 확인", en: "Voltage imbalance confirmed" },
  impeller_jammed_confirmed: { ko: "임펠러 고착 확인", en: "Impeller seizure confirmed" },
};
// 시뮬레이션(오프라인) 분류용 키워드 — 마찬가지로 한/영 둘 다 매칭한다.
const KEYWORD_HINTS = {
  NOISE_VIBRATION: { ko: ["소리", "소음", "진동", "덜컹", "떨림"], en: ["sound", "noise", "vibration", "rattl", "shake"] },
  FLOW_LOW: { ko: ["유량", "수량", "적게", "줄어", "안나와", "약해"], en: ["flow", "low flow", "reduced", "not coming out", "weak"] },
  PRESSURE_ABNORMAL: { ko: ["압력", "토출압", "맥동"], en: ["pressure", "discharge pressure", "pulsat"] },
  LEAKAGE: { ko: ["누설", "샌다", "새고", "새요", "물이 나와"], en: ["leak", "leaking", "dripping", "water coming"] },
  OVERHEATING: { ko: ["뜨거", "과열", "온도", "타는 냄새"], en: ["hot", "overheat", "temperature", "burning smell"] },
  MOTOR_ELECTRICAL: { ko: ["전류", "트립", "모터", "전기", "전압"], en: ["current", "trip", "motor", "electric", "voltage"] },
  START_FAILURE: { ko: ["시동", "기동", "안켜", "안돌아", "안 돌아", "돌아가지 않"], en: ["start", "won't start", "not starting", "doesn't start", "fails to start"] },
};

/* =====================================================================
   CORE LOGIC — ported from Python prototype
   ===================================================================== */
function evaluateCauseProbability(answers) {
  const candidates = [];
  for (const [cause, spec] of Object.entries(MATRIX)) {
    let score = spec.base;
    const evidence = [];
    for (const [qKey, expected, weight] of spec.rules) {
      if (answers[qKey] === expected) {
        score += weight;
        evidence.push(`${qKey}=${expected} (${weight > 0 ? "+" : ""}${weight})`);
      }
    }
    // 이 원인이 이론적으로 받을 수 있는 최대 점수(자기 자신의 base + 모든 긍정 가중치 합)
    // 대비 실제 받은 점수의 비율로 정규화한다.
    const maxAchievable = spec.base + spec.rules.filter(([, , w]) => w > 0).reduce((sum, [, , w]) => sum + w, 0);
    candidates.push({ cause, raw: score, maxAchievable, evidence });
  }
  const scored = candidates
    .map((c) => ({
      cause: c.cause,
      score: Math.round((Math.max(0, c.raw) / c.maxAchievable) * 1000) / 10,
      evidence: c.evidence,
    }))
    .filter((c) => c.evidence.length > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const top = scored[0]?.score ?? 0;
  const confidenceLevel = top >= 70 ? "HIGH" : top >= 40 ? "MEDIUM" : "LOW";
  return { candidates: scored, confidenceLevel };
}

function detectTextSignals(text) {
  const found = [];
  for (const [code, kwsByLang] of Object.entries(CRITICAL_TEXT_SIGNALS)) {
    const allKws = [...kwsByLang.ko, ...kwsByLang.en];
    if (allKws.some((kw) => text.toLowerCase().includes(kw.toLowerCase()))) found.push(code);
  }
  return found;
}
function detectAnswerSignals(answers) {
  const found = [];
  for (const [qKey, expected, code] of CRITICAL_ANSWER_SIGNALS) {
    if (answers[qKey] === expected) found.push(code);
  }
  return found;
}
// 베어링 하우징 실측/추정 온도(°C)를 사용자 지정 기준으로 판정한다.
function classifyBearingTemp(tempC, lang) {
  if (tempC >= BEARING_TEMP_STOP_C) {
    return { severity: "HIGH", label: lang === "en" ? "Above immediate-stop threshold" : "즉시 정지 기준 이상" };
  }
  if (tempC >= BEARING_TEMP_INSPECT_C) {
    return { severity: "MEDIUM_HIGH", label: lang === "en" ? "Inspection range" : "점검 대상 구간" };
  }
  return { severity: "LOW", label: lang === "en" ? "Normal range" : "정상 범위" };
}

function escalationCheck(rawText, answers, baseSeverity = "MEDIUM") {
  const textSignals = detectTextSignals(rawText || "");
  const answerSignals = detectAnswerSignals(answers || {});
  const all = [...textSignals, ...answerSignals];
  const forceHigh = textSignals.some((s) => HARD_SIGNAL_CODES.has(s));

  let severity = forceHigh ? "HIGH" : baseSeverity in SEVERITY_META ? baseSeverity : "MEDIUM";
  if (!forceHigh && answerSignals.length > 0 && SEVERITY_META[severity].idx < SEVERITY_META.MEDIUM_HIGH.idx) {
    severity = "MEDIUM_HIGH";
  }
  return { severity, matchedSignals: all, shouldInterrupt: severity === "HIGH" };
}

function simulateClassifier(text) {
  const matched = [];
  const lower = text.toLowerCase();
  for (const [cat, kwsByLang] of Object.entries(KEYWORD_HINTS)) {
    const allKws = [...kwsByLang.ko, ...kwsByLang.en];
    if (allKws.some((kw) => lower.includes(kw.toLowerCase()))) matched.push(cat);
  }
  return matched.length ? matched : ["OTHER_COMPLEX"];
}

// 원래는 이 함수가 https://api.anthropic.com을 직접 호출했다 — Claude 아티팩트
// 안에서는 별도 인증 없이 통하는 프록시가 있어서 가능했지만, 일반 배포 환경에서는
// API 키를 브라우저에 노출하지 않고는 직접 호출이 불가능하다.
// 그래서 이 서버(server/index.js)가 대신 호출해주는 "/api/claude" 엔드포인트를
// 거치도록 바꿨다 — API 키는 서버 환경변수에만 존재하고 클라이언트로는 전달되지 않는다.
async function callClaude(prompt, maxTokens = 600) {
  const resp = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data?.error || `Claude API 프록시 호출 실패 (status ${resp.status})`);
  }
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  const cleaned = text.trim().replace(/^```json/, "").replace(/^```/, "").replace(/```$/, "").trim();
  return JSON.parse(cleaned);
}

async function classifySymptomCategory(rawText, lang) {
  const catList = Object.entries(CATEGORY_LABEL).map(([c, l]) => `- ${c}: ${bi(l, lang)}`).join("\n");
  const prompt =
    lang === "en"
      ? `You are a symptom classifier for an industrial centrifugal pump troubleshooting chatbot. Map the description below to the matching categories (multiple allowed).\n\n[Categories]\n${catList}\n\n[Description]\n${rawText}\n\nReply with JSON only: {"primary_categories": ["CODE", ...]}`
      : `당신은 산업용 원심펌프 트러블슈팅 챗봇의 증상 분류기입니다. 아래 서술을 다음 카테고리 중 해당하는 것으로 매핑하세요(복수 가능).\n\n[카테고리]\n${catList}\n\n[서술]\n${rawText}\n\nJSON만 답하세요: {"primary_categories": ["코드", ...]}`;
  try {
    const result = await callClaude(prompt, 300);
    const cats = (result.primary_categories || []).filter((c) => c in CATEGORY_LABEL);
    if (cats.length) return { categories: cats, usedLLM: true };
    return { categories: simulateClassifier(rawText), usedLLM: false };
  } catch {
    return { categories: simulateClassifier(rawText), usedLLM: false };
  }
}

async function llmQualitativeReview(rawText, answers, ruleResult, lang) {
  const prompt =
    lang === "en"
      ? `You are the validator for a pump troubleshooting diagnosis. Don't re-score from scratch — review the rule-based scores below using the user's original wording and propose adjustments only.\n\n[Original text]\n${rawText}\n\n[Answers]\n${JSON.stringify(answers)}\n\n[Rule-based scores]\n${JSON.stringify(ruleResult.candidates)}\n\nReply with JSON only, and write "reason" in English:\n{"adjustments": [{"cause":"CODE","delta":integer(-20~20),"reason":"..."}], "new_candidate": {"cause":"CODE or free name","score":integer,"reason":"..."} or null}`
      : `당신은 펌프 트러블슈팅 진단의 검증자입니다. 아래 룰 기반 스코어를 새로 매기지 말고, 사용자 원문 맥락을 반영해 조정치만 제안하세요.\n\n[원문]\n${rawText}\n\n[답변]\n${JSON.stringify(answers)}\n\n[룰 스코어]\n${JSON.stringify(ruleResult.candidates)}\n\nJSON만 답하세요 ("reason"은 한국어로 작성):\n{"adjustments": [{"cause":"코드","delta":정수(-20~20),"reason":"근거"}], "new_candidate": {"cause":"코드또는이름","score":정수,"reason":"근거"} 또는 null}`;
  try {
    const result = await callClaude(prompt, 500);
    return { ...result, usedLLM: true };
  } catch {
    return { adjustments: [], new_candidate: null, usedLLM: false };
  }
}

function mergeDiagnosis(ruleResult, llmReview) {
  const CAP = 20;
  const map = {};
  ruleResult.candidates.forEach((c) => (map[c.cause] = { ...c, evidence: [...c.evidence] }));
  const notes = [];
  for (const adj of llmReview.adjustments || []) {
    if (!(adj.cause in map)) continue;
    const delta = Math.max(-CAP, Math.min(CAP, adj.delta));
    map[adj.cause].score = Math.round(Math.min(100, Math.max(0, map[adj.cause].score + delta)) * 10) / 10;
    map[adj.cause].evidence.push(`[LLM ${delta >= 0 ? "+" : ""}${delta}] ${adj.reason}`);
    notes.push(`${adj.cause}: ${delta >= 0 ? "+" : ""}${delta} — ${adj.reason}`);
  }
  if (llmReview.new_candidate) {
    const nc = llmReview.new_candidate;
    map[nc.cause] = { cause: nc.cause, score: Math.min(nc.score, CAP + 30), evidence: [`[LLM new] ${nc.reason}`] };
    notes.push(`New candidate ${nc.cause}: ${nc.reason}`);
  }
  const merged = Object.values(map).sort((a, b) => b.score - a.score).slice(0, 5);
  const top = merged[0]?.score ?? 0;
  const confidenceLevel = top >= 70 ? "HIGH" : top >= 40 ? "MEDIUM" : "LOW";
  return { candidates: merged, confidenceLevel, notes };
}

function generateActionPlan(finalResult, rawText, answers, lang) {
  const primary = finalResult.candidates[0];
  if (!primary) return null;
  const template = ACTION_PLAN_DB[primary.cause];
  if (!template) return null;

  const esc = escalationCheck(rawText, answers, template.severity);
  const related = finalResult.candidates.slice(1).filter((c) => c.score >= 40);
  const causeLabel = bi(CAUSE_LABEL[primary.cause], lang) || primary.cause;

  // 참고: 문장 구조를 "유력 원인: X (확신도 Y)" 형태로 잡아서, 원인명이 어떤 형태(한/영, 받침 유무)든
  // 조사(로/으로 등) 선택 오류 없이 자연스럽게 표현되도록 했다.
  let statement;
  if (lang === "en") {
    statement =
      primary.score >= 70
        ? `Likely cause: ${causeLabel} (high confidence)`
        : primary.score >= 40
        ? `Possible cause: ${causeLabel} (moderate confidence)`
        : `Possible cause (low confidence): ${causeLabel} — further checks recommended`;
  } else {
    statement =
      primary.score >= 70
        ? `유력한 원인: ${causeLabel} (확신도 높음)`
        : primary.score >= 40
        ? `가능성 있는 원인: ${causeLabel} (확신도 보통)`
        : `가능성이 낮은 원인: ${causeLabel} (확신도 낮음, 추가 확인 권장)`;
  }

  return {
    cause: primary.cause,
    causeLabel,
    score: primary.score,
    severity: esc.severity,
    statement,
    template,
    related,
    interrupted: esc.shouldInterrupt,
  };
}

// 진단 기록 영속 저장 — 개인 저장소(shared=false)에 배열 하나로 저장한다.
const HISTORY_KEY = "diagnosis-history";
const HISTORY_LIMIT = 50;

async function loadDiagnosisHistory() {
  try {
    const res = await window.storage.get(HISTORY_KEY, false);
    if (!res || !res.value) return [];
    return JSON.parse(res.value);
  } catch {
    return [];
  }
}

async function saveDiagnosisHistory(records) {
  try {
    await window.storage.set(HISTORY_KEY, JSON.stringify(records), false);
  } catch (e) {
    console.error("Failed to save diagnosis history:", e);
  }
}

async function clearDiagnosisHistory() {
  try {
    await window.storage.delete(HISTORY_KEY, false);
  } catch {
    // 키가 원래 없었던 경우도 여기로 올 수 있음 — 무시
  }
}

// 모든 카테고리를 통틀어 question_key로 질문을 바로 찾을 수 있는 맵
const QUESTION_BY_KEY = {};
for (const list of Object.values(CHECKLISTS)) {
  for (const q of list) {
    if (!(q.key in QUESTION_BY_KEY)) QUESTION_BY_KEY[q.key] = q;
  }
}

// 설계 문서 6.4절: 확신도 40~70% 구간에서 상위 후보를 가르는 질문을 1~2개 추가로 던진다.
function getDifferentiatingQuestions(candidates, answers, maxCount = 2) {
  const top = candidates.slice(0, 2);
  if (top.length === 0) return [];
  const keySet = (cause) => new Set((MATRIX[cause]?.rules || []).map((r) => r[0]));
  const keys1 = keySet(top[0].cause);
  const keys2 = top[1] ? keySet(top[1].cause) : new Set();
  const allKeys = new Set([...keys1, ...keys2]);

  const scored = [];
  for (const k of allKeys) {
    if (k in answers) continue;
    if (!QUESTION_BY_KEY[k]) continue;
    const differentiating = keys1.has(k) !== keys2.has(k);
    scored.push({ key: k, differentiating });
  }
  scored.sort((a, b) => (b.differentiating ? 1 : 0) - (a.differentiating ? 1 : 0));
  return scored.slice(0, maxCount).map((s) => QUESTION_BY_KEY[s.key]);
}

/* =====================================================================
   UI STRINGS — 모든 정적 UI 문구를 한 곳에 모아둔다. STR[lang].xxx로 사용.
   ===================================================================== */
const STR = {
  ko: {
    greeting: "안녕하세요. 펌프 진단 챗봇입니다. 어떤 문제가 있으신가요? 증상을 자유롭게 설명해주세요.",
    restartGreeting: "다른 문제가 있으신가요? 증상을 설명해주세요.",
    placeholderIntake: "증상을 입력하세요…",
    placeholderChecklist: "위험한 상황이면 자유롭게 알려주세요 (선택사항)",
    placeholderDisabled: "위 질문에 답변을 선택해주세요",
    restartButton: "새 진단 시작",
    skipOption: "모름 / 건너뛰기",
    yes: "네, 맞아요",
    no: "아니요, 직접 선택할게요",
    pickerConfirm: (n) => `확인 (${n}개 선택)`,
    pickerPrompt: "해당하는 카테고리를 직접 선택해주세요 (여러 개 선택 가능합니다).",
    pickerFailPrompt: "증상을 명확히 분류하지 못했습니다. 해당하는 카테고리를 직접 선택해주세요 (여러 개 선택 가능합니다).",
    classifyMsg: (labels) => `증상을 "${labels}" 관련으로 분류했습니다. 맞나요?`,
    statusClassifyOk: "AI 실시간 분류 사용",
    statusClassifyFail: "오프라인 추정 분류 사용 (AI 연결 실패 — 키워드 기반 결과)",
    statusReviewOk: "AI 정성 검토 반영됨",
    statusReviewFail: "AI 정성 검토 실패 — 룰 기반 결과만 사용",
    hardAlert: "안전 위험 신호가 감지되었습니다. 일반 진단 절차보다 안전 확보가 우선입니다.\n즉시 펌프 가동을 중지하고, 주변 인원을 안전 거리로 대피시킨 뒤 전문가/안전관리자에게 연락하세요.",
    heatIntro: "정확한 판단을 위해 온도를 확인할게요.",
    heatTempQuestion: "베어링 하우징 온도를 실측하셨거나 대략 아신다면 섭씨(°C)로 알려주세요.",
    heatTempThreshold: (inspect, stop) => `기준: ${inspect}°C 이상 점검 대상 · ${stop}°C 이상 즉시 정지+오버홀 검토`,
    heatTempPlaceholder: "예: 82",
    heatTempConfirm: "확인",
    heatTempFallback: "실측값 모름 → 느낌으로 답할게요",
    heatClarifyFootnote: "* 참고용 감각 기준입니다. 정확한 위험 온도는 베어링/윤활유 사양에 따라 다르니 제조사 스펙을 확인하세요.",
    heatMediumMsg: (inspect, stop) => `점검 대상 온도 구간(${inspect}~${stop}°C)입니다. 진단은 계속 진행하되, 정비팀에 베어링 점검을 함께 요청하시길 권장합니다.`,
    heatResumeMsg: "확인 감사합니다. 이어서 진행할게요.",
    heatHighMeasured: (tv, stop) => `실측 온도(${tv}°C)가 즉시 정지 기준(${stop}°C) 이상입니다.\n즉시 가동을 정지하고 오버홀(분해 정비) 검토를 진행하세요. 필요 시 전문가/안전관리자에게 연락하세요.`,
    heatHighFelt: (stop) => `느낌 기준으로 즉시 정지 기준(${stop}°C 이상 추정)에 해당합니다.\n즉시 가동을 정지하고 오버홀(분해 정비) 검토를 진행하세요. 필요 시 전문가/안전관리자에게 연락하세요.`,
    sideNoteAck: "알려주신 내용을 확인했습니다. 위 질문에 계속 답변해주세요.",
    diagAnalyzing: "수집된 정보를 바탕으로 원인을 분석하고 있습니다…",
    diagInconclusive: "입력하신 정보만으로는 원인을 확신하기 어렵습니다. 전문가 상담을 권장드리며, 추가 증상이 있으면 다시 말씀해주세요.",
    diagFollowUp: "조치 후에도 증상이 계속되면 다시 알려주세요 — 추가 진단을 도와드리겠습니다.",
    diagInterruptedLate: "답변 내용을 종합한 결과 안전 위험 신호가 감지되었습니다.\n즉시 가동을 중지하고 전문가/안전관리자에게 연락하세요.",
    diffIntro: "원인을 조금 더 좁히기 위해 몇 가지만 더 확인할게요.",
    historyTitle: (n) => `진단 기록 (${n}건)`,
    historyEmpty: "아직 저장된 진단 기록이 없습니다.",
    historyClear: "전체 삭제",
    historyBtn: "기록",
    outcomeDiagnosed: "진단 완료",
    outcomeInterrupted: "안전 중단",
    outcomeInconclusive: "확신 어려움",
    planSafetyNotice: "안전 관련 사항입니다. 즉시 조치를 최우선으로 시행하고, 필요 시 가동을 중지하세요.",
    planImmediate: "즉시 조치",
    planMaintenance: "정비 필요",
    planEscalation: "전문가 호출 기준",
    planRelated: "함께 확인하면 좋은 사항",
    planScoreLabel: (score) => `스코어 ${score}`,
    stepperSteps: ["접수", "점검", "체크리스트", "진단", "조치"],
    checklistProgress: (a, b) => `체크리스트 ${a}/${b}`,
    diffProgress: (a, b) => `추가 확인 ${a}/${b}`,
    reasonHardIntake: "안전 위험 신호 감지 (접수 시점)",
    reasonHardChecklist: "안전 위험 신호 감지 (체크리스트 중 보고)",
    reasonHeatHigh: "베어링 과열 — 즉시 정지 기준",
    reasonLateSignal: "체크리스트 답변 종합 후 위험 신호 감지",
    reasonInconclusive: "확신 가능한 원인 후보 없음",
    processing: "처리 중…",
  },
  en: {
    greeting: "Hello. This is the pump diagnostics chatbot. What issue are you having? Please describe the symptom freely.",
    restartGreeting: "Any other issue? Please describe the symptom.",
    placeholderIntake: "Describe the symptom…",
    placeholderChecklist: "Let us know if it's dangerous (optional)",
    placeholderDisabled: "Please select an answer above",
    restartButton: "Start new diagnosis",
    skipOption: "Don't know / Skip",
    yes: "Yes, that's right",
    no: "No, I'll choose manually",
    pickerConfirm: (n) => `Confirm (${n} selected)`,
    pickerPrompt: "Please select the matching categories yourself (multiple selection allowed).",
    pickerFailPrompt: "We couldn't clearly classify the symptom. Please select the matching categories yourself (multiple selection allowed).",
    classifyMsg: (labels) => `We classified the symptom as related to "${labels}". Is that right?`,
    statusClassifyOk: "Real-time AI classification used",
    statusClassifyFail: "Offline estimate used (AI connection failed — keyword-based result)",
    statusReviewOk: "AI qualitative review applied",
    statusReviewFail: "AI qualitative review failed — using rule-based result only",
    hardAlert: "A safety hazard signal was detected. Ensuring safety takes priority over the normal diagnostic process.\nStop the pump immediately, move nearby personnel to a safe distance, and contact a specialist/safety officer.",
    heatIntro: "Let's check the temperature to make an accurate call.",
    heatTempQuestion: "If you've measured or roughly know the bearing housing temperature, please tell us in Celsius (°C).",
    heatTempThreshold: (inspect, stop) => `Thresholds: ${inspect}°C+ -> inspection required · ${stop}°C+ -> immediate stop + overhaul review`,
    heatTempPlaceholder: "e.g., 82",
    heatTempConfirm: "Confirm",
    heatTempFallback: "Don't know exact value -> answer by feel",
    heatClarifyFootnote: "* These are rough sensory guides. The actual danger temperature depends on the bearing/lubricant spec — please check the manufacturer's documentation.",
    heatMediumMsg: (inspect, stop) => `This is in the inspection-required range (${inspect}-${stop}°C). We'll continue the diagnosis, but we recommend also asking maintenance to inspect the bearing.`,
    heatResumeMsg: "Thanks for confirming. Let's continue.",
    heatHighMeasured: (tv, stop) => `The measured temperature (${tv}°C) is at or above the immediate-stop threshold (${stop}°C).\nStop operation immediately and proceed with an overhaul review. Contact a specialist/safety officer if needed.`,
    heatHighFelt: (stop) => `Based on how it feels, this is estimated to be at or above the immediate-stop threshold (${stop}°C+).\nStop operation immediately and proceed with an overhaul review. Contact a specialist/safety officer if needed.`,
    sideNoteAck: "Thanks, noted. Please continue answering the question above.",
    diagAnalyzing: "Analyzing the cause based on the information collected…",
    diagInconclusive: "We can't confidently determine the cause from the information provided. We recommend consulting a specialist, and please let us know if there are additional symptoms.",
    diagFollowUp: "If the symptom continues after taking action, let us know again — we'll help with further diagnosis.",
    diagInterruptedLate: "Based on your answers, a safety hazard signal was detected.\nStop operation immediately and contact a specialist/safety officer.",
    diffIntro: "Let's check a couple more things to narrow down the cause.",
    historyTitle: (n) => `Diagnosis history (${n})`,
    historyEmpty: "No diagnosis history saved yet.",
    historyClear: "Clear all",
    historyBtn: "History",
    outcomeDiagnosed: "Diagnosed",
    outcomeInterrupted: "Safety stop",
    outcomeInconclusive: "Inconclusive",
    planSafetyNotice: "This is safety-related. Carry out the immediate actions first, and stop operation if needed.",
    planImmediate: "Immediate actions",
    planMaintenance: "Maintenance required",
    planEscalation: "Escalation criteria",
    planRelated: "Also worth checking",
    planScoreLabel: (score) => `score ${score}`,
    stepperSteps: ["Intake", "Check", "Checklist", "Diagnosis", "Action"],
    checklistProgress: (a, b) => `Checklist ${a}/${b}`,
    diffProgress: (a, b) => `Follow-up ${a}/${b}`,
    reasonHardIntake: "Safety hazard signal detected (at intake)",
    reasonHardChecklist: "Safety hazard signal detected (reported during checklist)",
    reasonHeatHigh: "Bearing overheating — immediate-stop threshold",
    reasonLateSignal: "Hazard signal detected after reviewing checklist answers",
    reasonInconclusive: "No confident cause candidate",
    processing: "Processing…",
  },
};

/* =====================================================================
   UI SUBCOMPONENTS
   ===================================================================== */
function SeverityGauge({ severity, lang }) {
  const idx = SEVERITY_META[severity]?.idx ?? 0;
  const angle = -90 + 22.5 + idx * 45;
  const zones = [
    { color: T.teal, from: -90, to: -45 },
    { color: T.amber, from: -45, to: 0 },
    { color: T.orange, from: 0, to: 45 },
    { color: T.red, from: 45, to: 90 },
  ];
  const polar = (a, r) => {
    const rad = (a * Math.PI) / 180;
    return [60 + r * Math.sin(rad), 60 - r * Math.cos(rad)];
  };
  const arcPath = (from, to, r) => {
    const [x1, y1] = polar(from, r);
    const [x2, y2] = polar(to, r);
    return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;
  };

  return (
    <svg width="100" height="56" viewBox="0 0 120 68" style={{ flexShrink: 0 }}>
      {zones.map((z, i) => (
        <path key={i} d={arcPath(z.from, z.to, 44)} stroke={z.color} strokeWidth="7" fill="none" strokeLinecap="butt" opacity="0.85" />
      ))}
      <line
        x1="60"
        y1="60"
        x2="60"
        y2="26"
        stroke={T.text}
        strokeWidth="2.5"
        strokeLinecap="round"
        style={{ transform: `rotate(${angle}deg)`, transformOrigin: "60px 60px", transition: "transform 0.5s cubic-bezier(0.34, 1.2, 0.64, 1)" }}
      />
      <circle cx="60" cy="60" r="4" fill={T.text} />
      <text x="60" y="66" textAnchor="middle" fontFamily={T.mono} fontSize="9" fill={T.textMuted}>
        {bi(SEVERITY_META[severity]?.label, lang) || (lang === "en" ? "Idle" : "대기")}
      </text>
    </svg>
  );
}

function HistoryPanel({ records, onClose, onClear, lang }) {
  const t = STR[lang];
  const OUTCOME_META = {
    diagnosed: { label: t.outcomeDiagnosed, color: T.teal },
    interrupted: { label: t.outcomeInterrupted, color: T.red },
    inconclusive: { label: t.outcomeInconclusive, color: T.textMuted },
  };
  const dateLocale = lang === "en" ? "en-US" : "ko-KR";

  return (
    <div style={{ padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontFamily: T.mono, fontSize: 12, color: T.text, letterSpacing: 0.5 }}>{t.historyTitle(records.length)}</div>
        <div style={{ display: "flex", gap: 6 }}>
          {records.length > 0 && (
            <button
              onClick={onClear}
              style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: T.mono, fontSize: 11, color: T.textMuted, background: "transparent", border: `1px solid ${T.border}`, borderRadius: 6, padding: "4px 8px", cursor: "pointer" }}
            >
              <Trash2 size={12} /> {t.historyClear}
            </button>
          )}
          <button
            onClick={onClose}
            style={{ display: "flex", alignItems: "center", fontFamily: T.mono, fontSize: 11, color: T.textMuted, background: "transparent", border: `1px solid ${T.border}`, borderRadius: 6, padding: "4px 8px", cursor: "pointer" }}
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {records.length === 0 ? (
        <div style={{ fontFamily: T.sans, fontSize: 13, color: T.textMuted, padding: "20px 0", textAlign: "center" }}>
          {t.historyEmpty}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {records.map((r) => {
            const meta = OUTCOME_META[r.outcome] || { label: r.outcome, color: T.textMuted };
            const dt = new Date(r.timestamp);
            const dateLabel = isNaN(dt) ? r.timestamp : dt.toLocaleString(dateLocale, { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
            return (
              <div key={r.id} style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontFamily: T.mono, fontSize: 10, color: T.textFaint }}>{dateLabel}</span>
                  <span style={{ fontFamily: T.mono, fontSize: 10, color: meta.color, border: `1px solid ${meta.color}`, borderRadius: 5, padding: "1px 6px" }}>{meta.label}</span>
                </div>
                <div style={{ fontFamily: T.sans, fontSize: 13, color: T.text, marginBottom: 2 }}>
                  {r.statement || r.reason || "—"}
                </div>
                {r.symptomText && (
                  <div style={{ fontFamily: T.sans, fontSize: 12, color: T.textMuted }}>"{r.symptomText}"</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stepper({ stage, lang }) {
  const steps = STR[lang].stepperSteps;
  const stageIdx = { intake: 0, escalating: 1, heat_clarify: 1, category_confirm: 1, category_picker: 1, checklist: 2, diagnosing: 3, done: 4, blocked: 1 }[stage] ?? 0;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", rowGap: 4, alignItems: "center", gap: 5, fontFamily: T.mono, fontSize: 12.5 }}>
      {steps.map((s, i) => (
        <React.Fragment key={s}>
          <span style={{ color: i <= stageIdx ? T.amber : T.textFaint, fontWeight: i === stageIdx ? 600 : 400, whiteSpace: "nowrap" }}>
            {i + 1} {s}
          </span>
          {i < steps.length - 1 && <ChevronRight size={13} color={T.textFaint} />}
        </React.Fragment>
      ))}
    </div>
  );
}

function StatusTag({ ok, label }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 12, marginTop: -6, animation: "tickerIn 0.25s ease-out" }}>
      <div
        style={{
          fontFamily: T.mono,
          fontSize: 10.5,
          letterSpacing: 0.3,
          color: ok ? T.teal : T.amber,
          border: `1px solid ${ok ? T.teal : T.amber}`,
          borderRadius: 6,
          padding: "2px 8px",
          opacity: 0.85,
        }}
      >
        {ok ? "● " : "▲ "}
        {label}
      </div>
    </div>
  );
}

function Bubble({ role, children }) {
  const isUser = role === "user";
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 12 }}>
      <div
        style={{
          maxWidth: "82%",
          background: isUser ? T.panelAlt : T.panel,
          border: `1px solid ${isUser ? T.borderStrong : T.border}`,
          borderRadius: 10,
          padding: "10px 14px",
          fontFamily: T.sans,
          fontSize: 14,
          lineHeight: 1.6,
          color: T.text,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function AlertBubble({ text }) {
  return (
    <div style={{ display: "flex", marginBottom: 12, animation: "fadeInUp 0.3s ease-out" }}>
      <div
        style={{
          maxWidth: "90%",
          background: "rgba(229,72,77,0.12)",
          border: `1px solid ${T.red}`,
          borderRadius: 10,
          padding: "12px 14px",
          fontFamily: T.sans,
          fontSize: 14,
          lineHeight: 1.6,
          color: T.text,
          display: "flex",
          gap: 10,
        }}
      >
        <AlertTriangle size={18} color={T.red} style={{ flexShrink: 0, marginTop: 2 }} />
        <span style={{ whiteSpace: "pre-line" }}>{text}</span>
      </div>
    </div>
  );
}

function ChoiceQuestion({ question, onAnswer, lang }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontFamily: T.sans, fontSize: 14, color: T.text, marginBottom: 8, background: T.panel, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 14px" }}>
        {bi(question.text, lang)}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {question.options.map(([val, label]) => (
          <button
            key={val}
            onClick={() => onAnswer(question.key, val)}
            style={{
              fontFamily: T.sans,
              fontSize: 13,
              color: T.text,
              background: T.panelAlt,
              border: `1px solid ${T.borderStrong}`,
              borderRadius: 8,
              padding: "6px 12px",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = T.amber)}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = T.borderStrong)}
          >
            {bi(label, lang)}
          </button>
        ))}
        <button
          onClick={() => onAnswer(question.key, null)}
          style={{ fontFamily: T.mono, fontSize: 12, color: T.textMuted, background: "transparent", border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}
        >
          {STR[lang].skipOption}
        </button>
      </div>
    </div>
  );
}

function CategoryConfirmQuestion({ onAnswer, lang }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", gap: 6 }}>
        <button
          onClick={() => onAnswer(true)}
          style={{ fontFamily: T.sans, fontSize: 13, color: T.bg, background: T.teal, border: "none", borderRadius: 8, padding: "6px 14px", cursor: "pointer" }}
        >
          {STR[lang].yes}
        </button>
        <button
          onClick={() => onAnswer(false)}
          style={{ fontFamily: T.sans, fontSize: 13, color: T.text, background: T.panelAlt, border: `1px solid ${T.borderStrong}`, borderRadius: 8, padding: "6px 14px", cursor: "pointer" }}
        >
          {STR[lang].no}
        </button>
      </div>
    </div>
  );
}

function CategoryPicker({ onConfirm, lang }) {
  const [selected, setSelected] = useState([]);
  const toggle = (c) => setSelected((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
        {REAL_CATEGORIES.map((c) => {
          const isSelected = selected.includes(c);
          return (
            <button
              key={c}
              onClick={() => toggle(c)}
              style={{
                fontFamily: T.sans,
                fontSize: 13,
                color: isSelected ? T.amber : T.text,
                background: isSelected ? "rgba(242,169,59,0.14)" : T.panelAlt,
                border: `1px solid ${isSelected ? T.amber : T.borderStrong}`,
                borderRadius: 8,
                padding: "6px 12px",
                cursor: "pointer",
              }}
            >
              {isSelected ? "✓ " : ""}
              {bi(CATEGORY_LABEL[c], lang)}
            </button>
          );
        })}
      </div>
      <button
        onClick={() => selected.length > 0 && onConfirm(selected)}
        disabled={selected.length === 0}
        style={{
          fontFamily: T.sans,
          fontSize: 13,
          color: T.bg,
          background: T.amber,
          border: "none",
          borderRadius: 8,
          padding: "6px 14px",
          cursor: selected.length > 0 ? "pointer" : "default",
          opacity: selected.length > 0 ? 1 : 0.4,
        }}
      >
        {STR[lang].pickerConfirm(selected.length)}
      </button>
    </div>
  );
}

function HeatTempQuestion({ onSubmitTemp, onFallback, lang }) {
  const [value, setValue] = useState("");
  const isValid = value.trim() !== "" && !isNaN(Number(value));
  const t = STR[lang];

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontFamily: T.sans, fontSize: 14, color: T.text, marginBottom: 8, background: T.panel, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 14px" }}>
        {t.heatTempQuestion}
        <div style={{ fontFamily: T.mono, fontSize: 11, color: T.textMuted, marginTop: 4 }}>
          {t.heatTempThreshold(BEARING_TEMP_INSPECT_C, BEARING_TEMP_STOP_C)}
        </div>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t.heatTempPlaceholder}
          style={{ width: 90, background: T.panel, border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 10px", color: T.text, fontFamily: T.mono, fontSize: 13, outline: "none" }}
        />
        <button
          onClick={() => isValid && onSubmitTemp(Number(value))}
          disabled={!isValid}
          style={{ fontFamily: T.sans, fontSize: 13, color: T.bg, background: T.amber, border: "none", borderRadius: 8, padding: "6px 14px", cursor: isValid ? "pointer" : "default", opacity: isValid ? 1 : 0.4 }}
        >
          {t.heatTempConfirm}
        </button>
        <button
          onClick={onFallback}
          style={{ fontFamily: T.mono, fontSize: 12, color: T.textMuted, background: "transparent", border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}
        >
          {t.heatTempFallback}
        </button>
      </div>
    </div>
  );
}

function HeatClarifyQuestion({ onAnswer, lang }) {
  return (
    <div style={{ marginBottom: 12, display: "flex", flexDirection: "column", gap: 6 }}>
      {HEAT_CLARIFY_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onAnswer(opt.value)}
          style={{
            textAlign: "left",
            fontFamily: T.sans,
            fontSize: 13,
            color: T.text,
            background: T.panelAlt,
            border: `1px solid ${opt.severity === "HIGH" ? T.red : T.borderStrong}`,
            borderRadius: 8,
            padding: "10px 12px",
            cursor: "pointer",
          }}
        >
          <div>{bi(opt.label, lang)}</div>
          <div style={{ fontFamily: T.mono, fontSize: 11, color: T.textMuted, marginTop: 2 }}>{bi(opt.note, lang)}</div>
        </button>
      ))}
      <div style={{ fontFamily: T.mono, fontSize: 10, color: T.textFaint, marginTop: 2 }}>
        {STR[lang].heatClarifyFootnote}
      </div>
    </div>
  );
}

function ActionPlanCard({ plan, lang }) {
  const meta = SEVERITY_META[plan.severity];
  const t = STR[lang];
  return (
    <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 10, padding: 16, marginBottom: 12, fontFamily: T.sans, fontSize: 14, color: T.text, animation: "fadeInUp 0.35s ease-out" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={{ width: 8, height: 8, borderRadius: 4, background: meta.color, display: "inline-block" }} />
        <span style={{ fontFamily: T.mono, fontSize: 12, color: meta.color, letterSpacing: 0.5 }}>{bi(meta.label, lang).toUpperCase()}</span>
      </div>
      <div style={{ fontSize: 15, marginBottom: 12 }}>{plan.statement}</div>

      {plan.interrupted && (
        <div style={{ background: "rgba(229,72,77,0.12)", border: `1px solid ${T.red}`, borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 13, display: "flex", gap: 8 }}>
          <AlertTriangle size={16} color={T.red} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{t.planSafetyNotice}</span>
        </div>
      )}

      <Section icon={<Activity size={13} />} title={t.planImmediate} items={plan.template.immediate} color={T.teal} lang={lang} />
      <Section icon={<Wrench size={13} />} title={t.planMaintenance} items={plan.template.maintenance} color={T.amber} lang={lang} />
      <Section icon={<ShieldAlert size={13} />} title={t.planEscalation} items={plan.template.escalation} color={T.red} lang={lang} />

      {plan.related.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontFamily: T.mono, fontSize: 11, color: T.textMuted, marginBottom: 4 }}>{t.planRelated}</div>
          {plan.related.map((r) => (
            <div key={r.cause} style={{ fontSize: 13, color: T.textMuted, marginBottom: 2 }}>
              · {bi(CAUSE_LABEL[r.cause], lang) || r.cause} ({t.planScoreLabel(r.score)})
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Section({ icon, title, items, color, lang }) {
  if (!items || items.length === 0) return null;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: T.mono, fontSize: 11, color, marginBottom: 4, letterSpacing: 0.3 }}>
        {icon}
        {title}
      </div>
      {items.map((it, i) => (
        <div key={i} style={{ fontSize: 13, color: T.text, marginBottom: 3, paddingLeft: 4 }}>
          · {bi(it, lang)}
        </div>
      ))}
    </div>
  );
}

/* =====================================================================
   MAIN APP
   ===================================================================== */
export default function PumpTroubleshootingChatbot() {
  const [lang, setLang] = useState("ko"); // "ko" | "en"
  const t = STR[lang];

  const [messages, setMessages] = useState([{ role: "bot", type: "text", content: STR.ko.greeting }]);
  const [stage, setStage] = useState("intake");
  const [inputText, setInputText] = useState("");
  const [rawText, setRawText] = useState("");
  const [categories, setCategories] = useState([]);
  const [answers, setAnswers] = useState({});
  const [diffQueue, setDiffQueue] = useState([]);
  const [diffAsked, setDiffAsked] = useState(false);
  const [severity, setSeverity] = useState("LOW");
  const [signals, setSignals] = useState([]);
  const [heatReturnStage, setHeatReturnStage] = useState("intake");
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, stage]);

  useEffect(() => {
    loadDiagnosisHistory().then(setHistory);
  }, []);

  const pushMessage = (msg) => setMessages((prev) => [...prev, msg]);

  // 언어 전환 시, 아직 아무 대화도 없는 최초 인사말만 새 언어로 교체한다.
  const handleLangChange = (nextLang) => {
    setLang(nextLang);
    setMessages((prev) => {
      if (prev.length === 1 && prev[0].role === "bot" && prev[0].type === "text") {
        return [{ role: "bot", type: "text", content: STR[nextLang].greeting }];
      }
      return prev;
    });
  };

  const logHistoryEntry = (entry) => {
    const record = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      symptomText: rawText,
      ...entry,
    };
    setHistory((prev) => {
      const updated = [record, ...prev].slice(0, HISTORY_LIMIT);
      saveDiagnosisHistory(updated);
      return updated;
    });
  };

  const nextChecklistQuestion = useCallback(
    (currentAnswers) => {
      const seen = new Set();
      for (const cat of categories) {
        for (const q of CHECKLISTS[cat] || []) {
          if (seen.has(q.key)) continue;
          seen.add(q.key);
          if (!(q.key in currentAnswers)) return q;
        }
      }
      return null;
    },
    [categories]
  );

  const proceedAfterChecklist = (currentAnswers, queue) => {
    const pendingDiff = queue.find((q) => !(q.key in currentAnswers));
    if (pendingDiff) {
      setStage("checklist");
      pushMessage({ role: "bot", type: "choice", question: pendingDiff });
      return;
    }

    if (!diffAsked) {
      const ruleResult = evaluateCauseProbability(currentAnswers);
      if (ruleResult.confidenceLevel === "MEDIUM") {
        const diffQs = getDifferentiatingQuestions(ruleResult.candidates, currentAnswers, 2);
        if (diffQs.length > 0) {
          setDiffQueue(diffQs);
          setDiffAsked(true);
          pushMessage({ role: "bot", type: "text", content: t.diffIntro });
          setStage("checklist");
          pushMessage({ role: "bot", type: "choice", question: diffQs[0] });
          return;
        }
      }
      setDiffAsked(true);
    }

    runDiagnosis(currentAnswers);
  };

  const startChecklist = (cats, currentAnswers) => {
    const seen = new Set();
    let next = null;
    for (const cat of cats) {
      for (const q of CHECKLISTS[cat] || []) {
        if (seen.has(q.key)) continue;
        seen.add(q.key);
        if (!(q.key in currentAnswers)) {
          next = q;
          break;
        }
      }
      if (next) break;
    }
    if (next) {
      setStage("checklist");
      pushMessage({ role: "bot", type: "choice", question: next });
    } else {
      proceedAfterChecklist(currentAnswers, []);
    }
  };

  const proceedWithClassification = async (text) => {
    setLoading(true);
    const { categories: cats, usedLLM } = await classifySymptomCategory(text, lang);
    setLoading(false);

    pushMessage({
      role: "bot",
      type: "status",
      ok: usedLLM,
      label: usedLLM ? t.statusClassifyOk : t.statusClassifyFail,
    });

    const realCats = cats.filter((c) => c !== "OTHER_COMPLEX");

    if (realCats.length === 0) {
      setStage("category_picker");
      pushMessage({ role: "bot", type: "text", content: t.pickerFailPrompt });
      pushMessage({ role: "bot", type: "category_picker" });
      return;
    }

    const catLabels = realCats.map((c) => bi(CATEGORY_LABEL[c], lang) || c).join(", ");
    setStage("category_confirm");
    pushMessage({ role: "bot", type: "text", content: t.classifyMsg(catLabels) });
    pushMessage({ role: "bot", type: "category_confirm", cats: realCats });
  };

  const handleCategoryConfirm = (accepted, cats) => {
    setMessages((prev) => {
      const updated = [...prev];
      const lastIdx = updated.length - 1;
      if (updated[lastIdx]?.type === "category_confirm") {
        updated[lastIdx] = { ...updated[lastIdx], answered: true, answerLabel: accepted ? t.yes : t.no };
      }
      return updated;
    });

    if (accepted) {
      setCategories(cats);
      startChecklist(cats, {});
    } else {
      setStage("category_picker");
      pushMessage({ role: "bot", type: "text", content: t.pickerPrompt });
      pushMessage({ role: "bot", type: "category_picker" });
    }
  };

  const handleCategoryPickerConfirm = (selected) => {
    setMessages((prev) => {
      const updated = [...prev];
      const lastIdx = updated.length - 1;
      if (updated[lastIdx]?.type === "category_picker") {
        updated[lastIdx] = { ...updated[lastIdx], answered: true, answerLabel: selected.map((c) => bi(CATEGORY_LABEL[c], lang)).join(", ") };
      }
      return updated;
    });
    setCategories(selected);
    startChecklist(selected, {});
  };

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || loading) return;
    setInputText("");
    setRawText(text);
    pushMessage({ role: "user", type: "text", content: text });
    setLoading(true);

    const textSignals = detectTextSignals(text);
    setSignals(textSignals);
    const hardHit = textSignals.some((s) => HARD_SIGNAL_CODES.has(s));

    if (hardHit) {
      setSeverity("HIGH");
      setLoading(false);
      setStage("blocked");
      pushMessage({ role: "bot", type: "alert", content: t.hardAlert });
      logHistoryEntry({ outcome: "interrupted", severity: "HIGH", reason: t.reasonHardIntake, signals: textSignals });
      return;
    }

    if (textSignals.includes("severe_overheating")) {
      setSeverity("MEDIUM_HIGH");
      setLoading(false);
      setHeatReturnStage("intake");
      setStage("heat_clarify");
      pushMessage({ role: "bot", type: "text", content: t.heatIntro });
      pushMessage({ role: "bot", type: "heat_temp" });
      return;
    }

    await proceedWithClassification(text);
  };

  const handleSideNote = async () => {
    const text = inputText.trim();
    if (!text || loading) return;
    setInputText("");
    pushMessage({ role: "user", type: "text", content: text });

    const textSignals = detectTextSignals(text);
    const hardHit = textSignals.some((s) => HARD_SIGNAL_CODES.has(s));
    const heatHit = textSignals.includes("severe_overheating");

    setRawText((prev) => `${prev} ${text}`.trim());
    setSignals((prev) => Array.from(new Set([...prev, ...textSignals])));

    if (hardHit) {
      setSeverity("HIGH");
      setStage("blocked");
      pushMessage({ role: "bot", type: "alert", content: t.hardAlert });
      logHistoryEntry({ outcome: "interrupted", severity: "HIGH", reason: t.reasonHardChecklist, signals: textSignals });
      return;
    }

    if (heatHit) {
      setSeverity("MEDIUM_HIGH");
      setHeatReturnStage("checklist");
      setStage("heat_clarify");
      pushMessage({ role: "bot", type: "text", content: t.heatIntro });
      pushMessage({ role: "bot", type: "heat_temp" });
      return;
    }

    pushMessage({ role: "bot", type: "text", content: t.sideNoteAck });
  };

  const handleClearHistory = async () => {
    await clearDiagnosisHistory();
    setHistory([]);
  };

  const applyHeatSeverityAndProceed = async (severityLevel, alertContent) => {
    setSeverity(severityLevel);
    if (severityLevel === "HIGH") {
      setStage("blocked");
      pushMessage({ role: "bot", type: "alert", content: alertContent });
      logHistoryEntry({ outcome: "interrupted", severity: "HIGH", reason: t.reasonHeatHigh, detail: alertContent });
      return;
    }
    if (severityLevel === "MEDIUM_HIGH") {
      pushMessage({ role: "bot", type: "text", content: t.heatMediumMsg(BEARING_TEMP_INSPECT_C, BEARING_TEMP_STOP_C) });
    }

    if (heatReturnStage === "checklist") {
      setStage("checklist");
      pushMessage({ role: "bot", type: "text", content: t.heatResumeMsg });
      return;
    }

    await proceedWithClassification(rawText);
  };

  const handleHeatTempSubmit = async (tempC) => {
    const result = classifyBearingTemp(tempC, lang);

    setMessages((prev) => {
      const updated = [...prev];
      const lastIdx = updated.length - 1;
      if (updated[lastIdx]?.type === "heat_temp") {
        updated[lastIdx] = { ...updated[lastIdx], answered: true, answerLabel: `${tempC}°C (${result.label})` };
      }
      return updated;
    });

    const alertContent = t.heatHighMeasured(tempC, BEARING_TEMP_STOP_C);
    await applyHeatSeverityAndProceed(result.severity, alertContent);
  };

  const handleHeatTempFallback = () => {
    setMessages((prev) => {
      const updated = [...prev];
      const lastIdx = updated.length - 1;
      if (updated[lastIdx]?.type === "heat_temp") {
        updated[lastIdx] = { ...updated[lastIdx], answered: true, answerLabel: t.heatTempFallback };
      }
      return updated;
    });
    pushMessage({ role: "bot", type: "heat_clarify" });
  };

  const handleHeatClarify = async (value) => {
    const opt = HEAT_CLARIFY_OPTIONS.find((o) => o.value === value);

    setMessages((prev) => {
      const updated = [...prev];
      const lastIdx = updated.length - 1;
      if (updated[lastIdx]?.type === "heat_clarify") {
        updated[lastIdx] = { ...updated[lastIdx], answered: true, answerLabel: `${bi(opt.label, lang)} (${bi(opt.note, lang)})` };
      }
      return updated;
    });

    const alertContent = t.heatHighFelt(BEARING_TEMP_STOP_C);
    await applyHeatSeverityAndProceed(opt.severity, alertContent);
  };

  const handleAnswer = (key, value) => {
    const newAnswers = { ...answers, [key]: value };
    setAnswers(newAnswers);

    setMessages((prev) => {
      const updated = [...prev];
      const lastIdx = updated.length - 1;
      if (updated[lastIdx]?.type === "choice") {
        const optLabel = value === null ? t.skipOption : bi(updated[lastIdx].question.options.find((o) => o[0] === value)?.[1], lang);
        updated[lastIdx] = { ...updated[lastIdx], answered: true, answerLabel: optLabel };
      }
      return updated;
    });

    const nextQ = nextChecklistQuestion(newAnswers);
    if (nextQ) {
      pushMessage({ role: "bot", type: "choice", question: nextQ });
    } else {
      proceedAfterChecklist(newAnswers, diffQueue);
    }
  };

  const runDiagnosis = async (finalAnswers) => {
    setStage("diagnosing");
    setLoading(true);
    pushMessage({ role: "bot", type: "text", content: t.diagAnalyzing });

    const ruleResult = evaluateCauseProbability(finalAnswers);
    const llmReview = await llmQualitativeReview(rawText, finalAnswers, ruleResult, lang);
    const finalResult = mergeDiagnosis(ruleResult, llmReview);

    pushMessage({
      role: "bot",
      type: "status",
      ok: llmReview.usedLLM,
      label: llmReview.usedLLM ? t.statusReviewOk : t.statusReviewFail,
    });

    const lateCheck = escalationCheck(rawText, finalAnswers, "MEDIUM");
    setSeverity(lateCheck.severity);
    setSignals(lateCheck.matchedSignals);

    if (lateCheck.shouldInterrupt) {
      setLoading(false);
      setStage("blocked");
      pushMessage({ role: "bot", type: "alert", content: t.diagInterruptedLate });
      logHistoryEntry({ outcome: "interrupted", severity: lateCheck.severity, reason: t.reasonLateSignal, signals: lateCheck.matchedSignals });
      return;
    }

    if (finalResult.candidates.length === 0) {
      setLoading(false);
      setStage("done");
      pushMessage({ role: "bot", type: "text", content: t.diagInconclusive });
      logHistoryEntry({ outcome: "inconclusive", reason: t.reasonInconclusive });
      return;
    }

    const plan = generateActionPlan(finalResult, rawText, finalAnswers, lang);
    setSeverity(plan.severity);
    setLoading(false);
    setStage("done");
    pushMessage({ role: "bot", type: "plan", plan });
    pushMessage({ role: "bot", type: "text", content: t.diagFollowUp });
    logHistoryEntry({
      outcome: "diagnosed",
      cause: plan.cause,
      causeLabel: plan.causeLabel,
      score: plan.score,
      severity: plan.severity,
      statement: plan.statement,
    });
  };

  const handleRestart = () => {
    setMessages([{ role: "bot", type: "text", content: t.restartGreeting }]);
    setStage("intake");
    setInputText("");
    setRawText("");
    setCategories([]);
    setAnswers({});
    setDiffQueue([]);
    setDiffAsked(false);
    setHeatReturnStage("intake");
    setSeverity("LOW");
    setSignals([]);
  };

  const isChecklistStage = stage === "checklist";
  const inputDisabled = stage !== "intake" && stage !== "done" && stage !== "blocked" && !isChecklistStage;
  const handleInputSubmit = isChecklistStage ? handleSideNote : handleSend;

  const categoryQuestionKeys = (() => {
    const seen = new Set();
    const keys = [];
    for (const cat of categories) {
      for (const q of CHECKLISTS[cat] || []) {
        if (!seen.has(q.key)) {
          seen.add(q.key);
          keys.push(q.key);
        }
      }
    }
    return keys;
  })();
  const categoryAnsweredCount = categoryQuestionKeys.filter((k) => k in answers).length;
  const diffAnsweredCount = diffQueue.filter((q) => q.key in answers).length;
  const inDiffPhase = diffQueue.length > 0 && categoryAnsweredCount >= categoryQuestionKeys.length;
  const progressLabel = inDiffPhase
    ? t.diffProgress(diffAnsweredCount, diffQueue.length)
    : categoryQuestionKeys.length > 0
    ? t.checklistProgress(categoryAnsweredCount, categoryQuestionKeys.length)
    : null;

  return (
    <div style={{ background: T.bg, borderRadius: 12, border: `1px solid ${T.border}`, width: "100%", maxWidth: 640, margin: "0 auto", fontFamily: T.sans, overflow: "hidden", boxSizing: "border-box" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap');
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes tickerIn { from { opacity: 0; transform: translateX(-4px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes softPulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
      `}</style>
      {/* Header */}
      <div style={{ borderBottom: `1px solid ${T.border}` }}>
        {/* 1단: 로고+제목 (좌) / 언어 전환 (우) — 앱 정체성과 전역 설정 */}
        <div style={{ display: "flex", flexWrap: "wrap", rowGap: 8, justifyContent: "flex-start", alignItems: "center", padding: "16px 18px 10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 8, background: "rgba(242,169,59,0.12)", border: `1px solid ${T.amber}`, flexShrink: 0 }}>
              <Droplets size={19} color={T.amber} strokeWidth={2.2} />
            </div>
            <div style={{ fontFamily: T.mono, fontSize: 19, fontWeight: 600, color: T.text, letterSpacing: 0.6, whiteSpace: "nowrap" }}>
              PUMP DIAGNOSTICS
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 2, border: `1px solid ${T.border}`, borderRadius: 6, padding: 2, flexShrink: 0, marginLeft: "auto" }}>
            <Globe size={11} color={T.textFaint} style={{ marginLeft: 4, marginRight: 2 }} />
            {["ko", "en"].map((code) => (
              <button
                key={code}
                onClick={() => handleLangChange(code)}
                style={{
                  fontFamily: T.mono,
                  fontSize: 10.5,
                  color: lang === code ? T.bg : T.textMuted,
                  background: lang === code ? T.amber : "transparent",
                  border: "none",
                  borderRadius: 4,
                  padding: "3px 7px",
                  cursor: "pointer",
                }}
              >
                {code.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* 2단: 진행 단계 (좌) / 기록 + 심각도 게이지 (우) — 현재 세션 상태
             [2차 수정] marginLeft:auto만으로는 outer row 자체가 flexWrap:"wrap"이라 여전히
             언어에 따라 오른쪽 그룹이 아예 다른 줄로 밀려날 수 있었다(실제 게시본에서 재현됨).
             이번엔 outer row를 flexWrap:"nowrap"으로 고정해 오른쪽 그룹(기록+게이지)이 항상
             같은 줄, 같은 위치(flexShrink:0)에 있도록 강제하고, 대신 왼쪽 스텝퍼 영역만
             flex:1 + minWidth:0으로 줄어들 수 있게 해서 그 안에서(자체 flexWrap:"wrap")
             영문처럼 길어진 라벨이 필요하면 내부적으로 줄바꿈되게 한다. */}
        <div style={{ display: "flex", flexWrap: "nowrap", alignItems: "center", padding: "0 18px 14px", gap: 10 }}>
          <div style={{ display: "flex", flexWrap: "wrap", rowGap: 6, alignItems: "center", gap: 8, flex: "1 1 auto", minWidth: 0 }}>
            <Stepper stage={stage} lang={lang} />
            {isChecklistStage && progressLabel && (
              <span style={{ fontFamily: T.mono, fontSize: 11, color: T.textFaint }}>· {progressLabel}</span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <button
              onClick={() => setShowHistory((v) => !v)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontFamily: T.mono,
                fontSize: 11,
                color: showHistory ? T.amber : T.textMuted,
                background: "transparent",
                border: `1px solid ${showHistory ? T.amber : T.border}`,
                borderRadius: 6,
                padding: "4px 8px",
                cursor: "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              <HistoryIcon size={12} /> {t.historyBtn}{history.length > 0 ? ` (${history.length})` : ""}
            </button>
            <SeverityGauge severity={severity} lang={lang} />
          </div>
        </div>
      </div>

      {/* Signal log ticker */}
      {!showHistory && signals.length > 0 && (
        <div style={{ padding: "6px 18px", borderBottom: `1px solid ${T.border}`, fontFamily: T.mono, fontSize: 11, color: T.amber, background: T.panelAlt, animation: "tickerIn 0.25s ease-out" }}>
          SIGNAL: {signals.map((s) => bi(SIGNAL_LABEL[s], lang) || s).join(" · ")}
        </div>
      )}

      {/* Chat log / History panel */}
      <div ref={scrollRef} style={{ height: "min(60vh, 560px)", minHeight: 320, overflowY: "auto", padding: showHistory ? 0 : 18 }}>
        {showHistory ? (
          <HistoryPanel records={history} onClose={() => setShowHistory(false)} onClear={handleClearHistory} lang={lang} />
        ) : (
        messages.map((m, i) => {
          if (m.type === "text") return <Bubble key={i} role={m.role}>{m.content}</Bubble>;
          if (m.type === "status") return <StatusTag key={i} ok={m.ok} label={m.label} />;
          if (m.type === "category_confirm") {
            if (m.answered) return <Bubble key={i} role="user">{m.answerLabel}</Bubble>;
            return <CategoryConfirmQuestion key={i} onAnswer={(v) => handleCategoryConfirm(v, m.cats)} lang={lang} />;
          }
          if (m.type === "category_picker") {
            if (m.answered) return <Bubble key={i} role="user">{m.answerLabel}</Bubble>;
            return <CategoryPicker key={i} onConfirm={handleCategoryPickerConfirm} lang={lang} />;
          }
          if (m.type === "alert") return <AlertBubble key={i} text={m.content} />;
          if (m.type === "plan") return <ActionPlanCard key={i} plan={m.plan} lang={lang} />;
          if (m.type === "choice") {
            if (m.answered) {
              return (
                <div key={i}>
                  <Bubble role="bot">{bi(m.question.text, lang)}</Bubble>
                  <Bubble role="user">{m.answerLabel}</Bubble>
                </div>
              );
            }
            return <ChoiceQuestion key={i} question={m.question} onAnswer={handleAnswer} lang={lang} />;
          }
          if (m.type === "heat_temp") {
            if (m.answered) return <Bubble key={i} role="user">{m.answerLabel}</Bubble>;
            return <HeatTempQuestion key={i} onSubmitTemp={handleHeatTempSubmit} onFallback={handleHeatTempFallback} lang={lang} />;
          }
          if (m.type === "heat_clarify") {
            if (m.answered) return <Bubble key={i} role="user">{m.answerLabel}</Bubble>;
            return <HeatClarifyQuestion key={i} onAnswer={handleHeatClarify} lang={lang} />;
          }
          return null;
        })
        )}
        {!showHistory && loading && (
          <div style={{ fontFamily: T.mono, fontSize: 12, color: T.textMuted, padding: "4px 0", animation: "softPulse 1.4s ease-in-out infinite" }}>{t.processing}</div>
        )}
      </div>

      {/* Input area */}
      <div style={{ borderTop: `1px solid ${T.border}`, padding: 14 }}>
        {stage === "done" || stage === "blocked" ? (
          <button
            onClick={handleRestart}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              fontFamily: T.mono,
              fontSize: 13,
              color: T.text,
              background: T.panelAlt,
              border: `1px solid ${T.borderStrong}`,
              borderRadius: 8,
              padding: "10px 0",
              cursor: "pointer",
            }}
          >
            <RotateCcw size={14} /> {t.restartButton}
          </button>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              value={inputText}
              disabled={inputDisabled}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleInputSubmit()}
              placeholder={
                isChecklistStage
                  ? t.placeholderChecklist
                  : inputDisabled
                  ? t.placeholderDisabled
                  : t.placeholderIntake
              }
              style={{
                flex: 1,
                background: T.panel,
                border: `1px solid ${T.border}`,
                borderRadius: 8,
                padding: "10px 12px",
                color: T.text,
                fontFamily: T.sans,
                fontSize: 14,
                outline: "none",
              }}
            />
            <button
              onClick={handleInputSubmit}
              disabled={inputDisabled || !inputText.trim()}
              style={{
                background: T.amber,
                border: "none",
                borderRadius: 8,
                width: 42,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: inputDisabled ? "default" : "pointer",
                opacity: inputDisabled || !inputText.trim() ? 0.4 : 1,
              }}
            >
              <Send size={16} color={T.bg} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
