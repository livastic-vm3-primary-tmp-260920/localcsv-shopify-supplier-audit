import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {execFileSync} from "node:child_process";
import vm from "node:vm";

const root=readFileSync("docs/index.html","utf8");
const audit=readFileSync("docs/supplier-audit/index.html","utf8");
const offline=readFileSync("offline/shopify-supplier-threeway-audit.html","utf8");
const scripts=text=>[...text.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const page="https://livastic-vm3-primary-tmp-260920.github.io/localcsv-shopify-supplier-audit/supplier-audit/";

test("exact deterministic offline source converted into one educational Pages document",()=>{
 const out=execFileSync("python3",["scripts/build_supplier_pages_demo.py","--check"],{encoding:"utf8",timeout:8000});
 assert.match(out,/REPRODUCIBLE_SUPPLIER_PAGES_DEMO_OK/);
 assert.equal(scripts(audit).length,1);
 assert.deepEqual(scripts(audit),scripts(offline));
 new vm.Script(scripts(audit)[0]);
 assert.ok(existsSync("docs/.nojekyll"));
});

test("online education has a distinct discoverable canonical and no paid/third-party ad code",()=>{
 assert.ok(root.includes('href="supplier-audit/"'));
 assert.ok(audit.includes('href="'+page+'"'));
 assert.equal(audit.match(/rel="canonical"/g)?.length,1);
 assert.ok(audit.includes('content="index,follow"'));
 assert.ok(!audit.includes('content="noindex,nofollow"'));
 assert.ok(audit.includes('meta name="description"'));
 assert.ok(audit.includes("Open-source educational example"));
 assert.ok(audit.includes("not a commercial hosting service"));
 assert.ok(audit.includes('connect-src \u0027none\u0027'));
 assert.ok(audit.includes('form-action \u0027none\u0027'));
 assert.ok(audit.includes('default-src \u0027none\u0027'));
 for(const banned of [
   "<script src=", "XMLHttpRequest(", "navigator.sendBeacon",
   "fetch(", "gtag(", "google-analytics",
   "adsterra.com", "bauval.org", "abscloud.org", "araplhn.org",
   "credential", "github_pat_",
 ]) assert.ok(!audit.toLowerCase().includes(banned.toLowerCase()),banned);
});

test("original public homepage remains the EXACT same executable one-CSV inspector",()=>{
 const prior=readFileSync("offline/shopify-csv-preflight.html","utf8");
 assert.deepEqual(scripts(root),scripts(prior));
 const run=execFileSync("python3",["scripts/build_pages_demo.py","--check"],{encoding:"utf8",timeout:8000});
 assert.match(run,/GITHUB_OPEN_SOURCE_DEMO_REPRODUCIBLE/);
 assert.equal(root.match(/<script>/g)?.length,1);
});

test("fictional merchant tutorial teaches reproducible product field review and caution",()=>{
 assert.ok(audit.includes("TEE-BLK-M"));
 assert.ok(audit.includes("29.00 to 31.00"));
 assert.ok(audit.includes("CAP-WOOL"));
 assert.ok(audit.includes("7 to 6"));
 assert.ok(audit.includes("TEE-BLK-L"));
 assert.ok(audit.includes("fictional"));
 assert.ok(audit.includes("한국어"));
 assert.ok(audit.includes("six downloadable review files"));
 assert.ok(audit.includes("supplier-matches-NOT-SHOPIFY-IMPORT.csv"));
 assert.ok(audit.includes("MUST NOT"));
 assert.ok(audit.includes("Shopify import CSV"));
 for(const name of ["shopify-current-products.csv","supplier-price-update.csv","shopify-proposed-products.csv"]){
    assert.ok(audit.includes("fixtures/"+name));
 }
 assert.ok(audit.includes("https://tools.trendbridged.com/tools/join-csv-by-key/"));
 assert.ok(audit.includes("https://tools.trendbridged.com/tools/shopify-csv-preflight/"));
 assert.ok(audit.includes("releases/latest/download/shopify-supplier-threeway-audit.html"));
});

test("web docs page actually exposes working local report controls with no inline remote input",()=>{
 for(const id of ['id="current"','id="supplier"','id="proposed"','id="sku-audit-form"','id="run"','id="reports"']){
   assert.ok(audit.includes(id));
 }
 assert.ok(audit.includes("No data leaves your browser"));
 assert.ok(audit.includes("2.2 MB"));
});
