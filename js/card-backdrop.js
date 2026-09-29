/*
  亞運菁英運動員卡片展示 — 卡片放大時的背景遮罩（首頁、關於運動員卡頁共用）
  卡片放大時背景變暗 40% 並加毛玻璃模糊；點遮罩收回卡片（焦點離開卡片，同原本點其他地方）。
  卡片區為 3D 空間（preserve-3d），排序依 Z 軸而非 z-index：
  - 遮罩放在同一個 3D 空間內，位在未放大的卡片（z = 150px）之前（500px）；
  - 放大的卡片加上 .is-lifted 往前推，翻轉時才不會穿過遮罩；縮回原尺寸後才移除。
  fixed 在 preserve-3d 內會以卡片區為定位基準，因此由 JS 以位移抵銷，讓遮罩對齊視窗。
  需先載入 js/cards.js，頁面需有 #card-grid（其內容會被重新產生，遮罩放在它的外層）。
*/
(function () {
  "use strict";

  var el = document.createElement("div");
  el.className = "card-backdrop";
  el.setAttribute("aria-hidden", "true");
  document.getElementById("card-grid").parentElement.appendChild(el);

  function place() {
    el.style.left = "0px";
    el.style.top = "0px";
    var r = el.getBoundingClientRect();
    el.style.left = -r.left + "px";
    el.style.top = -r.top + "px";
    el.style.width = document.documentElement.clientWidth + "px";
    el.style.height = window.innerHeight + "px";
  }

  var ticking = false;
  function requestPlace() {
    if (ticking || !el.classList.contains("is-shown")) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      place();
    });
  }

  // 收回的卡片縮回原尺寸（--card-scale ≈ 1）後才取消往前推
  function dropWhenSettled(cardEl) {
    (function check() {
      if (cardEl === lifted) return; // 又被放大了
      if (parseFloat(cardEl.style.getPropertyValue("--card-scale")) > 1.001) {
        requestAnimationFrame(check);
      } else {
        cardEl.classList.remove("is-lifted");
      }
    })();
  }

  var lifted = null;
  document.addEventListener("cardactivechange", function (e) {
    var card = e.detail.card;
    var prev = lifted;
    lifted = card ? card.el : null;
    if (prev && prev !== lifted) dropWhenSettled(prev);
    if (card) {
      card.el.classList.add("is-lifted");
      place();
    }
    el.classList.toggle("is-shown", !!card);
  });

  window.addEventListener("scroll", requestPlace, { passive: true });
  window.addEventListener("resize", requestPlace);
})();
