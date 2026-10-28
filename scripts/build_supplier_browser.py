#!/usr/bin/env python3
"""Deterministic, self-contained offline three-CSV supplier SKU audit.

This open-source downloadable HTML reuses the four checked pure CSV
modules AND the exact pure makeReports() function from the published CLI.
No network, analytics, ads, account access or import.
"""
from __future__ import annotations

import hashlib
import re
import sys

from build_offline import ROOT, CSS, package_core

DEST = ROOT / "offline/shopify-supplier-threeway-audit.html"


def extract_cli_reports() -> str:
    text = (ROOT / "bin/localcsv-audit.mjs").read_text(encoding="utf8")
    start = "export function normalizeSupplierColumns(supplierText,{"
    end = "\nexport async function audit(args) {"
    if text.count(start) != 1 or text.count(end) != 1:
        raise ValueError("CLI report API changed: review before rebuilding")
    block = text[text.index(start):text.index(end)]
    if "readFile(" in block or "writeFile(" in block or "fetch(" in block:
        raise ValueError("CLI reports no longer pure")
    return block.replace("export function normalizeSupplierColumns", "function normalizeSupplierColumns", 1).replace(
        "export function makeReports","function makeReports",1)


APP = r"""
(function(){
  "use strict";
  const form=document.getElementById("sku-audit-form");
  const run=document.getElementById("run");
  const status=document.getElementById("status");
  const results=document.getElementById("results");
  const summary=document.getElementById("summary");
  const reports=document.getElementById("reports");
  const preview=document.getElementById("review-preview");
  const changes=document.getElementById("changed-fields-preview");
  const riskSummary=document.getElementById("import-risk-summary");
  const riskList=document.getElementById("import-risk-examples");
  const marginPanel=document.getElementById("margin-panel");
  const marginOverview=document.getElementById("margin-overview");
  const marginRows=document.getElementById("margin-rows");
  const clear=document.getElementById("clear");
  const costOnly=document.getElementById("cost-only");
  const proposedInput=document.getElementById("proposed");
  const supplierInput=document.getElementById("supplier");
  const showVendorColumns=document.getElementById("show-supplier-headers");
  const vendorHeaderList=document.getElementById("supplier-header-list");
  const vendorSKUInput=document.getElementById("supplier-sku-column");
  const vendorCostInput=document.getElementById("supplier-cost-column");
  const vendorMappingSummary=document.getElementById("supplier-mapping-summary");
  let urls=[];

  function resetResults(){
    for(const url of urls){ URL.revokeObjectURL(url); }
    urls=[];
    reports.replaceChildren();
    changes.replaceChildren();
    riskList.replaceChildren();
    marginRows.replaceChildren();
    marginOverview.textContent="";
    vendorMappingSummary.textContent="";
    marginPanel.hidden=true;
    riskSummary.textContent="";
    preview.hidden=true;
    summary.textContent="";
    results.hidden=true;
  }

  form.addEventListener("submit",async function(event){
    event.preventDefault();
    resetResults();
    const twoFile=costOnly.checked;
    if(twoFile && proposedInput.files.length){
      status.textContent="A proposed CSV is selected. Clear it before two-file supplier-only review. / 3번째 파일을 초기화해야 합니다.";
      return;
    }
    const elements=twoFile?["current","supplier"]:["current","supplier","proposed"];
    const files=elements.map(id=>document.getElementById(id).files[0]);
    if(files.some(file=>!file)){
      status.textContent=twoFile?
        "Choose current Shopify export and supplier CSV. / 기존 상품과 공급업체 CSV 2개를 선택하세요.":
        "Choose all three CSV files. / CSV 파일 3개를 모두 선택하세요.";
      return;
    }
    if(files.some(file=>file.size>2200000)){
      status.textContent="Each CSV must be under 2.2 MB. / 각 파일은 2.2 MB 미만이어야 합니다.";
      return;
    }
    const sourceSKU=vendorSKUInput.value.trim();
    const sourceCost=vendorCostInput.value.trim();
    if(Boolean(sourceSKU)!==Boolean(sourceCost)){
      status.textContent="Enter BOTH exact source SKU and cost column headers. / 공급업체 SKU·원가 열 이름을 모두 입력하세요.";
      return;
    }
    run.disabled=true;
    status.textContent="Checking locally. Nothing is uploaded. / 브라우저 내부에서 검사 중입니다.";
    try{
      const texts=await Promise.all(files.map(file=>file.text()));
      const result=makeReports({
        current:texts[0], supplier:texts[1],
        proposed:twoFile?undefined:texts[2],
        supplierSkuColumn:sourceSKU||undefined,
        supplierCostColumn:sourceCost||undefined
      });
      const m=result.summary;
      const mapping=m.explicitlyConfirmedSupplierColumnMapping;
      vendorMappingSummary.textContent=mapping?
        "Exact reviewer-confirmed mapping ONLY: supplier '"+mapping.sourceSkuColumn+
        "' → SKU, '"+mapping.sourceCostColumn+
        "' → Cost. No automatic SKU, size, currency, colour, or product matching.":
        "Using supplier's existing canonical SKU and cost headers. No mappings guessed.";
      summary.textContent=
        "Supplier matches: "+m.supplierJoin.matched+
        " | Unmatched: "+m.supplierJoin.unmatched+
        (twoFile?" | Product change comparison: NOT RUN (no proposed CSV)":
         " | Changed records: "+m.changedProductRecords.changed+
         " | Added/removed: "+(m.changedProductRecords.added+m.changedProductRecords.removed))+
        " | Manual review: "+(m.manualReviewRequired?"YES":"NO")+
        ". This is an AUDIT, not an import.";
      // Show the existing diff engine's bounded FIRST 12 report rows.
      // Never place customer CSV text into HTML or third-party scripts.
      if(m.productChangeComparisonPerformed){
      for(const row of result.changePreview){
        const item=document.createElement("li");
        item.textContent=String(row[0])+" / SKU "+String(row[1])+
          " / "+String(row[2])+": "+
          JSON.stringify(String(row[3]))+" → "+JSON.stringify(String(row[4]));
        changes.append(item);
      }
      if(result.changePreview.length===0){
        const item=document.createElement("li");
        item.textContent="No added, removed or changed rows found by SKU.";
        changes.append(item);
      }
      const danger=m.possibleImportRisks;
      riskSummary.textContent=
        "Advisory signals across matched SKU rows: "+
        danger.includedBlankCellChanges+" included cells changing to blank; "+
        danger.variantOptionValueChanges+" variant option values changed; "+
        danger.productHandleChanges+" product handles changed. "+
        "These are possible import risks, NOT official Shopify validation. "+
        "Review all "+result.comparisonReportLines+" comparison report lines.";
      for(const issue of danger.examples){
        const item=document.createElement("li");
        item.textContent=issue.type+": SKU "+issue.sku+" / "+issue.field;
        riskList.append(item);
      }
      preview.hidden=false;
      }
      // Advisory arithmetic ONLY: never invent same-currency assurance or
      // profit after shipping, tax, discounts, labor, fees or advertising.
      const pricing=m.supplierCostMarginReview;
      marginOverview.textContent=
        (twoFile?
         "TWO-FILE SUPPLIER COST REVIEW ONLY. Current Shopify price, NO proposed update compared. ":
         "THREE-FILE: reviewing PROPOSED Shopify price. ")+
        "Price-minus-supplier-cost review: "+pricing.validComparisons+
        " calculated; "+pricing.belowSupplierCost+" below supplier cost; "+
        pricing.missingSupplier+" unmatched supplier SKUs; "+
        (pricing.invalidCost+pricing.invalidProposedPrice+
         pricing.unavailableCost+pricing.unavailableProposedPrice)+
        " missing/invalid price or cost rows. SAME-CURRENCY ASSUMED, "+
        "taxes/shipping/fees/discounts NOT included. NOT real profit.";
      for(const row of result.supplierMarginPreview){
        const item=document.createElement("li");
        item.textContent="SKU "+String(row[0])+
          " | cost "+String(row[1])+
          (twoFile?" | current price ":" | proposed price ")+String(row[3])+
          " | difference "+String(row[4])+
          " | price-cost margin "+String(row[5])+"%"+
          " | "+String(row[6]);
        marginRows.append(item);
      }
      marginPanel.hidden=false;
      for(const [name,data] of result.files){
        const link=document.createElement("a");
        const item=document.createElement("li");
        const type=name.endsWith(".json")?"application/json;charset=utf-8":"text/csv;charset=utf-8";
        const url=URL.createObjectURL(new Blob([data],{type}));
        urls.push(url);
        link.href=url;
        link.download=name;
        link.textContent="Download "+name;
        item.append(link);
        reports.append(item);
      }
      results.hidden=false;
      status.textContent=twoFile?
        "Five local reports prepared: supplier cost vs CURRENT Shopify prices; no product change analysis. Do not import audit reports.":
        "Seven local reports prepared. Never import ANY audit report into Shopify.";
    }catch(error){
      resetResults();
      status.textContent="Audit stopped safely: "+String(error&&error.message?error.message:error);
    }finally{
      run.disabled=false;
    }
  });

  showVendorColumns.addEventListener("click",async function(){
    const file=supplierInput.files[0];
    if(!file){
      vendorHeaderList.textContent="Choose a supplier CSV first. / 공급업체 CSV를 먼저 선택하세요.";
      return;
    }
    if(file.size>2200000){
      vendorHeaderList.textContent="Supplier CSV exceeds the 2.2 MB limit.";
      return;
    }
    showVendorColumns.disabled=true;
    try{
      // Header names only, locally. Never generate DOM HTML from CSV text.
      const fields=readJoinCSV(await file.text(),"Supplier CSV").headers;
      vendorHeaderList.textContent="Exact supplier headers (copy names as-is) / 원본 열 이름: "+
        fields.map((name,index)=>String(index+1)+". "+name).join(" | ");
    }catch(error){
      vendorHeaderList.textContent="Cannot inspect supplier headers: "+
        String(error&&error.message?error.message:error);
    }finally{
      showVendorColumns.disabled=false;
    }
  });
  supplierInput.addEventListener("change",function(){
    // Avoid applying a stale, user-confirmed mapping to a different file.
    vendorSKUInput.value="";
    vendorCostInput.value="";
    vendorHeaderList.textContent="";
    resetResults();
  });

  costOnly.addEventListener("change",function(){
    if(costOnly.checked && proposedInput.files.length){
      costOnly.checked=false;
      status.textContent="Do not ignore selected proposed CSV. Clear / 초기화 first. / 선택한 변경 예정 파일을 초기화하세요.";
      return;
    }
    proposedInput.disabled=costOnly.checked;
    proposedInput.required=!costOnly.checked;
    resetResults();
    status.textContent=costOnly.checked?
      "Two-file supplier-only mode: choose current Shopify and supplier CSV. NO product change comparison.":
      "Three-file mode: choose current Shopify, supplier, AND proposed export.";
  });

  clear.addEventListener("click",function(){
    form.reset();
    proposedInput.disabled=false;
    proposedInput.required=true;
    costOnly.checked=false;
    vendorHeaderList.textContent="";
    vendorSKUInput.value="";
    vendorCostInput.value="";
    resetResults();
    status.textContent="File selections and generated links cleared. / 입력 및 결과를 지웠습니다.";
  });
  window.addEventListener("beforeunload",resetResults,{once:true});
})();
"""

