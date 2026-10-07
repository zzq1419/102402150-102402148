/* ==========================================================================
   data.js —— 静态数据：分类 / 区域 / 时间片 / 图标 / 种子数据
   这里只放"数据"，不放逻辑；可被 Node 直接 require 用于单元测试。
   ========================================================================== */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LFData = api;
})(typeof self !== 'undefined' ? self : this, function () {

  /* ---------------- 物品分类 ----------------
     key 用于筛选与存储，label 用于展示，配色与第一次作业的 Figma 原型一一对应 */
  var CATEGORIES = [
    { key: '证件卡类', bg: '#DBEAFE', fg: '#2563EB' },
    { key: '电子设备', bg: '#EDE9FE', fg: '#7C3AED' },
    { key: '钥匙',     bg: '#FEF3C7', fg: '#D97706' },
    { key: '水杯',     bg: '#CFFAFE', fg: '#0891B2' },
    { key: '雨伞',     bg: '#D1FAE5', fg: '#059669' },
    { key: '书籍',     bg: '#FEE2E2', fg: '#DC2626' },
    { key: '其他',     bg: '#E9EDF2', fg: '#5A6169' }
  ];

  /* 首页筛选只列常用项，与原型一致（全部 + 4 类） */
  var HOME_CHIPS = ['全部', '证件卡类', '电子设备', '钥匙', '水杯'];

  /* ---------------- 区域（用于"地点"筛选，避免按楼栋精确匹配导致筛不出东西） ------ */
  var AREAS = ['教学楼', '图书馆', '食堂', '宿舍楼', '运动场', '其他'];

  /* ---------------- 时间片（用于"时间"筛选，按"距今多久"计算） ---------------- */
  var TIME_RANGES = [
    { key: 'all', label: '时间不限', hours: null },
    { key: 'h24', label: '24 小时内', hours: 24 },
    { key: 'd3',  label: '三天内',    hours: 72 },
    { key: 'd7',  label: '一周内',    hours: 168 }
  ];

  /* ---------------- 类型 ---------------- */
  var TYPES = [
    { key: 'found', label: '失物招领', short: '招领', color: '#07C160', soft: '#E8F8EF' },
    { key: 'lost',  label: '寻物启事', short: '寻物', color: '#FF8A3D', soft: '#FFF2E7' }
  ];

  /* ---------------- 分类图标（24×24 线性图标，stroke 用 currentColor 之外的颜色传入） */
  var CAT_ICON = {
    '证件卡类': '<rect x="3" y="5.5" width="18" height="13" rx="2.4"/><circle cx="9" cy="11" r="2.1"/><path d="M5.8 16.2c.5-1.6 1.8-2.5 3.2-2.5s2.7.9 3.2 2.5"/><path d="M15.2 10.2h3.4M15.2 13.2h3.4"/>',
    '电子设备': '<rect x="6" y="3" width="12" height="18" rx="2.6"/><path d="M10.6 6.2h2.8"/><path d="M10.2 18.2h3.6"/>',
    '钥匙':     '<circle cx="8.4" cy="8.4" r="4.2"/><path d="M11.4 11.4l7 7"/><path d="M15.6 15.6l1.9-1.9M17.7 17.7l1.9-1.9"/>',
    '水杯':     '<path d="M6.4 6.5h11.2l-1.3 12.2a1.8 1.8 0 01-1.8 1.6h-5a1.8 1.8 0 01-1.8-1.6z"/><path d="M7.4 11.2h9.2"/><path d="M10 3.7v2.8M14 3.7v2.8"/>',
    '雨伞':     '<path d="M3.6 12.2a8.4 8.4 0 0116.8 0z"/><path d="M12 12.2v6.4a2.1 2.1 0 004.2 0"/><path d="M12 3.4v1.2"/>',
    '书籍':     '<path d="M4.5 4.6h6.2a2.3 2.3 0 012.3 2.3v12.5a1.8 1.8 0 00-1.8-1.8H4.5z"/><path d="M19.5 4.6h-6.2a2.3 2.3 0 00-2.3 2.3v12.5a1.8 1.8 0 011.8-1.8h6.7z"/>',
    '其他':     '<circle cx="12" cy="12" r="8"/><path d="M12 8.4v.1M12 11.6v4.2"/>'
  };

  /* ---------------- 图标库（线性图标，字符串可直接塞进 <svg>） ------------- */
  var ICON = {
    home:   '<path d="M3.6 10.4L12 3.6l8.4 6.8V20a1 1 0 01-1 1h-4.6v-6.2H9.2V21H4.6a1 1 0 01-1-1z"/>',
    person: '<circle cx="12" cy="8" r="3.7"/><path d="M4.8 20.2c0-3.6 3.2-6.2 7.2-6.2s7.2 2.6 7.2 6.2"/>',
    plus:   '<path d="M12 5.4v13.2M5.4 12h13.2"/>',
    search: '<circle cx="11" cy="11" r="6.6"/><path d="M16 16l4.6 4.6"/>',
    chevR:  '<path d="M9.2 6.5L14.8 12l-5.6 5.5"/>',
    chevL:  '<path d="M14.8 6.5L9.2 12l5.6 5.5"/>',
    clock:  '<circle cx="12" cy="12" r="8"/><path d="M12 7.6V12l3 2"/>',
    pin:    '<path d="M12 21s6.4-5.4 6.4-10.2A6.4 6.4 0 005.6 10.8C5.6 15.6 12 21 12 21z"/><circle cx="12" cy="10.6" r="2.4"/>',
    copy:   '<rect x="8.6" y="8.6" width="11" height="11" rx="2.2"/><path d="M15.4 5.4H6.8a1.8 1.8 0 00-1.8 1.8v8.6"/>',
    star:   '<path d="M12 4.4l2.4 5 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4L4.2 10.2l5.4-.8z"/>',
    check:  '<path d="M5 12.6l4.4 4.4L19 7.4"/>',
    empty:  '<circle cx="11" cy="11" r="6.4"/><path d="M15.6 15.6L20.4 20.4"/><path d="M8.6 11h4.8"/>',
    chat:   '<path d="M20.4 12.6c0 3.9-3.8 7-8.4 7a9.6 9.6 0 01-2.6-.35L5 21l1-3.2A6.7 6.7 0 013.6 12.6c0-3.9 3.8-7 8.4-7s8.4 3.1 8.4 7z"/>',
    bell:   '<path d="M6.6 10.4a5.4 5.4 0 0110.8 0c0 4 1.6 5.4 1.6 5.4H5s1.6-1.4 1.6-5.4z"/><path d="M10.4 19a1.9 1.9 0 003.2 0"/>',
    warn:   '<circle cx="12" cy="12" r="8.4"/><path d="M12 7.8v4.8M12 15.7v.1"/>',
    img:    '<rect x="3.6" y="5" width="16.8" height="14" rx="2.4"/><circle cx="9" cy="10" r="1.6"/><path d="M4.4 17l4.4-4.2 3.4 3.2 2.6-2.4 4.8 4.4"/>',
    trash:  '<path d="M4.8 6.6h14.4"/><path d="M9 6.6V4.9h6v1.7"/><path d="M6.6 6.6l.9 12.1a1.6 1.6 0 001.6 1.5h5.8a1.6 1.6 0 001.6-1.5l.9-12.1"/>'
  };

  /* ---------------- 种子数据 ----------------
     agoMin = 距"现在"多少分钟前发布；渲染时换算成"今天 09:20 / 昨天 18:40"这类相对时间，
     这样无论什么时候打开示例数据都很自然。 */
  var SEED = [
    { id:'LF1001', type:'found', cat:'证件卡类', area:'教学楼', title:'校园卡（蓝色卡套）',
      place:'第一教学楼 A302', agoMin:35, contact:'13800138000',
      desc:'在 A302 教室最后一排捡到一张校园卡，外面套着蓝色卡套，卡面姓名为"周"某。\n已放在教学楼一楼值班室登记，也可以直接联系我。',
      status:'open', owner:false },

    { id:'LF1002', type:'found', cat:'雨伞', area:'图书馆', title:'黑色长柄雨伞',
      place:'图书馆三楼自习区', agoMin:60*19, contact:'wei_xin_2024',
      desc:'一把黑色长柄自动伞，伞柄有一圈磨损痕迹。昨晚落在自习区靠窗的位置，我先收起来了。',
      status:'open', owner:false },

    { id:'LF1003', type:'lost', cat:'电子设备', area:'食堂', title:'白色 AirPods 耳机盒',
      place:'第二食堂二楼', agoMin:60*26, contact:'lin@fzu.edu.cn',
      desc:'白色 AirPods 三代耳机盒，盒盖背面贴了一张小小的贴纸。中午打完饭回座位上就找不到了。',
      status:'open', owner:true },

    { id:'LF1004', type:'lost', cat:'钥匙', area:'宿舍楼', title:'宿舍钥匙（挂小熊挂件）',
      place:'5 号宿舍楼 3 层', agoMin:60*40, contact:'13900139000',
      desc:'一串宿舍钥匙，上面挂着一个棕色小熊挂件，还有一个门禁扣。应该是从口袋滑出去的。',
      status:'open', owner:false },

    { id:'LF1005', type:'found', cat:'书籍', area:'教学楼', title:'高等数学教材（写有姓名）',
      place:'教学楼 B 区 401', agoMin:60*52, contact:'13800138000',
      desc:'《高等数学》上册，扉页用铅笔写了姓名和班级，书里夹着几张草稿纸。',
      status:'open', owner:true },

    { id:'LF1006', type:'lost', cat:'证件卡类', area:'食堂', title:'校园卡（学号已被磨花）',
      place:'第二食堂一楼', agoMin:60*72, contact:'13800138000',
      desc:'校园卡一张，学号位置被磨得看不太清，卡套是透明磨砂的。补办要等一周，希望捡到的同学联系我。',
      status:'open', owner:false },

    { id:'LF1007', type:'lost', cat:'水杯', area:'运动场', title:'蓝色保温杯',
      place:'田径场看台', agoMin:60*96, contact:'wei_xin_2024',
      desc:'深蓝色 500ml 保温杯，杯盖有一点磕碰。晚上在田径场跑步时放在看台上忘了拿。',
      status:'open', owner:false },

    { id:'LF1008', type:'found', cat:'证件卡类', area:'图书馆', title:'校园卡（卡套为浅粉色）',
      place:'图书馆一楼大厅', agoMin:60*128, contact:'lin@fzu.edu.cn',
      desc:'在图书馆一楼大厅的自助借还机旁边捡到，浅粉色卡套，已经交到一楼服务台。',
      status:'done', owner:false },

    { id:'LF1009', type:'found', cat:'电子设备', area:'教学楼', title:'黑色有线鼠标',
      place:'实验楼 5 楼机房', agoMin:60*150, contact:'13800138000',
      desc:'一个黑色有线鼠标，线材靠近接口处有白色胶带缠绕。放在机房 5 号机位。',
      status:'open', owner:false },

    { id:'LF1010', type:'lost', cat:'其他', area:'其他', title:'透明文件袋（内有课程资料）',
      place:'校园 1 号线班车', agoMin:60*160, contact:'13900139000',
      desc:'A4 透明拉链文件袋，里面是《软件工程》课程的设计文档和几张实验报告，对我很重要。',
      status:'open', owner:false },

    { id:'LF1011', type:'found', cat:'雨伞', area:'食堂', title:'格子折叠伞',
      place:'第一食堂门口伞架', agoMin:60*200, contact:'wei_xin_2024',
      desc:'格子花纹的折叠伞，伞骨完好。下雨天落在门口的伞架上了。',
      status:'open', owner:false },

    { id:'LF1012', type:'found', cat:'水杯', area:'教学楼', title:'白色保温杯（贴有动漫贴纸）',
      place:'第三教学楼 205', agoMin:60*220, contact:'lin@fzu.edu.cn',
      desc:'白色保温杯，杯身贴着一张动漫角色贴纸，杯盖是按压式的。',
      status:'done', owner:true }
  ];

  /* 当前登录用户（作业不要求实名认证，这里做一个固定的"我"） */
  var ME = { name: '周子钦', sid: '102402150', college: '计算机学院', contact: '13800138000' };

  /* 展示用的"发布者"：演示时用固定几个人，避免暴露真实手机号 */
  var POSTERS = {
    '13800138000': { nick: '周同学' },
    '13900139000': { nick: '林同学' },
    'wei_xin_2024': { nick: '陈同学' },
    'lin@fzu.edu.cn': { nick: '黄同学' }
  };

  return {
    CATEGORIES: CATEGORIES,
    HOME_CHIPS: HOME_CHIPS,
    AREAS: AREAS,
    TIME_RANGES: TIME_RANGES,
    TYPES: TYPES,
    CAT_ICON: CAT_ICON,
    ICON: ICON,
    SEED: SEED,
    ME: ME,
    POSTERS: POSTERS
  };
});
