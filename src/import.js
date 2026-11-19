(function (root, factory) { const api = factory(typeof module === 'object' && module.exports ? require('./engine.js') : root.MenuWiseEngine); if (typeof module === 'object' && module.exports) module.exports = api; else root.MenuWiseImport = api; })(typeof globalThis !== 'undefined' ? globalThis : this, function (E) {
  'use strict';
  const columns = [ ['name','菜品'], ['price','售价'], ['food','食材成本'], ['packaging','包装成本'], ['labor','计件人工'], ['other','其他变动成本'], ['feeRate','抽成百分比'], ['qty','月销量'], ['minutes','单份瓶颈分钟'], ['demand','每日需求上限'], ['min','每日最低供应'], ['avoidable','月可避免固定成本'] ];
  function parseCSV(text, delimiter = ',') {
    text = text.replace(/^\uFEFF/, '');
    const rows = []; let row = [], field = '', quoted = false, afterQuote = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) { if (c === '"' && text[i + 1] === '"') { field += '"'; i++; } else if (c === '"') { quoted = false; afterQuote = true; } else field += c; }
      else if (c === delimiter || c === '\n' || c === '\r') { row.push(field); field = ''; afterQuote = false; if (c !== delimiter) { if (row.some(v => v !== '')) rows.push(row); row = []; if (c === '\r' && text[i + 1] === '\n') i++; } }
      else if (c === '"' && field === '' && !afterQuote) quoted = true;
      else { if (afterQuote || c === '"') throw new Error('CSV 引号格式不正确。'); field += c; }
    }
    if (quoted) throw new Error('CSV 中有未闭合的引号。');
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows;
  }
  function fromRows(rows, current) {
    if (rows.length < 2) throw new Error('文件至少需要表头和一行菜品。');
    if (rows.length > 41) throw new Error('最多支持 40 道菜品。');
    const headers = rows[0].map(h => String(h ?? '').trim());
    const indices = columns.map(([k, title]) => {
      const matches = headers.map((h, i) => h === k || h === title ? i : -1).filter(i => i >= 0);
      if (matches.length !== 1) throw new Error(`字段「${title}」缺失或重复，请使用导入模板。`);
      return matches[0];
    });
    const dishes = rows.slice(1).map((row, index) => {
      const d = { id: 'import-' + index };
      columns.forEach(([key, label], col) => {
        const raw = row[indices[col]];
        if (raw === undefined || raw === null || String(raw).trim() === '') throw new Error(`第 ${index + 2} 行的「${label}」为空。没有费用时请填写 0。`);
        if (typeof raw === 'object') throw new Error(`第 ${index + 2} 行包含公式或非数值单元格，请粘贴为数值后导入。`);
        if (key === 'name') d[key] = String(raw).trim();
        else { if (!/^\d+(\.\d+)?$/.test(String(raw).trim())) throw new Error(`第 ${index + 2} 行的「${label}」须为非负数字，不含货币符号或千位分隔符。`); d[key] = Number(raw); }
      });
      return d;
    });
    const data = { ...E.clone(current), dishes, source: 'imported', revision: current.revision + 1 };
    const check = E.validate(data); if (check.errors.length) throw new Error(check.errors.join('\n'));
    return { data, warnings: check.warnings };
  }
  function csvCell(value) { let s = String(value ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; }
  function toCSV(rows) { return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n'); }
  function menuCSV(data) { return toCSV([columns.map(c => c[1]), ...data.dishes.map(d => columns.map(c => d[c[0]]))]); }
  return { columns, parseCSV, fromRows, toCSV, menuCSV };
});
