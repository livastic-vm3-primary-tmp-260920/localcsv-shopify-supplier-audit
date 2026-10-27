#!/usr/bin/env python3
"""Build a noncommercial, open-source, browser-local educational Shopify CSV audit demo.

Uses the EXACT self-contained offline application JavaScript; changes only
HTML explanatory content / SEO metadata. Hosted on GitHub Pages /docs,
not the Netlify advertising service. Never reads merchant data.
"""
from __future__ import annotations
import hashlib
import json
import sys

from build_supplier_browser import ROOT, generate as generate_offline

TARGET = ROOT / "docs/supplier-audit/index.html"
PUBLIC = "https://livastic-vm3-primary-tmp-260920.github.io/localcsv-shopify-supplier-audit/supplier-audit/"

OFFLINE_ROBOTS = '<meta name="robots" content="noindex,nofollow">'
PUBLIC_META = f'''<meta name="robots" content="index,follow">
<meta name="description" content="Free Shopify supplier CSV comparison with instant change preview and blank overwrite and variant risk warnings. Seven private reports including a supplier cost vs. proposed price review. No upload or signup.">
<link rel="canonical" href="{PUBLIC}">
<meta property="og:type" content="website">
<meta property="og:title" content="Shopify Supplier CSV Change Comparison — Free Browser Demo">
<meta property="og:description" content="Try a free educational open-source 3-CSV Shopify pre-import audit. No file uploads or advertising.">
<meta property="og:url" content="{PUBLIC}">'''
OLD_TITLE = "<title>Free Offline Shopify Supplier SKU Change Audit | LocalCSV Lab</title>"
NEW_TITLE = "<title>Shopify Supplier CSV Comparison — Free Open-Source Browser Demo</title>"
OLD_BANNER = '<p class="muted">LocalCSV Lab · Downloadable free browser utility · No account, upload, ads or installation</p>'
NEW_BANNER = '<p class="muted">Open-source educational example · Browser-local · Free · No account · No ads or data upload</p>'
BEFORE_FORM = '<form id="sku-audit-form" class="panel" novalidate>'

SAMPLE_PANEL = """<section class="panel" aria-labelledby="sample-preview-title">
<h2 id="sample-preview-title">Try the entire workflow in one click / 예제 한 번에 실행</h2>
<p>No downloads or file selection required. The example uses only three
<strong>fictional</strong> CSV files bundled within this page, and runs the exact
same seven-report browser-local checker. No customer data, account or ads.</p>
<p lang="ko">가상의 CSV 예제 3개를 브라우저 안에서 자동 선택하여
7종 보고서를 바로 확인할 수 있습니다. 실제 Shopify 데이터를 업로드하지 않습니다.</p>
<button id="use-demo-inputs" type="button">Run fictional 3-CSV example / 예제 바로 실행</button>
<p class="muted">If you already selected personal CSV files, clear them before using
this fictional example. The example NEVER replaces existing selections silently.</p>
</section>
"""

SAMPLE_JS = r"""(function(){
  "use strict";
  const button=document.getElementById("use-demo-inputs");
  const form=document.getElementById("sku-audit-form");
  const status=document.getElementById("status");
  if(!button||!form||!status) return;
  const examples=@@EXAMPLES@@;
  button.addEventListener("click",function(){
    const fields=["current","supplier","proposed"];
    const inputs=fields.map(field=>document.getElementById(field));
    if(inputs.some(input=>!input)){
      status.textContent="Sample is unavailable: file inputs are missing.";
      return;
    }
    if(inputs.some(input=>input.files.length)){
      status.textContent="Clear selected files before trying the fictional example. / 예제 사용 전 실제 파일을 초기화하세요.";
      return;
    }
    try{
      // Only literal, locally bundled fictional CSVs; never makes a request.
      const staged=fields.map(field=>{
        const value=examples[field];
        const transfer=new DataTransfer();
        transfer.items.add(new File([value.text],value.filename,{type:"text/csv"}));
        return transfer.files;
      });
      inputs.forEach((input,index)=>{input.files=staged[index]});
      form.requestSubmit();
    }catch(error){
      // If browser-specific synthetic File selection fails, do not submit.
      for(const input of inputs)input.value="";
      status.textContent="Cannot use the one-click sample in this browser. Download the fictional examples above instead.";
    }
  });
})();"""

