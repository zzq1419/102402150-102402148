/* ==========================================================================
   ui.js —— 视图层：把数据渲染成 HTML 字符串
   只负责"长什么样"，不负责"点了会怎样"（那部分在 app.js）。
   注意：底部导航不在这里拼进页面内容 —— 它由 app.js 单独挂到 #tabbar，
   这样它能固定在屏幕底部，而内容区 #view 独立滚动。
   所有用户输入一律走 utils.escapeHtml / utils.highlight，避免 XSS 和排版错乱。
   ========================================================================== */
(function (root, factory) {
  var DATA  = (typeof module !== 'undefined' && module.exports) ? require('./data.js')  : root.LFData;
  var UTILS = (typeof module !== 'undefined' && module.exports) ? require('./utils.js') : root.LFUtils;
  var api = factory(DATA, UTILS);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LFUI = api;
})(typeof self !== 'undefined' ? self : this, function (DATA, UTILS) {

  var E = UTILS.escapeHtml;

  /* ---------------------------------------------------------------- 基础片段 */

  function svg(inner, size, color, sw) {
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" '
      + 'stroke="' + color + '" stroke-width="' + (sw || 1.9) + '" '
      + 'stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>';
  }

  function icon(name, size, color, sw) {
    return svg(DATA.ICON[name] || '', size || 18, color || '#5A6169', sw);
  }

  function thumb(cat) {
    var st = UTILS.catStyle(cat);
    return '<div class="thumb" style="background:' + st.bg + ';color:' + st.fg + '">'
      + svg(DATA.CAT_ICON[cat] || DATA.CAT_ICON['其他'], 26, st.fg, 1.8) + '</div>';
  }

  function pillType(type) {
    var tm = UTILS.typeMeta(type);
    return '<span class="pill ' + tm.key + '">' + tm.label + '</span>';
  }

  function cardItem(it, q, showOwner) {
    var done = it.status === 'done';
    return '<a class="card' + (done ? ' is-done' : '') + '" href="#/detail/' + E(it.id) + '">'
      + thumb(it.cat)
      + '<div class="card-main">'
      +   '<div class="card-title">' + UTILS.highlight(it.title, q) + '</div>'
      +   '<div class="card-tags">'
      +     pillType(it.type)
      +     '<span class="pill">' + UTILS.highlight(it.cat, q) + '</span>'
      +     (done ? '<span class="pill done">' + UTILS.statusLabel(it) + '</span>' : '')
      +     (showOwner && it.owner ? '<span class="pill done">我发布的</span>' : '')
      +   '</div>'
      +   '<div class="card-meta">' + icon('pin', 13, '#9AA1AA', 1.8)
      +     '<span>' + UTILS.highlight(it.place, q) + '</span>'
      +     '<span>·</span><span>' + UTILS.formatRelativeTime(it.createdAt) + '</span>'
      +   '</div>'
      + '</div>'
      + '<div style="align-self:center;flex:none">' + icon('chevR', 16, '#C9CFD6', 2) + '</div>'
      + '</a>';
  }

  function emptyState(title, desc, actionHtml) {
    return '<div class="empty">'
      + '<div style="display:flex;justify-content:center">' + icon('empty', 40, '#C9CFD6', 1.6) + '</div>'
      + '<h4>' + E(title) + '</h4>'
      + '<p>' + E(desc) + '</p>'
      + (actionHtml ? '<div style="margin-top:16px">' + actionHtml + '</div>' : '')
      + '</div>';
  }

  function chipRow(list, active, extraClass) {
    return '<div class="chips">' + list.map(function (c) {
      var key = typeof c === 'string' ? c : c.key;
      var label = typeof c === 'string' ? c : c.label;
      var on = key === active;
      return '<a class="chip' + (on ? ' on ' + (extraClass || '') : '') + '" '
        + 'href="#/home?cat=' + encodeURIComponent(key) + '">' + E(label) + '</a>';
    }).join('') + '</div>';
  }

  /* ---------------------------------------------------------------- 首页 */

  function viewHome(state, ctx) {
    var cat = ctx.cat || '全部';
    var items = UTILS.filterItems(state.items, {
      cat: cat, status: 'open', sort: 'new'
    });
    var list = items.slice(0, 5);
    var total = items.length;

    var body = list.length
      ? '<div class="list">' + list.map(function (it) { return cardItem(it, '', true); }).join('') + '</div>'
      : emptyState('这一类暂时还没有信息',
          '换个分类看看，或者点下面的「发布」帮大家补齐一条。');

    var more = total > list.length
      ? '<a class="more" href="#/search?type=all">查看全部' + icon('chevR', 12, '#9AA1AA', 2.2) + '</a>'
      : '';

    return '<div class="view">'
      + '<header class="hero">'
      +   '<div class="brand"><span class="brand-dot">' + icon('bell', 14, '#FFFFFF', 2) + '</span>'
      +     '<h1>校园失物招领</h1></div>'
      +   '<p class="sub">丢了东西别着急，捡到东西帮个忙 · 已有 ' + state.items.length + ' 条信息</p>'
      /* 首页这条搜索栏整体就是一个入口：原型里它就是占位文字而不是输入框，
         所以点哪都进搜索页；真正的输入框在搜索页（进去会自动聚焦，可以直接打字）。
         ⚠️ 注释行前面不能写 +，否则会和上一行/下一行的 + 撞成一元加号，把文案拼成 NaN。 */
      +   '<a class="searchbox" href="#/search" aria-label="搜索物品名称、地点">'
      +     icon('search', 16, '#9AA1AA', 2)
      +     '<span class="ph">搜索物品名称、地点，如「校园卡」</span>'
      +     '<span class="go-search">搜索</span>'
      +   '</a>'
      + '</header>'
      + chipRow(DATA.HOME_CHIPS, cat)
      + '<div class="sec-head"><h3>最新信息</h3>' + more + '</div>'
      + body
      + '<div class="hint">' + icon('star', 15, '#059E4E', 1.8)
      +   '<span>点任意一条卡片可以看详情。<b>已归还 / 已找到</b>的信息会自动从首页隐藏，'
      +   '所以首页永远是最需要帮助的那些。</span></div>'
      + '</div>';
  }

  /* ---------------------------------------------------------------- 搜索页 */

  function selectHtml(name, options, value) {
    return '<select name="' + name + '" data-filter>' + options.map(function (o) {
      return '<option value="' + E(o.value) + '"'
        + (o.value === value ? ' selected' : '') + '>' + E(o.label) + '</option>';
    }).join('') + '</select>';
  }

  function viewSearch(state, ctx) {
    var q = ctx.q || '';
    var type = ctx.type || 'all';
    var cat = ctx.cat || '全部';
    var area = ctx.area || '全部';
    var range = ctx.range || 'all';

    var results = UTILS.filterItems(state.items, {
      q: q, type: type, cat: cat, area: area, range: range, sort: 'new'
    });

    var typeOpts = [{ value: 'all', label: '全部类型' }]
      .concat(DATA.TYPES.map(function (t) { return { value: t.key, label: t.label }; }));
    var catOpts = [{ value: '全部', label: '全部分类' }]
      .concat(DATA.CATEGORIES.map(function (c) { return { value: c.key, label: c.key }; }));
    var areaOpts = [{ value: '全部', label: '全部地点' }]
      .concat(DATA.AREAS.map(function (a) { return { value: a, label: a }; }));
    var rangeOpts = DATA.TIME_RANGES.map(function (r) { return { value: r.key, label: r.label }; });

    var tip = q
      ? '为你找到 <b>' + results.length + '</b> 条与「' + E(q) + '」相关的信息'
      : '共 <b>' + results.length + '</b> 条信息（可按类型、分类、地点、时间筛选）';

    var body = results.length
      ? '<div class="list">' + results.map(function (it) { return cardItem(it, q, true); }).join('') + '</div>'
      : emptyState('没找到你丢失的物品？',
          '换个关键词试试，比如只搜「校园卡」三个字；也可以把筛选条件放宽到"时间不限"。',
          '<a class="btn-main" href="#/publish/lost" style="display:block;text-decoration:none">发布一条寻物启事</a>');

    return '<div class="view">'
      + '<div class="searchbar">'
      +   '<a class="back" href="#/home" data-act="back" aria-label="返回上一级">' + icon('chevL', 17, '#5A6169', 2.2) + '</a>'
      +   '<form class="box" data-search-form>'
      +     icon('search', 15, '#9AA1AA', 2)
      +     '<input type="text" name="q" placeholder="搜索物品名称、地点" '
      +       'value="' + E(q) + '" autocomplete="off">'
      +     (q ? '<button type="button" class="clear" data-act="clear-q" aria-label="清空">×</button>' : '')
      +   '</form>'
      +   '<a class="cancel" href="#/home" data-act="back">取消</a>'
      + '</div>'
      + '<div class="filters">'
      +   selectHtml('type', typeOpts, type)
      +   selectHtml('area', areaOpts, area)
      + '</div>'
      + '<div class="filters">'
      +   selectHtml('cat', catOpts, cat)
      +   selectHtml('range', rangeOpts, range)
      + '</div>'
      + '<div class="result-tip">' + tip + '</div>'
      + body
      + '</div>';
  }

  /* ---------------------------------------------------------------- 发布页 */

  function fieldBlock(name, label, req, control, extra) {
    return '<div class="field" data-field="' + name + '">'
      + '<label for="f-' + name + '">' + E(label)
      + (req ? '<span class="req">*</span>' : '') + '</label>'
      + control
      + '<div class="err">' + icon('warn', 13, '#E5484D', 2) + '<span class="err-text"></span></div>'
      + (extra || '')
      + '</div>';
  }

  function viewPublish(state, ctx, kind) {
    var isLost = kind === 'lost';
    var placeLabel = isLost ? '丢失地点' : '拾取地点';
    var timeLabel  = isLost ? '丢失时间' : '拾取时间';
    var title      = isLost ? '发布寻物启事' : '发布失物招领';

    var catOpts = '<option value="">请选择分类</option>' + DATA.CATEGORIES.map(function (c) {
      return '<option value="' + E(c.key) + '">' + E(c.key) + '</option>';
    }).join('');

    var slots = '<div class="upload">';
    for (var i = 0; i < 3; i++) {
      slots += '<label class="slot' + (i === 0 && !isLost ? '' : '') + '" data-slot="' + i + '">'
        + icon('img', 20, '#9AA1AA', 1.8) + '<span>添加图片</span>'
        + '<input type="file" accept="image/*" hidden data-img="' + i + '">'
        + '</label>';
    }
    slots += '</div>';

    return '<div class="view no-tabbar ' + (isLost ? 'theme-lost' : '') + '">'
      + '<div class="navbar">'
      +   '<a class="back" href="#/home" data-act="back" aria-label="返回上一级">' + icon('chevL', 17, '#5A6169', 2.2) + '</a>'
      +   '<h2>' + title + '</h2>'
      + '</div>'
      + '<form class="form" data-publish-form data-kind="' + kind + '" novalidate>'
      +   '<div class="typepick">'
      +     '<a class="' + (isLost ? '' : 'on found') + '" href="#/publish/found">拾到物品 · 我来招领</a>'
      +     '<a class="' + (isLost ? 'on lost' : '') + '" href="#/publish/lost">丢失物品 · 我来寻找</a>'
      +   '</div>'

      + fieldBlock('title', '物品名称', true,
          '<input id="f-title" type="text" name="title" placeholder="如：校园卡（蓝色卡套）" '
          + 'maxlength="30" autocomplete="off">')

      + fieldBlock('cat', '物品分类', true,
          '<select id="f-cat" name="cat">' + catOpts + '</select>')

      + fieldBlock('place', placeLabel, true,
          '<input id="f-place" type="text" name="place" placeholder="如：第一教学楼 A302" '
          + 'maxlength="40" autocomplete="off">')

      + fieldBlock('timeText', timeLabel, true,
          '<input id="f-timeText" type="datetime-local" name="timeText" value="'
          + UTILS.toLocalInputValue(Date.now()) + '">'
          )

      + fieldBlock('contact', '联系方式', true,
          '<input id="f-contact" type="text" name="contact" placeholder="手机号 / 邮箱 / 微信号" '
          + 'maxlength="40" autocomplete="off">',
          '<div class="count" data-contact-kind></div>')

      + fieldBlock('desc', '详细描述', false,
          '<textarea id="f-desc" name="desc" maxlength="200" '
          + 'placeholder="补充颜色、特征、有无挂件等信息，越具体越容易被认领"></textarea>',
          '<div class="count"><span data-count>0</span>/200</div>')

      + '<div style="margin-bottom:8px;font-size:12.5px;font-weight:600;color:var(--ink-2)">'
      +   '物品图片（选填，最多 3 张）</div>'
      + slots

      + '<div class="hint' + (isLost ? ' warn' : '') + '" style="margin:2px 0 18px">'
      +   icon('warn', 15, isLost ? '#E5762C' : '#059E4E', 1.8)
      +   '<span><b>温馨提示：</b>请勿在描述里填写身份证号、银行卡号等敏感信息；'
      +   '贵重物品建议只写大致位置，线下当面核对交接。</span></div>'

      + '<button type="submit" class="btn-main">发布</button>'
      + '<div style="height:18px"></div>'
      + '</form>'
      + '</div>';
  }

  /* ---------------------------------------------------------------- 成功页 */

  function viewSuccess(state, ctx) {
    return '<div class="view no-tabbar">'
      + '<div class="done-panel">'
      +   '<div class="done-icon">' + svg(DATA.ICON.check, 40, '#07C160', 2.6) + '</div>'
      +   '<h2>发布成功</h2>'
      +   '<p>信息已经发布到「校园失物招领」，其他同学可以在首页看到它，'
      +     '也可以通过关键词搜到。有进展时记得回来把状态改成「' + (ctx.kind === 'lost' ? '已找到' : '已归还') + '」。</p>'
      +   '<div class="btns">'
      +     '<a class="btn-main" href="#/mine" style="text-decoration:none">查看我发布的信息</a>'
      +     '<a class="btn-ghost" href="#/home" style="text-decoration:none;text-align:center">返回首页</a>'
      +   '</div>'
      + '</div></div>';
  }

  /* ---------------------------------------------------------------- 详情页 */

  function viewDetail(state, ctx) {
    var it = state.items.filter(function (x) { return x.id === ctx.id; })[0];
    if (!it) {
      return '<div class="view no-tabbar">'
        + '<div class="navbar"><a class="back" href="#/home" data-act="back" aria-label="返回上一级">'
        + icon('chevL', 17, '#5A6169', 2.2) + '</a><h2>信息详情</h2></div>'
        + emptyState('这条信息不在了', '它可能已经被发布者删除。',
            '<a class="btn-ghost" href="#/home" style="display:block;text-decoration:none;text-align:center">返回首页</a>')
        + '</div>';
    }

    var tm = UTILS.typeMeta(it.type);
    var st = UTILS.catStyle(it.cat);
    var done = it.status === 'done';
    var poster = DATA.POSTERS[it.contact] || { nick: '匿名同学' };
    var nick = it.owner ? DATA.ME.name : poster.nick;
    var faved = state.favs && state.favs[it.id];

    var first = it.images && it.images.length ? it.images[0] : null;
    var heroInner = first
      ? '<img src="' + E(first) + '" alt="物品图片" style="width:100%;height:100%;object-fit:cover">'
      : '<div style="width:100%;height:100%;background:' + st.bg + ';display:flex;'
        + 'align-items:center;justify-content:center">'
        + svg(DATA.CAT_ICON[it.cat] || DATA.CAT_ICON['其他'], 64, st.fg, 1.4) + '</div>';

    var badge = done
      ? '<span class="badge done">' + UTILS.statusLabel(it) + '</span>'
      : '<span class="badge' + (it.type === 'lost' ? ' lost' : '') + '">'
        + UTILS.statusLabel(it) + '</span>';

    var actionBar = it.owner
      ? '<div class="detail-actions">'
        + '<button class="fav' + (faved ? ' on' : '') + '" data-act="fav" data-id="' + E(it.id) + '" '
        + 'aria-label="收藏">' + icon('star', 20, faved ? '#FF8A3D' : '#9AA1AA', 1.8) + '</button>'
        + '<button class="btn-main" data-act="toggle-status" data-id="' + E(it.id) + '">'
        + (done ? '标记为待处理' : UTILS.typeMeta(it.type).key === 'found'
            ? '我已归还' : '我已找到') + '</button>'
        + '<button class="btn-sm danger" data-act="remove" data-id="' + E(it.id) + '">'
        + icon('trash', 16, '#C0353A', 1.9) + '</button>'
        + '</div>'
      : '<div class="detail-actions">'
        + '<button class="fav' + (faved ? ' on' : '') + '" data-act="fav" data-id="' + E(it.id) + '" '
        + 'aria-label="收藏">' + icon('star', 20, faved ? '#FF8A3D' : '#9AA1AA', 1.8) + '</button>'
        + '<button class="btn-main" data-act="copy-contact" data-id="' + E(it.id) + '">'
        + '一键复制联系方式</button>'
        + '</div>';

    return '<div class="view no-tabbar">'
      + '<div class="navbar">'
      +   '<a class="back" href="#/home" data-act="back" aria-label="返回上一级">' + icon('chevL', 17, '#5A6169', 2.2) + '</a>'
      +   '<h2>信息详情</h2>'
      +   '<span class="act">' + tm.label + '</span>'
      + '</div>'
      + '<div class="detail-hero">' + heroInner + badge + '</div>'
      + '<div class="detail-body">'
      +   '<div class="detail-title">' + E(it.title) + '</div>'
      +   '<div class="poster">'
      +     '<div class="avatar">' + E(Array.from(nick)[0] || '?') + '</div>'
      +     '<div class="who"><b>' + E(nick) + '</b>'
      +       '<span>' + E(it.owner ? DATA.ME.sid + ' · ' + DATA.ME.college : DATA.ME.college) + '</span></div>'
      +     '<span class="pill ' + (done ? 'done' : tm.key) + '">' + UTILS.statusLabel(it) + '</span>'
      +   '</div>'
      +   '<div class="attrs">'
      +     row('类型', tm.label)
      +     row('分类', it.cat)
      +     row(isLostOf(it) ? '丢失地点' : '拾取地点', it.place)
      +     row(isLostOf(it) ? '丢失时间' : '拾取时间', it.timeText || '—')
      +     row('发布时间', UTILS.formatRelativeTime(it.createdAt))
      +     row('联系方式', it.owner ? it.contact : maskContact(it.contact))
      +     row('编号', it.id)
      +   '</div>'
      +   '<div class="desc"><h4>详细描述</h4><p>'
      +     (it.desc ? E(it.desc) : '发布者没有填写更多描述。') + '</p></div>'
      +   '<div class="hint" style="margin:16px 0 0">' + icon('warn', 15, '#059E4E', 1.8)
      +     '<span>交接时请当面核对物品特征，<b>不要提前转账或汇款</b>，谨防冒充失主的诈骗。</span></div>'
      +   '<div style="height:8px"></div>'
      + '</div>'
      + actionBar
      + '</div>';
  }

  function isLostOf(it) { return it.type === 'lost'; }

  function row(k, v) {
    return '<div class="row"><span class="k">' + E(k) + '</span><span class="v">' + E(v) + '</span></div>';
  }

  /** 别人的联系方式默认打码，点了"一键复制"才给完整的（防爬） */
  function maskContact(c) {
    var v = UTILS.trim(c);
    if (UTILS.isValidPhone(v)) return v.slice(0, 3) + '****' + v.slice(-4);
    if (UTILS.isValidEmail(v)) {
      var at = v.indexOf('@');
      return v.slice(0, 2) + '***' + v.slice(at);
    }
    return v.length > 4 ? v.slice(0, 2) + '****' : v;
  }

  /* ---------------------------------------------------------------- 我的发布 */

  function viewMine(state, ctx) {
    var mode = ctx.mode || 'all';                 // all | open | done
    var mine = state.items.filter(function (it) { return it.owner; });
    var s = UTILS.statsOf(mine);
    var list = UTILS.filterItems(mine, { status: mode, sort: 'status' });

    var body = list.length
      ? '<div class="list">' + list.map(function (it) { return cardItem(it, '', false); }).join('') + '</div>'
      : emptyState(mode === 'all' ? '你还没有发布过信息' : '这一栏是空的',
          mode === 'all' ? '点底部中间的「+」按钮发布第一条吧。' : '换个筛选看看，或者去发布一条新的。',
          '<a class="btn-main" href="#/publish/found" style="display:block;text-decoration:none">'
          + '去发布</a>');

    var tabs = [
      { k: 'all', label: '全部 ' + s.total },
      { k: 'open', label: '待处理 ' + s.open },
      { k: 'done', label: '已完成 ' + s.done }
    ];

    return '<div class="view">'
      + '<header class="me-head">'
      +   '<div class="me-id">'
      +     '<div class="avatar">' + E(Array.from(DATA.ME.name)[0]) + '</div>'
      +     '<div class="who"><b>' + E(DATA.ME.name) + '</b>'
      +       '<span>学号 ' + E(DATA.ME.sid) + ' · ' + E(DATA.ME.college) + '</span></div>'
      +   '</div>'
      +   '<div class="me-row"><span>我的联系方式：' + E(DATA.ME.contact) + '</span></div>'
      + '</header>'
      + '<div class="stat">'
      +   '<div><b>' + s.total + '</b><span>我的发布</span></div>'
      +   '<div><b class="b-open">' + s.open + '</b><span>待处理</span></div>'
      +   '<div><b class="b-done">' + s.done + '</b><span>已完成</span></div>'
      + '</div>'
      + '<div class="sec-head"><h3>我发布的信息</h3>'
      +   '<button class="more" data-act="reset">恢复示例数据</button></div>'
      + '<div style="padding:0 var(--page-pad) 10px">'
      +   '<div class="segment" data-mine-mode>' + tabs.map(function (t) {
            return '<a data-mode="' + t.k + '" href="#/mine?mode=' + t.k + '"'
              + (t.k === mode ? ' class="on"' : '') + '>' + E(t.label) + '</a>';
          }).join('') + '</div>'
      + '</div>'
      + body
      + '</div>';
  }

  /* ---------------------------------------------------------------- 底部导航 */

  function tabbar(active) {
    var tabs = [
      { k: 'home',   href: '#/home',   ic: 'home',   label: '首页' },
      { k: 'publish',href: '#/publish/found', ic: null, label: '发布' },
      { k: 'mine',   href: '#/mine',   ic: 'person', label: '我的' }
    ];
    return '<nav class="tabbar">'
      + tabs.map(function (t) {
          var on = t.k === active ? ' on' : '';
          var inner = t.ic
            ? '<span class="slot">' + icon(t.ic, 22, t.k === active ? '#07C160' : '#9AA1AA', 1.9) + '</span>'
            : '<span class="slot"></span>';
          return '<a class="' + (t.k === active ? 'on' : '') + '" href="' + t.href + '" '
            + 'style="text-decoration:none;color:inherit">' + inner + t.label + '</a>';
        }).join('')
      + '<a class="fab" href="#/publish/found" aria-label="发布信息">'
      +   svg(DATA.ICON.plus, 20, '#FFFFFF', 2.5) + '</a>'
      + '</nav>';
  }

  return {
    svg: svg,
    icon: icon,
    thumb: thumb,
    cardItem: cardItem,
    emptyState: emptyState,
    maskContact: maskContact,
    tabbar: tabbar,
    viewHome: viewHome,
    viewSearch: viewSearch,
    viewPublish: viewPublish,
    viewSuccess: viewSuccess,
    viewDetail: viewDetail,
    viewMine: viewMine
  };
});
