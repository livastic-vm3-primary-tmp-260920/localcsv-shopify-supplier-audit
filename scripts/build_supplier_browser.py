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
    start = "export function makeReports({current, supplier, proposed}) {"
    end = "\nexport async function audit(args) {"
    if text.count(start) != 1 or text.count(end) != 1:
        raise ValueError("CLI report API changed: review before rebuilding")
    block = text[text.index(start):text.index(end)]
    if "readFile(" in block or "writeFile(" in block or "fetch(" in block:
        raise ValueError("CLI reports no longer pure")
    return block.replace("export function makeReports", "function makeReports", 1)


APP = r"""
(function(){
  "use strict";
  const form=document.getElementById("sku-audit-form");
  const run=document.getElementById("run");
  const status=document.getElementById("status");
  const results=document.getElementById("results");
  const summary=document.getElementById("summary");
  const reports=document.getElementById("reports");
  const clear=document.getElementById("clear");
  let urls=[];

  function resetResults(){
    for(const url of urls){ URL.revokeObjectURL(url); }
    urls=[];
    reports.replaceChildren();
    summary.textContent="";
    results.hidden=true;
  }

  form.addEventListener("submit",async function(event){
    event.preventDefault();
    resetResults();
    const elements=["current","supplier","proposed"];
    const files=elements.map(id=>document.getElementById(id).files[0]);
    if(files.some(file=>!file)){
      status.textContent="Choose all three CSV files. / CSV 파일 3개를 모두 선택하세요.";
      return;
    }
    if(files.some(file=>file.size>2200000)){
      status.textContent="Each CSV must be under 2.2 MB. / 각 파일은 2.2 MB 미만이어야 합니다.";
      return;
    }
    run.disabled=true;
    status.textContent="Checking locally. Nothing is uploaded. / 브라우저 내부에서 검사 중입니다.";
    try{
      const texts=await Promise.all(files.map(file=>file.text()));
      const result=makeReports({
        current:texts[0], supplier:texts[1], proposed:texts[2]
      });
      const m=result.summary;
      summary.textContent=
        "Supplier matches: "+m.supplierJoin.matched+
        " | Unmatched: "+m.supplierJoin.unmatched+
        " | Changed records: "+m.changedProductRecords.changed+
        " | Added/removed: "+(m.changedProductRecords.added+m.changedProductRecords.removed)+
        " | Manual review: "+(m.manualReviewRequired?"YES":"NO")+
        ". This is an AUDIT, not an import.";
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
      status.textContent="Six local reports prepared. Never import the joined supplier CSV into Shopify.";
    }catch(error){
      resetResults();
      status.textContent="Audit stopped safely: "+String(error&&error.message?error.message:error);
    }finally{
      run.disabled=false;
    }
  });

  clear.addEventListener("click",function(){
    form.reset();
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
<h1>Offline Shopify supplier SKU change audit</h1>
<p>Compare <strong>three CSV files</strong>: your current Shopify product export, a supplier SKU/cost list,
and a separately prepared proposed Shopify product CSV. Check SKU matches, added/removed and changed variants,
and advisory errors before considering an import. Nothing is sent to a server.</p>
<p lang="ko"><strong>한국어:</strong> 기존 Shopify 상품 CSV, 공급업체 SKU/원가 CSV,
변경 예정 상품 CSV를 각각 선택하면 브라우저에서 SKU 대응·변경사항·상품 데이터 오류를 비교합니다.
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
<label for="proposed">3. Proposed Shopify export / 변경 예정 Shopify CSV
<input id="proposed" type="file" accept=".csv,text/csv" required></label>
<p class="muted">Each CSV: under 2.2 MB, UTF-8 preferred. The SKU key must be unique and nonblank
for comparison. Ambiguous data stops rather than silently guessing.</p>
<div class="actions"><button id="run" type="submit">Audit three CSVs locally / 로컬 검사</button>
<button id="clear" type="button">Clear / 초기화</button></div></form>
<p id="status" role="status" aria-live="polite">Choose three CSVs to begin. No data leaves your browser.</p>
<section id="results" class="panel" hidden>
<h2>Review and download six reports / 보고서 6개</h2>
<p id="summary"></p><ul id="reports"></ul>
<p><strong>Do not import</strong> supplier-matches-NOT-SHOPIFY-IMPORT.csv;
the six files are private review reports, not merchant upload instructions.</p></section>
<section class="panel">
<h2>Limits, security and official guidance</h2>
<p>For your privacy this downloadable single HTML includes only the original open-source
CSV parser, SKU join, CSV diff and Shopify preflight algorithms.
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
        "const {joinCSVByKey}=CsvLookup;",
        "const {compareCSVExports}=CsvDiff;",
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
