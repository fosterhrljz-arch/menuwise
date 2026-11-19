/* MenuWise economic engine. Pure functions, no browser or storage dependencies. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MenuWiseEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const cents = n => Math.round(n * 100);
  const money = n => n / 100;
  const sum = a => a.reduce((s, n) => s + n, 0);
  const clone = x => JSON.parse(JSON.stringify(x));
  const moneyKeys = ['price', 'food', 'packaging', 'labor', 'other', 'avoidable'];
  const numericKeys = [...moneyKeys, 'feeRate', 'qty', 'minutes', 'demand', 'min'];
  function completeness(data) {
    const s = data.settings, days = s.daysKnown !== false;
    const time = s.capacityKnown !== false && data.dishes.every(d => d.timeKnown !== false);
    const demand = data.dishes.every(d => d.demandKnown !== false);
    return { fixed: s.fixedKnown !== false, days, time, demand, operations: days && time && demand };
  }
  function validNumber(n, min = 0, max = 1000000) { return typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max; }
  function precision(n, step) { return Math.abs(n / step - Math.round(n / step)) < 1e-6; }
  function validate(data) {
    const errors = [], warnings = [];
    if (!data || !data.settings || !Array.isArray(data.dishes)) return { errors: ['缺少餐厅设置或菜品数据。'], warnings };
    const s = data.settings;
    if (typeof s.name !== 'string' || !s.name.trim() || s.name.length > 80) errors.push('餐厅名称需为 1–80 个字符。');
    if (!validNumber(s.days, 1, 31) || !Number.isInteger(s.days)) errors.push('每月营业天数须为 1–31 的整数。');
    if (!validNumber(s.commonFixed) || !precision(s.commonFixed, .01)) errors.push('共享固定成本须为非负金额，最多两位小数。');
    if (!validNumber(s.target) || !precision(s.target, .01)) errors.push('目标利润须为非负金额，最多两位小数。');
    if (!validNumber(s.capacity, 0, 10000) || !precision(s.capacity, .5)) errors.push('每日瓶颈产能须为 0–10,000 分钟，按 0.5 分钟计。');
    if (data.dishes.length < 1 || data.dishes.length > 40) errors.push('请提供 1–40 道菜品。');
    const names = new Set(), ids = new Set();
    data.dishes.forEach((d, i) => {
      const prefix = `第 ${i + 1} 行`;
      if (!d || typeof d !== 'object') { errors.push(`${prefix}不是有效菜品。`); return; }
      if (typeof d.name !== 'string' || !d.name.trim() || d.name.length > 80) errors.push(`${prefix}：菜名需为 1–80 个字符。`);
      else if (names.has(d.name.trim())) errors.push(`${prefix}：菜名重复。`);
      if (typeof d.name === 'string') names.add(d.name.trim());
      if (typeof d.id !== 'string' || !d.id || ids.has(d.id)) errors.push(`${prefix}：菜品标识缺失或重复。`);
      ids.add(d.id);
      for (const k of moneyKeys) if (!validNumber(d[k]) || !precision(d[k], .01)) errors.push(`${prefix}：${k} 须为非负金额，最多两位小数。`);
      if (d.costMode === 'total' && (!validNumber(d.variableCost) || !precision(d.variableCost, .01))) errors.push(`${prefix}：variableCost 须为非负金额，最多两位小数。`);
      if (!validNumber(d.feeRate, 0, 100) || !precision(d.feeRate, .01)) errors.push(`${prefix}：抽成比例须为 0–100%，最多两位小数。`);
      if (!validNumber(d.qty, 0, 1000000) || !Number.isInteger(d.qty)) errors.push(`${prefix}：月销量须为非负整数，最多 1,000,000。`);
      if (!validNumber(d.minutes, 0, 10000) || !precision(d.minutes, .5)) errors.push(`${prefix}：每份瓶颈用时须为 0–10,000 分钟，按 0.5 分钟计。`);
      for (const k of ['demand', 'min']) if (!validNumber(d[k], 0, 10000) || !Number.isInteger(d[k])) errors.push(`${prefix}：每日需求与最低供应须为 0–10,000 的整数。`);
      if (d.demandKnown !== false && d.min > d.demand) warnings.push(`${d.name}：最低供应超过需求上限，产能方案不可行。`);
      if (d.demandKnown !== false && s.daysKnown !== false && d.qty > d.demand * s.days) warnings.push(`${d.name}：历史日均销量高于未来需求上限，请核实两个期间的差异。`);
      if (moneyKeys.every(k => validNumber(d[k])) && validNumber(d.feeRate, 0, 100) && unit(d).cm <= 0) warnings.push(`${d.name}：单份贡献非正，增加销量不能帮助覆盖固定成本。`);
    });
    if (!errors.length) {
      const gross = sum(data.dishes.map(d => (Math.abs(unit(d).cmCents) + unit(d).variableCents + cents(d.price)) * d.qty));
      if (!Number.isSafeInteger(gross) || gross > 1e13) { errors.push('数据规模超出可精确计算的金额范围，请缩短分析周期或减少数量。'); return { errors, warnings }; }
      const t = totalsUnchecked(data);
      if (completeness(data).time && s.daysKnown !== false && t.usedMinutes > s.capacity * s.days) warnings.push('历史销量所需平均用时超出当前产能；请核对用时、营业日或产能。');
      if (s.fixedKnown !== false && s.commonFixed === 0) warnings.push('共享固定成本为零；请核实房租、固定工资和折旧是否遗漏。');
    }
    return { errors, warnings };
  }
  function assertData(data) { const v = validate(data); if (v.errors.length) throw new Error(v.errors.join('\n')); return v; }
  function unit(d, price = d.price) {
    const commissionCents = Math.floor((cents(price) * Math.round(d.feeRate * 100) + 5000) / 10000);
    const baseCostCents = d.costMode === 'total' ? cents(d.variableCost) : sum(['food', 'packaging', 'labor', 'other'].map(k => cents(d[k])));
    const variableCents = baseCostCents + commissionCents;
    const cmCents = cents(price) - variableCents;
    return { price, commission: money(commissionCents), baseCost: money(baseCostCents), variable: money(variableCents), cm: money(cmCents), cmCents, variableCents, perMinute: d.minutes > 0 && d.timeKnown !== false ? money(cmCents) / d.minutes : null };
  }
  function totalsUnchecked(data) {
    const rows = data.dishes.map(d => { const u = unit(d); return { ...d, ...u, revenue: money(cents(d.price) * d.qty), contribution: money(u.cmCents * d.qty), variableTotal: money(u.variableCents * d.qty), usedMinutes: d.minutes * d.qty }; });
    const revenue = money(sum(rows.map(d => cents(d.revenue)))), contribution = money(sum(rows.map(d => cents(d.contribution))));
    const avoidable = money(sum(rows.map(d => cents(d.avoidable)))), fixed = money(cents(data.settings.commonFixed) + cents(avoidable));
    const profit = money(cents(contribution) - cents(fixed));
    return { rows, revenue, contribution, fixed, avoidable, variable: money(cents(revenue) - cents(contribution)), profit, units: sum(rows.map(d => d.qty)), usedMinutes: sum(rows.map(d => d.usedMinutes)), cmRatio: revenue > 0 ? contribution / revenue : null };
  }
  function totals(data) { assertData(data); return totalsUnchecked(data); }
  function numeric(n, label, min = 0, max = 1000000, step = .01) { if (!validNumber(n, min, max) || !precision(n, step)) throw new Error(`${label}超出允许范围或精度。`); }
  function priceScenario(data, id, { price, qty, extra = 0, label = '价格方案' }) {
    const t = totals(data), d = data.dishes.find(x => x.id === id);
    if (!d) throw new Error('未找到所选菜品。');
    numeric(price, '售价'); numeric(qty, '销量', 0, 1000000, 1); numeric(extra, '活动费用');
    const u = unit(d, price), old = unit(d);
    const delta = money(u.cmCents * qty - old.cmCents * d.qty - cents(extra));
    const usedMinutes = t.usedMinutes + (qty - d.qty) * d.minutes;
    const violations = [];
    const known = completeness(data);
    if (known.time && known.days && usedMinutes > data.settings.capacity * data.settings.days + 1e-8) violations.push('总用时超出月度可用瓶颈产能');
    data.dishes.forEach(item => {
      const q = item.id === id ? qty : item.qty;
      if (known.days && item.demandKnown !== false && q > item.demand * data.settings.days) violations.push(`${item.name}：销量超出填写的需求上限`);
      if (known.days && q < item.min * data.settings.days) violations.push(`${item.name}：销量低于填写的最低供应承诺`);
    });
    const numerator = old.cmCents * d.qty + cents(extra);
    const requiredQty = numerator <= 0 ? 0 : u.cmCents > 0 ? Math.ceil(numerator / u.cmCents) : null;
    const maxQtyToMaintain = u.cmCents < 0 && numerator <= 0 ? Math.floor(numerator / u.cmCents) : null;
    return { label, price, qty, extra, unitContribution: u.cm, requiredQty, maxQtyToMaintain, revenue: money(cents(t.revenue) - cents(d.price) * d.qty + cents(price) * qty), contribution: money(cents(t.contribution) - old.cmCents * d.qty + u.cmCents * qty), profit: money(cents(t.profit) + cents(delta)), delta, usedMinutes, feasible: !violations.length, verified: known.operations, violations };
  }
  function menuDecision(data, id, p) {
    const t = totals(data), d = data.dishes.find(x => x.id === id);
    if (!d) throw new Error('未找到所选菜品。');
    for (const k of ['saving', 'improveCost', 'relatedLoss', 'replacement', 'exitCost', 'promoteCost']) numeric(p[k], k);
    numeric(p.extraQty, '增加销量', 0, 1000000, 1);
    numeric(p.replacementMinutes, '替代业务瓶颈用时', 0, 10000000, .5);
    if (cents(p.saving) > cents(unit(d).baseCost)) throw new Error('单份节省不能高于可调整的单位变动成本（不含抽成）。');
    if (p.replacement > 0 && p.replacementMinutes <= 0) throw new Error('填写替代贡献时，请同时填写替代业务所需瓶颈分钟数。');
    const u = unit(d), freedMinutes = d.qty * d.minutes;
    const dropDelta = money(cents(d.avoidable) - u.cmCents * d.qty - cents(p.relatedLoss) + cents(p.replacement) - cents(p.exitCost));
    const promo = priceScenario(data, id, { price: d.price, qty: d.qty + p.extraQty, extra: p.promoteCost, label: '小规模推广' });
    const keep = priceScenario(data, id, { price: d.price, qty: d.qty, label: '保持现状' });
    const improve = { label: '降低变动成本', delta: money(cents(p.saving) * d.qty - cents(p.improveCost)), feasible: keep.feasible, violations: [...keep.violations] };
    improve.profit = money(cents(t.profit) + cents(improve.delta));
    const known = completeness(data);
    const drop = { label: '评估下架', delta: dropDelta, profit: money(cents(t.profit) + cents(dropDelta)), feasible: d.min === 0, verified: known.operations, violations: [] };
    if (known.time && known.days && t.usedMinutes - freedMinutes + p.replacementMinutes > data.settings.capacity * data.settings.days) { drop.feasible = false; drop.violations.push('替代后总用时仍超出产能'); }
    if (d.min > 0) drop.violations.push('存在最低供应承诺；解除后才能评估下架');
    for (const item of data.dishes.filter(x => x.id !== id)) {
      if (known.days && (item.demandKnown !== false && item.qty > item.demand * data.settings.days || item.qty < item.min * data.settings.days)) { drop.feasible = false; drop.violations.push(`${item.name}：保留菜品的销量超出需求或最低供应范围`); }
    }
    return { dish: d, freedMinutes, alternatives: [keep, improve, promo, drop], lostContribution: money(u.cmCents * d.qty) };
  }
  function cvp(data, target = data.settings.target, commonReduction = 0, costIncrease = 0) {
    const t = totals(data), s = data.settings;
    numeric(target, '目标利润'); numeric(commonReduction, '固定成本节省'); numeric(costIncrease, '成本上涨比例', 0, 100);
    if (commonReduction > s.commonFixed) throw new Error('固定成本节省不能超过共享固定成本。');
    const fixed = t.fixed - commonReduction;
    const variable = t.variable * (1 + costIncrease / 100);
    const contribution = t.revenue - variable;
    const ratio = t.revenue > 0 ? contribution / t.revenue : null;
    if (s.fixedKnown === false) return { status: 'incomplete', reason: '固定成本尚未确认。', fixed: null, ratio, breakEven: null, targetRevenue: null, feasible: false };
    const flat = ratio === 0 && fixed === 0 && target === 0, boundary = ratio < 0 && fixed === 0 && target === 0;
    if (ratio === null || ratio <= 0 && !flat && !boundary) return { status: 'undefined', reason: ratio === null ? '没有销售额，无法确定销售组合与贡献率。' : '贡献率非正，增加同组合销量无法覆盖正的固定成本或目标利润。', fixed, ratio, breakEven: null, targetRevenue: null, feasible: false };
    const breakEven = flat || boundary ? 0 : fixed / ratio, targetRevenue = flat || boundary ? 0 : (fixed + target) / ratio, factor = targetRevenue / t.revenue;
    const minScale = Math.max(0, ...data.dishes.filter(d => d.qty > 0).map(d => d.min * s.days / d.qty));
    const planFactor = Math.max(factor, minScale), plannedRevenue = t.revenue * planFactor;
    const targetMinutes = t.usedMinutes * planFactor;
    const rows = data.dishes.map(d => ({ id: d.id, name: d.name, exactMonthly: d.qty * planFactor, daily: d.qty * planFactor / s.days, demand: d.demand, min: d.min }));
    const violations = [];
    const known = completeness(data);
    if (known.time && known.days && targetMinutes > s.capacity * s.days + 1e-7) violations.push('按原销售组合，目标用时超过可用产能');
    if (known.days && rows.some((d,i) => data.dishes[i].demandKnown !== false && d.daily > d.demand + 1e-7)) violations.push('按原销售组合，部分菜品超过需求上限');
    if (known.days && rows.some(d => d.daily < d.min - 1e-7)) violations.push('按原销售组合，部分菜品低于最低供应承诺');
    if (boundary && planFactor > 0) violations.push('负贡献下最低供应承诺会产生亏损。');
    return { status: flat ? 'flat' : boundary ? 'boundary' : 'ok', fixed, ratio, breakEven, dailyBreakEven: known.days ? breakEven / s.days : null, targetRevenue, dailyTarget: known.days ? targetRevenue / s.days : null, targetUnits: t.units * factor, targetMinutes, target, rows, plannedRevenue, plannedDaily: known.days ? plannedRevenue / s.days : null, minimumSupplyAdjusted: planFactor > factor + 1e-8, marginOfSafety: flat || boundary ? null : t.revenue - breakEven, safetyRatio: flat || boundary ? null : (t.revenue - breakEven) / t.revenue, feasible: !violations.length, verified: known.operations, violations, currentProfit: contribution - fixed, costIncrease };
  }
  // Exact bounded integer knapsack. Time is represented in half-minute ticks;
  // values are integer cents. Binary decomposition preserves every integer quantity.
  function optimize(data, capacity = data.settings.capacity) {
    assertData(data); numeric(capacity, '瓶颈产能', 0, 10000, .5);
    if (!completeness(data).operations) return { status: 'incomplete', reason: '请先确认营业日、产能、菜品用时和需求上限。' };
    const rows = data.dishes, baseTicks = sum(rows.map(d => d.min * d.minutes * 2));
    if (rows.some(d => d.min > d.demand)) return { status: 'infeasible', reason: '最低供应超过需求上限。' };
    if (baseTicks > capacity * 2) return { status: 'infeasible', reason: `最低供应需要 ${baseTicks / 2} 分钟，超过 ${capacity} 分钟可用产能。` };
    const C = Math.round(capacity * 2 - baseTicks), groups = [];
    rows.forEach((d, i) => {
      const u = unit(d); if (u.cmCents <= 0 || d.minutes === 0) return;
      let remaining = Math.min(d.demand - d.min, Math.floor(C / (d.minutes * 2))), n = 1;
      while (remaining > 0) { const q = Math.min(n, remaining); groups.push({ i, q, w: Math.round(q * d.minutes * 2), v: q * u.cmCents }); remaining -= q; n *= 2; }
    });
    if ((C + 1) * groups.length > 20000000) return { status: 'limit', reason: '计算规模超过 2,000 万状态上限。请缩小每日产能或菜品数量；未输出近似最优方案。' };
    const dp = new Float64Array(C + 1); dp.fill(-Infinity); dp[0] = 0;
    const choices = [];
    for (const g of groups) {
      const take = new Uint8Array(C + 1);
      for (let c = C; c >= g.w; c--) if (dp[c - g.w] + g.v > dp[c]) { dp[c] = dp[c - g.w] + g.v; take[c] = 1; }
      choices.push(take);
    }
    let best = 0; for (let c = 1; c <= C; c++) if (dp[c] > dp[best]) best = c;
    const counts = rows.map(d => d.minutes === 0 && unit(d).cmCents > 0 ? d.demand : d.min); let cursor = best;
    for (let i = groups.length - 1; i >= 0; i--) if (choices[i][cursor]) { counts[groups[i].i] += groups[i].q; cursor -= groups[i].w; }
    const result = rows.map((d, i) => ({ id: d.id, name: d.name, qty: counts[i], minutes: d.minutes * counts[i], contribution: money(unit(d).cmCents * counts[i]), revenue: money(cents(d.price) * counts[i]) }));
    const contribution = money(sum(result.map(d => cents(d.contribution)))), revenue = money(sum(result.map(d => cents(d.revenue))));
    const used = sum(result.map(d => d.minutes));
    return { status: 'optimal', exact: true, rows: result, contribution, revenue, usedMinutes: used, remainingMinutes: capacity - used, capacity, profit: contribution - totalsUnchecked(data).fixed / data.settings.days, monthlyProfit: money(cents(contribution) * data.settings.days - cents(totalsUnchecked(data).fixed)), monthlyRevenue: money(cents(revenue) * data.settings.days), monthlyContribution: money(cents(contribution) * data.settings.days), states: (C + 1) * groups.length };
  }
  function bestAlternative(alternatives) { return alternatives.filter(a => a.feasible && Number.isFinite(a.profit)).reduce((best, a) => !best || a.profit > best.profit + .005 ? a : best, null); }
  function sample() {
    return { schemaVersion: 1, source: 'sample', revision: 1, settings: { name: '青禾面馆', days: 26, commonFixed: 32000, capacity: 600, target: 40000 }, dishes: [
      { id: 'beef', name: '招牌牛肉面', price: 28, food: 10, packaging: 1, labor: 0, other: 1, feeRate: 0, qty: 1560, minutes: 3.5, demand: 75, min: 30, avoidable: 600 },
      { id: 'tomato', name: '番茄鸡蛋面', price: 22, food: 6.5, packaging: 1, labor: 0, other: .5, feeRate: 0, qty: 1040, minutes: 3, demand: 55, min: 20, avoidable: 200 },
      { id: 'wonton', name: '红油抄手', price: 18, food: 5.5, packaging: 1, labor: 0, other: .5, feeRate: 0, qty: 780, minutes: 2.5, demand: 45, min: 10, avoidable: 1200 },
      { id: 'rice', name: '卤肉饭', price: 26, food: 9.5, packaging: 1, labor: 0, other: .5, feeRate: 0, qty: 650, minutes: 4, demand: 35, min: 10, avoidable: 900 },
      { id: 'cucumber', name: '凉拌黄瓜', price: 10, food: 2.5, packaging: .5, labor: 0, other: 0, feeRate: 0, qty: 520, minutes: 1, demand: 35, min: 0, avoidable: 0 },
      { id: 'tea', name: '自制柠檬茶', price: 8, food: 1.5, packaging: .5, labor: 0, other: 0, feeRate: 0, qty: 650, minutes: .5, demand: 40, min: 0, avoidable: 0 }
    ] };
  }
  return { cents, money, clone, numericKeys, completeness, validate, unit, totals, priceScenario, menuDecision, cvp, optimize, bestAlternative, sample };
});
