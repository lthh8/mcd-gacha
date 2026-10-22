#!/usr/bin/env node
/**
 * 麦当劳 MCP 只读客户端 —— 麦门图鉴 Skill 的数据层
 * 零依赖，Node 18+（使用全局 fetch）。Token 仅从环境变量读取，切勿写入任何文件。
 *
 * 用法：
 *   export MCD_MCP_TOKEN=<你的Token>
 *   node mcd-mcp-client.mjs tools              # 列出 MCP 工具并标注只读/危险
 *   node mcd-mcp-client.mjs orders [pageSize]  # 历史订单摘要（Top 单品/门店/时间范围）
 *   node mcd-mcp-client.mjs account            # 积分账户
 *   node mcd-mcp-client.mjs coupons            # 我的优惠券
 *   node mcd-mcp-client.mjs prizes             # 我的奖品
 *   node mcd-mcp-client.mjs nutrition <关键词> # 餐品营养查询
 *   node mcd-mcp-client.mjs luck               # 欧气值 + 本命卡（图鉴算法数据源）
 *
 * 安全策略：默认 fail-closed。只有命中只读规则的工具可调用；
 * 任何写操作（下单/领券/抽奖/取消/删除）一律拒绝，需要显式 --force <tool> 且需人工复核。
 */
const MCP_URL = process.env.MCD_MCP_URL || 'https://mcp.mcd.cn';
const TOKEN = process.env.MCD_MCP_TOKEN;

if (!TOKEN) {
  console.error('❌ 缺少环境变量 MCD_MCP_TOKEN。请先在麦当劳 MCP 控制台申请 Token，然后：\n' +
                '   export MCD_MCP_TOKEN=<你的Token>');
  process.exit(2);
}

/* ---------- JSON-RPC over Streamable HTTP ---------- */
let sessionId = null;
let reqId = 0;

async function rpc(method, params = {}) {
  const headers = {
    'Authorization': 'Bearer ' + TOKEN,
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
  };
  if (sessionId) headers['mcp-session-id'] = sessionId;
  const res = await fetch(MCP_URL, {
    method: 'POST', headers,
    body: JSON.stringify({ jsonrpc: '2.0', id: ++reqId, method, params }),
  });
  const sid = res.headers.get('mcp-session-id');
  if (sid) sessionId = sid;
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  return parseBody(text);
}

/** 兼容两种返回体：纯 JSON 或 SSE（data: 行） */
function parseBody(text) {
  const t = text.trim();
  if (t.startsWith('{') || t.startsWith('[')) return JSON.parse(t);
  let last = null;
  for (const line of t.split('\n')) {
    const m = line.match(/^data:\s*(.+)$/);
    if (m) { try { last = JSON.parse(m[1]); } catch { /* 跳过非 JSON 行 */ } }
  }
  if (last === null) throw new Error('无法解析响应体：' + t.slice(0, 200));
  return last;
}

/** 从 tools/call 结果中取出文本与结构化内容 */
function callResult(d) {
  const r = d.result || {};
  if (r.isError) {
    const msg = (r.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n');
    throw new Error('MCP 返回错误：' + (msg || JSON.stringify(r).slice(0, 300)));
  }
  const text = (r.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n');
  return { text, structured: r.structuredContent || null };
}

/** MCP 工具常把 JSON 塞在 markdown 的 "## Original Response" 之后，尽量抠出来 */
function digJSON(text) {
  if (!text) return null;
  const m = text.match(/## Original Response\s*(\{[\s\S]*\})\s*$/);
  if (m) { try { return JSON.parse(m[1]); } catch { /* 落入通用扫描 */ } }
  const i = text.indexOf('{"');
  if (i >= 0) {
    for (let j = text.length; j > i; j--) {
      try { return JSON.parse(text.slice(i, j)); } catch { /* 继续缩短 */ }
    }
  }
  return null;
}

/** 统一输出：能解析出 JSON 就解析，解析不了就包一层 raw，保证输出恒为 JSON */
function out(primary, fallbackText) {
  let j = primary || digJSON(fallbackText);
  if (typeof j === 'string') j = { raw: j };   // 有些工具把文本塞进 structuredContent
  console.log(JSON.stringify(j || { raw: fallbackText }, null, 2));
}

/* ---------- 只读安全策略（fail-closed） ----------
 * 第一道：显式只读白名单（35 个官方工具已逐个研判，见下方 READONLY_TOOLS）
 * 第二道：写操作特征正则（兜底，\b 边界避免 "addresses" 误命中 "add"）
 * 两者都没结论 → unknown，默认拒绝，必须人工确认后加 --force
 */
const READONLY_TOOLS = new Set([
  'order-list', 'mall-order-list', 'mall-order-detail', 'query-order',
  'query-my-account', 'query-my-coupons', 'query-my-prizes', 'available-coupons',
  'query-store-coupons', 'query-survey-coupon', 'query-promotions',
  'list-nutrition-foods', 'query-meals', 'query-meal-detail', 'query-meal-assistance',
  'query-nearby-stores', 'delivery-query-stores', 'delivery-query-addresses',
  'query-party-store', 'query-party-store-session', 'query-party-store-date', 'query-party-city',
  'mall-points-products', 'mall-product-detail', 'calculate-price',
  'query-lottery-info', 'campaign-calendar', 'now-time-info',
]);
const WRITE_PATTERN = /\b(create|add|cancel|delete|remove|bind|unbind|draw|lottery|pay|purchase|submit|confirm|redeem|use|apply|claim|activate|update|modify|scan|checkout|settle|refund|order)\b/i;

function classify(name) {
  if (READONLY_TOOLS.has(name)) return 'read';
  if (WRITE_PATTERN.test(name)) return 'write';
  return 'unknown';
}

async function callTool(name, args = {}, force = false) {
  const kind = classify(name);
  if (kind === 'write') throw new Error(`已拒绝调用写操作工具「${name}」（可能改动账户状态）。本客户端仅允许只读。`);
  if (kind === 'unknown' && !force) throw new Error(`工具「${name}」不在只读白名单。请先人工确认其为只读，再加 --force 调用。`);
  const d = await rpc('tools/call', { name, arguments: args });
  return callResult(d);
}

/* ---------- 单品 → 卡牌 id 映射（与 Demo 的 FOODS 对齐） ---------- */
const CARD_MAP = [
  [/安格斯|厚牛/, 'angus'], [/巨无霸/, 'big_mac'], [/麦旋风|冰淇淋|圣代/, 'mcflurry'],
  [/麦辣|辣翅|辣堡/, 'spicy_chicken'], [/薯条/, 'fries'], [/板烧/, 'banshao'],
  [/双层吉士|吉士堡/, 'double_cheese'], [/可乐/, 'coke'], [/麦乐鸡|鸡块/, 'mcnuggets'],
  [/麦香鱼|鱼堡/, 'filet_o_fish'], [/甜筒|甜筒/, 'cone'], [/麦咖啡|拿铁|美式/, 'mccafe'],
  [/苹果派/, 'apple_pie'], [/玉米/, 'corn'], [/奶昔/, 'shake'], [/猪柳蛋|麦满分|早餐/, 'sausage_egg'],
];

/* ---------- 子命令 ---------- */
const [cmd, ...rest] = process.argv.slice(2);
const force = rest.includes('--force');
const args = rest.filter(a => a !== '--force');

async function ensureInit() {
  await rpc('initialize', {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'mcd-gacha-skill', version: '1.0.0' },
  });
  try { await rpc('notifications/initialized', {}); } catch { /* 无状态实现可忽略 */ }
}

function fmtOrders(data) {
  const list = (data && data.list) || [];
  const prod = {}, stores = {}, times = [];
  for (const o of list) {
    const s = o.storeName || o.store || '未知门店';
    stores[s] = (stores[s] || 0) + 1;
    const t = o.createTime || o.orderTime || o.payTime;
    if (t) times.push(t);
    for (const it of (o.orderProductList || o.products || [])) {
      const n = it.productName || it.name || '?';
      prod[n] = (prod[n] || 0) + Number(it.quantity || it.count || 1);
    }
  }
  return {
    订单条数: list.length,
    时间范围: times.length ? [times.slice().sort()[0], times.slice().sort().at(-1)] : null,
    单品Top: Object.entries(prod).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([n, c]) => ({ 单品: n, 数量: c })),
    常去门店: Object.entries(stores).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([s, c]) => ({ 门店: s, 单数: c })),
  };
}