def sample_js() -> str:
    filenames = {
      "current":"shopify-current-products.csv",
      "supplier":"supplier-price-update.csv",
      "proposed":"shopify-proposed-products.csv",
    }
    contents={}
    for key,filename in filenames.items():
        text=(ROOT/"fixtures"/filename).read_text(encoding="utf8")
        if not text or len(text)>10000 or "</script" in text.lower():
            raise ValueError("Unexpected unsafe fictional fixture: "+filename)
        contents[key]={"filename":filename,"text":text}
    payload=json.dumps(contents,ensure_ascii=True,separators=(",",":")).replace("<","\\u003c").replace(">","\\u003e")
    assert SAMPLE_JS.count("@@EXAMPLES@@")==1
    return SAMPLE_JS.replace("@@EXAMPLES@@",payload)


EXPLAIN = '''<section class="panel" aria-labelledby="worked-example">
<h2 id="worked-example">Worked example: compare supplier costs and product changes</h2>
<p>A <strong>fictional</strong> clothing store has two T-shirt variants and one cap.
The supplier has sent a CSV with unique SKU codes and unit costs, while the
store has prepared a proposed export with an updated price for one variant
and lower stock for the cap.</p>
<p>Try the workflow with three openly licensed, <strong>fictional</strong> sample CSV files:
<a href="https://github.com/livastic-vm3-primary-tmp-260920/localcsv-shopify-supplier-audit/raw/refs/heads/main/fixtures/shopify-current-products.csv" rel="noopener noreferrer">1. current Shopify export</a>,
<a href="https://github.com/livastic-vm3-primary-tmp-260920/localcsv-shopify-supplier-audit/raw/refs/heads/main/fixtures/supplier-price-update.csv" rel="noopener noreferrer">2. supplier SKU list</a>,
<a href="https://github.com/livastic-vm3-primary-tmp-260920/localcsv-shopify-supplier-audit/raw/refs/heads/main/fixtures/shopify-proposed-products.csv" rel="noopener noreferrer">3. proposed export</a>.
Download or save each file, select it below, and choose <strong>Audit three CSVs locally</strong>.</p>
<ul>
<li><strong>TEE-BLK-M:</strong> Price changes from 29.00 to 31.00; the variant remains.</li>
<li><strong>CAP-WOOL:</strong> Inventory quantity changes from 7 to 6; the variant remains.</li>
<li><strong>TEE-BLK-L:</strong> Unchanged. All three supplier SKUs match.</li>
</ul>
<p>You should receive <strong>seven downloadable review files</strong>, including a field-by-field
before/after diff, supplier match summary, unmatched exceptions, and two advisory
product-CSV preflight reports. A seventh, strictly local CSV report
estimates proposed price minus the supplier unit cost. This arithmetic
assumes both inputs use the same currency and excludes shipping, taxes,
advertising, returns and payment fees. It is NOT real profit. None of these
outputs is an authorized Shopify import command.
The supplier-joined report contains extra supplier-only fields and MUST NOT
be used as a Shopify import CSV.</p>
<p lang="ko"><strong>한국어 예제:</strong> 가상의 의류 매장 상품 3개를 공급업체 SKU로 비교합니다.
티셔츠 M 사이즈 가격 29.00 → 31.00, 모자 재고 7 → 6으로 변경됩니다.
위 CSV 예시 세 개를 내려받고 아래 파일 입력에서 각각 선택해 보세요.
7종 보고서는 검토용이며 Shopify에 자동 반영되지 않습니다.
공급업체 원가와 제안 판매가는 동일 통화라고 가정한 단순 차액만 계산합니다.
배송비·수수료·세금·광고비 등을 뺀 실제 순이익이 아니므로 별도로 확인하세요.</p>
<p>For a single-file workflow visit the original
<a href="https://tools.trendbridged.com/tools/shopify-csv-preflight/" rel="noopener noreferrer">free Shopify CSV checker</a>,
or see its
<a href="https://tools.trendbridged.com/tools/join-csv-by-key/" rel="noopener noreferrer">free SKU lookup utility</a>.
Those original informational pages may show optional, clearly labeled
Adsterra advertising only with visitor consent; this GitHub Pages open-source
reference has no advertising at all.</p>
</section>
'''

