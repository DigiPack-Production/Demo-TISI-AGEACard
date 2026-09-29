/*
  亞運菁英運動員卡片展示 — 首頁互動
  - 設定 --s（1920 設計稿等比縮放）、--ms（手機版 375 稿縮放）與 --os（抽卡過場 1100 × 1940 稿縮放）
  - 主選單：轉場開關（同搜尋彈窗），僅「關於運動員卡」可點
  - 抽卡過場：「點我抽卡」開啟卡包影片，拖曳剪刀剪開後播完，卡片飄到運動員頁
  - 主視覺進場動畫：選手照與卡包依畫面位置（上→下、左→右）依序載入、淡入；
    其餘區塊捲到畫面時由下而上漸入（js/reveal.js）
  - TAIWAN 字樣隨捲動由上往下拉開（參考 blockstudio.tw），拉滿後王齊麟卡淡入，
    隨捲動邊轉正邊翻轉一圈墜落到 THE CHAMPIONS 疊卡中同一張卡的位置後貼合
  球員卡格線、「查看資料」由 js/cards.js、js/view-profile.js 處理。
*/
(function () {
  "use strict";

  var PT = window.PageTransition;
  var root = document.documentElement;
  var site = document.getElementById("site");

  /* ---------------- 等比縮放 ---------------- */

  function updateScale() {
    var w = root.clientWidth;
    root.style.setProperty("--s", String(Math.min(1, w / 1920)));
    root.style.setProperty("--ms", String(w / 375));
    root.style.setProperty("--os", String(Math.min(w / 1100, window.innerHeight / 1940)));
  }
  updateScale();
  window.addEventListener("resize", updateScale);

  /* ---------------- 主選單 ---------------- */

  var menu = document.getElementById("h-menu");
  var menuBtn = document.getElementById("menu-btn");
  var menuClose = document.getElementById("menu-close");
  var menuAbout = document.getElementById("menu-about");
  var lockedScrollY = 0;

  // 鎖定頁面捲動（同 js/page.js 搜尋彈窗）
  function lockScroll() {
    lockedScrollY = window.scrollY;
    var scrollbar = window.innerWidth - root.clientWidth;
    document.body.style.top = -lockedScrollY + "px";
    document.body.style.paddingRight = scrollbar ? scrollbar + "px" : "";
    document.body.classList.add("is-modal-open");
  }

  function unlockScroll() {
    document.body.classList.remove("is-modal-open");
    document.body.style.top = "";
    document.body.style.paddingRight = "";
    window.scrollTo(0, lockedScrollY);
  }

  function openMenu() {
    if (PT.isBusy() || !menu.hidden) return;
    lockScroll();
    if (PT.reducedMotion()) {
      menu.hidden = false;
      menuClose.focus({ preventScroll: true });
      return;
    }
    PT.swap(site, menu, function () { menu.hidden = false; })
      .then(function () { menuClose.focus({ preventScroll: true }); });
  }

  function closeMenu() {
    if (PT.isBusy() || menu.hidden) return;
    if (PT.reducedMotion()) {
      menu.hidden = true;
      unlockScroll();
      menuBtn.focus({ preventScroll: true });
      return;
    }
    PT.swap(menu, site, function () {
      menu.hidden = true;
      unlockScroll();
    }, [site]).then(function () { menuBtn.focus({ preventScroll: true }); });
  }

  menuBtn.addEventListener("click", openMenu);
  menuClose.addEventListener("click", closeMenu);

  // 選單內的連結：選單收合後換頁；底下的首頁同時保持收合，框外才不會露出首頁
  menuAbout.addEventListener("click", function (e) {
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    PT.navigate(menuAbout.getAttribute("href"), menu, null, [site]);
  });

  menu.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      closeMenu();
      return;
    }
    // 焦點鎖在選單內
    if (e.key === "Tab") {
      var first = menuClose;
      var last = menuAbout;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  /* ---------------- 抽卡過場（Figma 動畫 368:2441） ---------------- */
  /*
    「點我抽卡」→ 轉場開啟 → 影片播到卡包停住（第 75 格）→ 出現剪刀裁線提示 →
    按住剪刀沿虛線由左往右拖曳＝拖曳影片進度（可來回），放手彈回；拉到底後播完 →
    卡片分身疊在影片卡片上，飄到運動員頁（同「查看資料」）。
  */

  var drawEl = document.getElementById("h-open");
  var drawBtn = document.getElementById("draw-btn");
  var drawClose = document.getElementById("h-open-close");
  var video = document.getElementById("h-open-video");
  var scissors = document.getElementById("h-open-scissors");
  var cutEl = document.getElementById("h-open-cut");

  // 以下座標為影片像素（1080 × 1920），影片 24fps
  var FPS = 24;
  var PAUSE_FRAME = 75;  // 卡包停住、撕開前
  var CUT_FROM = 76;     // 剪刀中心起點 x
  var CUT_TO = 963;      // 虛線終點 x：拉到底即剪開
  var CARD_IMG = "images/lin-yu-ting.png";
  var CARD_CX = 539.5;   // 影片最後一格卡片（x 227–852、y 496–1429）的中心
  var CARD_CY = 962.5;
  var CARD_W = 648;      // 卡片分身寬（分身比例 0.718，影片中約 0.67，取寬高誤差的折衷）

  // 撕開的光點在第 77～79 格由左往右掃過（x ≈ 108 + 352 × (格 − 77)），讓光點跟著剪刀
  function frameAt(x) {
    return Math.max(PAUSE_FRAME, Math.floor(77 + (x - 108) / 352));
  }

  var drawState = "closed"; // closed | intro | cutting | playing | leaving
  var session = 0;          // 關閉後讓尚未執行的回呼失效
  var cutX = CUT_FROM;
  var shownFrame = -1;
  var animRaf = 0;
  var drag = null;

  function showFrame(f) {
    if (f === shownFrame) return;
    shownFrame = f;
    video.currentTime = (f + 0.5) / FPS; // 對準格子中間，避免落在前一格
  }

  function setCut(x) {
    cutX = Math.min(CUT_TO, Math.max(CUT_FROM, x));
    cutEl.style.setProperty("--cut", (cutX - CUT_FROM) + "px");
    showFrame(frameAt(cutX));
  }

  // 剪刀由目前位置移到 to（彈回或鍵盤操作）
  function animateCut(to, ms, done) {
    cancelAnimationFrame(animRaf);
    var from = cutX;
    var start = performance.now();
    function step(now) {
      var p = Math.min((now - start) / ms, 1);
      setCut(from + (to - from) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) animRaf = requestAnimationFrame(step);
      else if (done) done();
    }
    animRaf = requestAnimationFrame(step);
  }

  function resetDraw() {
    session++;
    drawState = "closed";
    cancelAnimationFrame(animRaf);
    drag = null;
    video.pause();
    video.style.visibility = "";
    drawEl.classList.remove("is-loading", "is-cutting");
    cutX = CUT_FROM;
    shownFrame = -1;
    cutEl.style.setProperty("--cut", "0px");
  }

  // 影片可播放後從頭播，播到停住的格子暫停
  function playIntro() {
    var s = session;
    drawState = "intro";
    function begin() {
      if (s !== session) return;
      drawEl.classList.remove("is-loading");
      video.currentTime = 0;
      video.play();
      (function watch() {
        if (s !== session) return;
        if (video.currentTime >= PAUSE_FRAME / FPS) {
          video.pause();
          showFrame(PAUSE_FRAME);
          drawState = "cutting";
          drawEl.classList.add("is-cutting");
        } else {
          animRaf = requestAnimationFrame(watch);
        }
      })();
    }
    if (video.readyState >= 4) {
      begin();
    } else {
      drawEl.classList.add("is-loading");
      video.addEventListener("canplaythrough", begin, { once: true });
    }
  }

  function finishCut() {
    drag = null;
    drawState = "playing";
    drawEl.classList.remove("is-cutting");
    video.play();
  }

  function openDraw() {
    if (PT.isBusy() || !drawEl.hidden) return;
    resetDraw();
    if (!video.getAttribute("src")) {
      // 透明背景 webm（VP9 alpha）；Safari（含 iOS 所有瀏覽器）不支援，改用黑底 mp4 + mix-blend-mode: screen
      var alpha = !/Apple/.test(navigator.vendor) && video.canPlayType('video/webm; codecs="vp9"') !== "";
      drawEl.classList.toggle("is-screen", !alpha);
      video.preload = "auto";
      video.src = alpha ? "assets/draw/lin-yu-ting-pack.webm" : "assets/draw/lin-yu-ting-pack.mp4";
      new Image().src = CARD_IMG; // 預先載入飄移用的卡片圖
    }
    lockScroll();
    if (PT.reducedMotion()) {
      drawEl.hidden = false;
      drawClose.focus({ preventScroll: true });
      playIntro();
      return;
    }
    PT.swap(site, drawEl, function () { drawEl.hidden = false; })
      .then(function () {
        drawClose.focus({ preventScroll: true });
        playIntro();
      });
  }

  function closeDraw() {
    if (PT.isBusy() || drawEl.hidden || drawState === "leaving") return;
    resetDraw();
    if (PT.reducedMotion()) {
      drawEl.hidden = true;
      unlockScroll();
      drawBtn.focus({ preventScroll: true });
      return;
    }
    PT.swap(drawEl, site, function () {
      drawEl.hidden = true;
      unlockScroll();
    }, [site]).then(function () { drawBtn.focus({ preventScroll: true }); });
  }

  // 播完：卡片分身疊在影片卡片位置，飄到運動員頁主視覺卡片（同 js/view-profile.js）
  video.addEventListener("ended", function () {
    if (drawState !== "playing") return;
    drawState = "leaving";
    var url = "athlete.html?card=" + encodeURIComponent(CARD_IMG);
    if (PT.reducedMotion()) {
      PT.navigate(url, drawEl);
      return;
    }
    var r = video.getBoundingClientRect();
    var k = r.width / 1080;
    var fly = PT.flyCard(CARD_IMG, {
      cx: r.left + CARD_CX * k,
      cy: r.top + CARD_CY * k,
      w: CARD_W * k,
      rot: 0
    });
    video.style.visibility = "hidden";
    PT.navigate(url, drawEl, fly.moveTo(PT.heroCardGeometry(), PT.SHRINK_MS + PT.HOLD_MS), [site]);
  });

  // 拖曳剪刀：放手時未拉到底就彈回
  scissors.addEventListener("pointerdown", function (e) {
    if (drawState !== "cutting" || e.button !== 0) return;
    e.preventDefault();
    cancelAnimationFrame(animRaf);
    scissors.setPointerCapture(e.pointerId);
    drag = { id: e.pointerId, x: e.clientX, from: cutX, k: video.getBoundingClientRect().width / 1080 };
  });

  scissors.addEventListener("pointermove", function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    setCut(drag.from + (e.clientX - drag.x) / drag.k);
    if (cutX >= CUT_TO) finishCut();
  });

  function endDrag(e) {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    animateCut(CUT_FROM, 350);
  }
  scissors.addEventListener("pointerup", endDrag);
  scissors.addEventListener("pointercancel", endDrag);

  // 鍵盤：Enter / 空白鍵直接剪開
  scissors.addEventListener("keydown", function (e) {
    if ((e.key !== "Enter" && e.key !== " ") || drawState !== "cutting" || drag) return;
    e.preventDefault();
    animateCut(CUT_TO, 600, function () {
      if (drawState === "cutting") finishCut();
    });
  });

  drawBtn.addEventListener("click", openDraw);
  drawClose.addEventListener("click", closeDraw);

  drawEl.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      closeDraw();
      return;
    }
    // 焦點鎖在過場內（剪刀出現時才可聚焦）
    if (e.key === "Tab") {
      var items = drawState === "cutting" ? [drawClose, scissors] : [drawClose];
      var i = items.indexOf(document.activeElement);
      e.preventDefault();
      items[(i + (e.shiftKey ? items.length - 1 : 1)) % items.length].focus();
    }
  });

  /* ---------------- TAIWAN 拉開 → 卡片墜落 ---------------- */

  var page = document.querySelector(".page");
  var tw = document.getElementById("h-tw");
  var word = document.getElementById("h-tw-word");
  var anchor = document.getElementById("h-tw-anchor");
  var target = document.getElementById("h-fan-target");
  var faller = document.getElementById("h-faller");
  var fallerInner = faller.querySelector(".h-faller__inner");

  var START_ROT = 60; // Figma：TAIWAN 上的卡片旋轉 60°

  function clamp01(v) {
    return Math.min(1, Math.max(0, v));
  }

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  // 以 .page 左上角為原點的中心點與寬度（不含旋轉）
  function box(el, pageRect) {
    var r = el.getBoundingClientRect();
    return {
      x: r.left + r.width / 2 - pageRect.left,
      y: r.top + r.height / 2 - pageRect.top,
      w: r.width,
      h: r.height
    };
  }

  var ticking = false;

  function update() {
    ticking = false;
    var vh = window.innerHeight;
    var reduce = PT.reducedMotion();
    var pageRect = page.getBoundingClientRect();
    var scrolled = -pageRect.top; // 頁面捲動量

    // 1. 字樣由上往下拉開：區塊上緣從畫面底部捲到畫面 15% 處，scaleY 0 → 1
    var twTop = tw.getBoundingClientRect().top - pageRect.top;
    var stretch = reduce ? 1 : clamp01((scrolled + vh - twTop) / (vh * 0.85));
    word.style.transform = "scaleY(" + stretch + ")";

    // 2. 墜落：字拉滿時開始，終點卡片來到畫面中央時抵達
    var from = box(anchor, pageRect);
    var to = box(target, pageRect);
    var startAt = twTop - vh * 0.15;
    var endAt = Math.max(startAt + 1, to.y - vh * 0.5);
    var t = reduce ? 1 : clamp01((scrolled - startAt) / (endAt - startAt));

    var landed = t >= 1;
    target.classList.toggle("is-waiting", !landed);

    if (landed || t <= 0) {
      faller.style.visibility = "hidden";
      faller.style.opacity = "0";
      return;
    }

    var e = easeInOutCubic(t);
    var w = lerp(from.w, to.w, e);
    var h = lerp(from.h, to.h, e);
    faller.style.visibility = "visible";
    faller.style.opacity = String(clamp01(t / 0.1)); // 一開始淡入
    faller.style.width = w + "px";
    faller.style.height = h + "px";
    faller.style.transform =
      "translate(" + (lerp(from.x, to.x, e) - w / 2) + "px, " + (lerp(from.y, to.y, e) - h / 2) + "px) " +
      "rotate(" + lerp(START_ROT, 0, e) + "deg)";
    fallerInner.style.transform = "rotateY(" + 360 * e + "deg)"; // 途中翻轉一圈（露出卡背）
  }

  function requestUpdate() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }

  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", requestUpdate);
  window.addEventListener("load", requestUpdate); // 圖片載入後版面高度才確定
  update();

  /* ---------------- 主視覺圖片：依畫面位置（上→下、左→右）依序載入、淡入 ---------------- */

  var hero = document.getElementById("h-hero");
  var heroInReady;
  var heroIn = new Promise(function (resolve) { heroInReady = resolve; });

  function whenLoaded(img) {
    if (img.decode) return img.decode().catch(function () {});
    return new Promise(function (resolve) {
      if (img.complete) resolve();
      else img.onload = img.onerror = resolve;
    });
  }

  (function sequenceHeroImages() {
    var bandH = hero.getBoundingClientRect().height / 3; // 主視覺分三列，列內由左而右
    var items = Array.prototype.slice.call(hero.querySelectorAll(".h-seq")).map(function (el) {
      var r = el.getBoundingClientRect();
      return { el: el, img: el.tagName === "IMG" ? el : el.querySelector("img"), x: r.left, row: Math.floor(Math.max(0, r.top) / bandH) };
    });
    items.sort(function (a, b) { return a.row - b.row || a.x - b.x; });

    // 依序發出請求（手機版 <picture> 先設 srcset）
    var loads = items.map(function (it) {
      var source = it.img.parentNode.tagName === "PICTURE" ? it.img.parentNode.querySelector("source[data-srcset]") : null;
      if (source) source.srcset = source.getAttribute("data-srcset");
      it.img.src = it.img.getAttribute("data-src");
      return whenLoaded(it.img);
    });

    // 主視覺進場後，前一張已顯示且本張已載入才淡入
    var chain = heroIn;
    items.forEach(function (it, i) {
      chain = chain.then(function () { return loads[i]; }).then(function () {
        it.el.classList.add("is-shown");
        return new Promise(function (resolve) { setTimeout(resolve, 140); });
      });
    });
  })();

  /* ---------------- 進場 ---------------- */

  PT.enter(site).then(function () {
    // 下一個 frame 才加上 class，確保初始（隱藏）狀態已套用，轉場才會播放
    requestAnimationFrame(function () {
      hero.classList.add("is-in");
      heroInReady();
      window.Reveal.start();
    });
  });

  PT.bindLinks(site);
})();
