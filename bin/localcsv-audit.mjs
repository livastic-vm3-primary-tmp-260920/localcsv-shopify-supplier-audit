#!/usr/bin/env node
/**
 * LocalCSV Lab — free, offline Shopify + supplier CSV comparison.
 *
 * Never performs a Shopify import, uses account credentials, loads ads,
 * sends HTTP requests, or modifies input files. The joined audit output
 * contains supplier-only fields and must NOT be imported into Shopify.
 */
import process from "node:process";
import path from "node:path";
import {readFile, mkdir, writeFile, rm} from "node:fs/promises";
import {fileURLToPath} from "node:url";

import {joinCSVByKey, readJoinCSV} from "../lib/csv-lookup-core.mjs";
import {stringifyCSV,parseCSV,detectDelimiter,MAX_INPUT_CHARS} from "../lib/csv-core.mjs";
import {compareCSVExports, readCSVForComparison} from "../lib/csv-diff-core.mjs";
import {inspectShopifyProductCSV} from "../lib/shopify-preflight-core.mjs";

const HELP = [
  "LocalCSV Lab — offline Shopify CSV supplier audit (free / no account)",
  "",
  "Usage:",
  "  node bin/localcsv-audit.mjs \\",
  "    --current fixtures/shopify-current-products.csv \\",
  "    --supplier fixtures/supplier-price-update.csv \\",
  "    --proposed fixtures/shopify-proposed-products.csv \\",
  "    --out ./reports-example",
  "",
  "TWO-FILE option (no proposed Shopify export yet):",
  "  node bin/localcsv-audit.mjs --current shopify.csv",
  "    --supplier supplier.csv --out ./cost-review",
  "",
  "Required options:",
  "  --current FILE    Current full Shopify product CSV export",
  "  --supplier FILE   Supplier CSV, with one unique nonblank SKU per item",
  "  --out NEW_DIR     NEW report directory; existing paths refused",
  "Optional:",
  "  --proposed FILE   Proposed Shopify update CSV; enables before/after diff",
  "  --supplier-sku-column NAME  Explicit vendor SKU header (requires cost header)",
  "  --supplier-cost-column NAME Explicit vendor unit cost header (requires SKU header)",
  "  " ,
  "Manual column mapping NEVER guesses column labels or SKU/size equivalence.",
  "Use exact header names from supplier CSV: example Item Code and Wholesale.",
  "",
  "Outputs: 7 local reports when proposed exists, 5 when absent.",
  "Review-only outputs include: summary.json, supplier-matches-NOT-SHOPIFY-",
  "IMPORT.csv, unmatched-skus.csv, proposed-changes.csv,",
  "supplier-margin-REVIEW-ONLY.csv, preflight-current.csv,",
  "and preflight-proposed.csv",
  "",
  "Runs without dependencies, network, Shopify login, analytics or ads.",
  "Never import joined supplier audit directly into Shopify.",
  "Not Shopify import validation. Back up original CSVs; test a small",
  "subset of products before any real store change.",
  "",
  "Related free no-upload web tools:",
  "  https://tools.trendbridged.com/tools/join-csv-by-key/",
  "  https://tools.trendbridged.com/tools/compare-csv-files/",
  "  https://tools.trendbridged.com/tools/shopify-csv-preflight/",
  "",
].join("\n");

export function parseArgs(argv) {
  if (argv.length === 0 || (argv.length === 1 && ["--help", "-h"].includes(argv[0]))) {
    return {help: true};
  }
  const values = {};
  const allowed = new Set([
    "--current","--supplier","--proposed","--out",
    "--supplier-sku-column","--supplier-cost-column"
  ]);
  if (argv.length % 2 !== 0) throw new Error("Options require path values. Use --help.");
  for (let index = 0; index < argv.length; index += 2) {
    const option = argv[index];
    if (!allowed.has(option)) throw new Error("Unknown option: " + String(option));
    if (option in values) throw new Error("Repeated option: " + option);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error("Missing path for " + option);
    if (value.includes("\0")) throw new Error("NUL in file path.");
    values[option] = value;
  }
  for (const key of ["--current", "--supplier", "--out"]) {
    if (!(key in values)) throw new Error("Missing required " + key + ". Use --help.");
  }
  return {
    current: values["--current"],
    supplier: values["--supplier"],
    proposed: values["--proposed"],
    out: values["--out"],
    ...(values["--supplier-sku-column"]?{supplierSkuColumn:values["--supplier-sku-column"]}:{}),
    ...(values["--supplier-cost-column"]?{supplierCostColumn:values["--supplier-cost-column"]}:{}),
  };
}

