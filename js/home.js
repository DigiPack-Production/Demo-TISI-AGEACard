/*
  亞運菁英運動員卡片展示 — 首頁互動
  - 設定 --s（1920 設計稿等比縮放）與 --ms（手機版 375 稿縮放）
  - 主選單：轉場開關（同搜尋彈窗），僅「關於運動員卡」可點
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
