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

import {joinCSVByKey} from "../lib/csv-lookup-core.mjs";
import {compareCSVExports} from "../lib/csv-diff-core.mjs";
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
  "preflight-current.csv and preflight-proposed.csv",
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
  const manualReviewRequired = Boolean(
    before.metrics.errors || after.metrics.errors ||
    before.metrics.warnings || after.metrics.warnings ||
    joined.metrics.unmatched || joined.metrics.blankPrimaryKeys ||
    joined.metrics.duplicatesInPrimary ||
    diff.metrics.added || diff.metrics.removed
  );
  const summary = {
    tool: "LocalCSV Lab — offline supplier SKU audit",
    type: "LOCAL_REPORT_NOT_SHOPIFY_IMPORT",
    shopifyAccountAccessed: false,
    dataUploaded: false,
    advertisingLoaded: false,
    supplierJoin: joined.metrics,
    changedProductRecords: diff.metrics,
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
    files: new Map([
      ["supplier-matches-NOT-SHOPIFY-IMPORT.csv", joined.csv],
      ["unmatched-skus.csv", joined.unmatchedCSV],
      ["proposed-changes.csv", diff.csv],
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
