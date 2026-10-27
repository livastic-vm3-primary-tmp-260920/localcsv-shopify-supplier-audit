#!/usr/bin/env python3
"""Deterministic, dependency-free, SINGLE HTML offline Shopify CSV preflight.

Packages only the same two tested pure-JS engines as the free public site.
Does NOT create a remote page, deploy, use advertising or read any merchant data.
"""
from __future__ import annotations
import hashlib
import re
import sys
from pathlib import Path

ROOT=Path(__file__).resolve().parent.parent
DEST=ROOT/"offline/shopify-csv-preflight.html"

def package_core(name:str,dependency:str,expected:list[str])->str:
    source=(ROOT/"lib"/name).read_text(encoding="utf-8")
    if "</script" in source.lower() or "<script" in source.lower():
        raise ValueError("Unsafe HTML token in module "+name)
    import_lines=re.findall(r"^import\s+\{([^}]+)\}\s+from\s+['\"]\./csv-core\.mjs['\"];?\s*$",source,re.M)
    if name=="csv-core.mjs" and import_lines:
        raise ValueError("Unexpected import")
    if name!="csv-core.mjs" and len(import_lines)!=1:
        raise ValueError("Unexpected core dependency")
    if any(re.search(r"\bfetch\s*\(|XMLHttpRequest|document\.write\s*\(|navigator\.sendBeacon",source) for _ in [0]):
        raise ValueError("Pure module unexpectedly contains a request")
    names=re.findall(r"^export\s+(?:function|const)\s+([a-zA-Z_]\w*)",source,re.M)
    if sorted(names)!=sorted(expected):
        raise ValueError("Module public API changed unexpectedly "+name)
    source=re.sub(r"^import\s+\{[^}]+\}\s+from\s+['\"]\./csv-core\.mjs['\"];?\s*$","",source,flags=re.M)
    source=re.sub(r"^export\s+(?=function\s|const\s)","",source,flags=re.M)
    if re.search(r"^\s*(?:import|export)\b",source,re.M):
        raise ValueError("Unexpected module statement")
    imported=""
    if import_lines:
        fields=[item.strip() for item in import_lines[0].split(",")]
        if any(not re.fullmatch(r"[A-Za-z_]\w*",x) for x in fields):
            raise ValueError("Unsafe field import")
        imported="const {"+",".join(fields)+"}=CsvCore;\n"
    parameters="CsvCore" if dependency else ""
    return "(function("+parameters+"){\n'use strict';\n"+imported+source+"\nreturn {"+",".join(expected)+"};\n})"

def generate()->str:
    core=package_core("csv-core.mjs", "", [
       "MAX_INPUT_CHARS","parseCSV","detectDelimiter","stringifyCSV",
       "deduplicateCSV","cleanCSV","csvToJSON","formatJSON","jsonToCSV"
    ])
    preflight=package_core("shopify-preflight-core.mjs","CsvCore",["inspectShopifyProductCSV"])
    js="const CsvCore="+core+"();\nconst Shopify="+preflight+"(CsvCore);\n"+APP

    if re.search(r"fetch\s*\(|XMLHttpRequest|navigator\.sendBeacon|document\.write\s*\(|gtag\s*\(",js):
        raise ValueError("Network/ads code unexpectedly present in offline bundle")
    if "</script" in js.lower():
        raise ValueError("Unsafe JS script close")
    document=PAGE.replace("@@STYLE@@",CSS).replace("@@SCRIPT@@",js)
    if "@@STYLE@@" in document or "@@SCRIPT@@" in document or len(document)>90000:
        raise ValueError("Unexpected generated output")
    return document

CSS=r"""
:root{font-family:system-ui,sans-serif;color:#12393c;background:#f5faf8;line-height:1.55}
*{box-sizing:border-box}
body{margin:0}
main{max-width:810px;padding:2rem 1.2rem 5rem;margin:auto}
h1{font-size:clamp(1.7rem,5vw,2.5rem);line-height:1.18}
h2{margin-top:1.8rem}
p{max-width:75ch}
.panel{background:white;border:1px solid #adc7c6;padding:1.2rem;border-radius:12px;margin:1.2rem 0}
label{display:block;font-weight:700;margin:.9rem 0}
input,select{display:block;font:inherit;width:100%;padding:.55rem;background:#f5fbfa;border:1px solid #678e8f;border-radius:6px}
button{font:inherit;padding:.6rem 1rem;border:2px solid #0c6266;border-radius:6px;cursor:pointer}
button[type=submit]{background:#08686b;color:white}
button[type=button]{background:white;color:#143638}
button:focus-visible,input:focus-visible,select:focus-visible,a:focus-visible{outline:3px solid #b3631d;outline-offset:2px}
.actions{display:flex;flex-wrap:wrap;gap:.7rem;margin-top:1.1rem}
.note{border-left:4px solid #ab5b12;background:#fff8ed;padding:.7rem 1rem}
.muted{font-size:.94rem;color:#386569}
a{color:#055c6b}
pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#edf5f4;padding:1rem}
footer{border-top:1px solid #b0c8c7;margin-top:2.3rem}
"""

