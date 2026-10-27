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
import {stringifyCSV} from "../lib/csv-core.mjs";
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
  "Required options:",
  "  --current FILE    Current full Shopify product CSV export",
  "  --supplier FILE   Supplier CSV, with one unique nonblank SKU per item",
  "  --proposed FILE   Proposed Shopify-shaped update CSV (not imported)",
  "  --out NEW_DIR     NEW report directory; existing paths refused",
  "",
  "Outputs (local files ONLY): summary.json, supplier-matches-NOT-SHOPIFY-",
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
  const allowed = new Set(["--current", "--supplier", "--proposed", "--out"]);
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
  for (const key of allowed) {
    if (!(key in values)) throw new Error("Missing required " + key + ". Use --help.");
  }
  return {
    current: values["--current"],
    supplier: values["--supplier"],
    proposed: values["--proposed"],
    out: values["--out"],
  };
}

export function makeReports({current, supplier, proposed}) {
  // All input validation takes place BEFORE touching the output filesystem.
  // Ambiguous supplier duplicates and CSV comparison keys cause an error.
  const before = inspectShopifyProductCSV(current, {mode: "update"});
  const after = inspectShopifyProductCSV(proposed, {mode: "update"});
  const joined = joinCSVByKey(current, supplier, {
    primaryKey: "SKU", lookupKey: "SKU", mode: "left", caseSensitive: true,
  });
  const diff = compareCSVExports(current, proposed, {
    key: "SKU", caseSensitive: true,
  });

  // These are advisory RISK signals, not Shopify importer predictions.
  // Evaluate matched SKU rows only, and only columns actually INCLUDED
  // in BOTH exports. Omitting a column is not equivalent to blanking it.
  const oldData = readCSVForComparison(current, "Current Shopify export");
  const newData = readCSVForComparison(proposed, "Proposed Shopify export");
  const oldBySKU = new Map(oldData.records.map(row => [
    String(row.fields.SKU).trim(), row.fields
  ]));
  const sharedFields = newData.headers.filter(field =>
    field !== "SKU" && oldData.headers.includes(field));
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
  const vendorData=readJoinCSV(supplier,"Supplier cost CSV");
  const costNames=vendorData.headers.filter(name =>
    ["cost","cost per item","unit cost","wholesale cost"].includes(name.toLowerCase()));
  const priceNames=newData.headers.filter(name =>
    ["Price","Variant Price"].includes(name));
  const oldPriceNames=oldData.headers.filter(name =>
    ["Price","Variant Price"].includes(name));
  const costField=costNames.length===1?costNames[0]:null;
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
    inspectedProposedSKU:newData.records.length,
    validComparisons:0, belowSupplierCost:0,
    missingSupplier:0, unavailableCost:0, invalidCost:0,
    unavailableProposedPrice:0, invalidProposedPrice:0,
    currencyVerified:false, trueProfitCalculated:false,
    costColumn:costField, priceColumn:priceField,
    limitations:"Arithmetic only. Confirm supplier cost and product price are in the SAME currency. It excludes taxes, refunds, discounts, shipping, card fees, labor and advertising. This is NOT actual or projected profit.",
    firstEightRows:[]
  };
  const marginReport=[[
    "SKU","supplier_cost","current_shopify_price","proposed_shopify_price",
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
    before.metrics.errors || after.metrics.errors ||
    before.metrics.warnings || after.metrics.warnings ||
    joined.metrics.unmatched || joined.metrics.blankPrimaryKeys ||
    joined.metrics.duplicatesInPrimary ||
    diff.metrics.added || diff.metrics.removed ||
    diff.metrics.changed || margin.belowSupplierCost ||
    margin.missingSupplier || margin.invalidCost || margin.invalidProposedPrice ||
    margin.unavailableCost || margin.unavailableProposedPrice
  );
  const summary = {
    tool: "LocalCSV Lab — offline supplier SKU audit",
    type: "LOCAL_REPORT_NOT_SHOPIFY_IMPORT",
    shopifyAccountAccessed: false,
    dataUploaded: false,
    advertisingLoaded: false,
    supplierJoin: joined.metrics,
    changedProductRecords: diff.metrics,
    possibleImportRisks: importRisk,
    supplierCostMarginReview: margin,
    existingShopifyPreflight: before.metrics,
    proposedShopifyPreflight: after.metrics,
    manualReviewRequired,
    outputCannotBeImportedDirectlyIntoShopify: true,
    important: [
      "This is not official Shopify validation or a guaranteed safe import.",
      "Shopify product updates are based on URL handle and dependent variant columns, not solely SKU.",
      "The supplier-joined analysis has extra Cost/Supplier fields; NEVER import it directly into Shopify.",
      "Keep the original export; review duplicate/blank SKU exceptions and changed variants.",
      "Supplier prices are confidential: keep generated reports local.",
      "Margin checks are SIMPLE price-minus-supplier-cost arithmetic, never real profit or an instruction to price products.",
      "Verify same-currency input, tax, discounts, refunds, payment processing, shipping and advertising costs separately.",
      "Consult Shopify's official documentation and test one or two products first.",
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
    changePreview: diff.previewRows.slice(1),
    comparisonReportLines: diff.reportLines,
    supplierMarginPreview: margin.firstEightRows,
    files: new Map([
      ["supplier-matches-NOT-SHOPIFY-IMPORT.csv", joined.csv],
      ["unmatched-skus.csv", joined.unmatchedCSV],
      ["proposed-changes.csv", diff.csv],
      ["supplier-margin-REVIEW-ONLY.csv", "﻿"+stringifyCSV(marginReport,",",true)],
      ["preflight-current.csv", before.csv],
      ["preflight-proposed.csv", after.csv],
      ["summary.json", JSON.stringify(summary, null, 2) + "\n"],
    ]),
  };
}

export async function audit(args) {
  if (args.help) return {help: true};
  if (!args.current || !args.supplier || !args.proposed || !args.out) {
    throw new Error("All four input/output options are required.");
  }
  const inputs = [args.current, args.supplier, args.proposed].map(p => path.resolve(p));
  const output = path.resolve(args.out);
  if (new Set(inputs).size !== 3) throw new Error("Three distinct input CSV files are required.");
  if (inputs.includes(output)) throw new Error("Output may not replace an input CSV file.");
  const [current, supplier, proposed] = await Promise.all(inputs.map(p => readFile(p, "utf8")));
  const {summary, files} = makeReports({current, supplier, proposed});
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
    changedRecords: summary.changedProductRecords.changed,
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
