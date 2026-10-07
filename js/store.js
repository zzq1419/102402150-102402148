/* ==========================================================================
   store.js —— 数据仓库（状态 + 本地持久化）
   不碰 DOM。数据存在 localStorage 里，刷新页面不丢；关掉浏览器再打开也还在。
   ⚠️ 用 file:// 直接打开时，个别浏览器会禁用 localStorage —— 这里做了降级：
     读写失败就退回"内存态"，功能照常可用，只是刷新后回到初始数据。
   ========================================================================== */
(function (root, factory) {
  var DATA  = (typeof module !== 'undefined' && module.exports) ? require('./data.js')  : root.LFData;
  var UTILS = (typeof module !== 'undefined' && module.exports) ? require('./utils.js') : root.LFUtils;
  var api = factory(DATA, UTILS);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LFStore = api;
})(typeof self !== 'undefined' ? self : this, function (DATA, UTILS) {

  var KEY_ITEMS = 'lf.lostfound.items.v1';
  var KEY_FAVS  = 'lf.lostfound.favs.v1';

  /* ---------- 存储适配器：localStorage 不可用时自动降级为内存 Map ---------- */
  var memory = {};
  var usable = (function () {
    try {
      var k = '__lf_probe__';
      root.localStorage.setItem(k, '1');
      root.localStorage.removeItem(k);
      return true;
    } catch (e) { return false; }
  })();

  function rawGet(k) {
    if (!usable) return memory[k] == null ? null : memory[k];
    try { return root.localStorage.getItem(k); } catch (e) { return null; }
  }
  function rawSet(k, v) {
    if (!usable) { memory[k] = v; return; }
    try { root.localStorage.setItem(k, v); } catch (e) { memory[k] = v; }
  }
  function rawDel(k) {
    delete memory[k];
    if (usable) { try { root.localStorage.removeItem(k); } catch (e) {} }
  }

  function readJSON(k, dft) {
    var s = rawGet(k);
    if (!s) return dft;
    try {
      var v = JSON.parse(s);
      return v == null ? dft : v;
    } catch (e) { return dft; }
  }
  function writeJSON(k, v) {
    try { rawSet(k, JSON.stringify(v)); } catch (e) {}
  }

  /* ---------- 种子数据：createdAt 每次加载时按 agoMin 重新锚定到"现在" ----------
     这样示例数据永远显示成"刚刚 / 今天 / 昨天"，演示和筛选都不会看起来像过期数据。 */
  function buildSeed(now) {
    return DATA.SEED.map(function (s) {
      var it = {};
      Object.keys(s).forEach(function (k) { it[k] = s[k]; });
      it.seeded = true;
      it.createdAt = now - (s.agoMin || 0) * 60000;
      /* 种子数据没写"拾取/丢失时间"，用发布时间兜底，详情页才不会显示成一横杠 */
      if (!it.timeText) it.timeText = UTILS.formatDateTime(it.createdAt);
      delete it.agoMin;
      return it;
    });
  }

  function anchorSeeded(items, now) {
    return items.map(function (it) {
      if (it && it.seeded && typeof it.agoMin === 'number') {
        it.createdAt = now - it.agoMin * 60000;
        if (!it.timeText) it.timeText = UTILS.formatDateTime(it.createdAt);
      }
      return it;
    });
  }

  var state = { items: [], favs: {} };
  var listeners = [];

  function emit() {
    listeners.slice().forEach(function (fn) {
      try { fn(state); } catch (e) { /* 单个订阅者出错不影响其他 */ }
    });
  }

  function persist() {
    /* 种子项存 agoMin（而不是 createdAt），下次加载时重新锚定 */
    var out = state.items.map(function (it) {
      var c = {};
      Object.keys(it).forEach(function (k) { c[k] = it[k]; });
      if (c.seeded) {
        c.agoMin = Math.round((Date.now() - c.createdAt) / 60000);
      }
      return c;
    });
    writeJSON(KEY_ITEMS, out);
    writeJSON(KEY_FAVS, state.favs);
  }

  /* ---------------------------------------------------------------- API */

  function init() {
    var now = Date.now();
    var saved = readJSON(KEY_ITEMS, null);
    if (saved && saved.length) {
      state.items = anchorSeeded(saved, now);
    } else {
      state.items = buildSeed(now);
    }
    state.favs = readJSON(KEY_FAVS, {}) || {};
    emit();
    return state;
  }

  function all() { return state.items.slice(); }
  function get(id) {
    return state.items.filter(function (it) { return it.id === id; })[0] || null;
  }
  function count() { return state.items.length; }

  /** 新增一条发布。payload 需要 title/cat/place/timeText/contact/desc/type */
  function add(payload) {
    var now = Date.now();
    var item = {
      id: UTILS.nextId(state.items),
      type: payload.type === 'lost' ? 'lost' : 'found',
      title: UTILS.trim(payload.title),
      cat: UTILS.trim(payload.cat),
      area: UTILS.areaOfPlace(payload.place),
      place: UTILS.trim(payload.place),
      timeText: UTILS.trim(payload.timeText),
      contact: UTILS.trim(payload.contact),
      desc: UTILS.trim(payload.desc),
      images: (payload.images || []).slice(0, 3),
      status: 'open',
      owner: true,
      seeded: false,
      createdAt: now
    };
    state.items.unshift(item);
    persist(); emit();
    return item;
  }

  function setStatus(id, status) {
    var it = get(id);
    if (!it) return null;
    it.status = status === 'done' ? 'done' : 'open';
    persist(); emit();
    return it;
  }

  function toggleStatus(id) {
    var it = get(id);
    if (!it) return null;
    return setStatus(id, it.status === 'done' ? 'open' : 'done');
  }

  function remove(id) {
    var before = state.items.length;
    state.items = state.items.filter(function (it) { return it.id !== id; });
    if (state.items.length !== before) { persist(); emit(); return true; }
    return false;
  }

  /* ---- 收藏（本地功能，属于"附加特点"）---- */
  function isFav(id) { return !!state.favs[id]; }
  function toggleFav(id) {
    if (state.favs[id]) delete state.favs[id];
    else state.favs[id] = 1;
    persist(); emit();
    return isFav(id);
  }
  function favIds() { return Object.keys(state.favs); }

  /** 恢复初始示例数据（对应"我的发布"页里的重置按钮） */
  function reset() {
    state.items = buildSeed(Date.now());
    state.favs = {};
    persist(); emit();
    return state;
  }

  function subscribe(fn) {
    listeners.push(fn);
    return function () {
      listeners = listeners.filter(function (f) { return f !== fn; });
    };
  }

  return {
    init: init,
    all: all,
    get: get,
    count: count,
    add: add,
    setStatus: setStatus,
    toggleStatus: toggleStatus,
    remove: remove,
    isFav: isFav,
    toggleFav: toggleFav,
    favIds: favIds,
    reset: reset,
    subscribe: subscribe,
    storageUsable: function () { return usable; },
    /* 供测试使用 */
    _keys: { items: KEY_ITEMS, favs: KEY_FAVS }
  };
});
