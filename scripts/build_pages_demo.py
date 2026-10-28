#!/usr/bin/env python3
"""Reproducibly publish an OPEN SOURCE demo of the existing offline HTML.

The hosting endpoint is GitHub Pages (public repository), never Netlify.
This is a no-account/no-ads educational open-source demo, NOT a
commercial SaaS, advertising platform, Shopify importer, or revenue claim.
"""
from __future__ import annotations
import hashlib
import os
from pathlib import Path
import sys

from build_offline import generate

ROOT=Path(__file__).resolve().parent.parent
OUTPUT=ROOT/'docs/index.html'
PUBLIC='https://livastic-vm3-primary-tmp-260920.github.io/localcsv-shopify-supplier-audit/'
PREFIX='<meta name="robots" content="noindex,nofollow">'
INDEXED=f'''<meta name="robots" content="index,follow">
<meta name="description" content="Open-source free Shopify CSV preflight demo: review product handles, variant options, prices, inventory and image URL syntax entirely in your browser without upload or account.">
<link rel="canonical" href="{PUBLIC}">
<meta property="og:title" content="Open-source Shopify Product CSV Preflight — Browser-Local Demo">
<meta property="og:description" content="Inspect Shopify-shaped CSV data for errors or warnings for free. All processing is local; no login or upload.">
<meta property="og:url" content="{PUBLIC}">'''
DISCLOSURE='''<p class="muted">LocalCSV Lab · Free · No account · Works without internet</p>'''
UPDATED='''<p class="muted">Open-source educational demonstration · Free · No account · No ads · No data upload</p>'''
REVIEW='''<h2>Privacy and import limitations</h2>'''
MORE='''<section class="panel" aria-labelledby="open-source-demo-heading">
<h2 id="open-source-demo-heading">Open-source example, not a merchant service</h2>
<p>This page hosts the exact self-contained JavaScript CSV preflight example from
<a href="https://github.com/livastic-vm3-primary-tmp-260920/localcsv-shopify-supplier-audit" rel="noopener noreferrer">its public MIT-licensed source</a>.
It has no accounts, subscriptions, Shopify integration, telemetry,
external scripts or advertising. It is a client-side reference tool,
not an import or a commercial service. Its checks are advisory, and
they cannot replace Shopify's official import requirements.</p>
<p>Need to compare a supplier SKU price list with <em>both</em> a current and proposed
Shopify product CSV? Try the <a href="supplier-audit/">free, no-upload
three-CSV supplier audit educational demo</a>. It generates seven local review
reports, not Shopify import files, with no advertising or user accounts.</p>
<p>Before using supplier CSVs in a live store, work through the
<a href="supplier-csv-review/">free Shopify supplier header-mapping and
pre-import review checklist</a>. It includes exact source-row evidence steps,
official Shopify import links and a blank, downloadable reviewer decision
CSV sheet. No files are collected by that guide.</p>
</section>
<h2>Privacy and import limitations</h2>'''

def build()->str:
    html=generate()
    assert html.count(PREFIX)==1
    assert html.count(DISCLOSURE)==1
    assert html.count(REVIEW)==1
    html=html.replace(PREFIX,INDEXED,1)
    html=html.replace(DISCLOSURE,UPDATED,1)
    html=html.replace(REVIEW,MORE,1)
    assert '<script src=' not in html
    assert 'connect-src '+"'none'" in html
    assert '<meta name="robots" content="noindex,nofollow">' not in html
    assert PUBLIC in html
    if '</script>' not in html or html.count('<script>')!=1:
        raise ValueError('Unexpected script structure in static Pages demo')
    return html

def main()->int:
    value=build()
    if '--check' in sys.argv:
        if OUTPUT.read_text(encoding='utf-8')!=value:
            raise SystemExit('Stored GitHub Pages demo differs from reproducible source')
        print('GITHUB_OPEN_SOURCE_DEMO_REPRODUCIBLE',len(value.encode('utf-8')),hashlib.sha256(value.encode()).hexdigest())
    else:
        OUTPUT.parent.mkdir(exist_ok=True)
        OUTPUT.write_text(value,encoding='utf-8')
        (OUTPUT.parent/'.nojekyll').touch(exist_ok=True)
        print('GITHUB_OPEN_SOURCE_DEMO_BUILT',str(OUTPUT),len(value.encode('utf-8')))
    return 0

if __name__=='__main__':
    raise SystemExit(main())
