/*
  亞運菁英運動員卡片展示 — 運動員專屬頁面互動
  - 主視覺放可互動的 V 特效卡（一律為林郁婷，資料僅此一位）
  - 由首頁或關於運動員卡頁轉場進入：頁面從中心展開，飄過來的卡片停在主視覺卡片位置，再淡出換成林郁婷的卡
  - 資料由下而上漸入（js/reveal.js）：主視覺於進場後播放，下方各區塊捲到畫面時播放
  - logo 連結轉場回首頁、「關於運動員卡」連結轉場到關於運動員卡頁
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

  /* ---------------- 進場 ---------------- */

  // 從前一頁飄過來的卡片：先停在主視覺卡片位置，頁面展開後淡出，露出林郁婷的卡
  var fly = null;
  if (PT.incomingCard && root.classList.contains("pt-entering") && !PT.reducedMotion()) {
    fly = PT.flyCard(PT.incomingCard, PT.heroCardGeometry());
  }

  PT.enter(site).then(function () {
    if (fly) fly.fadeOut(450);
    window.Reveal.start();
  });

  /* ---------------- 連結轉場（logo 回首頁、「關於運動員卡」） ---------------- */

  PT.bindLinks(site);
})();