OLD_END = '<footer><p class="muted">Free, MIT-licensed open-source companion. Not affiliated with Shopify.'
NEW_END = '''<section class="panel">
<h2>Source and educational scope</h2>
<p>The core audit script is byte-identical to the MIT-licensed
<a href="https://github.com/livastic-vm3-primary-tmp-260920/localcsv-shopify-supplier-audit" rel="noopener noreferrer">source repository</a>'s standalone
offline example. This educational page adds only a locally bundled, fictional
one-click sample loader. No accounts, backend, subscriptions, telemetry, remote APIs,
external scripts or advertising. It is an open-source learning example,
not a commercial hosting service or the official Shopify product importer.
You can also
<a href="https://github.com/livastic-vm3-primary-tmp-260920/localcsv-shopify-supplier-audit/releases/latest/download/shopify-supplier-threeway-audit.html" rel="noopener noreferrer">download the same offline tool</a>
and use it with internet disconnected.</p>
</section>
<footer><p class="muted">Free, MIT-licensed open-source companion. Not affiliated with Shopify.'''


def build() -> str:
    content = generate_offline()
    for expected in (OFFLINE_ROBOTS, OLD_TITLE, OLD_BANNER, BEFORE_FORM, OLD_END):
        if content.count(expected) != 1:
            raise ValueError("Unexpected offline template change: "+expected[:60])
    content = content.replace(OFFLINE_ROBOTS,PUBLIC_META,1)
    content = content.replace(OLD_TITLE,NEW_TITLE,1)
    content = content.replace(OLD_BANNER,NEW_BANNER,1)
    content = content.replace(BEFORE_FORM,SAMPLE_PANEL+EXPLAIN+BEFORE_FORM,1)
    closing="</body></html>"
    if content.count(closing)!=1:
        raise ValueError("Unexpected standalone HTML close")
    extra=sample_js()
    if "</script" in extra.lower():
        raise ValueError("Embedded sample JavaScript has an HTML closing tag")
    content=content.replace(closing,"<script>"+extra+"</script>"+closing,1)
    content = content.replace(OLD_END,NEW_END,1)
    assert content.count('<script>') == content.count('</script>') == 2
    assert 'connect-src '+ "'none'" in content
    assert '<script src=' not in content
    assert OFFLINE_ROBOTS not in content
    assert content.count('rel="canonical"') == 1
    assert content.count('href="'+PUBLIC+'"') == 1
    return content


def main() -> int:
    content = build()
    if "--check" in sys.argv:
        if TARGET.read_text(encoding="utf8") != content:
            raise SystemExit("GitHub supplier Pages demo diverged from deterministic builder")
        print("REPRODUCIBLE_SUPPLIER_PAGES_DEMO_OK",len(content.encode()),hashlib.sha256(content.encode()).hexdigest())
    else:
        TARGET.parent.mkdir(exist_ok=True,parents=True)
        TARGET.write_text(content,encoding="utf8")
        print("BUILT_EDUCATIONAL_SUPPLIER_PAGES_DEMO",str(TARGET),len(content.encode()))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
