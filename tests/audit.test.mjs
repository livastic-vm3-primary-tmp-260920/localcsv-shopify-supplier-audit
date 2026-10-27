import test from "node:test";
import assert from "node:assert/strict";
import {readFile, writeFile, mkdir, readdir, stat} from "node:fs/promises";
import {mkdtemp, rm} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {execFileSync, spawnSync} from "node:child_process";

import {parseArgs, makeReports, audit} from "../bin/localcsv-audit.mjs";
import {parseCSV} from "../lib/csv-core.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..");
const CLI = path.join(ROOT, "bin/localcsv-audit.mjs");
const fixture = name => path.join(ROOT, "fixtures", name);
const inputs = {
  current: fixture("shopify-current-products.csv"),
  supplier: fixture("supplier-price-update.csv"),
  proposed: fixture("shopify-proposed-products.csv"),
};

test("help documents all four mandatory options and no account requirement", () => {
  assert.deepEqual(parseArgs([]), {help: true});
  assert.deepEqual(parseArgs(["--help"]), {help: true});
  const help = execFileSync(process.execPath, [CLI, "--help"], {
    cwd: ROOT, encoding: "utf8", timeout: 5000,
  });
  for (const expected of [
    "--current", "--supplier", "--proposed", "--out NEW_DIR",
    "never import", "Shopify", "https://tools.trendbridged.com/tools/join-csv-by-key/",
  ]) assert.ok(help.toLowerCase().includes(expected.toLowerCase()), expected);
});

test("CLI refuses duplicate, omitted, invalid or untrusted flags", () => {
  for (const args of [
    ["--invalid", "something"],
    ["--current", "file"],
    ["--current", "file", "--current", "else"],
    ["--current", "--out"],
    ["--current", "a", "--supplier", "b", "--proposed", "c", "--out", "d", "--other", "e"],
  ]) assert.throws(() => parseArgs(args));
});

test("real LocalCSV core modules produce exactly expected merchant data results", async () => {
  const source = {
    current: await readFile(inputs.current, "utf8"),
    supplier: await readFile(inputs.supplier, "utf8"),
    proposed: await readFile(inputs.proposed, "utf8"),
  };
  const {summary, files} = makeReports(source);
  assert.equal(summary.supplierJoin.matched, 3);
  assert.equal(summary.supplierJoin.unmatched, 0);
  assert.equal(summary.supplierJoin.outputRows, 3);
  assert.equal(summary.changedProductRecords.changed, 2);
  assert.equal(summary.changedProductRecords.unchanged, 1);
  assert.equal(summary.changedProductRecords.changedCells, 2);
  assert.equal(summary.existingShopifyPreflight.errors, 0);
  assert.equal(summary.proposedShopifyPreflight.warnings, 0);
  assert.equal(summary.manualReviewRequired, true,
    "Changed prices or inventory always need review even if preflight has no errors");
  assert.deepEqual(summary.possibleImportRisks.examples, []);
  assert.equal(summary.possibleImportRisks.includedBlankCellChanges, 0);
  assert.equal(summary.possibleImportRisks.variantOptionValueChanges, 0);
  assert.equal(summary.possibleImportRisks.productHandleChanges, 0);
  assert.equal(summary.outputCannotBeImportedDirectlyIntoShopify, true);
  assert.equal(files.size, 7);
  assert.equal(summary.supplierCostMarginReview.inspectedProposedSKU,3);
  assert.equal(summary.supplierCostMarginReview.validComparisons,3);
  assert.equal(summary.supplierCostMarginReview.belowSupplierCost,0);
  assert.equal(summary.supplierCostMarginReview.currencyVerified,false);
  assert.equal(summary.supplierCostMarginReview.trueProfitCalculated,false);
  assert.match(summary.supplierCostMarginReview.limitations,/SAME currency/i);
  const margins = parseCSV(files.get("supplier-margin-REVIEW-ONLY.csv").replace(/^\uFEFF/,""));
  assert.deepEqual(margins.slice(1).map(row=>[row[0],row[4],row[5],row[6]]), [
    ["TEE-BLK-M","19.0000","61.29","MARGIN_REVIEW_ONLY"],
    ["TEE-BLK-L","16.5000","56.90","MARGIN_REVIEW_ONLY"],
    ["CAP-WOOL","9.7500","54.17","MARGIN_REVIEW_ONLY"]
  ]);

  const joined = parseCSV(files.get("supplier-matches-NOT-SHOPIFY-IMPORT.csv").replace(/^\uFEFF/, ""));
  assert.deepEqual(joined.slice(1).map(row => row.at(-2)), ["12.00","12.50","8.25"]);
  assert.equal(joined[0].at(-1), "Supplier");
  const changes = parseCSV(files.get("proposed-changes.csv").replace(/^\uFEFF/, ""));
  assert.deepEqual(changes.slice(1).map(r => [r[1],r[2],r[3],r[4]]), [
    ["TEE-BLK-M","Price","29.00","31.00"],
    ["CAP-WOOL","Inventory quantity","7","6"],
  ]);
});