/** Build a TEMPORARY normalized CSV only after explicit vendor-header choice.
 *
 * Never guess a supplier's SKU, size, currency, or price meaning.
 * Never write changes back to the vendor source. Every other column and
 * original raw cell is preserved in place; blank lines are retained.
 * This is NOT creating a Shopify import CSV or resolving ambiguous SKUs.
 */
export function normalizeSupplierColumns(supplierText,{
  supplierSkuColumn,supplierCostColumn
}={}){
  const selectedSKU=(typeof supplierSkuColumn==="string"?supplierSkuColumn.trim():"");
  const selectedCost=(typeof supplierCostColumn==="string"?supplierCostColumn.trim():"");
  if(!selectedSKU&&!selectedCost){
    if(supplierSkuColumn!==undefined||supplierCostColumn!==undefined){
      throw new Error("Supplier mapping requires BOTH source SKU and Cost headers.");
    }
    return {csv:supplierText,mapping:null};
  }
  if(!selectedSKU||!selectedCost){
    throw new Error("Supplier mapping requires BOTH source SKU and Cost headers.");
  }
  if(selectedSKU===selectedCost){
    throw new Error("Supplier SKU and unit cost must be DIFFERENT source columns.");
  }
  const dataset=readJoinCSV(supplierText,"Original supplier CSV");
  if(!dataset.headers.includes(selectedSKU)){
    throw new Error("Supplier CSV missing explicitly chosen SKU header: "+selectedSKU);
  }
  if(!dataset.headers.includes(selectedCost)){
    throw new Error("Supplier CSV missing explicitly chosen Cost header: "+selectedCost);
  }
  const newHeaders=dataset.headers.map(field=>
    field===selectedSKU?"SKU":field===selectedCost?"Cost":field
  );
  const caseInsensitive=newHeaders.map(field=>field.toLocaleLowerCase("en"));
  if(new Set(caseInsensitive).size!==caseInsensitive.length){
    throw new Error("Chosen header mapping collides with an EXISTING SKU/Cost column. Fix the ambiguous vendor CSV before review.");
  }
  const table=parseCSV(supplierText,detectDelimiter(supplierText));
  if(!table.length||table[0].length!==newHeaders.length){
    throw new Error("Supplier CSV structure changed during local mapping.");
  }
  // Only replace the header row, never variant values, SKU identifiers or costs.
  const transformed=stringifyCSV([newHeaders,...table.slice(1)],",",false);
  if(transformed.length>MAX_INPUT_CHARS){
    throw new Error("Mapped supplier CSV exceeds the two-million-character limit.");
  }
  return {
    csv:transformed,
    mapping:{
      userSelected:true,
      sourceSkuColumn:selectedSKU,
      sourceCostColumn:selectedCost,
      normalizedSkuColumn:"SKU",
      normalizedCostColumn:"Cost",
      originalOtherColumnsPreserved:true,
      originalSupplierFileModified:false,
      originalDataRows:dataset.records.length,
      limitation:"Exact header renaming ONLY: does not guess SKU, size, colour, currency, discounts, products, or authorize Shopify imports."
    }
  };
}

