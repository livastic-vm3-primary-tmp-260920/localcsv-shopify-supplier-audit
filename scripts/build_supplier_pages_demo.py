#!/usr/bin/env python3
"""Build a noncommercial, open-source, browser-local educational Shopify CSV audit demo.

Uses the EXACT self-contained offline application JavaScript; changes only
HTML explanatory content / SEO metadata. Hosted on GitHub Pages /docs,
not the Netlify advertising service. Never reads merchant data.
"""
from __future__ import annotations
import hashlib
import sys

from build_supplier_browser import ROOT, generate as generate_offline

TARGET = ROOT / "docs/supplier-audit/index.html"
PUBLIC = "https://livastic-vm3-primary-tmp-260920.github.io/localcsv-shopify-supplier-audit/supplier-audit/"

OFFLINE_ROBOTS = '<meta name="robots" content="noindex,nofollow">'
PUBLIC_META = f'''<meta name="robots" content="index,follow">
<meta name="description" content="Free open-source demo: locally compare a Shopify product export, a supplier SKU CSV and a proposed catalog. Six private reports, no signup or file upload.">
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
<p>You should receive <strong>six downloadable review files</strong>, including a field-by-field
before/after diff, supplier match summary, unmatched exceptions, and two advisory
product-CSV preflight reports. None is an authorized Shopify import command.
The supplier-joined report contains extra supplier-only fields and MUST NOT
be used as a Shopify import CSV.</p>
<p lang="ko"><strong>한국어 예제:</strong> 가상의 의류 매장 상품 3개를 공급업체 SKU로 비교합니다.
티셔츠 M 사이즈 가격 29.00 → 31.00, 모자 재고 7 → 6으로 변경됩니다.
위 CSV 예시 세 개를 내려받고 아래 파일 입력에서 각각 선택해 보세요.
6종 보고서는 검토용이며 Shopify에 자동 반영되지 않습니다.</p>
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
<p>All browser scripts on this page are byte-identical to the released MIT-licensed
<a href="https://github.com/livastic-vm3-primary-tmp-260920/localcsv-shopify-supplier-audit" rel="noopener noreferrer">source repository</a>'s standalone
offline example. No accounts, backend, subscriptions, telemetry, remote APIs,
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
    content = content.replace(BEFORE_FORM,EXPLAIN+BEFORE_FORM,1)
    content = content.replace(OLD_END,NEW_END,1)
    assert content.count('<script>') == content.count('</script>') == 1
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
