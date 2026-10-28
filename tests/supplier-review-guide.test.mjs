import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {parseCSV} from "../lib/csv-core.mjs";

const guide=readFileSync("docs/supplier-csv-review/index.html","utf8");
const blank=readFileSync("docs/supplier-csv-review/reviewer-template.csv","utf8");
const example=readFileSync("docs/supplier-csv-review/fictional-review-example.csv","utf8");
const sampleCurrent=readFileSync("docs/supplier-csv-review/fictional-current-product.csv","utf8");
const sampleRisk=readFileSync("docs/supplier-csv-review/fictional-risky-blank-vendor.csv","utf8");
const sampleOmitted=readFileSync("docs/supplier-csv-review/fictional-omitted-vendor-review-only.csv","utf8");
const base="https://livastic-vm3-primary-tmp-260920.github.io/localcsv-shopify-supplier-audit/";
const official="https://help.shopify.com/en/manual/products/import-export/using-csv";

test("educational 7-step guide and two private review templates are deterministic",()=>{
 const out=execFileSync("python3",["scripts/build_supplier_review_guide.py","--check"],{
  encoding:"utf8",timeout:5000
 });
 assert.match(out,/VERIFIED docs\/supplier-csv-review\/index.html/);
 assert.match(out,/VERIFIED docs\/supplier-csv-review\/reviewer-template.csv/);
 assert.match(out,/VERIFIED docs\/supplier-csv-review\/fictional-review-example.csv/);
 assert.match(out,/VERIFIED docs\/supplier-csv-review\/fictional-current-product.csv/);
 assert.match(out,/VERIFIED docs\/supplier-csv-review\/fictional-risky-blank-vendor.csv/);
 assert.match(out,/VERIFIED docs\/supplier-csv-review\/fictional-omitted-vendor-review-only.csv/);
 assert.ok(guide.length>14000,"Needs substantive help not a thin keyword landing page");
 assert.equal(guide.match(/<h1>/g)?.length,1);
 assert.equal(guide.match(/<li>/g)?.length>=7,true);
 assert.equal(guide.match(/type="checkbox"/g)?.length,10);
 assert.ok(guide.includes("<html lang=\"en\">"));
 assert.ok(guide.includes('lang="ko"'));
});

test("SEO allows only real project guide canonical, no auto redirects, trackers, ads, file upload or forms",()=>{
 assert.ok(guide.includes('href="'+base+'supplier-csv-review/"'));
 assert.equal(guide.match(/rel="canonical"/g)?.length,1);
 assert.ok(guide.includes('content="index,follow"'));
 assert.ok(!guide.includes('content="noindex,nofollow"'));
 assert.ok(guide.includes("Shopify Supplier CSV Pre-Import Checklist"));
 assert.ok(guide.includes("script-src 'none'"));
 assert.ok(guide.includes("connect-src 'none'"));
 assert.ok(guide.includes("form-action 'none'"));
 for(const bad of ["<script", "window.location", "document.cookie","localStorage",
   "sessionStorage","fetch(", "XMLHttpRequest",
   "navigator.sendBeacon","<iframe","<form",
   "adsterra.com","bauval.org","abscloud.org",
   "araplhn.org","stripe.com","paypal.com"]){
   assert.ok(!guide.toLowerCase().includes(bad.toLowerCase()),bad);
 }
 assert.ok(guide.includes('name="referrer" content="no-referrer"'));
 assert.ok(guide.includes('href="../supplier-audit/"'));
 assert.ok(guide.includes('href="reviewer-template.csv"'));
 assert.ok(guide.includes('href="fictional-review-example.csv"'));
});

test("guide links to official Shopify importer facts and does not overpromise SKU-only import",()=>{
 assert.ok(guide.includes('href="'+official+'"'));
 assert.ok(guide.includes('href="https://help.shopify.com/en/manual/products/import-export/import-products"'));
 assert.ok(guide.includes('href="https://help.shopify.com/ko/manual/products/import-export/using-csv"'));
 for(const requirement of [
  "Blank or duplicate SKU","Nonrequired included column becomes blank",
  "Product handle or variant option changes",
  "not a profit calculation","NOT","Never import any supplier-joined",
  "price minus cost","no proposed file",
  "The tool never uploads your files", "performing any actual update",
  "SKU-only audit does not establish","Shopify product handle",
  "source filename","reviewer decision",
  "Vendor Ref","Net Unit Price",
  "한국어: 공급업체 CSV"
 ])assert.ok(guide.toLowerCase().includes(requirement.toLowerCase()),requirement);
});

test("template is empty and has exact 14 inspectable fields, not any personal/merchant data",()=>{
 const rows=parseCSV(blank);
 assert.equal(rows.length,1);
 assert.equal(rows[0].length,14);
 assert.deepEqual(rows[0],[
  "check_type","supplier_file","supplier_csv_row","shopify_file","shopify_csv_row",
  "supplier_sku_header","shopify_sku_header","raw_supplier_sku","raw_shopify_sku",
  "supplier_cost_header","supplier_cost_raw","shopify_price_raw",
  "review_decision","reviewer_notes"
 ]);
 assert.ok(!blank.includes("@"));
 assert.ok(!blank.includes("http:"));
});

