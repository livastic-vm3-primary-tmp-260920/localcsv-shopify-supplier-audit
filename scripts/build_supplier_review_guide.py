#!/usr/bin/env python3
"""Build one substantial, noncommercial Shopify supplier CSV review tutorial.

No API, advertising, visitor metrics, analytics, third-party JavaScript,
merchant files, payments or external requests. All example records are
fictional. This is a separate open-source GitHub Pages educational asset,
NOT the Adsterra-funded commercial site.
"""
from __future__ import annotations

import csv
from hashlib import sha256
from io import StringIO
from pathlib import Path
import re
import sys

ROOT=Path(__file__).resolve().parent.parent
DEST=ROOT/"docs/supplier-csv-review"
PUBLIC="https://livastic-vm3-primary-tmp-260920.github.io/localcsv-shopify-supplier-audit/supplier-csv-review/"
TOOL="https://livastic-vm3-primary-tmp-260920.github.io/localcsv-shopify-supplier-audit/supplier-audit/"
SHOPIFY_EN="https://help.shopify.com/en/manual/products/import-export/using-csv"
SHOPIFY_KO="https://help.shopify.com/ko/manual/products/import-export/using-csv"

HEADERS=[
 "check_type","supplier_file","supplier_csv_row","shopify_file","shopify_csv_row",
 "supplier_sku_header","shopify_sku_header","raw_supplier_sku","raw_shopify_sku",
 "supplier_cost_header","supplier_cost_raw","shopify_price_raw",
 "review_decision","reviewer_notes"
]
EXAMPLES=[
 [
  "SKU_MATCH","supplier-custom-headers.csv","2",
  "shopify-current-products.csv","2","Vendor Ref","SKU",
  "TEE-BLK-M","TEE-BLK-M","Net Unit Price","12.00","29.00",
  "NEEDS_REVIEW",
  "Fictional example. Confirm exact variant mapping and common currency; SKU audit alone does not establish product-handle identity."
 ],
 [
  "PRICE_COST_REVIEW","supplier-custom-headers.csv","4",
  "shopify-current-products.csv","4","Vendor Ref","SKU",
  "CAP-WOOL","CAP-WOOL","Net Unit Price","8.25","18.00",
  "NEEDS_REVIEW",
  "Fictional example. Price minus supplier cost excludes shipping, tax, payment fees, returns and advertising."
 ]
]


def csv_text(rows:list[list[str]])->str:
    buff=StringIO(newline="")
    writer=csv.writer(buff,lineterminator="\n",quoting=csv.QUOTE_MINIMAL)
    writer.writerows(rows)
    data=buff.getvalue()
    for row in rows:
        assert len(row)==len(HEADERS), "Review sheet columns changed"
    assert not re.search(r"(?m)(^|,)\s*[=+@]",data), "No CSV formulas or remote links"
    return data


# Three tiny, entirely fictional product-CSV *review* fixtures.
# Deliberately not offered as Shopify-ready import files: preserving all
# variant/option/dependency and market data requires a real product export.
OVERWRITE_REVIEW_FIXTURES={
  "fictional-current-product.csv":{
    "headers":["URL handle","Title","Vendor","Option1 name","Option1 value","SKU","Price"],
    "rows":[
      ["fictional-cotton-tee","Fictional Cotton Tee","Fictional Studio","Size","M","FIC-TEE-M","29.00"],
      ["fictional-cotton-tee","","","Size","L","FIC-TEE-L","29.00"]
    ]
  },
  "fictional-risky-blank-vendor.csv":{
    "headers":["URL handle","Title","Vendor","Option1 name","Option1 value","SKU","Price"],
    "rows":[
      ["fictional-cotton-tee","Fictional Cotton Tee","","Size","M","FIC-TEE-M","31.00"],
      ["fictional-cotton-tee","","","Size","L","FIC-TEE-L","29.00"]
    ]
  },
  "fictional-omitted-vendor-review-only.csv":{
    "headers":["URL handle","Title","Option1 name","Option1 value","SKU","Price"],
    "rows":[
      ["fictional-cotton-tee","Fictional Cotton Tee","Size","M","FIC-TEE-M","31.00"],
      ["fictional-cotton-tee","","Size","L","FIC-TEE-L","29.00"]
    ]
  }
}