(async () => {
  await ensureInit();

  switch (cmd) {
    case 'tools': {
      const d = await rpc('tools/list', {});
      const tools = (d.result && d.result.tools) || [];
      const rows = tools.map(t => ({
        工具: t.name,
        权限: classify(t.name) === 'read' ? '只读✅' : classify(t.name) === 'write' ? '写操作⛔' : '未知⚠️',
        说明: String(t.description || '').split('\n')[0].slice(0, 60),
      }));
      console.log(JSON.stringify({ 总数: tools.length, 只读: rows.filter(r => r.权限 === '只读✅').length, 工具: rows }, null, 2));
      break;
    }
    case 'orders': {
      const size = Number(args[0] || 20);
      const { structured, text } = await callTool('order-list', { pageSize: String(size) });
      const data = (structured && structured.data) || digJSON(text) || {};
      console.log(JSON.stringify(fmtOrders(data), null, 2));
      break;
    }
    case 'account': {
      const { structured, text } = await callTool('query-my-account', {});
      out(structured && structured.data, text);
      break;
    }
    case 'coupons': {
      const { structured, text } = await callTool('query-my-coupons', {});
      out(structured && structured.data, text);
      break;
    }
    case 'prizes': {
      const { structured, text } = await callTool('query-my-prizes', {});
      out(structured && structured.data, text);
      break;
    }
    case 'nutrition': {
      const kw = args[0];
      if (!kw) { console.error('用法：nutrition <关键词>'); process.exit(2); }
      const { structured, text } = await callTool('list-nutrition-foods', { keyword: kw });
      out(structured && structured.data, text);
      break;
    }
    case 'luck': {
      const [{ structured: os, text: ot }, { structured: as_, text: at }] = await Promise.all([
        callTool('order-list', { pageSize: '50' }),
        callTool('query-my-account', {}),
      ]);
      const orders = (os && os.data) || digJSON(ot) || {};
      const account = (as_ && as_.data) || digJSON(at) || {};
      const o = fmtOrders(orders);
      const top = (o.单品Top || [])[0];
      let card = null;
      if (top) {
        for (const [re, id] of CARD_MAP) if (re.test(top.单品)) { card = id; break; }
      }
      const points = Number(account.availablePoint ?? account.point ?? account.points ?? 0) || 0;
      const heat = (o.单品Top || []).reduce((s, x) => s + x.数量, 0);
      const 欧气值 = Number(((heat * 0.6 + points * 0.4) / 10).toFixed(1));
      console.log(JSON.stringify({
        本命卡: card, 本命单品: top ? top.单品 : null,
        历史订单: o.订单条数, 单品热度: heat, 积分: points,
        欧气值, 图鉴建议: card ? `优先抽取并高亮「${card}」` : '订单不足，本命卡随机',
      }, null, 2));
      break;
    }
    default:
      console.error('子命令：tools | orders [pageSize] | account | coupons | prizes | nutrition <kw> | luck');
      process.exit(2);
  }
})().catch(e => { console.error('❌ ' + e.message); process.exit(1); });
