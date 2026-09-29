/*
  亞運菁英運動員卡片展示 — 轉場換頁特效（Figma「轉場換頁特效」）
  裁切框（相對視窗的 inset）從全畫面縮到中心 → 再從中心展開到下一頁，
  四條虛線跟著框邊移動並延伸到畫面邊界；收緊時在十字虛線左上方（距虛線 32px）顯示運動員頁導覽列的 logo，展開時淡出。

  各頁共用：
  - PageTransition.swap / shrink / grow：同頁內切換（搜尋彈窗）
  - PageTransition.navigate：收合目前頁面後換頁，下一頁載入時自動展開
  - PageTransition.heroCardGeometry：運動員頁主視覺卡片的位置（轉場時卡片飄移的落點）
  - PageTransition.flyCard：建立飄移用的卡片分身
  需搭配 css/transition.css；換頁進場需在 <head> 以行內 script 標記 html.pt-entering。
  跨頁資訊以網址參數傳遞（pt=1、card=圖片路徑）：file:// 下 sessionStorage 在部分瀏覽器不共用。
*/
(function () {
  "use strict";

  var root = document.documentElement;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var SHRINK_MS = 450;
  var HOLD_MS = 120;
  var GROW_MS = 450;
  var LOGO_FADE_MS = 150; // logo 在收緊前 150ms 開始淡入，收緊時剛好完全顯示
  var LOGO_GAP = 32;      // logo 與十字虛線的間距
  var params = new URLSearchParams(location.search);

  var overlay = document.createElement("div");
  overlay.className = "page-transition";
  overlay.setAttribute("aria-hidden", "true");
  overlay.hidden = true;
  overlay.innerHTML =
    '<div class="page-transition__line page-transition__line--top"></div>' +
    '<div class="page-transition__line page-transition__line--bottom"></div>' +
    '<div class="page-transition__line page-transition__line--left"></div>' +
    '<div class="page-transition__line page-transition__line--right"></div>' +
    // 同運動員頁導覽列左上方的 logo
    '<div class="page-transition__logo">' +
      '<img class="page-transition__logo-icon" src="assets/athlete/nav-tisi-icon.svg" alt="" width="83" height="38" />' +
      '<div class="page-transition__logo-site">' +
        '<span class="page-transition__logo-zh"><img src="assets/ctoc-emblem.png" alt="" width="23" height="23" />亞運菁英運動員卡</span>' +
        '<span class="page-transition__logo-en">ASIAN GAMES ELITE ATHLETE CARD</span>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);
  var logo = overlay.querySelector(".page-transition__logo");

  var busy = false;

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function viewport() {
    return { w: root.clientWidth, h: root.clientHeight };
  }

  var FULL = { t: 0, r: 0, b: 0, l: 0 };

  // 中心的最小框（Figma 收合狀態約 14×25）
  function centerBox() {
    var v = viewport();
    return { t: (v.h - 25) / 2, r: (v.w - 14) / 2, b: (v.h - 25) / 2, l: (v.w - 14) / 2 };
  }

  function setLines(box) {
    overlay.style.setProperty("--t", box.t + "px");
    overlay.style.setProperty("--r", box.r + "px");
    overlay.style.setProperty("--b", box.b + "px");
    overlay.style.setProperty("--l", box.l + "px");
  }

  // 依視窗座標裁切任一元素（元素可比視窗大，例如整個頁面容器）
  function clip(el, box) {
    var v = viewport();
    var r = el.getBoundingClientRect();
    el.style.clipPath = "inset(" +
      (box.t - r.top) + "px " +
      (r.right - v.w + box.r) + "px " +
      (r.bottom - v.h + box.b) + "px " +
      (box.l - r.left) + "px)";
  }

  // logo 右下角對齊十字虛線（收緊框的左、上兩條線）左上方 32px；視窗太窄時等比縮小
  function placeLogo() {
    var box = centerBox();
    var w = logo.offsetWidth;
    var h = logo.offsetHeight;
    var scale = Math.min(1, (box.l - LOGO_GAP - 12) / w);
    logo.style.transform = "scale(" + scale + ")";
    logo.style.left = (box.l - LOGO_GAP - w * scale) + "px";
    logo.style.top = (box.t - LOGO_GAP - h * scale) + "px";
  }

  function showLogo() {
    placeLogo();
    overlay.classList.add("has-logo");
  }

  function hideLogo() {
    overlay.classList.remove("has-logo");
  }

  // 收合動畫結束前開始淡入
  function showLogoAfterShrink() {
    return wait(SHRINK_MS - LOGO_FADE_MS).then(function () {
      if (busy) showLogo();
    });
  }

  function tween(el, from, to, ms) {
    return new Promise(function (resolve) {
      var start = performance.now();
      function frame(now) {
        var p = Math.min((now - start) / ms, 1);
        var e = easeInOutCubic(p);
        var box = {};
        for (var k in from) box[k] = from[k] + (to[k] - from[k]) * e;
        clip(el, box);
        setLines(box);
        if (p < 1) requestAnimationFrame(frame); else resolve();
      }
      requestAnimationFrame(frame);
    });
  }

  function wait(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function begin(box) {
    busy = true;
    root.classList.add("is-transitioning");
    setLines(box || FULL);
    overlay.hidden = false;
  }

  function end(els) {
    els.forEach(function (el) { el.style.clipPath = ""; });
    hideLogo();
    overlay.hidden = true;
    root.classList.remove("is-transitioning");
    busy = false;
  }

  var PT = {
    SHRINK_MS: SHRINK_MS,
    HOLD_MS: HOLD_MS,
    GROW_MS: GROW_MS,

    isBusy: function () { return busy; },
    reducedMotion: function () { return reduceMotion.matches; },

    /*
      同頁切換：outEl 縮到中心 → mid() → inEl 從中心展開。
      mid 可回傳 Promise；stayClipped 內的元素在展開前先保持收合。
    */
    swap: function (outEl, inEl, mid, stayClipped) {
      begin();
      (stayClipped || []).forEach(function (el) { clip(el, centerBox()); });
      showLogoAfterShrink();
      return tween(outEl, FULL, centerBox(), SHRINK_MS)
        .then(function () { return mid && mid(); })
        .then(function () {
          clip(inEl, centerBox());
          return wait(HOLD_MS);
        })
        .then(function () {
          hideLogo();
          return tween(inEl, centerBox(), FULL, GROW_MS);
        })
        .then(function () { end([outEl, inEl].concat(stayClipped || [])); });
    },

    /*
      換頁：目前頁面縮到中心後前往 url，下一頁載入時由 enter() 展開。
      alongside：與收合同時進行的動畫（Promise），例如卡片飄移。
      stayClipped：一開始就保持收合的元素（例如從選單換頁時，選單底下的頁面）。
    */
    navigate: function (url, siteEl, alongside, stayClipped) {
      if (busy) return;
      url += (url.indexOf("?") === -1 ? "?" : "&") + "pt=1";
      if (reduceMotion.matches) {
        location.href = url;
        return;
      }
      begin();
      (stayClipped || []).forEach(function (el) { clip(el, centerBox()); });
      showLogoAfterShrink();
      Promise.all([
        tween(siteEl, FULL, centerBox(), SHRINK_MS).then(function () { return wait(HOLD_MS); }),
        alongside || Promise.resolve()
      ]).then(function () {
        location.href = url;
      });
    },

    // 進場：若由 navigate() 換頁而來，頁面從中心展開；回傳展開完成的 Promise
    enter: function (siteEl) {
      var entering = root.classList.contains("pt-entering");
      // 清掉網址上的轉場參數，重新整理時不再重播
      if (params.has("pt") || params.has("card")) {
        history.replaceState(null, "", location.pathname + location.hash);
      }
      if (!entering) return Promise.resolve(false);
      if (reduceMotion.matches) {
        root.classList.remove("pt-entering");
        return Promise.resolve(true);
      }
      begin(centerBox());
      clip(siteEl, centerBox());
      showLogo(); // 接續上一頁收緊時的 logo（剛顯示的 overlay 不會播放淡入）
      root.classList.remove("pt-entering");
      return wait(HOLD_MS)
        .then(function () {
          hideLogo();
          return tween(siteEl, centerBox(), FULL, GROW_MS);
        })
        .then(function () {
          end([siteEl]);
          return true;
        });
    },

    /*
      運動員頁主視覺卡片的幾何（視窗座標，頁面捲動為 0 時）。
      電腦版依 Figma（1440 寬：外框左 837.93、上 133，卡片 299.72 寬、旋轉 8.3°），
      卡片貼齊內容區右側；手機版依 Figma 手機稿目測。
    */
    heroCardGeometry: function () {
      var vw = viewport().w;
      if (vw < 768) {
        return { cx: vw * 0.44, cy: 410, w: 220, rot: 8.3 };
      }
      var pad = Math.max(40, (vw - 1200) / 2);
      var contentRight = vw - pad;
      var scale = Math.min(1, Math.max(0.72, vw / 1440));
      var w = 299.72 * scale;
      var bboxW = 357.128 * scale;
      return {
        cx: contentRight - 125 * scale - bboxW / 2,
        cy: 133 + 229.23 * scale,
        w: w,
        rot: 8.3
      };
    },

    // 頁面內 a[data-transition] 連結：收合目前頁面後換頁（按住 Ctrl 等開新分頁時照常）
    bindLinks: function (siteEl) {
      document.querySelectorAll("a[data-transition]").forEach(function (a) {
        a.addEventListener("click", function (e) {
          if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
          e.preventDefault();
          PT.navigate(a.getAttribute("href"), siteEl);
        });
      });
    },

    // 從首頁飄過來的卡片圖（網址參數 card，需在 enter() 之前讀取）
    incomingCard: params.get("pt") === "1" ? params.get("card") : null,

    /*
      飄移用的卡片分身（固定定位，蓋在轉場虛線之上）。
      rect：{ cx, cy, w, rot }；回傳 { el, moveTo(rect, ms), fadeOut(ms), remove() }
    */
    flyCard: function (src, rect) {
      var el = document.createElement("div");
      el.className = "fly-card";
      el.innerHTML = '<img alt="" />';
      el.firstChild.src = src;
      document.body.appendChild(el);

      function place(r) {
        var h = r.w / 0.718;
        el.style.width = r.w + "px";
        el.style.height = h + "px";
        el.style.left = (r.cx - r.w / 2) + "px";
        el.style.top = (r.cy - h / 2) + "px";
        el.style.transform = "rotate(" + (r.rot || 0) + "deg)";
      }
      place(rect);

      var current = rect;
      return {
        el: el,
        moveTo: function (to, ms) {
          var from = current;
          current = to;
          return new Promise(function (resolve) {
            var start = performance.now();
            function frame(now) {
              var p = Math.min((now - start) / ms, 1);
              var e = easeInOutCubic(p);
              place({
                cx: from.cx + (to.cx - from.cx) * e,
                cy: from.cy + (to.cy - from.cy) * e,
                w: from.w + (to.w - from.w) * e,
                rot: (from.rot || 0) + ((to.rot || 0) - (from.rot || 0)) * e
              });
              if (p < 1) requestAnimationFrame(frame); else resolve();
            }
            requestAnimationFrame(frame);
          });
        },
        fadeOut: function (ms) {
          el.style.transition = "opacity " + ms + "ms ease";
          el.style.opacity = "0";
          return wait(ms).then(function () { el.remove(); });
        },
        remove: function () { el.remove(); }
      };
    }
  };

  // 按「上一頁」由瀏覽器快取還原時，頁面可能停在收合狀態：直接重新載入
  window.addEventListener("pageshow", function (e) {
    if (e.persisted && root.classList.contains("is-transitioning")) location.reload();
  });

  window.PageTransition = PT;
})();
