import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";

const SITE="https://livastic-vm3-primary-tmp-260920.github.io/localcsv-shopify-supplier-audit/";
const sitemap=readFileSync("docs/sitemap.xml","utf8");
const links=[...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1]);

test("actual minimal Github Pages sitemap is byte reproducible without any external API",()=>{
 const verify=execFileSync("python3",["scripts/build_pages_sitemap.py","--check"],{
  encoding:"utf8",timeout:5000
 });
 assert.match(verify,/GITHUB_EDUCATIONAL_SITEMAP_REPRODUCIBLE/);
 assert.ok(sitemap.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
 assert.ok(sitemap.includes('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'));
 assert.equal(sitemap.match(/<url>/g)?.length,3);
 assert.equal(sitemap.match(/<\/url>/g)?.length,3);
 assert.equal(sitemap.match(/<lastmod>2026-10-28<\/lastmod>/g)?.length,3);
});

test("three genuine indexable canonical educational pages and ZERO ad or editor URLs",()=>{
 assert.deepEqual(links,[SITE,SITE+"supplier-audit/",SITE+"supplier-csv-review/"]);
 assert.equal(new Set(links).size,3);
 assert.ok(!sitemap.includes("tools.trendbridged.com"));
 assert.ok(!sitemap.includes("/editor/"));
 assert.ok(!sitemap.includes("releases/download"));
 assert.ok(!sitemap.includes("<priority>"));
 assert.ok(!sitemap.includes("<changefreq>"));
 for(const [filename,url] of [
  ["docs/index.html",SITE],
  ["docs/supplier-audit/index.html",SITE+"supplier-audit/"],
  ["docs/supplier-csv-review/index.html",SITE+"supplier-csv-review/"]
 ]){
   const data=readFileSync(filename,"utf8");
   assert.equal(data.split('rel="canonical" href="'+url+'"').length,2);
   assert.ok(data.includes('content="index,follow"'));
   assert.ok(!data.includes('content="noindex,nofollow"'));
 }
});

test("search discovery asset contains no advertising or outbound user-data requests",()=>{
 const source=readFileSync("scripts/build_pages_sitemap.py","utf8");
 for(const token of [
  "requests.get(", "urllib.request","urlopen(", "subprocess.run(",
  "adsterra.com", "fetch(", "location.reload(",
  "sitemap ping", "indexnow", "submit_indexing"
 ])assert.ok(!source.toLowerCase().includes(token.toLowerCase()),token);
 assert.equal(links.every(url=>url.startsWith(SITE)),true);
});

test("sitemap update alone cannot write original Netlify production files",()=>{
 const source=readFileSync("scripts/build_pages_sitemap.py","utf8");
 assert.ok(source.includes('DEST=ROOT/"docs/sitemap.xml"'));
 assert.ok(!source.includes("netlify deploy"));
 assert.ok(!source.includes("site/sitemap.xml"));
 assert.ok(!source.includes("deploy/localcsv"));
});
