/*
  亞運菁英運動員卡片展示 — 資料由下而上漸入（首頁、運動員頁共用）
  .reveal 元素捲到畫面時加上 .is-visible；樣式見 css/page.css。
  需在 <head> 以行內 script 標記 html.js-reveal（減少動態效果時不加，內容直接顯示）。
*/
(function () {
  "use strict";

  function show(el) { el.classList.add("is-visible"); }

  window.Reveal = {
    // 開始觀察頁面上所有 .reveal；已在畫面內的會立即播放
    start: function () {
      var els = Array.prototype.slice.call(document.querySelectorAll(".reveal:not(.is-visible)"));
      if (!("IntersectionObserver" in window)) {
        els.forEach(show);
        return;
      }
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            show(e.target);
            io.unobserve(e.target);
          }
        });
      }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
      els.forEach(function (el) { io.observe(el); });
    }
  };
})();
