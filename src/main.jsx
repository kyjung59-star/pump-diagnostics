import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

// window.storage는 Claude 아티팩트 전용 API라, 이 정적 사이트(일반 브라우저)에는 없다.
// 같은 인터페이스(get/set/delete/list)를 localStorage로 구현해서 진단 기록 기능이
// 배포 환경에서도 그대로 동작하도록 한다.
if (!window.storage) {
  const PREFIX = "pump-diag:";
  window.storage = {
    async get(key) {
      const raw = localStorage.getItem(PREFIX + key);
      if (raw === null) throw new Error("key not found");
      return { key, value: raw, shared: false };
    },
    async set(key, value) {
      localStorage.setItem(PREFIX + key, value);
      return { key, value, shared: false };
    },
    async delete(key) {
      localStorage.removeItem(PREFIX + key);
      return { key, deleted: true, shared: false };
    },
    async list(prefix = "") {
      const keys = Object.keys(localStorage)
        .filter((k) => k.startsWith(PREFIX + prefix))
        .map((k) => k.slice(PREFIX.length));
      return { keys, shared: false };
    },
  };
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
