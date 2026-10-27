# Free offline Shopify supplier CSV audit

**Compare supplier SKU prices with a Shopify product export, inspect proposed changes, and review risky CSV fields before importing.** A genuinely free Node.js utility built from the same tested CSV engines that power [LocalCSV Lab](https://tools.trendbridged.com/).

No signup, npm dependencies, Shopify permissions, customer-file uploads, external APIs or advertising code. The CLI runs on your computer.

**Prefer a browser?** Try the free [SKU CSV Join](https://tools.trendbridged.com/tools/join-csv-by-key/), [Compare CSV Files](https://tools.trendbridged.com/tools/compare-csv-files/) and [Shopify CSV Preflight](https://tools.trendbridged.com/tools/shopify-csv-preflight/) tools. No signup required. The file-processing editors contain no third-party advertising scripts; the informational pages show **optional labeled ads only with affirmative visitor consent**.

## Try the open-source Shopify CSV inspector directly

**[Open the free online demo — no signup, no CSV upload, no ads](https://livastic-vm3-primary-tmp-260920.github.io/localcsv-shopify-supplier-audit/)**.

This is an educational, browser-local GitHub Pages demonstration of
the offline Shopify CSV preflight below. All checking and report
generation happen in your browser; it does not log in to or alter a
Shopify account. **Not affiliated with Shopify.** It may detect errors,
but passing checks does **not** guarantee a safe import.

**한국어:** [무료 Shopify 상품 CSV 사전 검사 바로 사용](https://livastic-vm3-primary-tmp-260920.github.io/localcsv-shopify-supplier-audit/) —
회원가입, 광고, CSV 업로드 없이 브라우저에서 검사합니다.
실제 Shopify 상품 업로드를 대신하거나 성공을 보장하지 않으므로
원본을 백업하세요.

---

## New: one-file OFFLINE Shopify CSV preflight (no Node install)

**[Download the fully self-contained HTML](https://github.com/livastic-vm3-primary-tmp-260920/localcsv-shopify-supplier-audit/releases/latest/download/shopify-csv-preflight.html)**. Open it directly in a modern browser with internet disconnected if you wish. Select ONE Shopify product CSV, choose Update or Create, then click **Inspect locally**. It reports errors and warnings and offers a CSV findings download. It needs **no account, npm install, analytics, external scripts, network requests or advertising**.

This standalone inspector complements the three-file Node CLI below. It **does not** connect to Shopify, check if image URLs resolve or guarantee an import will succeed. Back up your original export and carefully preserve variant option columns.

**한국어:** [오프라인 Shopify CSV 검사 HTML 파일 다운로드](https://github.com/livastic-vm3-primary-tmp-260920/localcsv-shopify-supplier-audit/releases/latest/download/shopify-csv-preflight.html). 다운로드한 HTML을 인터넷이 끊긴 상태에서 브라우저로 열고 상품 CSV를 선택하면 가격·재고·옵션 등의 오류를 확인하고 CSV 보고서를 내려받을 수 있습니다. **회원가입·프로그램 설치·파일 전송·광고 없이** 동작합니다. 실제 Shopify 가져오기를 자동으로 실행하거나 성공을 보장하지 않으므로 원본을 백업하세요.

The HTML source is retained at [offline/shopify-csv-preflight.html](offline/shopify-csv-preflight.html), generated reproducibly using [scripts/build_offline.py](scripts/build_offline.py). Running the CLI requires only Node.js 20; rebuilding or running the entire source test suite also requires Python 3.

---

## New: zero-install THREE-CSV supplier comparison (v1.2.0)

**[Download the free 3-CSV browser audit HTML](https://github.com/livastic-vm3-primary-tmp-260920/localcsv-shopify-supplier-audit/releases/latest/download/shopify-supplier-threeway-audit.html).** Save it, open it in a modern browser (even without an internet connection), and select: **current Shopify export**, **supplier SKU/cost CSV**, and **proposed Shopify product CSV**. It generates six local review reports covering SKU matches, exceptions, field changes and Shopify CSV preflight findings. No Node.js installation, signup, account token, merchant-file upload or advertising. Each input must be under 2.2 MB; ambiguous or blank comparison keys are rejected rather than guessed.

**This is a dry-run audit only.** It never imports or updates Shopify. In particular, do **not** import `supplier-matches-NOT-SHOPIFY-IMPORT.csv`: it includes private supplier-only columns. Keep the original product export, check handle/variant dependencies, and test a couple of products separately before any real update. The browser HTML reuses the exact four pure engines and six-report generator tested by this repository's CLI.

**한국어:** [공급업체 SKU 대조·Shopify 변경사항 검사 HTML 다운로드](https://github.com/livastic-vm3-primary-tmp-260920/localcsv-shopify-supplier-audit/releases/latest/download/shopify-supplier-threeway-audit.html). 다운로드 후 HTML 파일을 직접 열고 기존 상품 CSV·공급업체 SKU CSV·변경 예정 상품 CSV를 선택하세요. **SKU 매칭/누락·가격/재고 변경·상품 CSV 오류**를 6개 보고서로 확인할 수 있습니다. 모든 처리는 PC의 브라우저에서 이루어지며 파일 업로드·로그인·설치·광고는 없습니다. 분석용 공급업체 병합 CSV는 Shopify에 가져오면 안 됩니다.

Build reproducibly with `python3 scripts/build_supplier_browser.py`; verify via `--check`, `npm test`, and optional real Chrome smoke test `node scripts/smoke_supplier_browser.mjs`. The original CLI and single-CSV offline inspector remain available and unchanged.

---

## What it checks

Imagine a clothing store with two T-shirt sizes and one cap. You receive a supplier's updated prices and want to see which product fields will change before a bulk import.

1. **Supplier matching:** Left-join by SKU, preserving all existing Shopify rows and their order. The supplier SKU column must contain only unique, nonblank keys. Blank/missing Shopify SKU matches remain in an exceptions CSV.
2. **Before/after changes:** Compare current and proposed product exports by a **unique** SKU and report field-level changes, with CSV source row numbers. Ambiguous/blank SKU keys cause an error.
3. **Shopify CSV preflight:** Check handles, titles, variants, prices, inventory and image URL syntax. These are advisory diagnostics, **not** official Shopify import validation.

All included merchant data is **fictional**.

## Quick start — Node.js 20+

```bash
git clone https://github.com/livastic-vm3-primary-tmp-260920/localcsv-shopify-supplier-audit.git
cd localcsv-shopify-supplier-audit

# No npm install required.
npm test

node bin/localcsv-audit.mjs \
  --current fixtures/shopify-current-products.csv \
  --supplier fixtures/supplier-price-update.csv \
  --proposed fixtures/shopify-proposed-products.csv \
  --out ./my-local-reports
```

The output directory must **not exist already**. The script never overwrites an existing output or changes the input files.

**Expected result for fictional samples:** 3 product variant rows matched 3 supplier SKUs. The proposed file has 2 changed records and 1 unchanged record.

| SKU | Changed field | Before | Proposed |
| --- | --- | ---: | ---: |
| TEE-BLK-M | Price | 29.00 | 31.00 |
| CAP-WOOL | Inventory quantity | 7 | 6 |

### Reports written locally

| Report file | Purpose |
| --- | --- |
| `summary.json` | Match/exception counts, changed rows and preflight findings |
| `supplier-matches-NOT-SHOPIFY-IMPORT.csv` | Existing products with **extra Cost and Supplier columns** |
| `unmatched-skus.csv` | Empty/unknown Shopify SKU exceptions |
| `proposed-changes.csv` | Exact field-level old/new values |
| `preflight-current.csv` | Advisory findings about the original export |
| `preflight-proposed.csv` | Advisory findings about the proposed export |

**Never import the supplier-joined audit CSV directly into Shopify.** Its added vendor fields are for analysis only.

## Use real local files

```bash
node bin/localcsv-audit.mjs \
  --current /private/exports/shopify-current.csv \
  --supplier /private/exports/vendor-prices.csv \
  --proposed /private/exports/shopify-proposed.csv \
  --out /private/exports/review-2026-10-28
```

Keep supplier costs and customer data private. Nothing is uploaded. Do not commit reports or real merchant exports into a public GitHub repository.

## Important limitations

- **Not affiliated with or endorsed by Shopify.** The CLI does not connect to or update a Shopify account. A clean preflight does not guarantee safe import.
- Shopify product import/update behavior relies on product **URL handles** and variant option dependencies. This tool uses SKU as an **analysis key**, not a general Shopify update identity. See [official Shopify CSV guidance](https://help.shopify.com/en/manual/products/import-export/using-csv).
- Reused or blank SKU comparison keys are rejected, not guessed.
- Preserve a complete product export and all dependent variant rows. Test just one or two products before any real import.
- Image URLs are checked structurally; images are not downloaded.
- Spreadsheet-formula prefix escaping is defense-in-depth, not a guarantee for every spreadsheet, particularly after CSV re-save.
- The underlying CSV modules limit file/record sizes. Large catalogs should be split and reviewed separately.

## 한국어 사용법

**무료 Shopify 공급업체 SKU·상품 CSV 비교 도구**입니다. Node.js 20 이상에서 실행하며 회원가입, Shopify 로그인, API 키, 월 구독료, 파일 업로드가 필요하지 않습니다.

1. 기존 Shopify 상품 CSV를 **백업**합니다.
2. 공급업체 SKU/원가 CSV를 준비합니다. 공급업체 SKU는 중복 또는 빈 값이 없어야 합니다.
3. 변경 예정인 Shopify CSV를 별도 파일로 준비합니다.
4. 위 명령어의 `--current`, `--supplier`, `--proposed`에 파일 경로를 지정하고 `--out`은 **아직 없는 새 폴더**로 지정합니다.
5. 결과에서 SKU 누락, 가격·재고 변경, 옵션/가격 오류를 검토합니다.

**중요:** 공급업체 원가/공급처 열이 추가된 분석 보고서는 Shopify에 그대로 업로드하면 안 됩니다. Shopify 업데이트는 SKU만으로 이뤄지지 않으며 URL 핸들·옵션 열도 중요합니다. 실제 스토어에서는 원본을 보존하고 상품 1~2개만 먼저 테스트하세요.

설치 없이 사용할 수 있는 온라인 무료 도구:

- [CSV 키로 병합](https://tools.trendbridged.com/tools/join-csv-by-key/)
- [두 CSV 변경점 비교](https://tools.trendbridged.com/tools/compare-csv-files/)
- [Shopify CSV 사전 검사](https://tools.trendbridged.com/tools/shopify-csv-preflight/)

온라인 파일 편집기에는 Adsterra 광고 코드를 넣지 않았습니다. 안내 페이지의 광고는 방문자가 명시적으로 허용한 경우에만 로드됩니다.

## Contributing and privacy

Only share **synthetic** sample data in public issues. Never post customer identifiers, real merchant price lists, API keys or confidential CSVs. Run `npm test` for code changes. This repository has no backend, analytics SDK, ads, signup requirement or network requests.

This companion utility provides actual offline value and links to the existing free [LocalCSV Lab](https://tools.trendbridged.com/) website. A GitHub listing is **not** evidence of human visitors or Adsterra advertising earnings.

Licensed under MIT — see [LICENSE](LICENSE).
