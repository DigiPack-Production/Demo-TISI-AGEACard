/*
  亞運菁英運動員卡片展示 — 「查看資料」按鈕（首頁、關於運動員卡頁共用）
  卡片放大時顯示於畫面下緣；點擊後頁面收合，放大中的卡片飄到運動員頁主視覺卡片的位置再換頁。
  需先載入 js/cards.js、js/transition.js，頁面需有 #view-profile 與 #site。
*/
(function () {
  "use strict";

  var gallery = window.CardGallery;
  var PT = window.PageTransition;
  var site = document.getElementById("site");
  var viewBtn = document.getElementById("view-profile");
  viewBtn.setAttribute("data-keeps-card", "");

  document.addEventListener("cardactivechange", function (e) {
    viewBtn.hidden = !e.detail.card;
  });

  // 滑鼠點按鈕時不讓卡片失焦（失焦會收回卡片）
  viewBtn.addEventListener("mousedown", function (e) { e.preventDefault(); });

  // 鍵盤 Tab 離開按鈕、且不是回到卡片時，收回卡片
  viewBtn.addEventListener("blur", function (e) {
    var card = gallery.getActive();
    if (card && e.relatedTarget !== card.rotator) gallery.deactivateActive();
  });

  // 轉場：頁面收合，放大中的卡片不被覆蓋，飄到運動員頁主視覺卡片的位置後換頁
  viewBtn.addEventListener("click", function () {
    var card = gallery.getActive();
    if (!card || PT.isBusy()) return;
    var url = "athlete.html?card=" + encodeURIComponent(card.data.img);

    if (PT.reducedMotion()) {
      PT.navigate(url, site);
      return;
    }

    var r = card.rotator.getBoundingClientRect();
    var fly = PT.flyCard(card.frontImg.src, {
      cx: r.left + r.width / 2,
      cy: r.top + r.height / 2,
      w: r.width,
      rot: 0
    });
    card.el.style.visibility = "hidden";
    viewBtn.hidden = true;
    PT.navigate(url, site, fly.moveTo(PT.heroCardGeometry(), PT.SHRINK_MS + PT.HOLD_MS));
  });
})();