test("three input files produce seven private local reports without altering inputs", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "localcsv-github-cli-"));
  try {
    const target = path.join(dir, "local-reports");
    const before = await Promise.all(Object.values(inputs).map(p => readFile(p)));
    const run = await audit({...inputs, out: target});
    assert.equal(run.reportsWritten, 7);
    assert.equal(run.supplierMatches, 3);
    assert.equal(run.unmatchedSKUs, 0);
    assert.equal(run.changedRecords, 2);
    assert.equal(run.allWorkLocal, true);
    assert.equal(run.importedToShopify, false);
    assert.equal(run.publisherRevenueUSD, null);
    assert.deepEqual((await readdir(target)).sort(), [
      "preflight-current.csv","preflight-proposed.csv","proposed-changes.csv",
      "summary.json","supplier-margin-REVIEW-ONLY.csv",
      "supplier-matches-NOT-SHOPIFY-IMPORT.csv","unmatched-skus.csv",
    ]);
    for (const name of await readdir(target)) {
      const file = path.join(target, name);
      assert.equal((await stat(file)).mode & 0o077, 0, "leaked private report permissions: "+name);
    }
    const after = await Promise.all(Object.values(inputs).map(p => readFile(p)));
    before.forEach((content,i)=>assert.ok(content.equals(after[i])));
  } finally {
    await rm(dir, {recursive:true,force:true});
  }
});

test("CLI main is executable in a separate process without npm install", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "localcsv-cli-process-"));
  try {
    const out = path.join(temp, "report");
    const result = spawnSync(process.execPath, [CLI,
      "--current", inputs.current,
      "--supplier", inputs.supplier,
      "--proposed", inputs.proposed,
      "--out", out,
    ], {cwd:ROOT,encoding:"utf8",timeout:10000});
    assert.equal(result.status,0,result.stderr);
    assert.equal(JSON.parse(result.stdout).reportsWritten,7);
    assert.match(result.stderr,/AUDIT ONLY/);
  } finally { await rm(temp,{recursive:true,force:true}); }
});

test("duplicate supplier SKU is rejected BEFORE creating an output directory", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "localcsv-duplicates-"));
  try {
    const text=(await readFile(inputs.supplier,"utf8")).trimEnd() +
      "\nTEE-BLK-M,999.99,Conflicting Supplier\n";
    const bad=path.join(temp,"bad-supplier.csv");
    await writeFile(bad,text);
    const output=path.join(temp,"reports");
    await assert.rejects(
      audit({...inputs,supplier:bad,out:output}),
      /duplicate key in rows 2 and 5/
    );
    assert.ok(!(await readdir(temp)).includes("reports"));
  } finally { await rm(temp,{recursive:true,force:true}); }
});

test("empty supplier identifier is explicitly rejected, not matched to customer", async () => {
  const current = await readFile(inputs.current,"utf8");
  const proposed = await readFile(inputs.proposed,"utf8");
  const supplier = "SKU,Cost,Supplier\n,12.00,Missing Key\n";
  assert.throws(()=>makeReports({current,proposed,supplier}),/blank key in row 2/);
});

test("blank Shopify product SKU cannot silently match vendor cost", async () => {
  const current=(await readFile(inputs.current,"utf8")).replace("TEE-BLK-L","");
  const proposed=await readFile(inputs.proposed,"utf8");
  const supplier=await readFile(inputs.supplier,"utf8");
  // Comparison by SKU uses a UNIQUE business key and refuses a blank;
  // the CLI must fail rather than claim the ambiguous item is updated.
  assert.throws(()=>makeReports({current,proposed,supplier}),/blank (?:CSV )?key|blank key|Missing|duplicate/i);
});

test("existing report directory is never overwritten, even when nonempty", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "localcsv-no-overwrite-"));
  try {
    const report=path.join(temp,"already-there");
    await mkdir(report);
    const receipt=path.join(report,"summary.json");
    await writeFile(receipt,"Keep all prior user data.");
    await assert.rejects(audit({...inputs,out:report}),/EEXIST/);
    assert.equal(await readFile(receipt,"utf8"),"Keep all prior user data.");
  } finally { await rm(temp,{recursive:true,force:true}); }
});