PAGE = r"""<!doctype html>
<html lang="en">
<head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'; img-src 'none'; font-src 'none'; frame-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'">
<title>Free Offline Shopify Supplier SKU Change Audit | LocalCSV Lab</title>
<style>@@STYLE@@</style></head>
<body><main>
<p class="muted">LocalCSV Lab · Downloadable free browser utility · No account, upload, ads or installation</p>
<h1>Offline Shopify supplier SKU and price-cost review</h1>
<p><strong>Only two CSVs?</strong> Start with your current Shopify export
and your supplier SKU/cost CSV. Audit SKU matching, supplier costs and
current sale prices (5 review-only reports); no proposed-product change
comparison is performed. When ready, add a separately prepared proposed
Shopify product CSV to audit changed fields and possible import risks
(7 review-only reports). Nothing is sent to a server.</p>
<p lang="ko"><strong>한국어:</strong> 현재 Shopify 상품 CSV + 공급업체 SKU/원가
CSV <strong>2개만으로</strong> SKU·원가·현재 판매가를 확인하고 5개 보고서를 받을 수
있습니다. 변경 예정 상품 CSV도 있으면 3개 파일로 변경 내역과 가져오기 위험을
검토해 7개 보고서를 받습니다. 두 파일 모드에서는 변경사항을 비교하지 않습니다.
서버 업로드, 회원가입, 앱 설치, 광고가 없습니다.</p>
<div class="note" role="note"><strong>Backup before editing.</strong>
This tool <strong>does not create a safe Shopify import file</strong> or modify your products.
Shopify updates depend on URL handles and related variant option fields, not only SKU.
Supplier-joined reports include extra Cost/Supplier columns and
<strong>must NEVER be imported into Shopify</strong>.
Keep confidential supplier costs and customer data private.
Test one or two products using Shopify's official process first.</div>
<form id="sku-audit-form" class="panel" novalidate>
<h2>Select local CSV inputs</h2>
<label for="current">1. Current Shopify export / 기존 상품 전체 CSV
<input id="current" type="file" accept=".csv,text/csv" required></label>
<label for="supplier">2. Supplier SKU list / 공급업체 SKU/원가 CSV
<input id="supplier" type="file" accept=".csv,text/csv" required></label>
<section class="note" aria-labelledby="supplier-mapping-title">
<h3 id="supplier-mapping-title">Supplier column names differ? / 공급업체 열 이름이 다르다면</h3>
<p>Use the supplier file's <strong>exact original header names</strong>. The mapping
is ONLY a temporary in-memory column-label rename: no guessed SKU, size,
color, discounts, currency, or product equivalents. Leave both inputs empty
when the supplier already uses an exact SKU and Cost/Unit cost column.
Your original file remains unchanged.</p>
<button id="show-supplier-headers" type="button">Show supplier column names locally / 열 이름 확인</button>
<p id="supplier-header-list" role="status" aria-live="polite"></p>
<label for="supplier-sku-column">Original supplier SKU column name / 원본 SKU 열 이름
<input id="supplier-sku-column" type="text" maxlength="150"
 autocomplete="off" placeholder="Example: Vendor Ref"></label>
<label for="supplier-cost-column">Original supplier unit cost column name / 원본 단위원가 열 이름
<input id="supplier-cost-column" type="text" maxlength="150"
 autocomplete="off" placeholder="Example: Net Unit Price"></label>
<p class="muted">If you enter one mapping field, enter BOTH.
Exact matching only; duplicate/ambiguous SKU keys and colliding column
names stop safely. These audit outputs must NOT be imported into Shopify.</p>
</section>
<label for="proposed">3. Proposed Shopify export / 변경 예정 Shopify CSV (three-file mode only)
<input id="proposed" type="file" accept=".csv,text/csv" required></label>
<label for="cost-only">
<input id="cost-only" type="checkbox">
<strong>No proposed CSV yet?</strong> Review supplier cost against CURRENT Shopify price
using only TWO CSVs / 변경 예정 CSV가 없다면 기존 Shopify + 공급업체 CSV
2개만으로 공급가·판매가 검토 (변경사항 비교는 수행하지 않음).
</label>
<p class="muted">In two-file mode, proposed-field change analysis is NOT run, and
five review-only reports are generated. The third file can never be
silently ignored. In three-file mode seven reports are generated.</p>
<p class="muted">Each CSV: under 2.2 MB, UTF-8 preferred. The SKU key must be unique and nonblank
for comparison. Ambiguous data stops rather than silently guessing.</p>
<div class="actions"><button id="run" type="submit">Audit selected CSVs locally / 로컬 검사</button>
<button id="clear" type="button">Clear / 초기화</button></div></form>
<p id="status" role="status" aria-live="polite">Choose two or three CSVs to begin. No data leaves your browser.</p>
<section id="results" class="panel" hidden>
<h2>Review and download reports / 보고서 다운로드 (2 files: 5; 3 files: 7)</h2>
<p id="summary"></p>
<p id="supplier-mapping-summary" role="status"></p>
<section id="review-preview" aria-labelledby="review-preview-title" hidden>
<h3 id="review-preview-title">Change preview and potential import risks / 변경 내역 및 위험 신호</h3>
<p>The first 12 report rows are shown below (not necessarily all changes).
The full findings are in the downloadable reports. All data stays in your browser.</p>
<ol id="changed-fields-preview"></ol>
<p id="import-risk-summary" role="status"></p>
<ul id="import-risk-examples"></ul>
<p class="note">Shopify matches product imports by URL handle, not by SKU alone.
A nonrequired field included as blank in an import may erase an existing
value. A changed option value may recreate variant IDs. Back up the export,
check official Shopify rules and test one or two products first.</p>
</section>
<section id="margin-panel" aria-labelledby="margin-title" hidden>
<h3 id="margin-title">Supplier cost vs. Shopify price / 공급업체 원가·판매가 비교</h3>
<p id="margin-overview" role="status"></p>
<p class="note">This is not actual profit. You MUST independently confirm the supplier
cost and Shopify price use the same currency. Excludes taxes, shipping,
returns, discounts, labor, payment fees, advertising and all other costs.
Negative values only signal price below supplied cost; they do not prove a loss.</p>
<ol id="margin-rows"></ol>
<p>Shows the first eight proposed SKUs only. Download
supplier-margin-REVIEW-ONLY.csv for all rows; do not import it to Shopify.</p>
</section>
<ul id="reports"></ul>
<p><strong>Do not import</strong> supplier-matches-NOT-SHOPIFY-IMPORT.csv
or supplier-margin-REVIEW-ONLY.csv; ALL generated local reports are for
private review, not merchant upload instructions.</p></section>
<section class="panel">
<h2>Limits, security and official guidance</h2>
<p>For your privacy this downloadable single HTML includes only the open-source
CSV parser, supplier SKU join, optional CSV diff and Shopify preflight algorithms.
No network, telemetry, cookies, scripts from other sites, or Shopify API calls.
Input is limited to protect browser performance; any ambiguous key stops safely.
Advisory warnings cannot guarantee Shopify import success.</p>
<p>Shopify explains URL handles, variant option dependencies and CSV imports in its
<a href="https://help.shopify.com/en/manual/products/import-export/using-csv" rel="noopener noreferrer">official product CSV guide</a>.
Keep backups and independently review official import requirements.</p>
</section>
<h2>Other free browser tools / 다른 무료 도구</h2>
<p><a href="https://tools.trendbridged.com/tools/join-csv-by-key/" rel="noopener noreferrer">CSV lookup join / 키 병합</a>,
<a href="https://tools.trendbridged.com/tools/compare-csv-files/" rel="noopener noreferrer">CSV change comparison / 변경 비교</a>,
<a href="https://tools.trendbridged.com/tools/shopify-csv-preflight/" rel="noopener noreferrer">Shopify product CSV preflight / 상품 검사</a>.
The original free LocalCSV Lab informational pages may show clearly labeled advertising only after visitor opt-in;
the actual CSV editors and this offline HTML contain no advertiser script.</p>
<footer><p class="muted">Free, MIT-licensed open-source companion. Not affiliated with Shopify.
No Adsterra payment, ad impression or revenue claim is made.</p></footer>
</main><script>@@SCRIPT@@</script></body></html>
"""


