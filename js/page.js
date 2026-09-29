/*
  亞運菁英運動員卡片展示 — 首頁互動
  - 設定 --s（依 1920px 設計稿等比縮放）
  - 「使用運動類別排序」下拉：選類別即篩選
  - 「搜尋」彈窗：選手名稱搜尋、運動類別篩選
  篩選結果只顯示符合的選手各一張；卡片由 js/cards.js 的 CardGallery 產生。
*/
(function () {
  "use strict";

  var gallery = window.CardGallery;

  // Figma 搜尋彈窗的 40 個運動類別（順序同設計稿）
  var SPORTS = [
    "游泳", "跳水", "輕艇", "划船", "帆船", "衝浪", "田徑", "鐵人三項", "舉重",
    "競技體操", "韻律體操", "霹靂舞", "滑板", "射箭", "射擊", "高爾夫", "羽球",
    "網球", "軟式網球", "桌球", "棒球", "壘球", "籃球", "足球", "排球", "曲棍球",
    "卡巴迪", "拳擊", "跆拳道", "柔道", "空手道", "柔術", "克拉術", "綜合格鬥",
    "角力", "武術", "擊劍", "自由車", "馬術", "電子競技"
  ];

  var SORT_LABEL = "使用運動類別排序";

  // 各類別實際卡片數（每位選手一張）
  var counts = {};
  gallery.players.forEach(function (p) {
    counts[p.category] = (counts[p.category] || 0) + 1;
  });

  /* ---------------- 等比縮放 ---------------- */

  var root = document.documentElement;
  function updateScale() {
    root.style.setProperty("--s", String(Math.min(1, root.clientWidth / 1920)));
  }
  updateScale();
  window.addEventListener("resize", updateScale);

  /* ---------------- 篩選 ---------------- */

  var emptyMsg = document.getElementById("cards-empty");
  var sortLabel = document.getElementById("sort-label");
  var currentCategory = null;

  function applyFilter(filter) {
    currentCategory = filter.category || null;
    sortLabel.textContent = currentCategory || SORT_LABEL;
    syncSelected();

    if (!filter.category && !filter.name) {
      emptyMsg.hidden = true;
      gallery.showAll();
      return;
    }
    var list = gallery.players.filter(function (p) {
      if (filter.category) return p.category === filter.category;
      return p.name.indexOf(filter.name) !== -1;
    });
    emptyMsg.hidden = list.length > 0;
    gallery.showPlayers(list);
  }

  /* ---------------- 排序下拉 ---------------- */

  var sortBtn = document.getElementById("sort-btn");
  var sortList = document.getElementById("sort-list");
  var options = [];

  function addOption(value, label, count) {
    var li = document.createElement("li");
    li.className = "sort__option";
    li.setAttribute("role", "option");
    li.id = "sort-opt-" + options.length;
    li.dataset.value = value;
    li.innerHTML = "<span></span>";
    li.firstChild.textContent = label;
    if (count !== undefined) {
      var c = document.createElement("span");
      c.className = "sort__count";
      c.textContent = count + " 張";
      li.appendChild(c);
      if (!count) li.setAttribute("aria-disabled", "true");
    }
    li.addEventListener("click", function () {
      if (li.getAttribute("aria-disabled") === "true") return;
      chooseOption(li);
    });
    sortList.appendChild(li);
    options.push(li);
  }

  addOption("", "全部");
  SPORTS.forEach(function (s) { addOption(s, s, counts[s] || 0); });

  var focusIndex = -1;

  function syncSelected() {
    options.forEach(function (o) {
      o.setAttribute("aria-selected", String(o.dataset.value === (currentCategory || "")));
    });
    chips.forEach(function (c) {
      c.setAttribute("aria-pressed", String(c.dataset.value === (currentCategory || "")));
    });
  }

  function setFocus(i) {
    if (focusIndex >= 0) options[focusIndex].classList.remove("is-focused");
    focusIndex = i;
    if (i < 0) {
      sortBtn.removeAttribute("aria-activedescendant");
      return;
    }
    options[i].classList.add("is-focused");
    sortBtn.setAttribute("aria-activedescendant", options[i].id);
    options[i].scrollIntoView({ block: "nearest" });
  }

  var hero = document.querySelector(".hero");

  function openSort() {
    sortList.hidden = false;
    hero.classList.add("is-sort-open");
    sortBtn.setAttribute("aria-expanded", "true");
    var sel = 0;
    options.forEach(function (o, i) {
      if (o.getAttribute("aria-selected") === "true") sel = i;
    });
    setFocus(sel);
  }

  function closeSort() {
    sortList.hidden = true;
    hero.classList.remove("is-sort-open");
    sortBtn.setAttribute("aria-expanded", "false");
    setFocus(-1);
  }

  function chooseOption(li) {
    closeSort();
    sortBtn.focus();
    applyFilter({ category: li.dataset.value });
  }

  function moveFocus(step) {
    var i = focusIndex;
    do {
      i = (i + step + options.length) % options.length;
    } while (options[i].getAttribute("aria-disabled") === "true" && i !== focusIndex);
    setFocus(i);
  }

  sortBtn.addEventListener("click", function () {
    if (sortList.hidden) openSort(); else closeSort();
  });

  sortBtn.addEventListener("keydown", function (e) {
    if (sortList.hidden) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        openSort();
      }
      return;
    }
    if (e.key === "ArrowDown") { e.preventDefault(); moveFocus(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); moveFocus(-1); }
    else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (focusIndex >= 0) chooseOption(options[focusIndex]);
    } else if (e.key === "Escape" || e.key === "Tab") {
      closeSort();
    }
  });

  document.addEventListener("click", function (e) {
    if (!sortList.hidden && !e.target.closest(".sort")) closeSort();
  });

  /* ---------------- 搜尋彈窗 ---------------- */

  var modal = document.getElementById("search-modal");
  var searchBtn = document.getElementById("search-btn");
  var closeBtn = document.getElementById("search-close");
  var form = document.getElementById("search-form");
  var input = document.getElementById("search-input");
  var chipsBox = document.getElementById("sport-chips");
  var chips = [];

  // value 為空字串代表「全部」
  function addChip(value, label, n) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "sport-chip";
    b.dataset.value = value;
    b.innerHTML =
      '<span class="sport-chip__name"></span>' +
      '<span class="sport-chip__count"><span></span><span>張</span></span>';
    b.querySelector(".sport-chip__name").textContent = label;
    b.querySelector(".sport-chip__count span").textContent = String(n);
    b.setAttribute("aria-label", label + "，" + n + " 張");
    b.disabled = n === 0;
    b.addEventListener("click", function () {
      input.value = "";
      closeModal();
      applyFilter({ category: value });
    });
    chipsBox.appendChild(b);
    chips.push(b);
  }

  addChip("", "全部", gallery.players.length);
  SPORTS.forEach(function (s) { addChip(s, s, counts[s] || 0); });

  var lastFocus = null;
  var lockedScrollY = 0;

  // 鎖定頁面捲動：body 固定在目前位置（iOS 也有效），並補上捲軸寬度避免版面跳動
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

  /* ---------- 搜尋彈窗開關：轉場換頁特效（js/transition.js） ---------- */

  var PT = window.PageTransition;
  var site = document.getElementById("site");

  function openModal() {
    if (PT.isBusy() || !modal.hidden) return;
    closeSort();
    lastFocus = document.activeElement;
    lockScroll();

    if (PT.reducedMotion()) {
      modal.hidden = false;
      input.focus({ preventScroll: true });
      return;
    }

    PT.swap(site, modal, function () { modal.hidden = false; })
      .then(function () { input.focus({ preventScroll: true }); });
  }

  function closeModal() {
    if (PT.isBusy() || modal.hidden) return;

    if (PT.reducedMotion()) {
      modal.hidden = true;
      unlockScroll();
      if (lastFocus) lastFocus.focus({ preventScroll: true });
      return;
    }

    // 首頁先保持收合，等彈窗收完再展開
    PT.swap(modal, site, function () {
      modal.hidden = true;
      unlockScroll();
    }, [site]).then(function () {
      if (lastFocus) lastFocus.focus({ preventScroll: true });
    });
  }

  searchBtn.addEventListener("click", openModal);
  closeBtn.addEventListener("click", closeModal);

  // 點彈窗外的遮罩區關閉
  modal.addEventListener("click", function (e) {
    if (e.target === modal || e.target.classList.contains("search-modal__inner")) closeModal();
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var q = input.value.trim();
    closeModal();
    applyFilter({ name: q });
  });

  modal.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      e.stopPropagation();
      closeModal();
      return;
    }
    // 焦點鎖在彈窗內
    if (e.key === "Tab") {
      var f = modal.querySelectorAll("button:not(:disabled), input");
      var first = f[0];
      var last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  syncSelected();

  /* ---------------- 查看資料（卡片放大時顯示） ---------------- */

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

  // 由運動員頁返回：從中心展開
  PT.enter(site);
})();
