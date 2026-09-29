/*
  亞運菁英運動員卡片展示 — 觸控長按卡片看特效（首頁、關於運動員卡頁共用）
  手指按住卡片不動約 0.3 秒後鎖住頁面捲動，移動手指即可看卡片特效；按下後很快滑動則照常捲動頁面。
  放開後卡片回正，且不會觸發點擊放大。放大中的卡片本來就不會捲動頁面（css/cards/base.css），不在此處理。
  需先載入 js/cards.js，頁面需有 #card-grid。
*/
(function () {
  "use strict";

  var HOLD_MS = 300;
  var SLOP = 10; // 長按成立前手指可移動的距離（px），超過視為捲動

  var grid = document.getElementById("card-grid");
  var hold = null; // { rotator, x, y, timer, locked }
  var suppressClickUntil = 0;

  function cancel() {
    if (!hold) return;
    clearTimeout(hold.timer);
    hold = null;
  }

  grid.addEventListener("touchstart", function (e) {
    cancel();
    var rotator = e.target.closest(".card__rotator");
    if (!rotator || e.touches.length !== 1 || rotator.closest(".card.active")) return;
    var t = e.touches[0];
    var h = { rotator: rotator, x: t.clientX, y: t.clientY, locked: false };
    h.timer = setTimeout(function () { h.locked = true; }, HOLD_MS);
    hold = h;
  }, { passive: true });

  // 需為非 passive 才能在長按成立後阻止捲動
  grid.addEventListener("touchmove", function (e) {
    if (!hold) return;
    if (hold.locked) {
      e.preventDefault();
      return;
    }
    var t = e.touches[0];
    if (Math.abs(t.clientX - hold.x) > SLOP || Math.abs(t.clientY - hold.y) > SLOP) cancel();
  }, { passive: false });

  function release() {
    if (!hold) return;
    if (hold.locked) {
      suppressClickUntil = Date.now() + 500;
      // 同滑鼠移出卡片：特效回正（js/cards.js 的 interactEnd）
      hold.rotator.dispatchEvent(new MouseEvent("mouseout"));
    }
    cancel();
  }
  grid.addEventListener("touchend", release);
  grid.addEventListener("touchcancel", release);

  // 長按放開後瀏覽器仍可能送出 click，攔下以免卡片放大
  grid.addEventListener("click", function (e) {
    if (Date.now() < suppressClickUntil) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  // 長按時不跳出圖片選單
  grid.addEventListener("contextmenu", function (e) {
    if (hold) e.preventDefault();
  });
})();
