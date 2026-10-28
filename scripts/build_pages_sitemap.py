#!/usr/bin/env python3
"""Three-page genuine-content sitemap for the noncommercial project GitHub Pages demo.

This never requests indexing, crawls search engines or generates traffic.
The dates are the actual calendar dates of the content updates: update them
only when the corresponding educational page materially changes.
"""
from __future__ import annotations

from hashlib import sha256
from pathlib import Path
import re
import sys
from urllib.parse import urlsplit
import xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parent.parent
PUBLIC="https://livastic-vm3-primary-tmp-260920.github.io/localcsv-shopify-supplier-audit/"
DEST=ROOT/"docs/sitemap.xml"
LOCATIONS=(
    ("index.html",PUBLIC,"2026-10-28"),
    ("supplier-audit/index.html",PUBLIC+"supplier-audit/","2026-10-28"),
    ("supplier-csv-review/index.html",PUBLIC+"supplier-csv-review/","2026-10-28"),
)
SCHEMA="http://www.sitemaps.org/schemas/sitemap/0.9"


def build() -> str:
    if len(LOCATIONS)!=3:
        raise ValueError("Review sitemap public content list before expanding")
    seen=set()
    urls=[]
    for filename,url,lastmod in LOCATIONS:
        if url in seen:
            raise ValueError("Duplicate sitemap entry")
        seen.add(url)
        parsed=urlsplit(url)
        if(parsed.scheme!="https" or
           parsed.hostname!="livastic-vm3-primary-tmp-260920.github.io" or
           not parsed.path.startswith("/localcsv-shopify-supplier-audit/") or
           parsed.query or parsed.fragment):
            raise ValueError("Off-property or noncanonical sitemap URL")
        page=(ROOT/"docs"/filename)
        html=page.read_text(encoding="utf8")
        if (html.count('<meta name="robots" content="index,follow">')!=1
            or '<meta name="robots" content="noindex,nofollow">' in html):
            raise ValueError("Non-indexable source HTML")
        if html.count('<link rel="canonical" href="'+url+'">')!=1:
            raise ValueError("Sitemap and HTML canonical mismatch")
        if not re.fullmatch(r"20[2-9][0-9]-[01][0-9]-[0-3][0-9]",lastmod):
            raise ValueError("Manually reviewed content lastmod date missing")
        urls.append((url,lastmod))
    lines=['<?xml version="1.0" encoding="UTF-8"?>',
           '<urlset xmlns="'+SCHEMA+'">']
    for url,lastmod in urls:
        lines.extend([
            "  <url>",
            "    <loc>"+url+"</loc>",
            "    <lastmod>"+lastmod+"</lastmod>",
            "  </url>"
        ])
    lines.append("</urlset>")
    result="\n".join(lines)+"\n"
    root=ET.fromstring(result)
    assert len(root.findall("{"+SCHEMA+"}url"))==3
    return result


def main()->int:
    output=build()
    if "--check" in sys.argv[1:]:
        if DEST.read_text(encoding="utf8")!=output:
            raise SystemExit("Sitemap differs from the two genuine canonical pages")
        print("GITHUB_EDUCATIONAL_SITEMAP_REPRODUCIBLE",len(output.encode("utf8")),sha256(output.encode("utf8")).hexdigest())
    else:
        DEST.write_text(output,encoding="utf8")
        print("WRITTEN_THREE_PAGE_EDUCATIONAL_SITEMAP",str(DEST),len(output.encode("utf8")))
    return 0


if __name__=="__main__":
    raise SystemExit(main())
