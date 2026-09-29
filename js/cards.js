/*
  亞運菁英運動員卡片展示 — 卡片互動引擎（vanilla JS）
  忠實移植自 B1 poke-holo 的 Card.svelte / svelte/motion spring /
  stores（activeCard、orientation）/ helpers/Math.js，互動數值與原版一致。
  使用一般 script（非 ES module），雙擊以 file:// 開啟即可運作。
*/
(function () {
  "use strict";

  /* ---------------- 資料 ---------------- */

  // 選手依序循環排列（前四位同 Figma 設計稿順序）
  // sport = 卡下顯示文字；category = 對應搜尋彈窗的「運動類別」
  var PLAYERS = [
    { name: "丁華恬", sport: "體操", category: "競技體操", img: "images/丁華恬.png" },
    { name: "孫振", sport: "霹靂舞", category: "霹靂舞", img: "images/孫振.png" },
    { name: "林昀儒", sport: "桌球", category: "桌球", img: "images/林昀儒.png" },
    { name: "張博雅", sport: "田徑", category: "田徑", img: "images/張博雅.png" },
    { name: "林郁婷", sport: "拳擊", category: "拳擊", img: "images/林郁婷.png" },
    { name: "王齊麟", sport: "羽球", category: "羽球", img: "images/王齊麟.png" }
  ];

  // 電腦版 3×5 = 15 張；手機版由 CSS 只顯示前 9 張（3×3）
  var TOTAL_CARDS = 15;

  // hover 光暈顏色依卡片位置（Figma 前 10 張的順序，每 10 張循環），
  // 使用原版內建的屬性光暈色（css/cards/base.css 的 .card.water 等）
  var GLOWS = [
    "lightning", "metal", "lightning", "psychic", "metal",
    "psychic", "fire", "water", "lightning", "grass"
  ];

  // 目前只展示「Pokemon V」特效。其他特效 CSS 均已載入，
  // 日後要展示別的特效只要換掉這組屬性（例如 rarity: "rare holo vmax"）。
  var EFFECT = {
    rarity: "rare holo v",
    supertype: "pokémon",
    subtypes: "basic v"
  };

  /* ---------------- helpers/Math.js ---------------- */

  var round = function (value, precision) {
    if (precision === undefined) precision = 3;
    return parseFloat(value.toFixed(precision));
  };
  var clamp = function (value, min, max) {
    if (min === undefined) min = 0;
    if (max === undefined) max = 100;
    return Math.min(Math.max(value, min), max);
  };
  var adjust = function (value, fromMin, fromMax, toMin, toMax) {
    return round(toMin + (toMax - toMin) * (value - fromMin) / (fromMax - fromMin));
  };

  /* ---------------- svelte/motion spring ---------------- */

  function tickSpring(ctx, lastValue, currentValue, targetValue) {
    if (typeof currentValue === "number") {
      var delta = targetValue - currentValue;
      var velocity = (currentValue - lastValue) / (ctx.dt || 1 / 60);
      var spring = ctx.opts.stiffness * delta;
      var damper = ctx.opts.damping * velocity;
      var acceleration = (spring - damper) * ctx.invMass;
      var d = (velocity + acceleration) * ctx.dt;
      if (Math.abs(d) < ctx.opts.precision && Math.abs(delta) < ctx.opts.precision) {
        return targetValue; // settled
      }
      ctx.settled = false;
      return currentValue + d;
    }
    var next = {};
    for (var k in currentValue) {
      next[k] = tickSpring(ctx, lastValue[k], currentValue[k], targetValue[k]);
    }
    return next;
  }

  function createSpring(initial, opts, onChange) {
    var value = initial;
    var lastValue = initial;
    var targetValue = initial;
    var lastTime = 0;
    var running = false;
    var cancelTask = false;
    var invMass = 1;
    var invMassRecoveryRate = 0;

    var s = {
      stiffness: opts.stiffness,
      damping: opts.damping,
      precision: 0.01,
      get: function () { return value; },
      set: set
    };

    function tick(now) {
      if (cancelTask) {
        cancelTask = false;
        running = false;
        return;
      }
      invMass = Math.min(invMass + invMassRecoveryRate, 1);
      var ctx = {
        invMass: invMass,
        opts: s,
        settled: true,
        dt: (now - lastTime) * 60 / 1000
      };
      var next = tickSpring(ctx, lastValue, value, targetValue);
      lastTime = now;
      lastValue = value;
      value = next;
      onChange();
      if (ctx.settled) {
        running = false;
      } else {
        requestAnimationFrame(tick);
      }
    }

    function set(newValue, setOpts) {
      setOpts = setOpts || {};
      targetValue = newValue;
      if (setOpts.hard || (s.stiffness >= 1 && s.damping >= 1)) {
        cancelTask = running;
        lastTime = performance.now();
        lastValue = newValue;
        value = newValue;
        onChange();
        return;
      }
      if (setOpts.soft) {
        var rate = setOpts.soft === true ? 0.5 : +setOpts.soft;
        invMassRecoveryRate = 1 / (rate * 60);
        invMass = 0;
      }
      if (!running) {
        lastTime = performance.now();
        cancelTask = false;
        running = true;
        requestAnimationFrame(tick);
      }
    }

    return s;
  }

  /* ---------------- stores ---------------- */

  var cards = [];
  var activeCard; // 對應 stores/activeCard.js

  function setActiveCard(card) {
    var changed = activeCard !== card;
    activeCard = card;
    // 通知頁面（例如首頁的「查看資料」按鈕）
    if (changed) {
      document.dispatchEvent(new CustomEvent("cardactivechange", { detail: { card: card } }));
    }
    // 同 Svelte 的 reactive 區塊：activeCard 改變時每張卡都重新判斷
    cards.forEach(function (c) { c.onActiveChange(); });
  }

  // stores/orientation.js
  var getRawOrientation = function (e) {
    if (!e) return { alpha: 0, beta: 0, gamma: 0 };
    return { alpha: e.alpha, beta: e.beta, gamma: e.gamma };
  };
  var firstReading = true;
  var baseOrientation = getRawOrientation();
  var getOrientationObject = function (e) {
    var o = getRawOrientation(e);
    return {
      absolute: o,
      relative: {
        alpha: o.alpha - baseOrientation.alpha,
        beta: o.beta - baseOrientation.beta,
        gamma: o.gamma - baseOrientation.gamma
      }
    };
  };
  var orientation = getOrientationObject();
  var resetBaseOrientation = function () {
    firstReading = true;
    baseOrientation = getRawOrientation();
  };
  window.addEventListener("deviceorientation", function (e) {
    if (firstReading) {
      firstReading = false;
      baseOrientation = getRawOrientation(e);
    }
    orientation = getOrientationObject(e);
    if (activeCard) activeCard.onOrientation();
  }, true);

  /* ---------------- Card（Card.svelte） ---------------- */

  function createCard(data, showcase, glow) {
    var randomSeed = { x: Math.random(), y: Math.random() };
    var cosmosPosition = {
      x: Math.floor(randomSeed.x * 734),
      y: Math.floor(randomSeed.y * 1280)
    };

    // DOM
    var cell = document.createElement("div");
    cell.className = "card-cell";
    cell.innerHTML =
      '<div class="card ' + glow + ' interactive loading">' +
        '<div class="card__translater">' +
          '<button class="card__rotator" tabindex="0">' +
            '<img class="card__back" src="images/card-back.jpg" alt="" loading="lazy" width="660" height="921" />' +
            '<div class="card__front">' +
              '<img loading="lazy" width="660" height="921" />' +
              '<div class="card__shine"></div>' +
              '<div class="card__glare"></div>' +
            '</div>' +
          '</button>' +
        '</div>' +
      '</div>' +
      '<p class="card-caption">' +
        '<span class="card-caption__name"></span>' +
        '<span class="card-caption__sport"></span>' +
      '</p>';

    var el = cell.querySelector(".card");
    var rotator = cell.querySelector(".card__rotator");
    var front = cell.querySelector(".card__front");
    var frontImg = front.querySelector("img");

    el.setAttribute("data-subtypes", EFFECT.subtypes);
    el.setAttribute("data-supertype", EFFECT.supertype);
    el.setAttribute("data-rarity", EFFECT.rarity);
    el.setAttribute("data-trainer-gallery", "false");
    rotator.setAttribute("aria-label", "展開卡片：" + data.name);
    frontImg.alt = data.name + "（" + data.sport + "）運動員卡片正面";
    cell.querySelector(".card-caption__name").textContent = data.name;
    cell.querySelector(".card-caption__sport").textContent = data.sport;
    front.style.cssText =
      "--seedx: " + randomSeed.x + ";" +
      "--seedy: " + randomSeed.y + ";" +
      "--cosmosbg: " + cosmosPosition.x + "px " + cosmosPosition.y + "px;";

    // state
    var repositionTimer;
    var rafId = null;
    var pendingSpringUpdate = null;
    var active = false;
    var interacting = false;
    var firstPop = true;
    var isVisible = document.visibilityState === "visible";

    var renderQueued = false;
    var render = function () {
      if (renderQueued) return;
      renderQueued = true;
      // 同一 frame 內多個 spring 變動只寫一次樣式
      Promise.resolve().then(writeStyles);
    };

    var springInteractSettings = { stiffness: 0.066, damping: 0.25 };
    var springPopoverSettings = { stiffness: 0.033, damping: 0.45 };
    var springRotate = createSpring({ x: 0, y: 0 }, springInteractSettings, render);
    var springGlare = createSpring({ x: 50, y: 50, o: 0 }, springInteractSettings, render);
    var springBackground = createSpring({ x: 50, y: 50 }, springInteractSettings, render);
    var springRotateDelta = createSpring({ x: 0, y: 0 }, springPopoverSettings, render);
    var springTranslate = createSpring({ x: 0, y: 0 }, springPopoverSettings, render);
    var springScale = createSpring(1, springPopoverSettings, render);

    function setClasses() {
      el.classList.toggle("active", active);
      el.classList.toggle("interacting", interacting);
    }

    function writeStyles() {
      renderQueued = false;
      var g = springGlare.get();
      var r = springRotate.get();
      var rd = springRotateDelta.get();
      var b = springBackground.get();
      var t = springTranslate.get();
      var st = el.style;
      st.setProperty("--pointer-x", g.x + "%");
      st.setProperty("--pointer-y", g.y + "%");
      st.setProperty("--pointer-from-center", String(clamp(Math.sqrt(
        (g.y - 50) * (g.y - 50) + (g.x - 50) * (g.x - 50)
      ) / 50, 0, 1)));
      st.setProperty("--pointer-from-top", String(g.y / 100));
      st.setProperty("--pointer-from-left", String(g.x / 100));
      st.setProperty("--card-opacity", String(g.o));
      st.setProperty("--rotate-x", (r.x + rd.x) + "deg");
      st.setProperty("--rotate-y", (r.y + rd.y) + "deg");
      st.setProperty("--background-x", b.x + "%");
      st.setProperty("--background-y", b.y + "%");
      st.setProperty("--card-scale", String(springScale.get()));
      st.setProperty("--translate-x", t.x + "px");
      st.setProperty("--translate-y", t.y + "px");
    }

    var showcaseInterval;
    var showcaseTimerStart;
    var showcaseTimerEnd;
    var showcaseRunning = showcase;

    var endShowcase = function () {
      if (showcaseRunning) {
        clearTimeout(showcaseTimerEnd);
        clearTimeout(showcaseTimerStart);
        clearInterval(showcaseInterval);
        showcaseRunning = false;
      }
    };

    var updateSprings = function (background, rotate, glare) {
      springBackground.stiffness = springInteractSettings.stiffness;
      springBackground.damping = springInteractSettings.damping;
      springRotate.stiffness = springInteractSettings.stiffness;
      springRotate.damping = springInteractSettings.damping;
      springGlare.stiffness = springInteractSettings.stiffness;
      springGlare.damping = springInteractSettings.damping;

      springBackground.set(background);
      springRotate.set(rotate);
      springGlare.set(glare);
    };

    var interact = function (e) {
      endShowcase();

      if (!isVisible) {
        interacting = false;
        return setClasses();
      }

      // prevent other background cards being interacted with
      if (activeCard && activeCard !== card) {
        interacting = false;
        return setClasses();
      }

      interacting = true;
      setClasses();

      var clientX = e.clientX;
      var clientY = e.clientY;
      if (e.type === "touchmove") {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      }

      var rect = e.target.getBoundingClientRect();
      var absolute = {
        x: clientX - rect.left,
        y: clientY - rect.top
      };
      var percent = {
        x: clamp(round((100 / rect.width) * absolute.x)),
        y: clamp(round((100 / rect.height) * absolute.y))
      };
      var center = {
        x: percent.x - 50,
        y: percent.y - 50
      };

      pendingSpringUpdate = {
        background: {
          x: adjust(percent.x, 0, 100, 37, 63),
          y: adjust(percent.y, 0, 100, 33, 67)
        },
        rotate: {
          x: round(-(center.x / 3.5)),
          y: round(center.y / 3.5)
        },
        glare: {
          x: round(percent.x),
          y: round(percent.y),
          o: 1
        }
      };

      if (rafId === null) {
        rafId = requestAnimationFrame(function () {
          if (pendingSpringUpdate) {
            updateSprings(
              pendingSpringUpdate.background,
              pendingSpringUpdate.rotate,
              pendingSpringUpdate.glare
            );
            pendingSpringUpdate = null;
          }
          rafId = null;
        });
      }
    };

    var interactEnd = function (e, delay) {
      if (delay === undefined) delay = 500;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      pendingSpringUpdate = null;

      setTimeout(function () {
        var snapStiff = 0.01;
        var snapDamp = 0.06;
        interacting = false;
        setClasses();

        springRotate.stiffness = snapStiff;
        springRotate.damping = snapDamp;
        springRotate.set({ x: 0, y: 0 }, { soft: 1 });

        springGlare.stiffness = snapStiff;
        springGlare.damping = snapDamp;
        springGlare.set({ x: 50, y: 50, o: 0 }, { soft: 1 });

        springBackground.stiffness = snapStiff;
        springBackground.damping = snapDamp;
        springBackground.set({ x: 50, y: 50 }, { soft: 1 });
      }, delay);
    };

    var activate = function () {
      if (activeCard && activeCard === card) {
        setActiveCard(undefined);
      } else {
        resetBaseOrientation();
        setActiveCard(card);
      }
    };

    var deactivate = function () {
      interactEnd();
      setActiveCard(undefined);
    };

    var setCenter = function () {
      var rect = el.getBoundingClientRect();
      var view = document.documentElement;
      springTranslate.set({
        x: round(view.clientWidth / 2 - rect.x - rect.width / 2),
        y: round(view.clientHeight / 2 - rect.y - rect.height / 2)
      });
    };

    var reposition = function () {
      clearTimeout(repositionTimer);
      repositionTimer = setTimeout(function () {
        if (activeCard && activeCard === card) {
          setCenter();
        }
      }, 300);
    };

    var popover = function () {
      var rect = el.getBoundingClientRect();
      var delay = 100;
      var scaleW = (window.innerWidth / rect.width) * 0.9;
      var scaleH = (window.innerHeight / rect.height) * 0.9;
      var scaleF = 1.75;
      setCenter();
      if (firstPop) {
        delay = 1000;
        springRotateDelta.set({ x: 360, y: 0 });
      }
      firstPop = false;
      springScale.set(Math.min(scaleW, scaleH, scaleF));
      interactEnd(null, delay);
    };

    var retreat = function () {
      springScale.set(1, { soft: true });
      springTranslate.set({ x: 0, y: 0 }, { soft: true });
      springRotateDelta.set({ x: 0, y: 0 }, { soft: true });
      interactEnd(null, 100);
    };

    var reset = function () {
      interactEnd(null, 0);
      springScale.set(1, { hard: true });
      springTranslate.set({ x: 0, y: 0 }, { hard: true });
      springRotateDelta.set({ x: 0, y: 0 }, { hard: true });
      springRotate.set({ x: 0, y: 0 }, { hard: true });
    };

    var orientate = function (e) {
      var x = e.relative.gamma;
      var y = e.relative.beta;
      var limit = { x: 16, y: 18 };
      var degrees = {
        x: clamp(x, -limit.x, limit.x),
        y: clamp(y, -limit.y, limit.y)
      };
      updateSprings({
        x: adjust(degrees.x, -limit.x, limit.x, 37, 63),
        y: adjust(degrees.y, -limit.y, limit.y, 33, 67)
      }, {
        x: round(degrees.x * -1),
        y: round(degrees.y)
      }, {
        x: adjust(degrees.x, -limit.x, limit.x, 0, 100),
        y: adjust(degrees.y, -limit.y, limit.y, 0, 100),
        o: 1
      });
    };

    var card = {
      el: el,
      rotator: rotator,
      // Svelte：$: if ($activeCard === thisCard) popover() else retreat()
      //         $: if ($activeCard === thisCard) { interacting = true; orientate($orientation) }
      onActiveChange: function () {
        if (activeCard && activeCard === card) {
          popover();
          active = true;
          interacting = true;
          orientate(orientation);
        } else {
          retreat();
          active = false;
        }
        setClasses();
      },
      onOrientation: function () {
        interacting = true;
        setClasses();
        orientate(orientation);
      },
      onVisibility: function () {
        isVisible = document.visibilityState === "visible";
        endShowcase();
        reset();
      },
      reposition: reposition,
      deactivate: deactivate,
      destroy: endShowcase,
      mount: function () {
        // set the front image on mount so that lazyloading works
        frontImg.src = data.img;

        // run a cute little animation on load for showcase card
        if (showcase && isVisible) {
          var s = 0.02;
          var d = 0.5;
          var r = 0;
          showcaseTimerStart = setTimeout(function () {
            interacting = true;
            active = true;
            setClasses();
            springRotate.stiffness = s;
            springRotate.damping = d;
            springGlare.stiffness = s;
            springGlare.damping = d;
            springBackground.stiffness = s;
            springBackground.damping = d;
            if (isVisible) {
              showcaseInterval = setInterval(function () {
                r += 0.05;
                springRotate.set({ x: Math.sin(r) * 25, y: Math.cos(r) * 25 });
                springGlare.set({
                  x: 55 + Math.sin(r) * 55,
                  y: 55 + Math.cos(r) * 55,
                  o: 0.8
                });
                springBackground.set({
                  x: 20 + Math.sin(r) * 20,
                  y: 20 + Math.cos(r) * 20
                });
              }, 20);
              showcaseTimerEnd = setTimeout(function () {
                clearInterval(showcaseInterval);
                interactEnd(null, 0);
              }, 4000);
            } else {
              interacting = false;
              active = false;
              setClasses();
            }
          }, 2000);
        }
      }
    };

    frontImg.addEventListener("load", function () {
      el.classList.remove("loading");
    });
    rotator.addEventListener("click", activate);
    rotator.addEventListener("pointermove", interact);
    rotator.addEventListener("mouseout", function (e) { interactEnd(e); });
    rotator.addEventListener("blur", function (e) {
      // 焦點移到「查看資料」等屬於放大卡片的控制項時，不收回卡片
      if (e.relatedTarget && e.relatedTarget.closest("[data-keeps-card]")) return;
      deactivate();
    });

    card.cell = cell;
    card.data = data;
    card.frontImg = frontImg;
    writeStyles();
    return card;
  }

  /* ---------------- 建立卡片格線 ---------------- */

  var grid = document.getElementById("card-grid");
  var extraCards = []; // 格線以外單獨掛載的卡片（例如運動員頁主視覺）

  // 以指定的選手清單重建卡片；showcase = 第一張卡是否播放載入展示動畫
  function renderCards(list, showcase) {
    cards.forEach(function (c) { c.destroy(); });
    activeCard = undefined;
    cards = extraCards.slice();
    grid.innerHTML = "";
    list.forEach(function (data, i) {
      var card = createCard(data, showcase && i === 0, GLOWS[i % GLOWS.length]);
      cards.push(card);
      grid.appendChild(card.cell);
    });
    cards.forEach(function (c) {
      c.onActiveChange(); // 同 Svelte 初次執行 reactive 區塊
      c.mount();
    });
  }

  // 預設展示牆：選手依序循環排滿 TOTAL_CARDS 張
  function showcaseList() {
    var list = [];
    for (var i = 0; i < TOTAL_CARDS; i++) {
      list.push(PLAYERS[i % PLAYERS.length]);
    }
    return list;
  }

  if (grid) renderCards(showcaseList(), true);

  function findPlayer(name) {
    for (var i = 0; i < PLAYERS.length; i++) {
      if (PLAYERS[i].name === name) return PLAYERS[i];
    }
    return null;
  }

  // 提供給 js/page.js（排序下拉、搜尋彈窗、查看資料）與 js/athlete.js 使用
  window.CardGallery = {
    players: PLAYERS,
    findPlayer: findPlayer,
    showAll: function () { renderCards(showcaseList(), false); },
    showPlayers: function (list) { renderCards(list, false); },
    getActive: function () { return activeCard; },
    deactivateActive: function () {
      if (activeCard) activeCard.deactivate();
    },
    // 單獨掛載一張卡（不含卡下文字），回傳卡片物件
    mount: function (container, data, glow) {
      var card = createCard(data, false, glow || "lightning");
      var caption = card.cell.querySelector(".card-caption");
      if (caption) caption.remove();
      cards.push(card);
      extraCards.push(card);
      container.appendChild(card.cell);
      card.onActiveChange();
      card.mount();
      return card;
    }
  };

  window.addEventListener("scroll", function () {
    cards.forEach(function (c) { c.reposition(); });
  });

  document.addEventListener("visibilitychange", function () {
    cards.forEach(function (c) { c.onVisibility(); });
  });

  // ESC 關閉放大中的卡片（等同點擊外部讓卡片失焦）
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && activeCard) {
      var rotator = activeCard.rotator;
      activeCard.deactivate();
      rotator.blur();
    }
  });
})();
