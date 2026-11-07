// Koinly transaction exporter: paste into the DevTools console while logged in to Koinly
// (app.koinly.io or app-beta.koinly.io). Downloads koinly_transactions.csv (and optionally raw JSONL).
// Read it before running: it uses your logged-in session, but only sends GET requests to api.koinly.io.
(async (opts = {}) => {
  const {
    excludeIgnored = false, // true matches the app's default view, which hides ignored transactions
    saveJsonl = false, // also download every raw API object, for fields not in the CSV
    download = true,
    maxPages = Infinity,
    perPage = 100, // API rejects anything above 100
  } = { ...(window.KOINLY_EXPORT_OPTIONS || {}), ...opts };

  const API = "https://api.koinly.io/api/transactions";

  const readLocal = (k) => {
    const v = localStorage.getItem(k);
    try { return JSON.parse(v); } catch { return v; }
  };
  const readCookie = (k) => {
    const m = document.cookie.match(new RegExp("(?:^|; )" + k + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : null;
  };
  // New design keeps the session in localStorage; the old design used cookies.
  const token = readLocal("session.apiToken") || readCookie("API_KEY");
  const portfolio = readLocal("session.portfolioId") || readCookie("PORTFOLIO_ID");
  if (!token || !portfolio) throw new Error("Koinly session not found. Run this on a logged-in Koinly tab.");
  const headers = { "x-auth-token": token, "x-portfolio-token": portfolio, accept: "application/json" };

  const getPage = async (page) => {
    const params = new URLSearchParams({ per_page: perPage, order: "date", page });
    if (excludeIgnored) { params.set("q[m]", "and"); params.set("q[ignored_false]", "1"); }
    for (let attempt = 0; ; attempt++) {
      const r = await fetch(`${API}?${params}`, { headers, credentials: "omit" });
      if (r.ok) return r.json();
      if ([429, 500, 502, 503, 504].includes(r.status) && attempt < 5) {
        await new Promise((res) => setTimeout(res, 1000 * 2 ** attempt));
        continue;
      }
      throw new Error(`HTTP ${r.status} on page ${page}: ${(await r.text()).slice(0, 300)}`);
    }
  };

  const LEG_FIELDS = ["amount", "currency", "currency_id", "wallet", "wallet_id", "cost_basis"];
  const TOP_FIELDS = [
    "net_value", "fee_value", "gain", "description", "txhash", "txsrc", "txdest", "txurl",
    "method_name", "contract_address", "ignored", "ignored_reason", "manual", "imported", "synced",
    "missing_rates", "missing_cost_basis", "negative_balances", "cost_basis_method", "group_name",
    "parent_transaction_id", "has_children", "from_source", "to_source", "reviewed_at",
    "created_at", "updated_at",
  ];
  const COLUMNS = [
    "id", "date", "type", "label",
    ...["from", "to", "fee"].flatMap((leg) => LEG_FIELDS.map((f) => `${leg}_${f}`)),
    ...TOP_FIELDS,
  ];

  const flatten = (t) => {
    const row = { id: t.id, date: t.date, type: t.type, label: t.label };
    for (const leg of ["from", "to", "fee"]) {
      const l = t[leg] || {};
      Object.assign(row, {
        [`${leg}_amount`]: l.amount,
        [`${leg}_currency`]: l.currency?.symbol,
        [`${leg}_currency_id`]: l.currency?.id,
        [`${leg}_wallet`]: l.wallet?.name,
        [`${leg}_wallet_id`]: l.wallet?.id,
        [`${leg}_cost_basis`]: l.cost_basis,
      });
    }
    for (const k of TOP_FIELDS) row[k] = t[k];
    return row;
  };

  const cell = (v) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  // A sync landing mid-export shifts page boundaries, so rows are keyed by id to drop repeats.
  const txns = new Map();
  let page = 1, totalPages = 1, totalItems = "?";
  do {
    const data = await getPage(page);
    totalPages = Math.min(data.meta?.page?.total_pages ?? 0, maxPages);
    totalItems = data.meta?.page?.total_items ?? totalItems;
    for (const t of data.transactions || []) txns.set(t.id, t);
    console.log(`Koinly export: page ${page}/${totalPages} (${txns.size}/${totalItems} transactions)`);
    page++;
  } while (page <= totalPages);

  const all = [...txns.values()];
  const csv = [COLUMNS.join(","), ...all.map((t) => { const r = flatten(t); return COLUMNS.map((c) => cell(r[c])).join(","); })].join("\r\n");

  const save = (text, name, type) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  };
  const stamp = new Date().toISOString().slice(0, 10);
  if (download) {
    save(csv, `koinly_transactions_${stamp}.csv`, "text/csv");
    if (saveJsonl) save(all.map((t) => JSON.stringify(t)).join("\n"), `koinly_transactions_${stamp}.jsonl`, "application/x-ndjson");
  }
  window.koinlyExport = { transactions: all, csv };
  console.log(`Koinly export: done, ${all.length} transactions. Also available as window.koinlyExport.`);
  return { count: all.length, totalItems, columns: COLUMNS.length };
})();