export function makeReports({current, supplier, proposed,
  supplierSkuColumn,supplierCostColumn
}) {
  // OMITTING proposed is an explicit two-file supplier-cost review.
  // Never pretend that any product changes have been checked.
  const proposedSupplied = typeof proposed === "string";
  if (proposed !== undefined && !proposedSupplied) {
    throw new Error("Proposed file must be CSV text or omitted entirely.");
  }
  // All input validation takes place BEFORE touching the output filesystem.
  // Ambiguous supplier duplicates and CSV comparison keys cause an error.
  const mapped=normalizeSupplierColumns(supplier,{
    supplierSkuColumn,supplierCostColumn
  });
  const vendorCSV=mapped.csv;
  const before = inspectShopifyProductCSV(current, {mode: "update"});
  const after = proposedSupplied ?
    inspectShopifyProductCSV(proposed, {mode: "update"}) : null;
  const joined = joinCSVByKey(current, vendorCSV, {
    primaryKey: "SKU", lookupKey: "SKU", mode: "left", caseSensitive: true,
  });
  const diff = proposedSupplied ?
    compareCSVExports(current, proposed, {
      key: "SKU", caseSensitive: true,
    }) : null;

  // These are advisory RISK signals, not Shopify importer predictions.
  // Evaluate matched SKU rows only, and only columns actually INCLUDED
  // in BOTH exports. Omitting a column is not equivalent to blanking it.
  const oldData = readCSVForComparison(current, "Current Shopify export");
  // The 3-file diff already refuses ambiguous business keys; its absence in
  // 2-file mode MUST NOT make empty/reused current-product SKUs acceptable.
  if(!proposedSupplied){
    const seenSKU=new Set();
    for(const row of oldData.records){
      const sku=String(row.fields.SKU??"").trim();
      if(!sku)throw new Error("Current Shopify CSV: empty SKU key in row "+row.rowNumber);
      if(seenSKU.has(sku)){
        throw new Error("Current Shopify CSV: duplicate SKU key in row "+row.rowNumber+
          ". Fix conflicting variants before supplier cost review.");
      }
      seenSKU.add(sku);
    }
  }
  const newData = proposedSupplied ?
    readCSVForComparison(proposed, "Proposed Shopify export") : oldData;
  const oldBySKU = new Map(oldData.records.map(row => [
    String(row.fields.SKU).trim(), row.fields
  ]));
  const sharedFields = proposedSupplied ?
    newData.headers.filter(field =>
      field !== "SKU" && oldData.headers.includes(field)) : [];
  const importRisk = {
    includedBlankCellChanges: 0,
    variantOptionValueChanges: 0,
    productHandleChanges: 0,
    examples: [],
    note: "Advisory only: Shopify may overwrite included blank cells, treat changed option values as new variants, or identify products by URL handle. SKU is only the comparison key. Check official import rules."
  };
  for (const row of newData.records) {
    const key = String(row.fields.SKU).trim();
    const older = oldBySKU.get(key);
    if (!older) continue;
    for (const field of sharedFields) {
      const from = String(older[field] ?? "");
      const to = String(row.fields[field] ?? "");
      if (from === to) continue;
      // A blanked variant option or handle can have MORE THAN ONE risk.
      // Report overlapping concerns rather than losing one via else-if.
      const detected = [];
      if (from.trim() && !to.trim()) {
        detected.push("POSSIBLE_BLANK_OVERWRITE");
        importRisk.includedBlankCellChanges++;
      }
      if (/^Option[123] value$/i.test(field)) {
        detected.push("VARIANT_OPTION_VALUE_CHANGE");
        importRisk.variantOptionValueChanges++;
      }
      if (/^(URL handle|Handle)$/i.test(field)) {
        detected.push("PRODUCT_HANDLE_CHANGE");
        importRisk.productHandleChanges++;
      }
      for (const type of detected) {
        if (importRisk.examples.length < 12) {
          importRisk.examples.push({type, sku:key, field});
        }
      }
    }
  }
  // Supplier-cost price margin REVIEW. This arithmetic does NOT predict
  // profit: discounts, tax, card fees, fulfillment, ad costs and currency
  // conversion are unknown. NEVER assume vendor CSV uses store currency.
  // Read valid input tables only; the join and diff above already validate
  // unique supplier SKU and unique proposed/current Shopify SKU keys.
  const vendorData=readJoinCSV(vendorCSV,"Supplier cost CSV");
  const costNames=vendorData.headers.filter(name =>
    ["cost","cost per item","unit cost","wholesale cost"].includes(name.toLowerCase()));
  const priceNames=newData.headers.filter(name =>
    ["Price","Variant Price"].includes(name));
  const oldPriceNames=oldData.headers.filter(name =>
    ["Price","Variant Price"].includes(name));
  // Explicit reviewer choice overrides ambiguous vendor cost aliases.
  const costField=mapped.mapping?"Cost":
    costNames.length===1?costNames[0]:null;
  const priceField=priceNames.length===1?priceNames[0]:null;
  const priorPriceField=oldPriceNames.length===1?oldPriceNames[0]:null;
  const vendorSkuIndex=vendorData.headers.indexOf("SKU");
  const vendorBySKU=new Map(vendorData.records.map(row => [
    String(row.values[vendorSkuIndex]??"").trim(),
    Object.fromEntries(vendorData.headers.map((field,index)=>[field,row.values[index]]))
  ]));
  // Integer 1/10000 currency units prevent unsafe binary float parsing,
  // approximate lookups and mistaken currency-symbol conversion.
  function moneyUnits(raw) {
    const value=String(raw??"").trim();
    if(!/^(?:0|[1-9][0-9]{0,8})(?:[.][0-9]{1,4})?$/.test(value))return null;
    const parts=value.split(".");
    const units=Number(parts[0])*10000+
      Number((parts[1]??"").padEnd(4,"0"));
    return Number.isSafeInteger(units)?units:null;
  }
  const margin={
    inspectedProposedSKU:proposedSupplied?newData.records.length:null,
    inspectedCurrentSKU:oldData.records.length,
    priceSource:proposedSupplied?"PROPOSED_CSV":"CURRENT_CSV_NO_PROPOSAL",
    proposedExportSupplied:proposedSupplied,
    validComparisons:0, belowSupplierCost:0,
    missingSupplier:0, unavailableCost:0, invalidCost:0,
    unavailableProposedPrice:0, invalidProposedPrice:0,
    currencyVerified:false, trueProfitCalculated:false,
    costColumn:costField, priceColumn:priceField,
    limitations:"Arithmetic only. Confirm supplier cost and product price are in the SAME currency. It excludes taxes, refunds, discounts, shipping, card fees, labor and advertising. This is NOT actual or projected profit.",
    firstEightRows:[]
  };
  const marginReport=[[
    "SKU","supplier_cost",
    proposedSupplied?"current_shopify_price":"baseline_current_price",
    proposedSupplied?"proposed_shopify_price":"current_shopify_price_under_review",
    "price_minus_supplier_cost_before_fees","price_cost_margin_percent",
    "review_status"
  ]];
  for(const row of newData.records){
    const sku=String(row.fields.SKU).trim();
    const vendor=vendorBySKU.get(sku);
    const older=oldBySKU.get(sku);
    const oldPrice=priorPriceField&&older?String(older[priorPriceField]??""):"";
    const costRaw=vendor&&costField?String(vendor[costField]??""):"";
    const proposedRaw=priceField?String(row.fields[priceField]??""):"";
    let status="MARGIN_REVIEW_ONLY";
    let marginText="";
    let differenceText="";
    if(!vendor){status="SUPPLIER_SKU_UNMATCHED";margin.missingSupplier++;}
    else if(!costField){
      status=costNames.length?"AMBIGUOUS_COST_COLUMNS":"COST_COLUMN_NOT_FOUND";
      margin.unavailableCost++;
    }else if(!priceField){
      status=priceNames.length?"AMBIGUOUS_PRICE_COLUMNS":"PROPOSED_PRICE_COLUMN_NOT_FOUND";
      margin.unavailableProposedPrice++;
    }else{
      const cost=moneyUnits(costRaw);
      const price=moneyUnits(proposedRaw);
      if(cost===null){status="INVALID_OR_MISSING_COST";margin.invalidCost++;}
      else if(price===null||price===0){
        status="INVALID_OR_ZERO_PROPOSED_PRICE";margin.invalidProposedPrice++;
      }else{
        const delta=price-cost;
        differenceText=(delta/10000).toFixed(4);
        marginText=(delta*100/price).toFixed(2);
        margin.validComparisons++;
        if(delta<0){status="BELOW_SUPPLIER_COST";margin.belowSupplierCost++;}
      }
    }
    const review=[sku,costRaw,oldPrice,proposedRaw,differenceText,marginText,status];
    marginReport.push(review);
    if(margin.firstEightRows.length<8)margin.firstEightRows.push(review);
  }
  const manualReviewRequired = Boolean(
    !proposedSupplied ||
    before.metrics.errors || (after && after.metrics.errors) ||
    before.metrics.warnings || (after && after.metrics.warnings) ||
    joined.metrics.unmatched || joined.metrics.blankPrimaryKeys ||
    joined.metrics.duplicatesInPrimary ||
    (diff && (diff.metrics.added || diff.metrics.removed ||
      diff.metrics.changed)) || margin.belowSupplierCost ||
    margin.missingSupplier || margin.invalidCost || margin.invalidProposedPrice ||
    margin.unavailableCost || margin.unavailableProposedPrice
  );
  const summary = {
    tool: "LocalCSV Lab — offline supplier SKU audit",
    type: "LOCAL_REPORT_NOT_SHOPIFY_IMPORT",
    shopifyAccountAccessed: false,
    dataUploaded: false,
    advertisingLoaded: false,
    comparisonMode:proposedSupplied?"THREE_CSV_WITH_PROPOSED":"TWO_CSV_SUPPLIER_COST_ONLY",
    proposedFileSupplied:proposedSupplied,
    productChangeComparisonPerformed:proposedSupplied,
    supplierJoin: joined.metrics,
    explicitlyConfirmedSupplierColumnMapping:mapped.mapping,
    changedProductRecords: proposedSupplied?diff.metrics:null,
    possibleImportRisks: proposedSupplied?importRisk:null,
    supplierCostMarginReview: margin,
    existingShopifyPreflight: before.metrics,
    proposedShopifyPreflight: after?after.metrics:null,
    manualReviewRequired,
    outputCannotBeImportedDirectlyIntoShopify: true,
    important: [
      "This is not official Shopify validation or a guaranteed safe import.",
      "Shopify product updates are based on URL handle and dependent variant columns, not solely SKU.",
      "The supplier-joined analysis has extra Cost/Supplier fields; NEVER import it directly into Shopify.",
      "Keep the original export; review duplicate/blank SKU exceptions and changed variants.",
      ...(mapped.mapping?[
        "Supplier column mapping is explicitly chosen by the reviewer. It only renames headers in TEMPORARY in-memory CSV; no automatic match, size conversion, product update or source file modification."
      ]:[]),
      "Supplier prices are confidential: keep generated reports local.",
      "Margin checks are SIMPLE price-minus-supplier-cost arithmetic, never real profit or an instruction to price products.",
      "Verify same-currency input, tax, discounts, refunds, payment processing, shipping and advertising costs separately.",
      "Consult Shopify's official documentation and test one or two products first.",
      ...(!proposedSupplied ? [
        "NO PROPOSED CSV WAS PROVIDED. Product changes and import overwrite risks were NOT checked. Current Shopify prices were reviewed against supplier costs only."
      ] : []),
    ],
    relatedFreeTools: {
      skuJoin: "https://tools.trendbridged.com/tools/join-csv-by-key/",
      csvComparison: "https://tools.trendbridged.com/tools/compare-csv-files/",
      shopifyPreflight: "https://tools.trendbridged.com/tools/shopify-csv-preflight/",
    },
  };
  return {
    summary,
    // The first 12 report rows only, already produced by our shared CSV
    // diff engine; never parse arbitrarily large downloaded reports.
    changePreview: proposedSupplied?diff.previewRows.slice(1):[],
    comparisonReportLines: proposedSupplied?diff.reportLines:null,
    supplierMarginPreview: margin.firstEightRows,
    files: new Map([
      ["supplier-matches-NOT-SHOPIFY-IMPORT.csv", joined.csv],
      ["unmatched-skus.csv", joined.unmatchedCSV],
      ...(proposedSupplied?[["proposed-changes.csv", diff.csv]]:[]),
      ["supplier-margin-REVIEW-ONLY.csv", "﻿"+stringifyCSV(marginReport,",",true)],
      ["preflight-current.csv", before.csv],
      ...(proposedSupplied?[["preflight-proposed.csv", after.csv]]:[]),
      ["summary.json", JSON.stringify(summary, null, 2) + "\n"],
    ]),
  };
}

