/* ==========================================================================
   app.js —— 路由 + 事件绑定（把 ui.js 的界面和 store.js 的数据接起来）
   路由用 hash（#/home、#/detail/LF1001…），所以用 file:// 双击打开也能正常跳转，
   不需要任何本地服务器。
   ========================================================================== */
(function () {
  var DATA  = window.LFData;
  var UTILS = window.LFUtils;
  var STORE = window.LFStore;
  var UI    = window.LFUI;

  var viewEl   = document.getElementById('view');
  var tabbarEl = document.getElementById('tabbar');
  var toastEl  = document.getElementById('toast');

  /* 显示底部导航的页面；发布 / 成功 / 详情是"二级页"，不显示 */
  var TAB_OF = { home: 'home', search: 'search', mine: 'mine' };

  /* 站内返回栈：最后一项永远是当前页。左上角返回按这个栈逐级往回走，
     而不是每次都弹回首页。入栈规则见 utils.pushRoute（纯函数，有单测覆盖）。 */
  var routeStack = [];

  /* 发布表单里暂存的图片（dataURL），离开发布页就清空 */
  var pendingImages = [];

  /* ---------------------------------------------------------------- 路由 */

  function parseHash() {
    var raw = location.hash.replace(/^#\/?/, '');
    if (!raw) return { path: ['home'], params: {} };
    var qi = raw.indexOf('?');
    var qs = '';
    if (qi > -1) { qs = raw.slice(qi + 1); raw = raw.slice(0, qi); }
    var path = raw.split('/').filter(Boolean);
    if (!path.length) path = ['home'];

    var params = {};
    qs.split('&').forEach(function (kv) {
      if (!kv) return;
      var i = kv.indexOf('=');
      var k = i < 0 ? kv : kv.slice(0, i);
      var v = i < 0 ? '' : kv.slice(i + 1);
      try { params[decodeURIComponent(k)] = decodeURIComponent(v); }
      catch (e) { params[k] = v; }
    });
    return { path: path, params: params };
  }

  function buildHash(path, params) {
    var qs = Object.keys(params || {}).filter(function (k) {
      return params[k] != null && params[k] !== '';
    }).map(function (k) {
      return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
    }).join('&');
    return '#/' + path + (qs ? '?' + qs : '');
  }

  function go(hash) {
    if (location.hash === hash) render();
    else location.hash = hash;
  }

  /** 左上角返回：按站内栈往上一级走；已经是最外层就回首页 */
  function goBack() {
    var target = UTILS.backTarget(routeStack);
    if (!target) { go('#/home'); return; }
    routeStack = UTILS.popRoute(routeStack);
    if (location.hash === target) render();
    else location.hash = target;
  }

  /* ---------------------------------------------------------------- 渲染 */

  var currentScrollKey = '';

  function render() {
    var r = parseHash();
    var ctx = r.params;

    /* 先把"当前页"并入返回栈，再渲染（放在最前面，保证栈和界面始终一致） */
    routeStack = UTILS.pushRoute(routeStack, location.hash || '#/home');

    var state = { items: STORE.all(), favs: favsMap() };
    var name = r.path[0];
    var html;

    if (name === 'home')         { ctx.q = ctx.q || ''; html = UI.viewHome(state, ctx); }
    else if (name === 'search')  { html = UI.viewSearch(state, ctx); }
    else if (name === 'publish') { html = UI.viewPublish(state, ctx, r.path[1] === 'lost' ? 'lost' : 'found'); }
    else if (name === 'success') { html = UI.viewSuccess(state, ctx); }
    else if (name === 'detail')  { ctx.id = r.path[1] || ''; html = UI.viewDetail(state, ctx); }
    else if (name === 'mine')    { html = UI.viewMine(state, ctx); }
    else                         { location.replace('#/home'); return; }

    var key = r.path.join('/') + JSON.stringify(ctx);
    var sameRoute = (key === currentScrollKey);
    currentScrollKey = key;

    viewEl.innerHTML = html;
    tabbarEl.innerHTML = TAB_OF[name] ? UI.tabbar(TAB_OF[name]) : '';
    document.body.classList.toggle('has-tabbar', !!TAB_OF[name]);
    if (!sameRoute) window.scrollTo(0, 0);

    if (name === 'publish') { pendingImages = []; }
    bindPublishHelpers();

    /* 从首页那条搜索入口跳过来时，直接把光标放进输入框（首页那条不能打字，这里要接得住） */
    if (name === 'search' && !sameRoute && !ctx.q) {
      var si = viewEl.querySelector('.searchbar input');
      if (si) si.focus();
    }
  }

  function favsMap() {
    var m = {};
    STORE.favIds().forEach(function (id) { m[id] = 1; });
    return m;
  }

  /* ---------------------------------------------------------------- 提示 */

  var toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('on'); }, 1800);
  }

  /* ---------------------------------------------------------------- 复制 */

  function copyText(text) {
    var done = function () { toast('已复制：' + text); };
    var fail = function () { toast('复制失败，请手动长按选择：' + text); };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done)['catch'](function () { legacyCopy(text, done, fail); });
    } else {
      legacyCopy(text, done, fail);
    }
  }

  function legacyCopy(text, done, fail) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;left:-9999px;top:0';
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, text.length);
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      ok ? done() : fail();
    } catch (e) { fail(); }
  }

  /* ---------------------------------------------------------------- 图片处理 */

  function readImageFile(file, cb) {
    if (!file) { cb(null, '没有选择文件'); return; }
    if (!/^image\//.test(file.type)) { cb(null, '请选择图片文件'); return; }
    if (file.size > 8 * 1024 * 1024) { cb(null, '图片太大了，请选 8MB 以内的'); return; }

    var reader = new FileReader();
    reader.onerror = function () { cb(null, '图片读取失败'); };
    reader.onload = function () {
      var img = new Image();
      img.onerror = function () { cb(null, '这不是一张能识别的图片'); };
      img.onload = function () {
        var MAX = 640;
        var scale = Math.min(1, MAX / Math.max(img.width, img.height));
        var w = Math.max(1, Math.round(img.width * scale));
        var h = Math.max(1, Math.round(img.height * scale));
        var cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        try { cb(cv.toDataURL('image/jpeg', 0.7)); }
        catch (e) { cb(null, '图片处理失败'); }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  /* ---------------------------------------------------------------- 发布表单 */

  function formValues(form) {
    function v(n) {
      var el = form.querySelector('[name="' + n + '"]');
      return el ? UTILS.trim(el.value) : '';
    }
    return {
      type: form.getAttribute('data-kind') === 'lost' ? 'lost' : 'found',
      title: v('title'),
      cat: v('cat'),
      place: v('place'),
      timeText: v('timeText') ? v('timeText').replace('T', ' ') : '',
      contact: v('contact'),
      desc: v('desc')
    };
  }

  function clearErrors(form) {
    form.querySelectorAll('.field').forEach(function (f) { f.classList.remove('is-bad'); });
  }

  function showErrors(form, errors) {
    var first = null;
    form.querySelectorAll('.field').forEach(function (f) {
      var name = f.getAttribute('data-field');
      var msg = errors[name];
      if (msg) {
        f.classList.add('is-bad');
        var t = f.querySelector('.err-text');
        if (t) t.textContent = msg;
        if (!first) first = f;
      } else {
        f.classList.remove('is-bad');
      }
    });
    if (first) {
      first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      var input = first.querySelector('input,select,textarea');
      if (input) input.focus({ preventScroll: true });
    }
  }

  /** 输入时顺手把已经改好的那一项的红框去掉，并更新字数/联系方式类型提示 */
  function bindPublishHelpers() {
    var form = document.querySelector('[data-publish-form]');
    if (!form) return;

    var desc = form.querySelector('[name="desc"]');
    if (desc) {
      var counter = form.querySelector('[data-count]');
      var update = function () { if (counter) counter.textContent = UTILS.charLen(desc.value); };
      desc.addEventListener('input', update);
      update();
    }

    var contact = form.querySelector('[name="contact"]');
    if (contact) {
      var kindEl = form.querySelector('[data-contact-kind]');
      var updateKind = function () {
        if (!kindEl) return;
        var v = UTILS.trim(contact.value);
        kindEl.textContent = !v ? '' : (UTILS.isValidContact(v)
          ? '✓ 识别为' + UTILS.contactKind(v)
          : '格式不正确，可填手机号 / 邮箱 / 微信号');
        kindEl.style.color = !v ? '' : (UTILS.isValidContact(v) ? '#059E4E' : '#E5484D');
      };
      contact.addEventListener('input', updateKind);
      updateKind();
    }

    form.querySelectorAll('[data-img]').forEach(function (input) {
      input.addEventListener('change', function () {
        var file = input.files && input.files[0];
        if (!file) return;
        readImageFile(file, function (dataUrl, err) {
          if (err) { toast(err); input.value = ''; return; }
          var idx = parseInt(input.getAttribute('data-img'), 10);
          pendingImages[idx] = dataUrl;
          var slot = input.closest('.slot');
          if (slot) {
            slot.classList.add('has');
            slot.innerHTML = '<img src="' + dataUrl + '" alt="已选图片" '
              + 'style="width:100%;height:100%;object-fit:cover;border-radius:9px">'
              + '<input type="file" accept="image/*" hidden data-img="' + idx + '">';
            var again = slot.querySelector('input[data-img]');
            bindOneImage(again);
          }
          toast('已添加第 ' + (idx + 1) + ' 张图片');
        });
      });
    });

    /* 每个 field 一输入就清掉自己的错误样式 */
    form.querySelectorAll('.field').forEach(function (f) {
      f.addEventListener('input', function () { f.classList.remove('is-bad'); });
      f.addEventListener('change', function () { f.classList.remove('is-bad'); });
    });
  }

  function bindOneImage(input) {
    if (!input) return;
    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      if (!file) return;
      readImageFile(file, function (dataUrl, err) {
        if (err) { toast(err); return; }
        var idx = parseInt(input.getAttribute('data-img'), 10);
        pendingImages[idx] = dataUrl;
        toast('已更新第 ' + (idx + 1) + ' 张图片');
      });
    });
  }

  /* ---------------------------------------------------------------- 事件委托 */

  document.addEventListener('submit', function (e) {
    var form = e.target;

    /* 首页 / 搜索页的搜索框 */
    if (form.hasAttribute('data-search-form')) {
      e.preventDefault();
      var q = UTILS.trim(form.querySelector('[name="q"]').value);
      var cur = parseHash();
      if (cur.path[0] === 'search') {
        var p = cur.params;
        p.q = q;
        go(buildHash('search', p));
      } else {
        go(buildHash('search', { q: q }));
      }
      return;
    }

    /* 发布表单 */
    if (form.hasAttribute('data-publish-form')) {
      e.preventDefault();
      var values = formValues(form);
      var res = UTILS.validatePublish(values);
      if (!res.ok) {
        showErrors(form, res.errors);
        toast('还有 ' + Object.keys(res.errors).length + ' 项需要修改');
        return;
      }
      clearErrors(form);
      values.images = pendingImages.filter(Boolean).slice(0, 3);
      var item = STORE.add(values);
      pendingImages = [];
      toast('发布成功，编号 ' + item.id);
      go(buildHash('success', { kind: values.type }));
      return;
    }
  });

  /* 搜索页的筛选下拉 */
  document.addEventListener('change', function (e) {
    var el = e.target;
    if (!el.hasAttribute || !el.hasAttribute('data-filter')) return;
    var cur = parseHash();
    if (cur.path[0] !== 'search') return;
    var p = cur.params;
    p[el.getAttribute('name')] = el.value;
    go(buildHash('search', p));
  });

  /* 所有 data-act 按钮 */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('[data-act]') : null;
    if (!btn) return;
    var act = btn.getAttribute('data-act');
    var id = btn.getAttribute('data-id');

    if (act === 'back') {
      e.preventDefault();
      goBack();
      return;
    }

    if (act === 'clear-q') {
      e.preventDefault();
      var cur = parseHash();
      var p = cur.params;
      p.q = '';
      go(buildHash('search', p));
      return;
    }

    if (act === 'copy-contact') {
      e.preventDefault();
      var it = STORE.get(id);
      if (!it) { toast('这条信息已经不存在了'); return; }
      copyText(it.contact);
      return;
    }

    if (act === 'fav') {
      e.preventDefault();
      var on = STORE.toggleFav(id);
      toast(on ? '已收藏，方便之后回来查看' : '已取消收藏');
      render();
      return;
    }

    if (act === 'toggle-status') {
      e.preventDefault();
      var item = STORE.toggleStatus(id);
      if (item) {
        toast(item.status === 'done'
          ? '已标记为「' + UTILS.statusLabel(item) + '」，首页不再展示'
          : '已重新标记为「' + UTILS.statusLabel(item) + '」');
      }
      render();
      return;
    }

    if (act === 'remove') {
      e.preventDefault();
      if (!window.confirm('确定删除这条信息吗？删除后无法恢复。')) return;
      if (STORE.remove(id)) { toast('已删除'); go('#/mine'); }
      return;
    }

    if (act === 'reset') {
      e.preventDefault();
      if (!window.confirm('恢复成初始示例数据？你自己发布的内容会被清空。')) return;
      STORE.reset();
      toast('已恢复示例数据');
      render();
      return;
    }
  });

  /* ---------------------------------------------------------------- 启动 */

  window.addEventListener('hashchange', function () { currentScrollKey = ''; render(); });

  STORE.init();
  if (!location.hash) location.replace('#/home');
  else render();

  /* 键盘无障碍：按 Esc 返回上一级 */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') go('#/home');
  });
})();