test("missing input aborts without writing partial reports", async () => {
  const temp=await mkdtemp(path.join(os.tmpdir(),"localcsv-missing-"));
  try {
    const folder=path.join(temp,"empty-reports");
    await assert.rejects(audit({...inputs,proposed:path.join(temp,"not-found.csv"),out:folder}));
    assert.ok(!(await readdir(temp)).includes("empty-reports"));
  } finally { await rm(temp,{recursive:true,force:true}); }
});

test("formula-looking supplier CSV text is written with apostrophe spreadsheet protection", async () => {
  const current=await readFile(inputs.current,"utf8");
  const proposed=await readFile(inputs.proposed,"utf8");
  const supplier=(await readFile(inputs.supplier,"utf8"))
    .replace("Fictional Mill", '=HYPERLINK("https://invalid.example","click")');
  // Quoted text requires valid CSV escaping, or parsing MUST reject it.
  assert.throws(()=>makeReports({current,proposed,supplier}));
  const goodSupplier=(await readFile(inputs.supplier,"utf8"))
    .replace("Fictional Mill", '=@SUM(1;2)');
  const {files}=makeReports({current,proposed,supplier:goodSupplier});
  const joined=parseCSV(files.get("supplier-matches-NOT-SHOPIFY-IMPORT.csv").replace(/^\uFEFF/,""));
  assert.equal(joined[3].at(-1),"'=@SUM(1;2)");
});

test("no hidden credentials or network/advertising SDKs are bundled in public repo", async () => {
  for (const name of [
    "csv-core.mjs","csv-diff-core.mjs",
    "csv-lookup-core.mjs","shopify-preflight-core.mjs",
  ]) {
    const js=await readFile(path.join(ROOT,"lib",name),"utf8");
    for (const forbidden of [
      "fetch(", "XMLHttpRequest", "navigator.sendBeacon", "localStorage",
      "document.write(", "window.open(", "process.env.",
      "node:http", "node:https",
    ]) assert.ok(!js.includes(forbidden),name+" contains "+forbidden);
  }
  const files=await readdir(ROOT);
  assert.ok(!files.includes(".secrets"));
  assert.ok(!files.includes("seo"));
  assert.ok(!files.includes("config"));
  assert.ok(!files.includes("growth"));
  const cli=await readFile(CLI,"utf8");
  assert.ok(!cli.includes("https.request("));
  assert.ok(!cli.includes("window.open("));
});

test("supplier costs higher than Shopify proposed prices are visibly flagged, not claimed to be profit",async()=>{
 const current=await readFile(inputs.current,"utf8");
 const proposed=await readFile(inputs.proposed,"utf8");
 const supplier=(await readFile(inputs.supplier,"utf8")).replace("TEE-BLK-M,12.00","TEE-BLK-M,45.00");
 const {summary,files}=makeReports({current,proposed,supplier});
 assert.equal(summary.supplierCostMarginReview.validComparisons,3);
 assert.equal(summary.supplierCostMarginReview.belowSupplierCost,1);
 assert.equal(summary.manualReviewRequired,true);
 const rows=parseCSV(files.get("supplier-margin-REVIEW-ONLY.csv").replace(/^\uFEFF/,""));
 assert.equal(rows[1][4],"\x27-14.0000");
 assert.equal(rows[1][5],"\x27-45.16");
 assert.equal(rows[1][6],"BELOW_SUPPLIER_COST");
});

test("invalid vendor prices or missing supplier keys produce review-only row statuses instead of invented numbers",async()=>{
 const current=await readFile(inputs.current,"utf8");
 const proposed=await readFile(inputs.proposed,"utf8");
 const supplier=(await readFile(inputs.supplier,"utf8"))
   .replace("12.00,Fictional Textile Supply","not-a-number,Fictional Textile Supply")
   .replace(/\nCAP-WOOL,8\.25,Fictional Mill\n?/,"\n");
 const {summary,files}=makeReports({current,proposed,supplier});
 assert.equal(summary.supplierCostMarginReview.validComparisons,1);
 assert.equal(summary.supplierCostMarginReview.invalidCost,1);
 assert.equal(summary.supplierCostMarginReview.missingSupplier,1);
 const rows=parseCSV(files.get("supplier-margin-REVIEW-ONLY.csv").replace(/^\uFEFF/,""));
 assert.equal(rows[1][6],"INVALID_OR_MISSING_COST");
 assert.equal(rows[1][4],"");
 assert.equal(rows[3][6],"SUPPLIER_SKU_UNMATCHED");
 assert.equal(rows[3][5],"");
 assert.equal(summary.manualReviewRequired,true);
});