def miniature_review_csv(headers:list[str],rows:list[list[str]])->str:
    """Read-only illustration; small Shopify-field subset, never an import."""
    assert all(name in ("URL handle","Title","Vendor","Option1 name",
                       "Option1 value","SKU","Price") for name in headers)
    assert len(headers)==len(set(headers))
    assert headers[:2]==["URL handle","Title"]
    assert len(rows)==2
    assert all(len(row)==len(headers) for row in rows)
    assert all(cell=="" or not cell.startswith(("=","+","-","@"))
               for row in rows for cell in row)
    buff=StringIO(newline="")
    csv.writer(buff,lineterminator="\n").writerows([headers,*rows])
    return buff.getvalue()


def guide_html()->str:
    # Intentionally static, readable by crawler and script-disabled browser.
    return """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="index,follow">
<meta name="referrer" content="no-referrer">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; connect-src 'none'; img-src 'none'; font-src 'none'; frame-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'">
<title>Shopify Supplier CSV Pre-Import Checklist: Map SKU &amp; Cost Safely</title>
<meta name="description" content="A free practical Shopify supplier CSV pre-import checklist. Confirm SKU/cost column mapping, duplicate keys, blank overwrites and variant risks with a fictional example and a private review sheet.">
<link rel="canonical" href="https://livastic-vm3-primary-tmp-260920.github.io/localcsv-shopify-supplier-audit/supplier-csv-review/">
<meta property="og:type" content="article">
<meta property="og:title" content="Shopify Supplier CSV Pre-Import Checklist">
<meta property="og:description" content="Learn to review source SKU/cost headers, check risky Shopify product CSV changes, and record manual decisions. Free, no signup or files uploaded.">
<meta property="og:url" content="https://livastic-vm3-primary-tmp-260920.github.io/localcsv-shopify-supplier-audit/supplier-csv-review/">
<style>
:root{color-scheme:light;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;line-height:1.64;color:#142d35;background:#f5f8fa}
*{box-sizing:border-box}body{margin:0}.top{background:#153d44;color:white;padding:1.2rem max(1rem,calc((100vw - 940px)/2))}
.top a{color:#e2fffa}main{max-width:940px;margin:0 auto;padding:1.1rem 1.2rem 3rem}
article{background:white;border:1px solid #dbe5e9;border-radius:12px;padding:1.2rem 1.5rem}
h1{font-size:clamp(1.55rem,3.3vw,2.25rem);line-height:1.18}h2{margin-top:2.4rem;font-size:1.42rem;line-height:1.3}h3{font-size:1.08rem}
p,li{max-width:77ch}a{color:#045c72;text-decoration:underline;text-underline-offset:3px}
a:focus-visible,input:focus-visible{outline:3px solid #079c84;outline-offset:4px}
.muted{color:#435d66;font-size:.93rem}.lede{font-size:1.12rem}
.note{border-left:5px solid #007868;background:#edfaf5;padding:1rem 1.15rem;margin:1.4rem 0}
.warning{border-left:5px solid #aa5e1e;background:#fff7e7;padding:1rem 1.15rem;margin:1.4rem 0}
.actions{display:flex;flex-wrap:wrap;gap:.7rem;margin:1.1rem 0}.actions a{display:inline-block;padding:.7rem 1rem;border:1px solid #006f70;border-radius:7px;font-weight:700}
.table-scroll{overflow:auto;max-width:100%}table{border-collapse:collapse;width:100%;font-size:.94rem}th,td{border:1px solid #d1dde1;padding:.7rem;text-align:left;vertical-align:top}th{background:#e9f6f2}
label{display:flex;align-items:flex-start;gap:.65rem;padding:.46rem .3rem;max-width:80ch}
input[type=checkbox]{width:1.08rem;height:1.08rem;accent-color:#006f70;flex:none;margin-top:.32rem}
code{overflow-wrap:anywhere;background:#eaf1f5;border-radius:4px;padding:.12rem .26rem}
details{border-bottom:1px solid #cfdae0;padding:.8rem 0}summary{cursor:pointer;font-weight:650}
footer{max-width:940px;margin:auto;padding:0 1.2rem 2rem;color:#455b64;font-size:.92rem}
@media print{.top,.actions{display:none}body{background:white}article{border:0;padding:0}main{max-width:none;padding:0}
h2,h3{break-after:avoid}table{font-size:.81rem}details{border:0}details>summary{font-weight:700}}
</style>
</head>
<body>
<header class="top"><a href="../">Free open-source Shopify CSV examples</a> · Source-verifiable LocalCSV Lab education</header>
<main><article>
<p class="muted">Free merchant checklist · Updated 28 October 2026 · English + 한국어 · No signup or customer-file upload</p>
<h1>Shopify supplier CSV pre-import checklist: match the right SKU and cost columns before making changes</h1>
<p class="lede">A supplier sends a file with unfamiliar column names, prices, sizes, or delivery rows. Your Shopify export has its own product and variant columns. Before editing any live product, record which original supplier field means what, flag unresolved SKUs, and verify the changes rather than guessing.</p>
<div class="note"><strong>Choose the files you have.</strong> With only a current Shopify product export and a supplier SKU/cost CSV, run the free <a href="../supplier-audit/">two-file supplier-cost review (5 local reports)</a>. If you also have a separately prepared proposed Shopify product CSV, use the same browser tool for a <strong>three-file change review (7 local reports)</strong>. The tool never uploads your files or modifies Shopify.</div>
<p><strong>What this is not:</strong> not official Shopify import validation, not a Shopify-ready conversion service, not automatic supplier-to-variant reconciliation, and not a profit calculation. A SKU-only audit does not establish which Shopify product handle or variant should be overwritten. Any proposed import must be verified separately.</p>
<div class="actions">
<a href="../supplier-audit/">Try the free 2- or 3-CSV browser checker</a>
<a href="reviewer-template.csv" download="shopify-supplier-review-blank-template.csv">Blank review sheet CSV</a>
<a href="fictional-review-example.csv" download="shopify-supplier-review-fictional-example.csv">Fictional filled example</a>
</div>
<section id="blank-vendor-example" aria-labelledby="blank-vendor-example-title">
<h2 id="blank-vendor-example-title">Shopify CSV blank cells overwrite existing values: a 3-file worked example</h2>
<p><strong>Real problem:</strong> You want to change a fictional T-shirt price from <code>29.00</code> to <code>31.00</code>. The current Shopify product export records <code>Vendor = Fictional Studio</code>. A supplier spreadsheet produces a proposed CSV with the <code>Vendor</code> header <em>present</em> but its first data cell <em>empty</em>. What might happen if you select <strong>Overwrite products with matching handles</strong>?</p>
<p><strong>Shopify's official rule:</strong> an included, blank non-required column can replace the existing product value with blank. An entirely omitted non-required column leaves the corresponding existing value unchanged, provided the rest of the import meets Shopify's actual requirements. Product identity follows the <code>URL handle</code>, not a supplier SKU. Read <a href="https://help.shopify.com/en/manual/products/import-export/import-products" rel="noopener noreferrer">Shopify's official importing and overwrite documentation</a> before any real change.</p>
<div class="table-scroll"><table>
<thead><tr><th>Fictional CSV for offline reading</th><th>What you can inspect</th><th>Expected Vendor-column behavior when matching handles are overwritten</th></tr></thead>
<tbody>
<tr><td><a href="fictional-current-product.csv" download="fictional-current-shopify-product-review.csv">1. Current product export excerpt</a></td><td><code>Vendor</code> column contains <code>Fictional Studio</code>. Two size rows M/L stay visible.</td><td>Existing vendor: Fictional Studio (illustrative baseline).</td></tr>
<tr><td><a href="fictional-risky-blank-vendor.csv" download="fictional-risky-included-blank-vendor.csv">2. Proposed excerpt with empty Vendor cell</a></td><td>Header <code>Vendor</code> EXISTS, but first product row cell is BLANK; size M price is 31.00.</td><td><strong>Risk: overwrites the product vendor with an empty value.</strong></td></tr>
<tr><td><a href="fictional-omitted-vendor-review-only.csv" download="fictional-omitted-vendor-not-import-ready.csv">3. Proposed excerpt with Vendor column omitted</a></td><td>No <code>Vendor</code> HEADER at all; the same fictional size-M price becomes 31.00.</td><td>The omitted <code>Vendor</code> column alone does not clear the existing vendor. This is NOT a guarantee the whole import preserves variants.</td></tr>
</tbody></table></div>
<div class="warning"><strong>Do NOT import these downloadable demonstration files into a real Shopify store.</strong> They are intentionally incomplete, fictional <em>field-behavior review excerpts</em>, not validated Shopify imports. Required/dependent product columns, variant and market data are outside this miniature. Shopify warns that omitting or changing <code>Option1 name</code>/<code>Option1 value</code> and other dependent fields may recreate or delete variants. A supplier SKU does not prove which Shopify URL handle or variant should be changed. Back up a <em>real full product export</em>, prepare its complete rows, check the official schema and test under merchant control.</div>
<p><strong>Why three files?</strong> Open each tiny CSV in a text editor or spreadsheet and compare the HEADER LINE before looking at numbers: <code>Vendor,</code> with an empty cell is not the same as an absent <code>Vendor</code> header. This is a concrete, reproducible learning exercise—there is no simulation of Shopify import, no customer records and no automatic mutation of your store.</p>
<p><strong>Next, inspect your own complete product export.</strong> Use the <a href="../">free educational one-file Shopify CSV inspector</a> or the independent <a href="https://tools.trendbridged.com/tools/shopify-csv-preflight/" rel="noopener noreferrer">LocalCSV Lab free Shopify CSV preflight checker</a>. Neither can guarantee a safe import or modify your store. The separate LocalCSV Lab informational site may offer <strong>optional advertising only after your affirmative consent</strong>; its file-processing editor contains no advertising scripts. This open-source guide has no ads, JavaScript or tracking.</p>

<p lang="ko"><strong>한국어 설명:</strong> <code>Vendor</code> 열이 있는데 첫 데이터 셀이 <strong>빈 칸</strong>이면 Shopify의 동일 URL 핸들 덮어쓰기에서 기존 공급업체명이 공백으로 지워질 수 있습니다. 반대로 열 자체가 <strong>없는 경우</strong> 해당 필드의 기존 값은 유지됩니다. 하지만 옵션 의존성 때문에 이 세 CSV는 <strong>실제 상품 가져오기용 파일이 아닙니다.</strong> 예제를 다운로드해 첫 줄의 열 이름부터 비교해 보세요. <a href="https://help.shopify.com/ko/manual/products/import-export/import-products" rel="noopener noreferrer">Shopify 공식 한국어 안내</a>.</p>
</section>
<section aria-labelledby="steps"><h2 id="steps">A safer 7-step workflow</h2>
<ol>
<li><strong>Keep a current backup.</strong> Export your existing products from your Shopify admin before considering a product CSV import. Keep the original unchanged. The product importer is not a replacement for that backup.</li>
<li><strong>Inspect the actual supplier headers.</strong> Open the local browser checker and select a vendor CSV. Choose <em>Show supplier column names locally</em>. Read the real column labels: a fictional example uses <code>Vendor Ref</code>, <code>Net Unit Price</code>, and <code>Vendor Name</code>.</li>
<li><strong>Confirm exactly which field is SKU and which is unit cost.</strong> If the vendor uses nonstandard headings, enter BOTH exact source names into the optional mapping fields. This only renames two headers in temporary browser memory. It does <strong>not</strong> decode SKU suffixes, convert sizes or currencies, combine delivery lines, or resolve mixed product identities.</li>
<li><strong>Check uniqueness before joining.</strong> Blank or duplicate supplier SKU values are not reliable identifiers. The browser checker stops on ambiguous keys rather than merging two products. If a supplier reference covers different variants, make a human decision using the original source rows.</li>
<li><strong>Run only the comparison supported by your files.</strong> In two-file mode, examine SKU matches, missing costs and current sale price versus supplier cost. The checker does <strong>not</strong> assess what changed because no proposed file exists. Add the third file only when it is a real proposed Shopify export.</li>
<li><strong>Record exceptions with evidence.</strong> Use the blank <a href="reviewer-template.csv" download="shopify-supplier-review-blank-template.csv">review sheet CSV</a> to note the source filename, CSV row number, raw SKU, raw cost, proposed interpretation and reviewer decision. The <a href="fictional-review-example.csv" download="shopify-supplier-review-fictional-example.csv">filled fictional example</a> shows two safe placeholder records. Keep real evidence private on your device.</li>
<li><strong>Verify an import separately.</strong> Review any changed product handles, option values, blank included columns and dependent fields against the official Shopify instructions. Then back up and test one or two controlled products using Shopify's own import process. <strong>Never import any supplier-joined or margin review report into Shopify.</strong></li>
</ol></section>

<section aria-labelledby="risk-table">
<h2 id="risk-table">Risk cases worth an explicit human decision</h2>
<div class="table-scroll"><table>
<thead><tr><th>Supplier/Shopify situation</th><th>Why it matters</th><th>Safer next action</th></tr></thead>
<tbody>
<tr><td>Different supplier header labels</td><td>One vendor calls the variant key <code>Vendor Ref</code> and unit cost <code>Net Unit Price</code>.</td><td>Show original headings, confirm both mappings yourself. Never silently auto-select a likely field.</td></tr>
<tr><td>Blank or duplicate SKU</td><td>Two distinct variants could be merged, or unrelated blank keys could be treated as the same item.</td><td>Stop. Inspect source rows and confirm an actually unique sellable variant key.</td></tr>
<tr><td>One style code covering multiple fabrics/sizes</td><td>A supplier reference may not identify a unique Shopify variant.</td><td>Keep raw style/colour/size fields visible; ask the merchant to confirm each ambiguous pairing.</td></tr>
<tr><td>Sizes as columns or split delivery rows</td><td>Turning every size column into a variant or combining deliveries can invent inventory if business rules are unknown.</td><td>Do not let this checker infer or normalize a size matrix; review manually or use an authorized specialist workflow.</td></tr>
<tr><td>Promotional net cost vs ordinary vendor cost</td><td>Prices may refer to different periods or discount rules; calculation alone cannot resolve the intended base cost.</td><td>Record cost definition, date and currency separately. Confirm the commercial terms before pricing.</td></tr>
<tr><td>Two different currencies</td><td>Price minus cost is meaningless if the amounts are denominated differently.</td><td>Confirm common currency and applicable conversion outside this tool. Review shipping, tax, fees, refunds and ads.</td></tr>
<tr><td>Nonrequired included column becomes blank</td><td>Shopify says that in some import overwrite cases the existing field will be cleared by an included blank cell.</td><td>Distinguish <em>omitted</em> from <em>included but blank</em> and review dependent columns before importing.</td></tr>
<tr><td>Product handle or variant option changes</td><td>Shopify matches overwritten products using URL handles; changing an option value can recreate variant IDs.</td><td>Do not interpret SKU comparison as importer identity. Review handles, option columns and dependencies using official guidance.</td></tr>
<tr><td>Imported file contains supplier-only columns</td><td>Joined review CSV includes vendor cost and other information, not a Shopify import schema.</td><td>Keep every audit report for private review only. Prepare any actual Shopify import separately and verify its schema.</td></tr>
</tbody></table></div>
</section>

<section aria-labelledby="print-check"><h2 id="print-check">Print-and-review checklist (nothing is submitted)</h2>
<p class="muted">These checkboxes exist only in the current browser page; selections are not saved, uploaded or analyzed. Print a copy for an offline review if useful.</p>
<div aria-label="Manual Shopify supplier CSV review checklist">
<label><input type="checkbox"> Original Shopify export backed up and kept unchanged.</label>
<label><input type="checkbox"> Vendor source filename, actual column headers and dates verified.</label>
<label><input type="checkbox"> SKU and unit-cost source headers explicitly approved by a reviewer.</label>
<label><input type="checkbox"> Blank, duplicate or non-unique SKU identities resolved.</label>
<label><input type="checkbox"> Size/colour, delivery splits and cross-product references not guessed.</label>
<label><input type="checkbox"> Currency, net/gross cost, discounts and period verified.</label>
<label><input type="checkbox"> If no proposed file: confirmed that no change comparison occurred.</label>
<label><input type="checkbox"> If proposed file exists: inspected handle, option values and included blanks.</label>
<label><input type="checkbox"> Reviewed full findings, not just the first preview rows.</label>
<label><input type="checkbox"> Actual Shopify import separately prepared, checked and minimally tested.</label>
</div></section>

<section lang="ko" aria-labelledby="korean-guide">
<h2 id="korean-guide">한국어: 공급업체 CSV·Shopify 상품 가져오기 전 확인 순서</h2>
<p>의류 매장 등에서 공급업체 CSV를 받으면 먼저 원본 파일과 기존 Shopify 상품 내보내기를 백업하세요. 공급업체가 <strong>Vendor Ref</strong>를 SKU로, <strong>Net Unit Price</strong>를 단위원가로 사용하는지 <strong>직접 확인</strong>해야 합니다. 열 이름만 비슷하다고 자동으로 연결하거나 상품 코드·사이즈·색상을 추측해서는 안 됩니다.</p>
<p>무료 <a href="../supplier-audit/">브라우저 검사기</a>에서 <strong>열 이름 확인</strong>을 누른 뒤 실제 원본 열 제목 두 개를 정확히 입력하세요. 기존 Shopify CSV와 공급업체 CSV만 있으면 <strong>5개 검토 보고서</strong>를 만들 수 있습니다. 변경 예정 Shopify CSV가 있는 경우에만 세 파일을 비교하여 <strong>7개 보고서</strong>를 만들고 가격·재고 변경을 검토합니다. 변경 예정 파일이 없는 상태를 ‘변경 없음’으로 판단하지 않습니다.</p>
<p>같은 SKU가 다른 상품을 뜻하는 경우, 크기별 열이 있는 경우, 납기별로 같은 상품이 나뉜 경우는 사람이 원본 행을 대조해야 합니다. 단위원가와 판매가는 <strong>동일한 통화</strong>를 사용해야 비교할 수 있습니다. 배송비·광고비·세금·결제 수수료·할인·환불을 뺀 실제 순이익 계산이 아닙니다.</p>
<p>가져오기 CSV에 포함한 빈 셀이 기존 값을 지울 수 있고, 옵션값 변경으로 상품 옵션의 ID가 새로 만들어질 수 있습니다. 실제 가져오기 전에 Shopify 공식 <a href="https://help.shopify.com/ko/manual/products/import-export/using-csv" rel="noopener noreferrer">제품 CSV 설명서(한국어)</a>를 확인하고, 별도로 만든 가져오기 파일로 소수 상품을 시험하세요. <strong>분석용 병합·원가 보고서를 Shopify에 직접 가져오지 마세요.</strong></p>
</section>

<section aria-labelledby="questions"><h2 id="questions">Frequently asked questions</h2>
<details><summary>Can the checker turn any vendor spreadsheet into a Shopify import?</summary>
<p>No. It accepts CSV text, with optionally user-confirmed exact column header mapping for SKU and cost. It does not translate arbitrary file types, convert size matrices, infer variants, generate an import-ready product file or change a Shopify store.</p></details>
<details><summary>Does the review prove Shopify will update products correctly?</summary>
<p>No. The audit compares SKU keys for human review; Shopify product CSV overwrite behavior involves the URL handle and related variant fields. Follow the official importer requirements before performing any actual update.</p></details>
<details><summary>What if there is no proposed Shopify export?</summary>
<p>Choose the two-file mode. It checks existing Shopify prices against explicitly identified supplier costs and yields five reports. It does not invent a future price or say that no changes occurred.</p></details>
<details><summary>Can a below-cost alert tell me my actual profit?</summary>
<p>No. Only a simple same-currency difference is calculated, excluding fees, taxes, shipping, returns, discounts, labor and advertising. Pricing decisions require separate accounting.</p></details>
<details><summary>Are my merchant files stored or sent to anyone?</summary>
<p>The linked open-source browser checker processes selected CSVs entirely in the local browser with no upload or ad scripts. This guide has no JavaScript, telemetry or account system. The downloadable blank review sheet contains no merchant data. Standard website hosting may still process ordinary HTTP metadata for page delivery.</p></details>
</section>

<section aria-labelledby="sources">
<h2 id="sources">Official guidance and related free tools</h2>
<p>This independent checklist follows the descriptions in <a href="https://help.shopify.com/en/manual/products/import-export/using-csv" rel="noopener noreferrer">Shopify: Using CSV files to import/export products</a> and <a href="https://help.shopify.com/en/manual/products/import-export/import-products" rel="noopener noreferrer">Shopify: Importing products</a>. It is not affiliated with or endorsed by Shopify. Check official instructions again before importing because importer requirements can change.</p>
<p>For a full browser-local audit, open the <a href="../supplier-audit/">MIT-licensed 2/3-file example</a> or its <a href="https://github.com/livastic-vm3-primary-tmp-260920/localcsv-shopify-supplier-audit/releases/latest/download/shopify-supplier-threeway-audit.html" rel="noopener noreferrer">self-contained offline HTML download</a>.</p>
<p>For a narrower step, the original LocalCSV Lab site offers a <a href="https://tools.trendbridged.com/tools/shopify-csv-preflight/" rel="noopener noreferrer">free Shopify CSV preflight</a> and <a href="https://tools.trendbridged.com/tools/join-csv-by-key/" rel="noopener noreferrer">free SKU lookup</a>. Those separate informational pages may display optional, clearly labeled advertising <strong>only when a visitor permits it</strong>; this noncommercial GitHub Pages educational checklist and demo contain no advertising or marketing trackers.</p>
<p>Found a genuine edge case? You can <a href="https://github.com/livastic-vm3-primary-tmp-260920/localcsv-shopify-supplier-audit/issues/new" rel="noopener noreferrer">report an issue to the open-source maintainers</a> using <strong>fictional or permitted anonymized headers/rows only</strong>. Never publish real vendor costs, customer records, account tokens or client files in a public issue.</p>
</section>
</article></main>
<footer>Open-source educational reference · No login, remote CSV processing, marketing trackers or ads. Source repository:
<a href="https://github.com/livastic-vm3-primary-tmp-260920/localcsv-shopify-supplier-audit" rel="noopener noreferrer">localcsv-shopify-supplier-audit</a>. Not affiliated with Shopify.</footer>
</body></html>
"""


