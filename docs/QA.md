# MenuWise 2.0 verification

## Result and environment

Windows, Node 24, local file:// build in isolated Microsoft Edge and Google Chrome profiles. Desktop 1536×1024; mobile 390×844. Browser plugin was not available (no Browser skill in the session), so the frontend-testing skill’s regular Playwright path was used. The offline single HTML is the tested target; no server or installation is required by users.

The flow under test was: welcome → sample overview → interactive diagnosis → scenario edit → saved decision → actual review → bilingual report → own-data import → shared-data reuse → reload.

| Check | Result / evidence |
|---|---|
| Identity, meaningful content, no error overlay | All 10 routes render in both languages |
| Console/runtime health | Zero page errors in complete Edge and Chrome runs |
| Offline requests | Zero HTTP(S) requests through all tested local workflows |
| Core economics/imports/build | 76 passing Node tests; 300 independently exhaustive optimizer cases |
| Charts | Scatter focus/tooltip/selection, axis switch, line legend and volume slider tested |
| Stale output | Invalid price clears advice/results; valid input recalculates |
| Data entry | Four required fields, basic/advanced switching, explicit cost-source choice, shared settings |
| Imports | CSV custom mappings, semicolon and decimal commas; XLSX worksheet/header selection; known zero time |
| Unknowns | Sample overhead/settings cleared on real import; unknown profit withheld; incomplete capacity blocked |
| History | Snapshot independence, review status, checklist, actual profit, mismatch warning, comparison |
| Export/persistence | JSON backup/restore, Excel template, HTML report, English/Chinese PDF, reload |
| Language | UI, chart labels, advice and reports switch; user-authored text retained |
| Responsive | No horizontal page overflow across 9 main mobile routes; drawer opens/closes |
| Visual QA | Desktop overview/pricing/capacity and mobile screenshots inspected; PDF pages rendered and inspected |

## Regression coverage

`tests/engine.test.cjs` preserves the independently worked v1 economic examples. Its replacement-resource test now checks total post-removal capacity, allowing already-idle time. `tests/v2.test.cjs` covers integer commission ties, total-versus-detailed costs, zero-resource optimization, flat/boundary CVP, unknown data, flexible imports, migration, snapshots, language keys and literal script packaging.

The sample remains: revenue ¥107,900, variable costs ¥42,510, contribution ¥65,390, fixed costs ¥34,900, operating profit ¥30,490. Price A adds ¥1,300 and requires 1,398 portions. At 600 daily bottleneck minutes, the exact optimum earns ¥2,946 daily contribution and ¥41,696 monthly operating profit. At 660 minutes with ¥80/day expansion cost, profit is ¥45,986.

## Reproduce (developers only)

Run `npm run build` and `npm test`. There are no install-time dependencies for these checks.

The optional `tests/browser.cjs` requires Playwright and ExcelJS, and installed Edge or Chrome. Set `MENUWISE_PLAYWRIGHT` and `MENUWISE_EXCELJS` to their module paths if they are not installed in the project. `MENUWISE_BROWSER=chrome` selects Chrome; otherwise Edge is used. `MENUWISE_QA_DIR` optionally selects a dedicated test-output directory. Run `node tests/browser.cjs`. It uses isolated profiles and fictional data, writes test fixtures in its output directory, and refreshes the two sample PDFs under `docs/`.

Key evidence: `v2-overview-en.png`, `v2-pricing-en.png`, `v2-capacity-zh.png`, `v2-mobile-overview.png`, and `sample-report-en.pdf` / `sample-report-zh.pdf`.

## Limits of verification

Safari, Firefox and physical phones were not tested. Mobile evidence is Chromium viewport emulation. User-authored names/notes are not automatically translated. PDF output uses the browser print dialog; installed printer settings can affect pagination. No real restaurant data or demand has been independently verified. The kitchen model is one bottleneck and assumes all planned output sells. Source code/static output are deployed privately; browser storage is not uploaded or synchronized.
