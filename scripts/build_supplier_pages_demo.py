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
<meta name="description" content="Free Shopify supplier CSV cost, SKU and change review: 2 or 3 files, exact manual vendor column mapping, 5 or 7 reports. Private local audit.">
<link rel="canonical" href="{PUBLIC}">
<meta property="og:type" content="website">
<meta property="og:title" content="Shopify Supplier CSV Change Comparison — Free Browser Demo">
<meta property="og:description" content="Try a free educational open-source 3-CSV Shopify pre-import audit. No file uploads or advertising.">
<meta property="og:url" content="{PUBLIC}">'''
OLD_TITLE = "<title>Free Offline Shopify Supplier SKU Change Audit | LocalCSV Lab</title>"
NEW_TITLE = "<title>Free Shopify Supplier SKU &amp; Cost CSV Audit — 2 or 3 Files</title>"
OLD_BANNER = '<p class="muted">LocalCSV Lab · Downloadable free browser utility · No account, upload, ads or installation</p>'
NEW_BANNER = '<p class="muted">Open-source educational example · Browser-local · Free · No account · No ads or data upload</p>'
BEFORE_FORM = '<form id="sku-audit-form" class="panel" novalidate>'

SAMPLE_PANEL = """<section class="panel" aria-labelledby="sample-preview-title">
<h2 id="sample-preview-title">Try the entire workflow in one click / 예제 한 번에 실행</h2>
<p>No downloads or file selection required. The example uses only two or three
<strong>fictional</strong> CSV files bundled within this page, and runs the exact
same privacy-safe local CSV checker. No customer data, account or ads.</p>
<p lang="ko">가상의 CSV 예제 3개를 브라우저 안에서 자동 선택하여
7종 보고서를 바로 확인할 수 있습니다. 실제 Shopify 데이터를 업로드하지 않습니다.</p>
<button id="use-demo-inputs" type="button">Run fictional 3-CSV example (7 reports) / 세 파일 예제</button>
<button id="use-two-file-demo-inputs" type="button">Run fictional 2-CSV supplier cost review (5 reports) / 두 파일 예제</button>
<p class="muted">If you already selected personal CSV files, clear them before using
this fictional example. The example NEVER replaces existing selections silently.</p>
</section>
"""

SAMPLE_JS = r"""(function(){
  "use strict";
  const fullButton=document.getElementById("use-demo-inputs");
  const costButton=document.getElementById("use-two-file-demo-inputs");
  const costOnly=document.getElementById("cost-only");
  const form=document.getElementById("sku-audit-form");
  const status=document.getElementById("status");
  if(!fullButton||!costButton||!costOnly||!form||!status)return;
  const examples=@@EXAMPLES@@;
  function sample(twoFile){
    const names=["current","supplier","proposed"];
    const inputs=names.map(name=>document.getElementById(name));
    if(inputs.some(input=>!input)){
      status.textContent="Sample unavailable: file inputs missing.";
      return;
    }
    // Check ALL inputs, including the proposed one in supplier-only mode.
    if(inputs.some(input=>input.files.length)){
      status.textContent="Clear selected files before trying fictional examples. / 예제 사용 전 실제 파일을 초기화하세요.";
      return;
    }
    const skuMap=document.getElementById("supplier-sku-column");
    const costMap=document.getElementById("supplier-cost-column");
    if((skuMap&&skuMap.value.trim())||(costMap&&costMap.value.trim())){
      status.textContent="Clear custom supplier column mappings before fictional examples. / 가상 예제 실행 전 열 이름 설정을 초기화하세요.";
      return;
    }
    let staged;
    const originalMode=costOnly.checked;
    try{
      const fields=twoFile?names.slice(0,2):names;
      staged=fields.map(field=>{
        const entry=examples[field];
        const transfer=new DataTransfer();
        transfer.items.add(new File([entry.text],entry.filename,{type:"text/csv"}));
        return transfer.files;
      });
      // Never override already-selected personal files. All inputs above were empty.
      costOnly.checked=twoFile;
      costOnly.dispatchEvent(new Event("change",{bubbles:true}));
      if(costOnly.checked!==twoFile){
        throw new Error("Could not select the desired safe comparison mode");
      }
      fields.forEach((name,index)=>{inputs[names.indexOf(name)].files=staged[index];});
      form.requestSubmit();
    }catch(error){
      for(const input of inputs)input.value="";
      costOnly.checked=originalMode;
      costOnly.dispatchEvent(new Event("change",{bubbles:true}));
      status.textContent="Browser cannot run this fictional example. Try the downloadable example CSVs.";
    }
  }
  fullButton.addEventListener("click",function(){sample(false);});
  costButton.addEventListener("click",function(){sample(true);});
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
Download or save each file, select it below, and choose <strong>Audit selected CSVs locally</strong>.</p>
<h3>Raw supplier headers differ? Choose them, do not guess</h3>
<p>Another <strong>fictional</strong> supplier file has the same three SKUs but uses
<strong>Vendor Ref</strong> instead of SKU and <strong>Net Unit Price</strong> instead of Cost.
<a href="https://github.com/livastic-vm3-primary-tmp-260920/localcsv-shopify-supplier-audit/raw/refs/heads/main/fixtures/supplier-custom-headers.csv"
rel="noopener noreferrer">Download the fake supplier with nonstandard headers</a>.
Choose it as your second file, click <strong>Show supplier column names locally</strong>,
and explicitly type <strong>Vendor Ref</strong> and <strong>Net Unit Price</strong> in the two mapping fields.
You can use this with two or three files. No automatic SKU synonym/size/colour
matching or currency conversion is attempted. The original supplier CSV stays unchanged.
The resulting supplier-joined and cost files are for review only, never Shopify imports.</p>
<p lang="ko"><strong>공급업체 열 이름 직접 지정:</strong> 다른 공급업체의 CSV가
SKU 대신 Vendor Ref, 원가 대신 Net Unit Price라는 열 이름을 쓸 수 있습니다.
위 가상 CSV를 내려받아 두 번째 파일로 지정하고
<strong>열 이름 확인</strong> 버튼을 누르세요. 표시된 열 이름 두 개를 그대로 입력하면
브라우저 안에서만 검토용으로 매핑합니다. 상품 옵션·크기·통화·SKU를 자동 추측하지
않으며 원본 CSV를 변경하지 않습니다.</p>
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
<p><strong>Two-file example:</strong> Have no proposed export yet?
Choose the 2-CSV sample button to review the CURRENT Shopify sale price
against the fictional supplier cost, inspect unmatched SKUs, and download
five review-only reports. No proposed changes, product-import risks or
new prices are inferred; no real profit is calculated. Use the 3-CSV
example only when a proposed export exists.</p>
<p lang="ko"><strong>두 파일 예제:</strong> 변경 예정 CSV가 없다면
2개 파일 예제로 기존 판매가와 가상 공급업체 원가를 비교하고
5개 검토 보고서를 확인하세요. 가격 변경 여부는 검사하지 않습니다.</p>
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
