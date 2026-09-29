/*
  亞運菁英運動員卡片展示 — 運動員專屬頁面互動
  - 主視覺放可互動的 V 特效卡（一律為林郁婷，資料僅此一位）
  - 由首頁轉場進入：頁面從中心展開，首頁飄過來的卡片停在主視覺卡片位置，再淡出換成林郁婷的卡
  - 資料由下而上漸入：主視覺於進場後播放，下方各區塊捲到畫面時播放
  - 「關於運動員卡」連結：轉場回首頁
*/
(function () {
  "use strict";

  var PT = window.PageTransition;
  var gallery = window.CardGallery;
  var root = document.documentElement;
  var site = document.getElementById("site");
  var slot = document.getElementById("hero-card");

  /* ---------------- 主視覺球員卡 ---------------- */

  gallery.mount(slot, gallery.findPlayer("林郁婷"), "lightning");

  // 與首頁轉場的落點共用同一組幾何，確保卡片無縫接上
  function placeCard() {
    var g = PT.heroCardGeometry();
    var h = g.w / 0.718;
    slot.style.width = g.w + "px";
    slot.style.left = (g.cx - g.w / 2) + "px";
    slot.style.top = (g.cy - h / 2) + "px";
  }
  placeCard();
  window.addEventListener("resize", placeCard);

  /* ---------------- 資料由下而上漸入 ---------------- */

  var reveals = Array.prototype.slice.call(document.querySelectorAll(".reveal"));
  var heroReveals = reveals.filter(function (el) { return el.closest(".a-hero"); });
  var restReveals = reveals.filter(function (el) { return !el.closest(".a-hero"); });

  function show(el) { el.classList.add("is-visible"); }

  function startReveals() {
    heroReveals.forEach(show);
    if (!("IntersectionObserver" in window)) {
      restReveals.forEach(show);
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
    restReveals.forEach(function (el) { io.observe(el); });
  }

  /* ---------------- 進場 ---------------- */

  // 從首頁飄過來的卡片：先停在主視覺卡片位置，頁面展開後淡出，露出林郁婷的卡
  var fly = null;
  if (PT.incomingCard && root.classList.contains("pt-entering") && !PT.reducedMotion()) {
    fly = PT.flyCard(PT.incomingCard, PT.heroCardGeometry());
  }

  PT.enter(site).then(function () {
    if (fly) fly.fadeOut(450);
    startReveals();
  });

  /* ---------------- 連結轉場（僅「關於運動員卡」） ---------------- */

  document.querySelectorAll("a[data-transition]").forEach(function (a) {
    a.addEventListener("click", function (e) {
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      PT.navigate(a.getAttribute("href"), site);
    });
  });
})();
