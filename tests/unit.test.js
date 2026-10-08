/* ==========================================================================
   unit.test.js —— 单元测试用例
   用最朴素的方式写：一个 assert + 一个 it()，不依赖任何第三方框架。
   好处是 —— 同一份文件既能被 Node 跑，也能被浏览器直接跑（tests/tests.html）。

   运行方式（二选一）：
     ① 命令行：node tests/unit.test.js
     ② 浏览器：双击打开 tests/tests.html
   ========================================================================== */
(function (root, factory) {
  var isNode = (typeof module !== 'undefined' && module.exports);
  var DATA  = isNode ? require('../js/data.js')  : root.LFData;
  var UTILS = isNode ? require('../js/utils.js') : root.LFUtils;
  var UI    = isNode ? require('../js/ui.js')    : root.LFUI;
  var api = factory(DATA, UTILS, UI);
  if (isNode) module.exports = api;
  else root.LFTests = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (DATA, UTILS, UI) {

  /* ------------------------------------------------------------ 迷你测试框架 */

  var results = [];

  function AssertionError(msg) {
    var e = new Error(msg);
    e.name = 'AssertionError';
    return e;
  }

  function ok(cond, msg) {
    if (!cond) throw AssertionError(msg || '期望为真，实际为假');
  }

  function eq(actual, expected, msg) {
    if (actual !== expected) {
      throw AssertionError((msg || '值不相等') + '：期望 ' + JSON.stringify(expected)
        + '，实际 ' + JSON.stringify(actual));
    }
  }

  function deepEq(actual, expected, msg) {
    var a = JSON.stringify(actual), b = JSON.stringify(expected);
    if (a !== b) {
      throw AssertionError((msg || '结构不相等') + '：期望 ' + b + '，实际 ' + a);
    }
  }

  function it(name, fn) {
    try {
      fn();
      results.push({ name: name, ok: true });
    } catch (e) {
      results.push({ name: name, ok: false, msg: e.message, stack: e.stack });
    }
  }

  /** 每个用例自带一个"分组名"，方便在报告里归类 */
  var group = '';
  function describe(name, fn) { group = name; fn(); group = ''; }
  function title(name) { return group ? '[' + group + '] ' + name : name; }

  /* ------------------------------------------------------------ 测试数据工厂 */

  var DAY = 86400000, HOUR = 3600000;

  /** 固定一个基准时间，让时间相关的断言可复现 */
  var NOW = new Date(2026, 9, 7, 20, 0, 0).getTime();   // 2026-10-07 20:00

  function mk(o) {
    return Object.assign({
      id: 'LF9001', type: 'found', cat: '证件卡类', area: '教学楼',
      title: '校园卡（蓝色卡套）', place: '第一教学楼 A302',
      timeText: '2026-10-07 09:00', contact: '13800138000',
      desc: '在教室捡到的', images: [], status: 'open', owner: false,
      createdAt: NOW - 1 * HOUR
    }, o || {});
  }

  var FIXTURE = [
    mk({ id: 'LF9001', title: '校园卡（蓝色卡套）', cat: '证件卡类', area: '教学楼',
         place: '第一教学楼 A302', createdAt: NOW - 1 * HOUR }),
    mk({ id: 'LF9002', title: '黑色长柄雨伞', cat: '雨伞', area: '图书馆',
         place: '图书馆三楼', type: 'found', createdAt: NOW - 20 * HOUR }),
    mk({ id: 'LF9003', title: '白色 AirPods 耳机盒', cat: '电子设备', area: '食堂',
         place: '第二食堂二楼', type: 'lost', createdAt: NOW - 2 * DAY }),
    mk({ id: 'LF9004', title: '蓝色保温杯', cat: '水杯', area: '运动场',
         place: '田径场看台', type: 'lost', status: 'done', createdAt: NOW - 6 * DAY }),
    mk({ id: 'LF9005', title: '宿舍钥匙（挂小熊挂件）', cat: '钥匙', area: '宿舍楼',
         place: '5 号宿舍楼 3 层', type: 'lost', owner: true, createdAt: NOW - 3 * HOUR })
  ];

  function ids(list) { return list.map(function (x) { return x.id; }); }

  /* ============================================================ 关键词与搜索 */

  describe('关键词解析', function () {

    it(title('按空白切分、转小写、去掉空项'), function () {
      deepEq(UTILS.parseKeywords('  校园卡   Blue '), ['校园卡', 'blue']);
    });

    it(title('重复关键词只保留一次，且保持出现顺序'), function () {
      deepEq(UTILS.parseKeywords('卡 卡 校园 卡'), ['卡', '校园']);
    });

    it(title('空输入 / null / undefined 都返回空数组，不报错'), function () {
      deepEq(UTILS.parseKeywords(''), []);
      deepEq(UTILS.parseKeywords('    '), []);
      deepEq(UTILS.parseKeywords(null), []);
      deepEq(UTILS.parseKeywords(undefined), []);
    });

    it(title('多关键词是 AND 关系：全中才算命中'), function () {
      ok(UTILS.matchAll('校园卡 蓝色卡套', ['校园卡', '蓝色']), '两个词都命中应通过');
      ok(!UTILS.matchAll('校园卡 蓝色卡套', ['校园卡', '雨伞']), '有一个词不中应不通过');
      ok(UTILS.matchAll('任意文本', []), '空关键词应视为命中');
    });
  });

  describe('筛选 filterItems', function () {

    it(title('按标题关键词筛选，且大小写不敏感'), function () {
      eq(ids(UTILS.filterItems(FIXTURE, { q: '校园卡' })).length, 1);
      eq(ids(UTILS.filterItems(FIXTURE, { q: 'AIRPODS' }))[0], 'LF9003');
      eq(ids(UTILS.filterItems(FIXTURE, { q: 'airpods' }))[0], 'LF9003');
    });

    it(title('关键词能同时搜到"分类""地点""描述"里的文字'), function () {
      eq(ids(UTILS.filterItems(FIXTURE, { q: '雨伞' }))[0], 'LF9002');       // 标题 + 分类
      eq(ids(UTILS.filterItems(FIXTURE, { q: '食堂' }))[0], 'LF9003');       // 地点
      eq(UTILS.filterItems(FIXTURE, { q: '捡到' }).length, 5);               // 描述（5 条的描述里都有"捡到"）
    });

    it(title('无命中时返回空数组，而不是报错或返回全部'), function () {
      deepEq(UTILS.filterItems(FIXTURE, { q: '不存在的物品xyz' }), []);
    });

    it(title('按类型筛选：found 只出招领，lost 只出寻物'), function () {
      var found = UTILS.filterItems(FIXTURE, { type: 'found' });
      ok(found.every(function (x) { return x.type === 'found'; }), 'found 结果里混进了 lost');
      eq(found.length, 2);
      eq(UTILS.filterItems(FIXTURE, { type: 'lost' }).length, 3);
      eq(UTILS.filterItems(FIXTURE, { type: 'all' }).length, 5);
    });

    it(title('按分类筛选；"全部"等于不筛选'), function () {
      deepEq(ids(UTILS.filterItems(FIXTURE, { cat: '水杯' })), ['LF9004']);
      eq(UTILS.filterItems(FIXTURE, { cat: '全部' }).length, 5);
    });

    it(title('按区域筛选；"全部"等于不筛选'), function () {
      deepEq(ids(UTILS.filterItems(FIXTURE, { area: '食堂' })), ['LF9003']);
      eq(UTILS.filterItems(FIXTURE, { area: '全部' }).length, 5);
    });

    it(title('按时间片筛选（24 小时 / 三天 / 一周），边界按"距今多久"算'), function () {
      // NOW-1h、NOW-3h 在 24 小时内；NOW-20h 也在里面 ⇒ 共 3 条
      eq(UTILS.filterItems(FIXTURE, { range: 'h24', now: NOW }).length, 3);
      // 再加 NOW-2天 ⇒ 4 条
      eq(UTILS.filterItems(FIXTURE, { range: 'd3', now: NOW }).length, 4);
      // 再加 NOW-6天 ⇒ 5 条
      eq(UTILS.filterItems(FIXTURE, { range: 'd7', now: NOW }).length, 5);
      eq(UTILS.filterItems(FIXTURE, { range: 'all', now: NOW }).length, 5);
    });

    it(title('按状态筛选：首页只看待处理，已完成的不出现'), function () {
      var open = UTILS.filterItems(FIXTURE, { status: 'open' });
      ok(open.every(function (x) { return x.status === 'open'; }), '结果里混进了已完成项');
      eq(open.length, 4);
      deepEq(ids(UTILS.filterItems(FIXTURE, { status: 'done' })), ['LF9004']);
    });

    it(title('只看我发布的（mineOnly）'), function () {
      deepEq(ids(UTILS.filterItems(FIXTURE, { mineOnly: true })), ['LF9005']);
    });

    it(title('多个条件叠加时取交集'), function () {
      var r = UTILS.filterItems(FIXTURE, { type: 'lost', area: '食堂', q: '耳机' });
      deepEq(ids(r), ['LF9003']);
      // 条件互相矛盾时应当为空
      eq(UTILS.filterItems(FIXTURE, { type: 'found', area: '食堂' }).length, 0);
    });

    it(title('排序：new 最新在前、old 最早在前、status 待处理优先'), function () {
      deepEq(ids(UTILS.filterItems(FIXTURE, { sort: 'new' })),
        ['LF9001', 'LF9005', 'LF9002', 'LF9003', 'LF9004']);
      deepEq(ids(UTILS.filterItems(FIXTURE, { sort: 'old' })),
        ['LF9004', 'LF9003', 'LF9002', 'LF9005', 'LF9001']);
      // done 的 LF9004 应当被排到最后
      deepEq(ids(UTILS.filterItems(FIXTURE, { sort: 'status' })).indexOf('LF9004'), 4);
    });

    it(title('筛选不会修改传入的原数组（纯函数）'), function () {
      var copy = JSON.parse(JSON.stringify(FIXTURE));
      UTILS.filterItems(FIXTURE, { q: '校园卡', sort: 'old' });
      deepEq(FIXTURE, copy, '调用筛选后原数组被改动了');
    });

    it(title('空数组 / null 输入不会崩'), function () {
      deepEq(UTILS.filterItems([], { q: 'a' }), []);
      deepEq(UTILS.filterItems(null, { q: 'a' }), []);
    });
  });

  /* ============================================================ 高亮与转义 */

  describe('高亮与 HTML 安全', function () {

    it(title('escapeHtml 转义五个危险字符'), function () {
      eq(UTILS.escapeHtml('<a href="x" & \'y\'>'), '&lt;a href=&quot;x&quot; &amp; &#39;y&#39;&gt;');
    });

    it(title('高亮命中关键词并包上 <mark>'), function () {
      eq(UTILS.highlight('校园卡（蓝色卡套）', '校园卡'), '<mark>校园卡</mark>（蓝色卡套）');
      eq(UTILS.highlight('abcABC', 'b'), 'a<mark>b</mark>cA<mark>B</mark>C');   // 大小写都会高亮
      eq(UTILS.highlight('校园卡（蓝色卡套）校园', '校园'), '<mark>校园</mark>卡（蓝色卡套）<mark>校园</mark>');
    });

    it(title('高亮时用户输入里的 HTML 会被转义，不会当成标签执行'), function () {
      var out = UTILS.highlight('<img src=x onerror=alert(1)>', 'img');
      eq(out.indexOf('<img'), -1, '原始 <img 标签泄漏到输出里了');
      eq(out.indexOf('onerror=alert(1)') > -1, true, '其余文本应当原样保留（只是被转义）');
      eq(out.slice(0, 4), '&lt;', '开头的尖括号应当被转义成 &lt;');
      eq(out.indexOf('<mark>img</mark>') > -1, true, '关键词没有被高亮');
    });

    it(title('搜索词里含正则特殊字符也不会抛错'), function () {
      eq(UTILS.highlight('价格 12.5 元 (含税)', '12.5'), '价格 <mark>12.5</mark> 元 (含税)');
      eq(UTILS.highlight('a+b', '+'), 'a<mark>+</mark>b');
    });

    it(title('无关键词时只做转义，不产生 <mark>'), function () {
      eq(UTILS.highlight('<b>x</b>', ''), '&lt;b&gt;x&lt;/b&gt;');
    });
  });

  /* ============================================================ 表单校验 */

  describe('发布表单校验 validatePublish', function () {

    var GOOD = {
      type: 'found', title: '校园卡（蓝色卡套）', cat: '证件卡类',
      place: '第一教学楼 A302', timeText: '2026-10-07 09:00',
      contact: '13800138000', desc: '在教室最后一排捡到的'
    };

    it(title('完整合法数据通过校验'), function () {
      var r = UTILS.validatePublish(GOOD);
      eq(r.ok, true, '合法数据被判为不合法：' + JSON.stringify(r.errors));
      deepEq(r.errors, {});
    });

    it(title('全部留空时应逐项报错，且 ok=false'), function () {
      var r = UTILS.validatePublish({});
      eq(r.ok, false);
      ok(r.errors.title && r.errors.cat && r.errors.place, '缺少必填项的错误提示');
      ok(r.errors.timeText && r.errors.contact, '时间和联系方式应当必填');
    });

    it(title('物品名称：至少 2 个字、最多 30 个字'), function () {
      eq(UTILS.validatePublish(Object.assign({}, GOOD, { title: '卡' })).errors.title,
        '物品名称至少 2 个字');
      eq(UTILS.validatePublish(Object.assign({}, GOOD, { title: '卡'.repeat(31) })).errors.title,
        '物品名称不要超过 30 个字');
      eq(UTILS.validatePublish(Object.assign({}, GOOD, { title: ' 校园卡 ' })).ok, true);
    });

    it(title('物品分类必须在预设范围内，不允许自己编一个'), function () {
      eq(UTILS.validatePublish(Object.assign({}, GOOD, { cat: '外星科技' })).errors.cat,
        '物品分类不在可选范围内');
      DATA.CATEGORIES.forEach(function (c) {
        ok(UTILS.validatePublish(Object.assign({}, GOOD, { cat: c.key })).ok,
          '预设分类被拒：' + c.key);
      });
    });

    it(title('地点过短、描述超过 200 字都会被拦下'), function () {
      eq(UTILS.validatePublish(Object.assign({}, GOOD, { place: 'A' })).errors.place, '地点至少 2 个字');
      ok(UTILS.validatePublish(Object.assign({}, GOOD, { desc: '啊'.repeat(201) })).errors.desc);
      eq(UTILS.validatePublish(Object.assign({}, GOOD, { desc: '啊'.repeat(200) })).ok, true);
    });

    it(title('联系方式接受手机号 / 邮箱 / 微信号三种'), function () {
      ['13800138000', '15912345678', '2035@qq.com', 'lin@fzu.edu.cn', 'wei_xin_2024', 'abc123456']
        .forEach(function (c) {
          ok(UTILS.isValidContact(c), c + ' 应被判为合法联系方式');
        });
    });

    it(title('联系方式拒绝明显非法的输入'), function () {
      ['', '   ', '12345', '12345678901', '12800138000', 'abc', 'a b@c.com', '@qq.com', 'user@']
        .forEach(function (c) {
          ok(!UTILS.isValidContact(c), c + ' 应被判为非法');
        });
      eq(UTILS.validatePublish(Object.assign({}, GOOD, { contact: '12345' })).errors.contact,
        '请填写正确的手机号 / 邮箱 / 微信号');
    });

    it(title('能识别出用户填的是哪种联系方式，用于即时提示'), function () {
      eq(UTILS.contactKind('13800138000'), '手机号');
      eq(UTILS.contactKind('lin@fzu.edu.cn'), '邮箱');
      eq(UTILS.contactKind('wei_xin_2024'), '微信号');
      eq(UTILS.contactKind('???'), '未知');
    });

    it(title('长度按"字符数"算，emoji 和中文都只算 1 个'), function () {
      eq(UTILS.charLen('校园卡'), 3);
      eq(UTILS.charLen('🎒🎒'), 2);
      eq(UTILS.charLen(''), 0);
      eq(UTILS.charLen(null), 0);
    });
  });

  /* ============================================================ 时间与统计 */

  describe('时间格式化', function () {

    it(title('一分钟内显示"刚刚"，一小时内显示"n 分钟前"'), function () {
      eq(UTILS.formatRelativeTime(NOW - 30 * 1000, NOW), '刚刚');
      eq(UTILS.formatRelativeTime(NOW - 5 * 60000, NOW), '5 分钟前');
      eq(UTILS.formatRelativeTime(NOW - 59 * 60000, NOW), '59 分钟前');
    });

    it(title('当天显示"今天 HH:mm"，昨天显示"昨天 HH:mm"'), function () {
      var today9 = new Date(2026, 9, 7, 9, 20).getTime();
      var yest1840 = new Date(2026, 9, 6, 18, 40).getTime();
      eq(UTILS.formatRelativeTime(today9, NOW), '今天 09:20');
      eq(UTILS.formatRelativeTime(yest1840, NOW), '昨天 18:40');
    });

    it(title('更早的同年日期显示 MM-DD，跨年补上年份'), function () {
      eq(UTILS.formatRelativeTime(new Date(2026, 9, 1, 8, 0).getTime(), NOW), '10-01');
      eq(UTILS.formatRelativeTime(new Date(2025, 11, 31, 8, 0).getTime(), NOW), '2025-12-31');
    });

    it(title('未来时间（时钟偏差）不会出现负数时间'), function () {
      eq(UTILS.formatRelativeTime(NOW + 10 * 60000, NOW), '刚刚');
    });

    it(title('完整时间格式 YYYY-MM-DD HH:mm 补零正确'), function () {
      eq(UTILS.formatDateTime(new Date(2026, 0, 5, 8, 7).getTime()), '2026-01-05 08:07');
      eq(UTILS.formatDateTime(new Date(2026, 11, 31, 23, 59).getTime()), '2026-12-31 23:59');
    });
  });

  describe('业务小工具', function () {

    it(title('由地点文字推断区域，让"地点筛选"能命中'), function () {
      eq(UTILS.areaOfPlace('第一教学楼 A302'), '教学楼');
      eq(UTILS.areaOfPlace('图书馆三楼自习区'), '图书馆');
      eq(UTILS.areaOfPlace('第二食堂二楼'), '食堂');
      eq(UTILS.areaOfPlace('5 号宿舍楼 3 层'), '宿舍楼');
      eq(UTILS.areaOfPlace('田径场看台'), '运动场');
      eq(UTILS.areaOfPlace('三坊七巷'), '其他');
      eq(UTILS.areaOfPlace(''), '其他');
    });

    it(title('统计总数 / 待处理 / 已完成'), function () {
      deepEq(UTILS.statsOf(FIXTURE), { total: 5, open: 4, done: 1 });
      deepEq(UTILS.statsOf([]), { total: 0, open: 0, done: 0 });
    });

    it(title('toggleStatus 返回新对象，不改原对象'), function () {
      var a = mk({ status: 'open' });
      var b = UTILS.toggleStatus(a);
      eq(a.status, 'open', '原对象被改动了');
      eq(b.status, 'done');
      eq(UTILS.toggleStatus(b).status, 'open');
    });

    it(title('状态文案随类型变化：招领=待认领/已归还，寻物=寻找中/已找到'), function () {
      eq(UTILS.statusLabel({ type: 'found', status: 'open' }), '待认领');
      eq(UTILS.statusLabel({ type: 'found', status: 'done' }), '已归还');
      eq(UTILS.statusLabel({ type: 'lost', status: 'open' }), '寻找中');
      eq(UTILS.statusLabel({ type: 'lost', status: 'done' }), '已找到');
    });

    it(title('新编号 = 现有最大编号 +1，删掉中间项也不会重号'), function () {
      eq(UTILS.nextId([]), 'LF1001');
      eq(UTILS.nextId(FIXTURE), 'LF9006');
      eq(UTILS.nextId([{ id: 'LF1001' }, { id: 'LF1009' }, { id: 'LF1003' }]), 'LF1010');
      eq(UTILS.nextId([{ id: 'X' }]), 'LF1001');
    });

    it(title('别人的联系方式在详情页打码显示'), function () {
      eq(UI.maskContact('13800138000'), '138****8000');
      eq(UI.maskContact('lin@fzu.edu.cn'), 'li***@fzu.edu.cn');
      eq(UI.maskContact('wei_xin_2024'), 'we****');
    });

    it(title('长文本截断：短的不动，长的加省略号'), function () {
      eq(UTILS.truncate('校园卡', 10), '校园卡');
      eq(UTILS.truncate('一二三四五', 3), '一二三…');
    });
  });

  /* ============================================================ 视图渲染冒烟测试
     目的：视图层是"拼字符串"，最容易犯的错是拼接时手滑多写一个 + 号（变成一元加号 ⇒ NaN），
     或者字段名写错（⇒ undefined）、把对象直接拼进字符串（⇒ [object Object]）。
     这类错误不抛异常，只能靠扫产物发现 —— 所以这里把每个视图都渲染一遍再检查。 */

  describe('视图渲染冒烟测试', function () {

    var state = { items: FIXTURE, favs: {} };

    var VIEWS = [
      ['首页',          function () { return UI.viewHome(state, { q: '' }); }],
      ['搜索页',        function () { return UI.viewSearch(state, { q: '校园卡', type: 'all' }); }],
      ['发布页·招领',   function () { return UI.viewPublish(state, {}, 'found'); }],
      ['发布页·寻物',   function () { return UI.viewPublish(state, {}, 'lost'); }],
      ['发布成功页',    function () { return UI.viewSuccess(state, { kind: 'lost' }); }],
      ['信息详情页',    function () { return UI.viewDetail(state, { id: 'LF9001' }); }],
      ['我的发布页',    function () { return UI.viewMine(state, { mode: 'all' }); }],
      ['底部导航',      function () { return UI.tabbar('home'); }]
    ];

    VIEWS.forEach(function (v) {
      it(title(v[0] + ' 的 HTML 里不出现 NaN / undefined / [object Object]'), function () {
        var html = v[1]();
        eq(html.indexOf('NaN'), -1, '出现了 NaN —— 拼接时多半多写了一个 + 号');
        eq(html.indexOf('undefined'), -1, '出现了 undefined —— 多半是字段名写错');
        eq(html.indexOf('[object Object]'), -1, '对象被直接拼进了字符串');
        ok(html.length > 80, '渲染结果过短，视图可能没正常产出');
      });
    });

    it(title('成功页按招领 / 寻物给出不同的状态文案'), function () {
      ok(UI.viewSuccess(state, { kind: 'lost' }).indexOf('已找到') > -1, '寻物应提示"已找到"');
      ok(UI.viewSuccess(state, { kind: 'found' }).indexOf('已归还') > -1, '招领应提示"已归还"');
    });

    it(title('详情页：自己的信息显示完整联系方式，别人的打码'), function () {
      var mineHtml = UI.viewDetail(
        { items: [mk({ id: 'LF9005', owner: true, contact: '13800138000' })], favs: {} }, { id: 'LF9005' });
      ok(mineHtml.indexOf('13800138000') > -1, '自己的信息应当显示完整联系方式');
      eq(mineHtml.indexOf('138****8000'), -1, '自己的信息不该被打码');

      var otherHtml = UI.viewDetail(
        { items: [mk({ id: 'LF9001', owner: false, contact: '13800138000' })], favs: {} }, { id: 'LF9001' });
      ok(otherHtml.indexOf('138****8000') > -1, '别人的联系方式应当打码');
    });

    it(title('详情页：自己发布时给出状态操作按钮，别人发布时给复制按钮'), function () {
      var mineHtml = UI.viewDetail(
        { items: [mk({ id: 'LF9005', owner: true })], favs: {} }, { id: 'LF9005' });
      ok(mineHtml.indexOf('data-act="toggle-status"') > -1, '自己的信息应有状态操作按钮');
      eq(mineHtml.indexOf('data-act="copy-contact"'), -1, '自己的信息不需要复制按钮');

      var otherHtml = UI.viewDetail(
        { items: [mk({ id: 'LF9001', owner: false })], favs: {} }, { id: 'LF9001' });
      ok(otherHtml.indexOf('data-act="copy-contact"') > -1, '别人的信息应有一键复制按钮');
    });

    it(title('详情页 id 不存在时给出空状态而不是报错'), function () {
      var html = UI.viewDetail(state, { id: '不存在的编号' });
      ok(html.indexOf('这条信息不在了') > -1, '应当渲染"信息不存在"的空状态');
    });

    it(title('搜索无结果时给出引导，且带上发布寻物的入口'), function () {
      var html = UI.viewSearch(state, { q: '压根不存在的关键词zzz' });
      ok(html.indexOf('没找到你丢失的物品') > -1, '应当渲染空状态');
      ok(html.indexOf('#/publish/lost') > -1, '空状态里应当有发布寻物的入口');
    });

    it(title('首页的搜索入口是整条可点的链接，而不是只有"搜索"两个字能点'), function () {
      var html = UI.viewHome(state, { q: '' });
      ok(html.indexOf('<a class="searchbox" href="#/search"') > -1,
        '首页搜索入口应当是一个链接（整条区域都可点）');
      eq(html.indexOf('<form class="searchbox"'), -1, '首页不该再放可输入的 form');
      ok(html.indexOf('class="ph"') > -1, '首页应当用占位文字，真正的输入框留给搜索页');
    });

    it(title('搜索页仍然是真正的输入框，可以直接打字'), function () {
      var html = UI.viewSearch(state, { q: '' });
      ok(html.indexOf('<input type="text" name="q"') > -1, '搜索页必须有可输入的输入框');
    });

    it(title('用户输入的内容会被转义后再放进 HTML（视图层防注入）'), function () {
      var evil = '<img src=x onerror=alert(1)>';
      var html = UI.viewDetail(
        { items: [mk({ id: 'LF9001', title: evil, desc: evil, place: evil })], favs: {} }, { id: 'LF9001' });
      eq(html.indexOf('<img src=x'), -1, '注入的标签原样出现在 HTML 里了');
      ok(html.indexOf('&lt;img src=x') > -1, '应当以转义形式出现');
    });
  });

  /* ============================================================ 返回栈 */

  describe('返回栈 pushRoute（左上角返回要逐级退，不能每次都弹回首页）', function () {

    var HOME = '#/home', SEARCH = '#/search', DETAIL = '#/detail/LF1001';

    it(title('访问新页面时入栈，栈顶永远是当前页'), function () {
      deepEq(UTILS.pushRoute([], HOME), [HOME]);
      deepEq(UTILS.pushRoute([HOME], SEARCH), [HOME, SEARCH]);
      deepEq(UTILS.pushRoute([HOME, SEARCH], DETAIL), [HOME, SEARCH, DETAIL]);
    });

    it(title('同一页面重复渲染（比如切换收藏后重画）不会重复入栈'), function () {
      deepEq(UTILS.pushRoute([HOME, SEARCH], SEARCH), [HOME, SEARCH]);
    });

    it(title('按浏览器后退键时同步出栈，栈不会错乱'), function () {
      deepEq(UTILS.pushRoute([HOME, SEARCH, DETAIL], SEARCH), [HOME, SEARCH]);
      deepEq(UTILS.pushRoute([HOME, SEARCH], HOME), [HOME]);
    });

    it(title('跳到访问过的更早页面时，把它后面的记录截断'), function () {
      // 首页 → 搜索 → 详情，然后点底部「首页」Tab
      deepEq(UTILS.pushRoute([HOME, SEARCH, DETAIL], HOME), [HOME]);
      // 首页 → 搜索 → 我的 → 搜索
      deepEq(UTILS.pushRoute([HOME, SEARCH, '#/mine'], SEARCH), [HOME, SEARCH]);
    });

    it(title('同一个页面的参数变化算原地更新，不新增一层（改筛选不该越退越多）'), function () {
      // 在搜索页里换关键词、切换筛选，都不该占一层
      deepEq(UTILS.pushRoute([HOME, SEARCH], '#/search?q=校园卡'), [HOME, '#/search?q=校园卡']);
      deepEq(UTILS.pushRoute([HOME, '#/search?q=校园卡'], '#/search?q=校园卡&type=lost'),
        [HOME, '#/search?q=校园卡&type=lost']);
      // 首页切分类同理
      deepEq(UTILS.pushRoute([HOME], '#/home?cat=钥匙'), ['#/home?cat=钥匙']);
      // 我的发布切分段同理
      deepEq(UTILS.pushRoute([HOME, '#/mine'], '#/mine?mode=done'), [HOME, '#/mine?mode=done']);
    });

    it(title('不同页面之间仍然各占一层'), function () {
      deepEq(UTILS.pushRoute([HOME, '#/search'], '#/detail/LF1001'),
        [HOME, '#/search', '#/detail/LF1001']);
    });

    it(title('空值 / undefined 不会把坏数据塞进栈'), function () {
      deepEq(UTILS.pushRoute([HOME], ''), [HOME]);
      deepEq(UTILS.pushRoute([HOME], null), [HOME]);
      deepEq(UTILS.pushRoute(null, HOME), [HOME]);
    });

    it(title('pushRoute 不修改传入的原数组（纯函数）'), function () {
      var origin = [HOME, SEARCH];
      var copy = origin.slice();
      UTILS.pushRoute(origin, DETAIL);
      deepEq(origin, copy, '原数组被改动了');
    });

    it(title('backTarget / popRoute 配套使用：先取目标再出栈'), function () {
      var stack = [HOME, SEARCH, DETAIL];
      eq(UTILS.backTarget(stack), SEARCH);
      var after = UTILS.popRoute(stack);
      deepEq(after, [HOME, SEARCH]);
      eq(UTILS.backTarget(after), HOME);
      deepEq(UTILS.popRoute(after), [HOME]);
      eq(UTILS.backTarget([HOME]), null, '只剩一层时应返回 null（表示没有上一级）');
    });

    it(title('完整场景：首页 → 搜索 → 详情，连点两次返回应当逐级退回首页'), function () {
      var stack = [];
      stack = UTILS.pushRoute(stack, HOME);        // 打开首页
      stack = UTILS.pushRoute(stack, SEARCH);      // 点搜索入口
      stack = UTILS.pushRoute(stack, DETAIL);      // 点一张卡片

      eq(UTILS.backTarget(stack), SEARCH, '第一次返回应当回到搜索页，而不是首页');
      stack = UTILS.popRoute(stack);
      eq(UTILS.backTarget(stack), HOME, '第二次返回应当回到首页');
      stack = UTILS.popRoute(stack);
      eq(UTILS.backTarget(stack), null, '第三次没有再上一级了');
    });

    it(title('完整场景：首页 → 发布页 → 成功页，返回能退回发布页再退首页'), function () {
      var stack = [];
      stack = UTILS.pushRoute(stack, HOME);
      stack = UTILS.pushRoute(stack, '#/publish/lost');
      stack = UTILS.pushRoute(stack, '#/success?kind=lost');
      eq(UTILS.backTarget(stack), '#/publish/lost', '从成功页返回应回到发布页');
      stack = UTILS.popRoute(stack);
      eq(UTILS.backTarget(stack), HOME, '再返回应回到首页');
    });
  });

  /* ------------------------------------------------------------ 运行与报告 */

  function summary() {
    var pass = results.filter(function (r) { return r.ok; }).length;
    var fail = results.length - pass;
    return { total: results.length, pass: pass, fail: fail, results: results };
  }

  var s = summary();

  /* 报告：Node 打控制台；浏览器交给 tests.html 渲染 */
  if (typeof console !== 'undefined' && typeof document === 'undefined') {
    console.log('\n=== 校园失物招领 · 单元测试 ===\n');
    results.forEach(function (r, i) {
      console.log((r.ok ? '  ✓ ' : '  ✗ ') + (i + 1) + '. ' + r.name);
      if (!r.ok) console.log('      → ' + r.msg);
    });
    console.log('\n共 ' + s.total + ' 个用例：通过 ' + s.pass + '，失败 ' + s.fail);
    console.log(s.fail === 0 ? '✅ 全部通过\n' : '❌ 有失败用例\n');
  }

  return {
    results: results,
    summary: summary,
    ok: ok, eq: eq, deepEq: deepEq, it: it, describe: describe, title: title
  };
});