test("two example decisions reproduce truly fictional source row numbers and do not leak credentials",()=>{
 const rows=parseCSV(example);
 assert.equal(rows.length,3);
 assert.deepEqual(rows[0],parseCSV(blank)[0]);
 assert.equal(rows[1][0],"SKU_MATCH");
 assert.equal(rows[1][2],"2");
 assert.equal(rows[1][4],"2");
 assert.equal(rows[1][7],"TEE-BLK-M");
 assert.equal(rows[1][8],"TEE-BLK-M");
 assert.equal(rows[1][10],"12.00");
 assert.equal(rows[1][11],"29.00");
 assert.equal(rows[2][0],"PRICE_COST_REVIEW");
 assert.equal(rows[2][2],"4");
 assert.equal(rows[2][4],"4");
 assert.equal(rows[2][7],"CAP-WOOL");
 assert.equal(rows[2][8],"CAP-WOOL");
 assert.equal(rows[2][10],"8.25");
 assert.equal(rows[2][11],"18.00");
 assert.equal(rows[2][12],"NEEDS_REVIEW");
 const fixture=readFileSync("fixtures/supplier-custom-headers.csv","utf8");
 const original=parseCSV(fixture);
 assert.equal(original[0][0],"Vendor Ref");
 assert.equal(original[1][0],rows[1][7]);
 assert.equal(original[3][0],rows[2][7]);
 for(const bad of ["github_pat_", "password=", "@gmail.com", "=SUM(", "+cmd", "Adsterra"]){
   assert.ok(!example.includes(bad),bad);
 }
});

test("guide is linked from both educational pages, never injected into 90-file Netlify ad-supported site",()=>{
 const home=readFileSync("docs/index.html","utf8");
 const demo=readFileSync("docs/supplier-audit/index.html","utf8");
 assert.ok(home.includes('href="supplier-csv-review/"'));
 assert.ok(demo.includes('href="../supplier-csv-review/"'));
 assert.ok(guide.includes('href="../supplier-audit/"'));
 const main=readFileSync("README.md","utf8");
 assert.ok(main.includes(base+"supplier-csv-review/"));
 assert.ok(!readFileSync("offline/shopify-supplier-threeway-audit.html","utf8").includes("supplier-csv-review/"),
  "Keep offline executable bundle byte-for-byte unchanged");
});

test("3 fictional download CSVs concretely demonstrate included-blank vs omitted Vendor without claiming import safety",()=>{
 const current=parseCSV(sampleCurrent);
 const risk=parseCSV(sampleRisk);
 const omitted=parseCSV(sampleOmitted);
 const vendorCurrent=current[0].indexOf("Vendor");
 const vendorRisk=risk[0].indexOf("Vendor");
 assert.equal(vendorCurrent,2);
 assert.equal(vendorRisk,2);
 assert.equal(omitted[0].indexOf("Vendor"),-1);
 assert.equal(current.length,3);
 assert.equal(risk.length,3);
 assert.equal(omitted.length,3);
 assert.deepEqual(current[0],risk[0],"Risk file includes the same complete header with a blank value");
 assert.deepEqual(omitted[0],current[0].filter(x=>x!=="Vendor"));
 assert.equal(current[1][vendorCurrent],"Fictional Studio");
 assert.equal(risk[1][vendorRisk],"","Risk must be a truly blank product Vendor cell");
 assert.deepEqual(omitted[1],risk[1].filter((_,idx)=>idx!==vendorRisk));
 assert.equal(current[1][current[0].indexOf("Price")],"29.00");
 assert.equal(risk[1][risk[0].indexOf("Price")],"31.00");
 assert.equal(omitted[1][omitted[0].indexOf("Price")],"31.00");
 for(const source of [current,risk,omitted]){
   for(const row of source.slice(1)){
     assert.equal(row[0],"fictional-cotton-tee","Cannot invent different Shopify handles");
     assert.equal(row.length,source[0].length);
     assert.ok(row.includes("Size"),"Retain the illustrative variant option-name field");
     for(const cell of row){
       assert.ok(!/^[=+@]/u.test(cell),"Never export CSV formulas");
       assert.ok(!/https?:\/\//iu.test(cell),"No merchant identifiers or outgoing links");
     }
   }
   assert.equal(source[1][source[0].indexOf("SKU")],"FIC-TEE-M");
   assert.equal(source[2][source[0].indexOf("SKU")],"FIC-TEE-L");
 }
 for(const text of [
   "Shopify CSV blank cells overwrite existing values",
   'id="blank-vendor-example"',
   'href="fictional-current-product.csv"',
   'href="fictional-risky-blank-vendor.csv"',
   'href="fictional-omitted-vendor-review-only.csv"',
   "Do NOT import these downloadable demonstration files",
   "NOT a guarantee the whole import preserves variants",
   "same as an absent",
   "공식 한국어 안내",
   "Vendor",
   "Option1 name"
 ])assert.ok(guide.includes(text),text);
 assert.ok(guide.includes('https://help.shopify.com/en/manual/products/import-export/import-products'));
 assert.ok(guide.includes('https://help.shopify.com/ko/manual/products/import-export/import-products'));
 assert.ok(!guide.includes('<script'));
});
