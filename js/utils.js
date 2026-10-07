/* ==========================================================================
   utils.js —— 纯函数工具层
   设计原则：**不碰 DOM、不碰 localStorage**，输入什么就输出什么。
   这样同一份代码既能被浏览器加载，也能被 Node 直接 require 做单元测试。
   ========================================================================== */
(function (root, factory) {
  var DATA = (typeof module !== 'undefined' && module.exports)
    ? require('./data.js')
    : root.LFData;
  var api = factory(DATA);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LFUtils = api;
})(typeof self !== 'undefined' ? self : this, function (DATA) {

  var DAY = 86400000;
  var HOUR = 3600000;

  /* ---------------------------------------------------------------- 基础 */

  /** 去掉首尾空白；null / undefined 统一成空串 */
  function trim(s) {
    return String(s == null ? '' : s).trim();
  }

  /** 按"字符数"计算长度（用 Array.from，中文和 emoji 都算 1 个） */
  function charLen(s) {
    return Array.from(String(s == null ? '' : s)).length;
  }

  /** HTML 转义：所有要拼进 innerHTML 的用户输入必须过这一道，防 XSS 也防排版错乱 */
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** 转义正则元字符，供"关键词高亮"用 */
  function escapeReg(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /* ---------------------------------------------------------------- 搜索 */

  /**
   * 把用户输入拆成关键词数组。
   * 规则：按空白切分 → 转小写 → 去空 → 去重（保持出现顺序）。
   * 例："  校园卡  蓝色 " ⇒ ['校园卡','蓝色']
   */
  function parseKeywords(q) {
    var raw = trim(q).toLowerCase().split(/\s+/);
    var seen = {}, out = [];
    raw.forEach(function (k) {
      if (k && !seen[k]) { seen[k] = 1; out.push(k); }
    });
    return out;
  }

  /** 多个关键词全部命中才算匹配（AND 语义，空格越多结果越精确） */
  function matchAll(text, keywords) {
    var hay = String(text == null ? '' : text).toLowerCase();
    return (keywords || []).every(function (k) { return hay.indexOf(k) > -1; });
  }

  /** 一条信息里参与搜索的字段集合 */
  function itemHaystack(it) {
    if (!it) return '';
    return [it.title, it.cat, it.area, it.place, it.desc, it.contact, it.id]
      .filter(Boolean).join(' ');
  }

  /**
   * 在原文里高亮关键词：先按匹配位置切分原文，再对每一段做转义。
   * 这样 <mark> 标签不会被二次转义，也不会出现"标签被关键词命中"的问题。
   */
  function highlight(text, q) {
    var raw = String(text == null ? '' : text);
    var kws = parseKeywords(q);
    if (!kws.length) return escapeHtml(raw);

    var re = new RegExp(kws.map(escapeReg).join('|'), 'gi');
    var out = '', last = 0, m;
    while ((m = re.exec(raw)) !== null) {
      if (m[0] === '') { re.lastIndex++; continue; }   // 防御零宽匹配死循环
      out += escapeHtml(raw.slice(last, m.index)) + '<mark>' + escapeHtml(m[0]) + '</mark>';
      last = m.index + m[0].length;
    }
    out += escapeHtml(raw.slice(last));
    return out;
  }

  /* ---------------------------------------------------------------- 筛选 */

  function findRange(key) {
    var hit = DATA.TIME_RANGES.filter(function (r) { return r.key === key; })[0];
    return hit || DATA.TIME_RANGES[0];
  }

  /** 排序：new = 最新在前；old = 最早在前；status = 待处理在前、同状态按时间倒序 */
  function sortItems(items, sort) {
    var arr = (items || []).slice();
    if (sort === 'old') {
      arr.sort(function (a, b) { return a.createdAt - b.createdAt; });
    } else if (sort === 'status') {
      arr.sort(function (a, b) {
        if (a.status !== b.status) return a.status === 'open' ? -1 : 1;
        return b.createdAt - a.createdAt;
      });
    } else {
      arr.sort(function (a, b) { return b.createdAt - a.createdAt; });
    }
    return arr;
  }

  /**
   * 统一的筛选入口。opt 支持：
   *   q        关键词
   *   type     'all' | 'found' | 'lost'
   *   cat      '全部' | 分类 key
   *   area     '全部' | 区域
   *   status   'all' | 'open' | 'done'
   *   range    时间片 key（all / h24 / d3 / d7）
   *   mineOnly 只看我发布的
   *   sort     'new' | 'old' | 'status'
   *   now      基准时间戳（测试时注入固定值，保证结果可复现）
   */
  function filterItems(items, opt) {
    opt = opt || {};
    var kws = parseKeywords(opt.q);
    var now = opt.now == null ? Date.now() : opt.now;

    var res = (items || []).filter(function (it) {
      if (!it) return false;
      if (opt.type && opt.type !== 'all' && it.type !== opt.type) return false;
      if (opt.cat && opt.cat !== '全部' && it.cat !== opt.cat) return false;
      if (opt.area && opt.area !== '全部' && it.area !== opt.area) return false;
      if (opt.status && opt.status !== 'all' && it.status !== opt.status) return false;
      if (opt.mineOnly && !it.owner) return false;

      var range = findRange(opt.range);
      if (range.hours) {
        if (now - it.createdAt > range.hours * HOUR) return false;
      }
      if (kws.length && !matchAll(itemHaystack(it), kws)) return false;
      return true;
    });

    return sortItems(res, opt.sort);
  }

  /* ---------------------------------------------------------------- 时间 */

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  function sameDay(a, b) {
    var x = new Date(a), y = new Date(b);
    return x.getFullYear() === y.getFullYear()
      && x.getMonth() === y.getMonth()
      && x.getDate() === y.getDate();
  }

  function formatClock(ts) {
    var d = new Date(ts);
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  /** 完整日期时间：YYYY-MM-DD HH:mm（"拾取/丢失时间"这类字段用） */
  function formatDateTime(ts) {
    var d = new Date(ts == null ? Date.now() : ts);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate())
      + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  /**
   * 相对时间文案：
   *   < 1 分钟 → 刚刚      < 1 小时 → n 分钟前
   *   今天     → 今天 HH:mm
   *   昨天     → 昨天 HH:mm
   *   今年     → MM-DD
   *   更早     → YYYY-MM-DD
   */
  function formatRelativeTime(ts, now) {
    now = now == null ? Date.now() : now;
    var diff = now - ts;
    if (diff < 0) diff = 0;
    if (diff < 60000) return '刚刚';
    if (diff < HOUR) return Math.floor(diff / 60000) + ' 分钟前';
    if (sameDay(ts, now)) return '今天 ' + formatClock(ts);
    if (sameDay(ts, now - DAY)) return '昨天 ' + formatClock(ts);
    var d = new Date(ts), n = new Date(now);
    var md = pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
    return d.getFullYear() === n.getFullYear() ? md : d.getFullYear() + '-' + md;
  }

  /** 用于表单默认值：YYYY-MM-DDTHH:mm（datetime-local 要求的格式） */
  function toLocalInputValue(ts) {
    var d = new Date(ts == null ? Date.now() : ts);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate())
      + 'T' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  /* ---------------------------------------------------------------- 校验 */

  var RE_PHONE  = /^1[3-9]\d{9}$/;
  var RE_EMAIL  = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;
  var RE_WECHAT = /^[A-Za-z][-_A-Za-z0-9]{5,19}$/;

  function isValidPhone(s)  { return RE_PHONE.test(trim(s)); }
  function isValidEmail(s)  { return RE_EMAIL.test(trim(s)); }
  function isValidWechat(s) { return RE_WECHAT.test(trim(s)); }

  /** 联系方式：手机号 / 邮箱 / 微信号，三种任一即可 */
  function isValidContact(s) {
    var v = trim(s);
    return isValidPhone(v) || isValidEmail(v) || isValidWechat(v);
  }

  /** 联系方式的展示类型，用于提示用户"你填的是哪种" */
  function contactKind(s) {
    var v = trim(s);
    if (isValidPhone(v)) return '手机号';
    if (isValidEmail(v)) return '邮箱';
    if (isValidWechat(v)) return '微信号';
    return '未知';
  }

  var LIMITS = { title: 30, place: 40, desc: 200, contact: 40 };

  /**
   * 发布表单校验。返回 { ok, errors }，errors 以字段名为 key —— 便于"输入框下方即时提示"。
   * 只做纯数据判断，不关心界面上哪个框是红的。
   */
  function validatePublish(f) {
    f = f || {};
    var e = {};

    var title = trim(f.title);
    if (!title) e.title = '请填写物品名称';
    else if (charLen(title) < 2) e.title = '物品名称至少 2 个字';
    else if (charLen(title) > LIMITS.title) e.title = '物品名称不要超过 ' + LIMITS.title + ' 个字';

    if (!trim(f.cat)) e.cat = '请选择物品分类';
    else if (!DATA.CATEGORIES.some(function (c) { return c.key === trim(f.cat); })) {
      e.cat = '物品分类不在可选范围内';
    }

    var place = trim(f.place);
    if (!place) e.place = '请填写地点';
    else if (charLen(place) < 2) e.place = '地点至少 2 个字';
    else if (charLen(place) > LIMITS.place) e.place = '地点不要超过 ' + LIMITS.place + ' 个字';

    if (!trim(f.timeText)) e.timeText = '请选择时间';

    var contact = trim(f.contact);
    if (!contact) e.contact = '请填写联系方式';
    else if (charLen(contact) > LIMITS.contact) e.contact = '联系方式过长';
    else if (!isValidContact(contact)) e.contact = '请填写正确的手机号 / 邮箱 / 微信号';

    var desc = trim(f.desc);
    if (charLen(desc) > LIMITS.desc) e.desc = '详细描述不要超过 ' + LIMITS.desc + ' 个字';

    return { ok: Object.keys(e).length === 0, errors: e };
  }

  /* ---------------------------------------------------------------- 业务 */

  /** 由地点文字猜区域：发布时免去用户再选一次，也让筛选能命中 */
  function areaOfPlace(place) {
    var p = trim(place);
    if (!p) return '其他';
    if (/图书馆/.test(p)) return '图书馆';
    if (/食堂/.test(p)) return '食堂';
    if (/宿舍|号楼|公寓/.test(p)) return '宿舍楼';
    if (/田径场|运动场|操场|体育馆|球场/.test(p)) return '运动场';
    if (/教学楼|教室|实验楼|机房|楼/.test(p)) return '教学楼';
    return '其他';
  }

  /** 统计：总数 / 待处理 / 已完成 */
  function statsOf(items) {
    var s = { total: 0, open: 0, done: 0 };
    (items || []).forEach(function (it) {
      if (!it) return;
      s.total++;
      if (it.status === 'done') s.done++; else s.open++;
    });
    return s;
  }

  /** 翻转状态（返回新对象，不改原对象 —— 便于测试和"撤销"） */
  function toggleStatus(item) {
    var copy = {};
    Object.keys(item || {}).forEach(function (k) { copy[k] = item[k]; });
    copy.status = item.status === 'done' ? 'open' : 'done';
    return copy;
  }

  /** 生成下一个 id：取现有 LFxxxx 的最大值 +1，避免删除后重号 */
  function nextId(items) {
    var max = 1000;
    (items || []).forEach(function (it) {
      var m = /^LF(\d+)$/.exec(it && it.id ? it.id : '');
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    return 'LF' + (max + 1);
  }

  /** 状态标签文案：招领 → 待认领 / 已归还；寻物 → 寻找中 / 已找到 */
  function statusLabel(item) {
    if (!item) return '';
    if (item.type === 'found') return item.status === 'done' ? '已归还' : '待认领';
    return item.status === 'done' ? '已找到' : '寻找中';
  }

  /** 状态按钮上该显示的"动作"文案 */
  function actionLabel(item) {
    if (!item) return '';
    if (item.status === 'done') return '重新标记为待处理';
    return item.type === 'found' ? '我已归还，标记为已归还' : '我已找到，标记为已找到';
  }

  /** 按分类 key 取配色，取不到给"其他"的灰 */
  function catStyle(cat) {
    var hit = DATA.CATEGORIES.filter(function (c) { return c.key === cat; })[0];
    return hit || DATA.CATEGORIES[DATA.CATEGORIES.length - 1];
  }

  function typeMeta(type) {
    return DATA.TYPES.filter(function (t) { return t.key === type; })[0] || DATA.TYPES[0];
  }

  /** 截断长文本（列表里用，避免撑破卡片） */
  function truncate(s, n) {
    var arr = Array.from(String(s == null ? '' : s));
    return arr.length <= n ? arr.join('') : arr.slice(0, n).join('') + '…';
  }

  /* ---------------------------------------------------------------- 导航栈 */

  /**
   * 把一个新到达的路由并入「返回栈」。栈的最后一项永远是当前页面。
   * 这样左上角返回按钮就能逐级往回走，而不是每次都弹回首页。
   *
   * 五条规则（都写成纯函数，方便单测）：
   *   1. 与栈顶相同            → 原样返回（刷新当前页，比如切换收藏状态后重渲染）
   *   2. 正好是栈里倒数第二项  → 视为**浏览器后退**，出栈
   *   3. 同一个页面的参数变化  → **原地替换栈顶**（改筛选、换关键词、切分类都不该占一层，
   *                              否则在搜索页里筛两次再点返回，会一层层退筛选条件）
   *   4. 栈里出现过（更靠前）  → 截断回那一层（比如从详情页点底部「首页」Tab）
   *   5. 新页面                → 入栈
   *
   * @param {string[]} stack 现有栈
   * @param {string} hash    新到达的路由（形如 '#/detail/LF1001'、'#/search?q=校园卡'）
   * @returns {string[]} 新栈（不修改入参）
   */
  function routePath(hash) {
    return String(hash == null ? '' : hash).split('?')[0];
  }

  function pushRoute(stack, hash) {
    var s = (stack || []).slice();
    var h = String(hash == null ? '' : hash);
    if (!h) return s;

    var top = s[s.length - 1];
    if (top === h) return s;                                   // 规则 1

    if (s.length >= 2 && s[s.length - 2] === h) {              // 规则 2：浏览器后退
      s.pop();
      return s;
    }

    if (top && routePath(top) === routePath(h)) {              // 规则 3：原地更新
      s[s.length - 1] = h;
      return s;
    }

    var seen = s.indexOf(h);
    if (seen > -1) return s.slice(0, seen + 1);                // 规则 4：回到访问过的页面

    s.push(h);                                                 // 规则 5
    return s;
  }

  /**
   * 点返回按钮后该去哪。返回 null 表示"已经没有上一级了"。
   * 调用方拿到目标后把 location.hash 指过去即可（此时栈顶已经是目标）。
   */
  function backTarget(stack) {
    var s = stack || [];
    return s.length >= 2 ? s[s.length - 2] : null;
  }

  /** 出栈（配合 backTarget 使用：先算出目标，再出栈） */
  function popRoute(stack) {
    var s = (stack || []).slice();
    if (s.length > 1) s.pop();
    return s;
  }

  return {
    trim: trim,
    charLen: charLen,
    escapeHtml: escapeHtml,
    escapeReg: escapeReg,
    parseKeywords: parseKeywords,
    matchAll: matchAll,
    itemHaystack: itemHaystack,
    highlight: highlight,
    findRange: findRange,
    sortItems: sortItems,
    filterItems: filterItems,
    sameDay: sameDay,
    formatClock: formatClock,
    formatDateTime: formatDateTime,
    formatRelativeTime: formatRelativeTime,
    toLocalInputValue: toLocalInputValue,
    isValidPhone: isValidPhone,
    isValidEmail: isValidEmail,
    isValidWechat: isValidWechat,
    isValidContact: isValidContact,
    contactKind: contactKind,
    LIMITS: LIMITS,
    validatePublish: validatePublish,
    areaOfPlace: areaOfPlace,
    statsOf: statsOf,
    toggleStatus: toggleStatus,
    nextId: nextId,
    statusLabel: statusLabel,
    actionLabel: actionLabel,
    catStyle: catStyle,
    typeMeta: typeMeta,
    truncate: truncate,
    pushRoute: pushRoute,
    backTarget: backTarget,
    popRoute: popRoute
  };
});
