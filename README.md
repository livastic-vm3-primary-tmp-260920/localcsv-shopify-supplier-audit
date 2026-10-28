# Free offline Shopify supplier CSV audit

**Compare supplier SKU prices with a Shopify product export, inspect proposed changes, and review risky CSV fields before importing.** A genuinely free Node.js utility built from the same tested CSV engines that power [LocalCSV Lab](https://tools.trendbridged.com/).

No signup, npm dependencies, Shopify permissions, customer-file uploads, external APIs or advertising code. The CLI runs on your computer.

**Prefer a browser?** Try the free [SKU CSV Join](https://tools.trendbridged.com/tools/join-csv-by-key/), [Compare CSV Files](https://tools.trendbridged.com/tools/compare-csv-files/) and [Shopify CSV Preflight](https://tools.trendbridged.com/tools/shopify-csv-preflight/) tools. No signup required. The file-processing editors contain no third-party advertising scripts; the informational pages show **optional labeled ads only with affirmative visitor consent**.

## Search discovery for the educational project pages

The two actual public, noncommercial GitHub Pages educational examples are
listed in the [small canonical sitemap](https://livastic-vm3-primary-tmp-260920.github.io/localcsv-shopify-supplier-audit/sitemap.xml):
the standalone one-file Shopify preflight example and the browser-local
three-CSV supplier audit. It intentionally excludes GitHub source downloads,
merchant CSV inputs, ad-funded pages on the original domain, and any
private editor or customer data. The sitemap is reproducible using
`python3 scripts/build_pages_sitemap.py --check`.

A sitemap only helps search-engine discovery. **It does not establish
indexation, actual human readers, qualified Adsterra impressions, account
approval, or earned publisher revenue.** This educational source demo has
no advertising code or data collection. Search Console for the already-verified
GitHub Pages host can receive the sitemap without touching the original
`tools.trendbridged.com` Search Console property.

---

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

## NEW: compare current Shopify prices against supplier costs with TWO CSVs (v1.5.0)

**[Open the free browser-only supplier SKU & cost checker](https://livastic-vm3-primary-tmp-260920.github.io/localcsv-shopify-supplier-audit/supplier-audit/)**. If you have only a current Shopify product export and a supplier SKU/cost CSV, choose **"No proposed CSV yet?"** in the file form and select those TWO files. It checks SKU matches, invalid/missing supplier costs, and prices below supplier cost. Download **five review-only reports**. You can also click **"Run fictional 2-CSV supplier cost review"** to see the full example without any file preparation.

**Crucial accuracy safeguard:** A TWO-file review does **NOT** check changed product fields, create a proposed export, invent Shopify import safety results, or claim that no product changes have occurred. The changed-fields reports are generated **only** if you supply a real proposed CSV as the third file. All cost comparisons assume the same currency and exclude sales tax, shipping, discounts, advertising, card fees and refunds. This is not actual profit or advice on price setting. **Never import supplier-joined or margin reports directly into Shopify.**

**한국어:** 현재 Shopify 상품 CSV와 공급업체 SKU/원가 CSV **두 파일만** 있으면 '변경 예정 CSV 없음'을 선택하여 SKU 대응, 원가 누락, 판매가가 공급가보다 낮은 상품을 확인할 수 있습니다. 5개 분석용 보고서를 다운로드합니다. **'두 파일 예제' 버튼으로 파일 준비 없이 무료 체험**할 수도 있습니다. 변경 예정 상품 CSV가 없으면 가격·재고 변경 비교는 **절대 수행하지 않습니다.** 통화가 동일하다는 가정이 필요하며 배송·광고·수수료·세금 등을 제외해 실제 이익을 계산한 것은 아닙니다.

---

## NEW v1.6.0: explicitly map a supplier's unusual column names

If your supplier sends a CSV headed **Vendor Ref, Net Unit Price, Vendor Name**
instead of the familiar SKU / Cost names, you no longer need to edit the
source file in Excel before review. The offline browser utility adds a
**Show supplier column names locally** button and TWO optional text fields.
After selecting the vendor file, inspect the exact header names and type
the intended **SKU** and **unit-cost** source columns explicitly. Both are
required if you choose manual mapping. Try the publicly licensed,
entirely [fictional mismatched-header supplier CSV](fixtures/supplier-custom-headers.csv)
with the [free no-ads browser demonstration](https://livastic-vm3-primary-tmp-260920.github.io/localcsv-shopify-supplier-audit/supplier-audit/).

This feature **only changes two header labels in a temporary in-memory CSV
used by the audit**. It preserves all other source columns and the original
vendor file. Duplicate/blank SKU keys, incorrect column names and a
mapping that collides with existing fields are rejected. It does not
guess variant sizes, colours, brand codes, currency, discounts or product
identities; merchants must verify mappings independently. It does not
generate a Shopify import. You can use it with either the **two-file
current-price review** (5 review reports) or the **three-file proposed
change review** (7 reports).

**한국어:** 공급업체가 SKU 대신 `Vendor Ref`, 원가 대신 `Net Unit Price`
처럼 다른 열 이름을 사용하는 경우, 무료 브라우저 도구에서
**열 이름 확인** 버튼으로 원본 제목을 확인하고 두 필드에 정확히
입력하세요. 이 기능은 **열 제목 두 개만 브라우저 메모리 안에서 임시로
연결**합니다. 원본 CSV를 고치거나 크기·색상·SKU·통화를 임의로
변환하지 않습니다. 애매한 매칭·중복 열·중복 SKU는 오류로 중단됩니다.
결과 파일은 Shopify 가져오기용이 아니라 검토 전용입니다.

Node CLI (optional explicit mapping, **two input CSV files**, local output):
```bash
node bin/localcsv-audit.mjs \
  --current fixtures/shopify-current-products.csv \
  --supplier fixtures/supplier-custom-headers.csv \
  --supplier-sku-column "Vendor Ref" \
  --supplier-cost-column "Net Unit Price" \
  --out ./private-supplier-review
```

---

## Try the three-file supplier comparison online — open-source demo

**[Open the free two- or three-file supplier SKU comparison](https://livastic-vm3-primary-tmp-260920.github.io/localcsv-shopify-supplier-audit/supplier-audit/)**. In three-file mode, run a real browser-only audit using current Shopify product CSV, a supplier SKU list, and a proposed CSV. It produces seven review-only reports and includes two one-click fictional workflows, plus an optional mismatched-header supplier CSV example. **New: click `Run fictional 3-CSV example` to generate all seven reports instantly without downloading or selecting sample files.** No login, file upload, network calls from the CSV editor, third-party scripts or advertising. It is an educational, noncommercial open-source reference implementation, not an importer. The original ad-opt-in LocalCSV Lab tools remain linked for single-file workflows.

**한국어:** [Shopify 공급업체 SKU CSV 3개 무료 비교 체험](https://livastic-vm3-primary-tmp-260920.github.io/localcsv-shopify-supplier-audit/supplier-audit/) — 기존 상품·공급업체·변경 예정 CSV를 브라우저 안에서 비교하고 7개 분석 보고서를 내려받습니다. 회원가입·파일 전송·광고 없이 사용하는 오픈소스 학습용 데모이며 Shopify 상품을 직접 수정하지 않습니다.

---

## New: one-file OFFLINE Shopify CSV preflight (no Node install)

**[Download the fully self-contained HTML](https://github.com/livastic-vm3-primary-tmp-260920/localcsv-shopify-supplier-audit/releases/latest/download/shopify-csv-preflight.html)**. Open it directly in a modern browser with internet disconnected if you wish. Select ONE Shopify product CSV, choose Update or Create, then click **Inspect locally**. It reports errors and warnings and offers a CSV findings download. It needs **no account, npm install, analytics, external scripts, network requests or advertising**.

This standalone inspector complements the three-file Node CLI below. It **does not** connect to Shopify, check if image URLs resolve or guarantee an import will succeed. Back up your original export and carefully preserve variant option columns.

**한국어:** [오프라인 Shopify CSV 검사 HTML 파일 다운로드](https://github.com/livastic-vm3-primary-tmp-260920/localcsv-shopify-supplier-audit/releases/latest/download/shopify-csv-preflight.html). 다운로드한 HTML을 인터넷이 끊긴 상태에서 브라우저로 열고 상품 CSV를 선택하면 가격·재고·옵션 등의 오류를 확인하고 CSV 보고서를 내려받을 수 있습니다. **회원가입·프로그램 설치·파일 전송·광고 없이** 동작합니다. 실제 Shopify 가져오기를 자동으로 실행하거나 성공을 보장하지 않으므로 원본을 백업하세요.

The HTML source is retained at [offline/shopify-csv-preflight.html](offline/shopify-csv-preflight.html), generated reproducibly using [scripts/build_offline.py](scripts/build_offline.py). Running the CLI requires only Node.js 20; rebuilding or running the entire source test suite also requires Python 3.

---

## Updated: zero-install Shopify supplier audit (TWO or THREE CSVs, v1.6.0)

**[Download the free 2- or 3-CSV browser audit HTML](https://github.com/livastic-vm3-primary-tmp-260920/localcsv-shopify-supplier-audit/releases/latest/download/shopify-supplier-threeway-audit.html).** Save it, open it in a modern browser (even without an internet connection). Choose the two-file supplier-cost mode or select: **current Shopify export**, **supplier SKU/cost CSV**, and **proposed Shopify product CSV**. It generates seven local review reports covering SKU matches, exceptions, field changes and Shopify CSV preflight findings. **NEW: the browser shows the first 12 change rows immediately, counts possible blank-cell overwrites, changed variant option values and product handle changes, and flags any changed records as requiring human review.** These are conservative advisories, not Shopify import guarantees. No Node.js installation, signup, account token, merchant-file upload or advertising. Each input must be under 2.2 MB; ambiguous or blank comparison keys are rejected rather than guessed.

**Supplier cost review (new in v1.4.0):** The seventh report,
supplier-margin-REVIEW-ONLY.csv, compares each proposed Shopify variant Price
with the vendor's Cost / Cost per item / Unit cost / Wholesale cost column by a
unique SKU. An on-page preview shows the first eight SKUs; the report covers
all proposed records. It flags prices below supplier cost, missing supplier
SKUs, bad numeric amounts and absent/ambiguous price or cost columns rather
than guessing. **The calculation assumes supplier costs and Shopify prices
use the same currency. It excludes shipping, taxes, discounts, advertising,
refunds, payment fees and labor. This is arithmetic, NOT profit, accounting
advice or a recommended selling price.** The tool never modifies Shopify.
The browser-local margin review contains sensitive vendor costs: keep it on
your own device and NEVER import this report to Shopify.

**한국어:** 신규 7번째 supplier-margin-REVIEW-ONLY.csv 보고서는 제안
판매가와 공급업체 원가를 SKU별로 대조하여 **공급가보다 낮게 판매하는
상품** 등을 찾아줍니다. 같은 통화 기준의 단순 차액 계산일 뿐 실제
이익이 아닙니다(세금·배송비·광고비·수수료 제외). 검토 전용 파일이므로
Shopify 상품 가져오기에 사용하면 안 됩니다.

**This is a dry-run audit only.** It never imports or updates Shopify. In particular, do **not** import `supplier-matches-NOT-SHOPIFY-IMPORT.csv`: it includes private supplier-only columns. Keep the original product export, check handle/variant dependencies, and test a couple of products separately before any real update. The browser HTML reuses the exact four pure engines and seven-report generator tested by this repository's CLI.

**한국어:** [공급업체 SKU 대조·Shopify 변경사항 검사 HTML 다운로드](https://github.com/livastic-vm3-primary-tmp-260920/localcsv-shopify-supplier-audit/releases/latest/download/shopify-supplier-threeway-audit.html). 다운로드 후 HTML 파일을 직접 열고 기존 상품 CSV·공급업체 SKU CSV·변경 예정 상품 CSV를 선택하세요. **SKU 매칭/누락·가격/재고 변경·상품 CSV 오류**를 7개 보고서로 확인할 수 있습니다. 모든 처리는 PC의 브라우저에서 이루어지며 파일 업로드·로그인·설치·광고는 없습니다. 분석용 공급업체 병합 CSV는 Shopify에 가져오면 안 됩니다.

Build reproducibly with `python3 scripts/build_supplier_browser.py`; verify via `--check`, `npm test`, and optional real Chrome smoke test `node scripts/smoke_supplier_browser.mjs`. The original CLI and single-CSV offline inspector remain available and unchanged.

---

## What it checks

Imagine a clothing store with two T-shirt sizes and one cap. You receive a supplier's updated prices and want to see which product fields will change before a bulk import.

1. **Supplier matching:** Left-join by SKU, preserving all existing Shopify rows and their order. The supplier SKU column must contain only unique, nonblank keys. Blank/missing Shopify SKU matches remain in an exceptions CSV.
2. **Before/after changes:** Compare current and proposed product exports by a **unique** SKU and report field-level changes, with CSV source row numbers. Ambiguous/blank SKU keys cause an error.
3. **Shopify CSV preflight:** Check handles, titles, variants, prices, inventory and image URL syntax. These are advisory diagnostics, **not** official Shopify import validation.

All included example merchant data is **fictional**; user-selected files are never uploaded.

**Two-file mode** does not perform proposed product-change comparison or create diff or proposed-preflight reports. No fake empty diff is presented.

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