test("missing supplier cost column fails closed on pricing arithmetic without losing other diagnostics",async()=>{
 const current=await readFile(inputs.current,"utf8");
 const proposed=await readFile(inputs.proposed,"utf8");
 const supplier=(await readFile(inputs.supplier,"utf8")).replace("SKU,Cost,Supplier","SKU,Internal Note,Supplier");
 const {summary,files}=makeReports({current,proposed,supplier});
 const r=summary.supplierCostMarginReview;
 assert.equal(r.validComparisons,0);
 assert.equal(r.unavailableCost,3);
 assert.equal(r.costColumn,null);
 assert.equal(files.size,7);
});

test("financial CSV report protects supplier cost formulas from spreadsheet execution",async()=>{
 const current=await readFile(inputs.current,"utf8");
 const proposed=await readFile(inputs.proposed,"utf8");
 const supplier=(await readFile(inputs.supplier,"utf8")).replace("12.00,Fictional Textile Supply","=1+1,Fictional Textile Supply");
 const {files,summary}=makeReports({current,proposed,supplier});
 assert.equal(summary.supplierCostMarginReview.invalidCost,1);
 const rows=parseCSV(files.get("supplier-margin-REVIEW-ONLY.csv").replace(/^\uFEFF/,""));
 assert.equal(rows[1][1],"'=1+1");
 assert.equal(rows[1][6],"INVALID_OR_MISSING_COST");
});

test("legacy Shopify Variant Price and supplier Cost per item headers are recognized without guessing currencies",async()=>{
 const current=(await readFile(inputs.current,"utf8")).replace(
   "Price,Inventory tracker","Variant Price,Inventory tracker");
 const proposed=(await readFile(inputs.proposed,"utf8")).replace(
   "Price,Inventory tracker","Variant Price,Inventory tracker");
 const supplier=(await readFile(inputs.supplier,"utf8")).replace(
   "SKU,Cost,Supplier","SKU,Cost per item,Supplier");
 const {summary,files}=makeReports({current,supplier,proposed});
 const cost=summary.supplierCostMarginReview;
 assert.equal(cost.costColumn,"Cost per item");
 assert.equal(cost.priceColumn,"Variant Price");
 assert.equal(cost.validComparisons,3);
 assert.equal(cost.belowSupplierCost,0);
 assert.equal(cost.currencyVerified,false);
 const rows=parseCSV(files.get("supplier-margin-REVIEW-ONLY.csv").replace(/^\uFEFF/,""));
 assert.equal(rows[1][5],"61.29");
});

test("zero, negative and symbol-denominated prices never produce false profit arithmetic",async()=>{
 const current=await readFile(inputs.current,"utf8");
 const proposed=(await readFile(inputs.proposed,"utf8"))
   .replace("31.00,shopify,8","0.00,shopify,8")
   .replace("29.00,shopify,4","$29.00,shopify,4")
   .replace("18.00,shopify,6","-18.00,shopify,6");
 const supplier=await readFile(inputs.supplier,"utf8");
 const {summary,files}=makeReports({current,supplier,proposed});
 const cost=summary.supplierCostMarginReview;
 assert.equal(cost.validComparisons,0);
 assert.equal(cost.invalidProposedPrice,3);
 assert.equal(cost.trueProfitCalculated,false);
 const rows=parseCSV(files.get("supplier-margin-REVIEW-ONLY.csv").replace(/^\uFEFF/,""));
 for(const row of rows.slice(1)){
   assert.equal(row[4],"");
   assert.equal(row[5],"");
   assert.equal(row[6],"INVALID_OR_ZERO_PROPOSED_PRICE");
 }
});

test("multiple candidate supplier cost columns produce explicit ambiguity instead of arbitrary selection",async()=>{
 const current=await readFile(inputs.current,"utf8");
 const proposed=await readFile(inputs.proposed,"utf8");
 const supplier=(await readFile(inputs.supplier,"utf8"))
   .replace("SKU,Cost,Supplier","SKU,Cost,Unit cost,Supplier")
   .replace("12.00,Fictional","12.00,13.00,Fictional")
   .replace("12.50,Fictional","12.50,13.50,Fictional")
   .replace("8.25,Fictional","8.25,9.25,Fictional");
 const {summary,files}=makeReports({current,supplier,proposed});
 assert.equal(summary.supplierCostMarginReview.validComparisons,0);
 assert.equal(summary.supplierCostMarginReview.unavailableCost,3);
 const rows=parseCSV(files.get("supplier-margin-REVIEW-ONLY.csv").replace(/^\uFEFF/,""));
 assert.ok(rows.slice(1).every(r=>r[6]==="AMBIGUOUS_COST_COLUMNS"));
});