def build()->dict[Path,str]:
    html=guide_html()
    forbidden=("<script", "adsterra", "bauval.org", "abscloud.org",
               "araplhn.org", "localStorage", "fetch(", "XMLHttpRequest")
    # Mentioning "adsterra" (only context about no advertising) isn't a leak,
    # but this educational page avoids the word entirely.
    for item in forbidden:
        if item.lower() in html.lower():
            raise ValueError("Unexpected executable ad/tracker or secret: "+item)
    assert html.count('<link rel="canonical" href="'+PUBLIC+'">')==1
    assert 'content="index,follow"' in html
    assert 'content="noindex,nofollow"' not in html
    assert "script-src 'none'" in html and "connect-src 'none'" in html
    assert html.count('<h1>')==1
    assert html.count('type="checkbox"')==10
    assert html.count("Shopify")>=18 and "한국어" in html
    assert len(html)>15000
    assert '"review_decision"' not in html  # CSV-only schema below
    return {
        DEST/"index.html":html,
        DEST/"reviewer-template.csv":csv_text([HEADERS]),
        DEST/"fictional-review-example.csv":csv_text([HEADERS,*EXAMPLES]),
        **{DEST/name:miniature_review_csv(case["headers"],case["rows"])
           for name,case in OVERWRITE_REVIEW_FIXTURES.items()}
    }


def main()->int:
    outputs=build()
    checking="--check" in sys.argv[1:]
    for dest,data in outputs.items():
        if checking:
            if dest.read_bytes().decode("utf8")!=data:
                raise SystemExit("Educational guide or review CSV not reproducible: "+str(dest))
        else:
            dest.parent.mkdir(parents=True,exist_ok=True)
            dest.write_bytes(data.encode("utf8"))
        print(("VERIFIED" if checking else "BUILT"),
              dest.relative_to(ROOT),len(data.encode("utf8")),
              sha256(data.encode("utf8")).hexdigest())
    return 0


if __name__=="__main__":
    raise SystemExit(main())