APP=r"""
(function(){
  "use strict";
  const form=document.getElementById("localcsv-form");
  const input=document.getElementById("csv-file");
  const mode=document.getElementById("mode");
  const result=document.getElementById("result");
  const summary=document.getElementById("summary");
  const findings=document.getElementById("findings");
  const download=document.getElementById("download");
  const status=document.getElementById("status");
  const clear=document.getElementById("clear");
  let objectURL=null;
  function forget(){
    if(objectURL){URL.revokeObjectURL(objectURL);objectURL=null;}
    download.removeAttribute("href");
    result.hidden=true;
    summary.textContent="";
    findings.textContent="";
  }
  form.addEventListener("submit",async function(event){
    event.preventDefault();
    forget();
    const file=input.files[0];
    if(!file){status.textContent="Choose a CSV file first.";return;}
    if(file.size>2200000){status.textContent="File too large: use a CSV under 2.2 MB.";return;}
    status.textContent="Checking the file locally — no upload…";
    try{
      const text=await file.text();
      const report=Shopify.inspectShopifyProductCSV(text,{mode:mode.value});
      const m=report.metrics;
      summary.textContent="CSV rows: "+m.totalRows+" | Products: "+m.products+
        " | Errors: "+m.errors+" | Warnings: "+m.warnings+
        " | Findings: "+m.issueCount;
      const displayed=report.findings.slice(0,30);
      const lines=displayed.map(row=>row.join(" | "));
      findings.textContent=lines.length?lines.join("\n"):"No findings in this diagnostic. This does NOT guarantee Shopify import safety.";
      const blob=new Blob([report.csv],{type:"text/csv;charset=utf-8"});
      objectURL=URL.createObjectURL(blob);
      download.href=objectURL;
      download.download="shopify-preflight-findings.csv";
      result.hidden=false;
      status.textContent="Local check complete. Download the report or review the findings.";
    }catch(err){
      result.hidden=true;
      status.textContent="Cannot inspect CSV: "+String(err&&err.message?err.message:err);
    }
  });
  clear.addEventListener("click",function(){
    form.reset();forget();
    status.textContent="Cleared local file selection and generated report.";
  });
  window.addEventListener("beforeunload",forget,{once:true});
})();
"""

PAGE=r"""<!doctype html>
<html lang="en">
<head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'; img-src 'none'; font-src 'none'; frame-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'">
<title>Free Offline Shopify CSV Preflight | LocalCSV Lab</title>
<style>@@STYLE@@</style></head>
<body>
<main id="main">
<p class="muted">LocalCSV Lab · Free · No account · Works without internet</p>
<h1>Offline Shopify product CSV preflight</h1>
<p>Open this single HTML file in a modern browser. Pick a Shopify-shaped product CSV
and review missing handles, titles, variant option dependencies, prices, inventory
and image URL syntax <strong>before</strong> importing. Your CSV stays on your computer.</p>
<p>한국어: Shopify 상품 CSV를 업로드하지 않고 브라우저에서 검사할 수 있습니다.
파일을 선택하고 아래 <b>Inspect locally</b> 버튼을 클릭하세요.</p>
<div class="note"><strong>Important:</strong> This is advisory CSV inspection, not Shopify's
official validator. A clean report cannot guarantee a safe import. Product updates
use URL handles and variant option dependencies. <strong>Keep your original backup</strong>
and test only one or two products before a live store import.</div>
<form id="localcsv-form" class="panel" novalidate>
<h2>Choose local CSV</h2>
<label for="csv-file">Shopify product CSV (.csv)
<input type="file" id="csv-file" accept=".csv,text/csv" required></label>
<label for="mode">Check intent
<select id="mode">
<option value="update">Update existing products</option>
<option value="create">Create new products</option>
</select></label>
<div class="actions">
<button type="submit">Inspect locally</button>
<button type="button" id="clear">Clear</button></div>
</form>
<p id="status" role="status" aria-live="polite">No file chosen. Data never leaves your browser.</p>
<section id="result" class="panel" hidden><h2>Local preflight result</h2>
<p id="summary"></p><pre id="findings"></pre>
<p><a id="download">Download full findings CSV</a></p>
<p class="muted">Only the first 30 findings are displayed here.
The download contains all captured findings up to the preflight limit.</p>
</section>
<h2>Privacy and import limitations</h2>
<p>This file includes only the pure local CSV and Shopify diagnostic JavaScript
engines. No tracking, external scripts, advertisers, analytics, network requests,
file uploads, merchant API login or subscription. It works with Wi-Fi disconnected.</p>
<p>Image URL syntax is reviewed but the URLs are not fetched. This tool never
updates Shopify. Keep the full product export, all relevant variant rows, and
dependent option columns. Spreadsheet formula protection is defense-in-depth;
it cannot guarantee safety in all spreadsheet programs.</p>
<h2>More free web tools</h2>
<p>Use <a href="https://tools.trendbridged.com/tools/shopify-csv-preflight/" target="_blank" rel="noopener noreferrer">LocalCSV Lab Shopify preflight</a>,
<a href="https://tools.trendbridged.com/tools/join-csv-by-key/" target="_blank" rel="noopener noreferrer">supplier SKU join</a>, or
<a href="https://tools.trendbridged.com/tools/compare-csv-files/" target="_blank" rel="noopener noreferrer">two-CSV difference viewer</a>
online, also free without login. Their separate file editors do not load advertiser
scripts. Informational landing pages display only opt-in optional advertising.</p>
<footer><p class="muted">LocalCSV Lab · MIT-licensed offline HTML companion ·
No Adsterra code or monetization counter in this file.</p></footer>
</main><script>@@SCRIPT@@</script>
</body></html>
"""

def main()->int:
    html=generate()
    if "--check" in sys.argv[1:]:
        existing=DEST.read_text(encoding="utf-8")
        if existing!=html:
            raise SystemExit("Committed offline HTML differs from reproducible build")
        print("REPRODUCIBLE_OFFLINE_HTML_OK",len(html.encode("utf-8")),"bytes")
    else:
        DEST.parent.mkdir(parents=True,exist_ok=True)
        DEST.write_text(html,encoding="utf-8")
        print("BUILT_SELF_CONTAINED_OFFLINE_HTML",str(DEST),len(html.encode("utf-8")),"bytes")
    return 0

if __name__=="__main__":
    raise SystemExit(main())