export async function audit(args) {
  if (args.help) return {help: true};
  if (!args.current || !args.supplier || !args.out) {
    throw new Error("Current, supplier and output directory are required.");
  }
  const inputs = [args.current, args.supplier,
    ...(args.proposed?[args.proposed]:[])].map(p => path.resolve(p));
  const output = path.resolve(args.out);
  if (new Set(inputs).size !== inputs.length) {
    throw new Error("Input CSV paths must be distinct.");
  }
  if (inputs.includes(output)) throw new Error("Output may not replace an input CSV file.");
  const [current, supplier, proposed] = await Promise.all(inputs.map(p => readFile(p, "utf8")));
  const {summary, files} = makeReports({
    current,supplier,proposed,
    supplierSkuColumn:args.supplierSkuColumn,
    supplierCostColumn:args.supplierCostColumn
  });
  // New directory only: existing directories, symlinks and files fail
  // closed; report filenames use exclusive creates and cannot overwrite.
  await mkdir(output);
  try {
    for (const [name, contents] of files) {
      await writeFile(path.join(output, name), contents, {
        encoding: "utf8", flag: "wx", mode: 0o600,
      });
    }
  } catch (error) {
    // Only remove the fresh output directory created by THIS invocation.
    await rm(output, {recursive: true, force: true});
    throw error;
  }
  return {
    output,
    reportsWritten: files.size,
    supplierMatches: summary.supplierJoin.matched,
    unmatchedSKUs: summary.supplierJoin.unmatched,
    changedRecords:summary.changedProductRecords?.changed??null,
    proposedFileSupplied:summary.proposedFileSupplied,
    manualReviewRequired: summary.manualReviewRequired,
    allWorkLocal: true,
    importedToShopify: false,
    publisherRevenueUSD: null,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(HELP);
    return;
  }
  const result = await audit(args);
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  process.stderr.write("AUDIT ONLY: Supplier-joined CSV cannot be imported into Shopify.\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    process.stderr.write("AUDIT FAILED: " + error.message + "\n");
    process.exitCode = 2;
  });
}