def generate() -> str:
    core = package_core("csv-core.mjs", "", [
        "MAX_INPUT_CHARS", "parseCSV", "detectDelimiter", "stringifyCSV",
        "deduplicateCSV", "cleanCSV", "csvToJSON", "formatJSON", "jsonToCSV"])
    lookup = package_core("csv-lookup-core.mjs", "CsvCore", ["readJoinCSV","suggestLookupKeys","joinCSVByKey"])
    diff = package_core("csv-diff-core.mjs", "CsvCore", ["readCSVForComparison","commonCSVKeys","compareCSVExports"])
    shopify = package_core("shopify-preflight-core.mjs", "CsvCore", ["inspectShopifyProductCSV"])
    logic = extract_cli_reports()
    js = "\n".join([
        "const CsvCore="+core+"();",
        "const CsvLookup="+lookup+"(CsvCore);",
        "const CsvDiff="+diff+"(CsvCore);",
        "const Shopify="+shopify+"(CsvCore);",
         "const {joinCSVByKey,readJoinCSV}=CsvLookup;",
         "const {compareCSVExports,readCSVForComparison}=CsvDiff;",
        "const {stringifyCSV,parseCSV,detectDelimiter,MAX_INPUT_CHARS}=CsvCore;",
        "const {inspectShopifyProductCSV}=Shopify;",
        logic,
        APP,
    ])
    if "</script" in js.lower() or re.search(
       r"\bfetch\s*\(|XMLHttpRequest|navigator\.sendBeacon|document\.write\s*\(|\bgtag\s*\(", js
    ):
        raise ValueError("Unexpected web request or HTML close in JS bundle")
    html=PAGE.replace("@@STYLE@@",CSS).replace("@@SCRIPT@@",js)
    if "@@STYLE@@" in html or "@@SCRIPT@@" in html or len(html)>150000:
        raise ValueError("Unexpected HTML bundle output")
    return html


def main() -> int:
    html=generate()
    if "--check" in sys.argv[1:]:
        if DEST.read_text(encoding="utf8") != html:
            raise SystemExit("Stored supplier browser app differs from exact source")
        print("REPRODUCIBLE_THREE_CSV_AUDIT_OK",len(html.encode()),hashlib.sha256(html.encode()).hexdigest())
    else:
        DEST.parent.mkdir(parents=True,exist_ok=True)
        DEST.write_text(html,encoding="utf8")
        print("BUILT_THREE_CSV_BROWSER",str(DEST),len(html.encode()))
    return 0


if __name__=="__main__":
    raise SystemExit(main())
