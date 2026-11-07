# koinly-exporter

Exports all your Koinly transactions to CSV from the browser console. It uses the same JSON API the Koinly web app uses (`https://api.koinly.io/api/transactions`).

## Usage

1. Log in to Koinly (`app-beta.koinly.io` or `app.koinly.io`).
2. Open DevTools → Console.
3. Read [`koinly-export.js`](koinly-export.js), then paste it into the console and press Enter. It uses your logged-in session but only sends GET requests to `api.koinly.io`.
4. Progress is logged per page (about 100 transactions per page). When it finishes, `koinly_transactions_<date>.csv` downloads.

The results also stay in `window.koinlyExport` (`.transactions` holds the raw objects, `.csv` the CSV text).

### Options

Set options before pasting the script:

```js
window.KOINLY_EXPORT_OPTIONS = { excludeIgnored: true, saveJsonl: true }
```

- `excludeIgnored`: skip transactions marked as ignored (the app's default view). Default `false`.
- `saveJsonl`: also download every raw API object as JSON Lines, for fields not in the CSV. Default `false`.
- `maxPages`: stop after N pages, for a quick trial. Default all pages.
- `download`: set to `false` to keep the results only in `window.koinlyExport`.

## CSV columns

There is one row per transaction, including child transactions of grouped entries (see `parent_transaction_id` / `has_children`).

- `from_*`, `to_*` and `fee_*` hold each leg's amount, currency symbol and id, wallet name and id, and cost basis.
- Other columns include `net_value`, `fee_value`, `gain`, `txhash`, `txurl`, `ignored`, `label`, `description` and timestamps.
- Values are in your Koinly base currency.

The API is undocumented and may change without notice.
