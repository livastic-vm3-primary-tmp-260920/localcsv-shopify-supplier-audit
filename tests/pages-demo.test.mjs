import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync, existsSync} from "node:fs";
import {execFileSync} from "node:child_process";
import vm from "node:vm";

const docs=readFileSync("docs/index.html","utf8");
const offline=readFileSync("offline/shopify-csv-preflight.html","utf8");
const scripts=text=>[...text.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const url="https://livastic-vm3-primary-tmp-260920.github.io/localcsv-shopify-supplier-audit/";

test("GitHub Pages demo is reproducible, educational, noncommercial, dependency free",()=>{
 const x=execFileSync("python3",["scripts/build_pages_demo.py","--check"],{
   encoding:"utf8",timeout:8000
 });
 assert.match(x,/GITHUB_OPEN_SOURCE_DEMO_REPRODUCIBLE/);
 assert.ok(existsSync("docs/.nojekyll"));
 assert.ok(docs.includes('content="index,follow"'));
 assert.ok(docs.includes('rel="canonical" href="'+url+'"'));
 assert.ok(docs.includes("Open-source educational demonstration"));
 assert.ok(docs.includes("public MIT-licensed source"));
 assert.ok(docs.includes("not a merchant service"));
 assert.ok(docs.includes("not an import or a commercial service"));
 assert.ok(!docs.includes('content="noindex,nofollow"'));
});

test("advertiser-free educational demo reuses EXACT byte-for-byte tested offline application script",()=>{
 const a=scripts(docs);
 const b=scripts(offline);
 assert.equal(a.length,1);
 assert.deepEqual(a,b);
 new vm.Script(a[0]);
 for(const risky of [
   "<script src=", "XMLHttpRequest(", "fetch(", "navigator.sendBeacon",
   "document.write(", "window.open(", "google-analytics", "gtag(",
   "bauval.org", "abscloud.org", "araplhn.org",
   "shopify.com/admin", "adsterra.com",
 ]){
   assert.ok(!docs.toLowerCase().includes(risky.toLowerCase()),risky);
 }
 assert.ok(docs.includes("connect-src 'none'"));
 assert.ok(docs.includes("form-action 'none'"));
 assert.ok(docs.includes("default-src 'none'"));
 assert.ok(docs.includes("No Adsterra code or monetization counter"));
});

test("browser example remains self-contained, English/Korean, no signup, backup warning",()=>{
 assert.ok(docs.includes("한국어"));
 assert.ok(docs.includes('type="file" id="csv-file"'));
 assert.ok(docs.includes('id="localcsv-form"'));
 assert.ok(docs.includes("Inspect locally"));
 assert.ok(docs.includes("Download full findings CSV"));
 assert.ok(docs.includes("Keep your original backup"));
 assert.ok(docs.includes("never")||docs.includes("No account"));
 assert.ok(docs.includes("No tracking, external scripts"));
 assert.ok(docs.includes("https://tools.trendbridged.com/tools/shopify-csv-preflight/"));
 assert.ok(docs.includes("https://tools.trendbridged.com/tools/join-csv-by-key/"));
});

test("new GitHub Pages demo does not alter original standalone offline HTML",()=>{
 const original=offline;
 const current=readFileSync("offline/shopify-csv-preflight.html","utf8");
 assert.equal(original,current);
 assert.ok(original.includes('content="noindex,nofollow"'));
 assert.equal(scripts(original).length,1);
 assert.equal(scripts(docs).length,1);
});
