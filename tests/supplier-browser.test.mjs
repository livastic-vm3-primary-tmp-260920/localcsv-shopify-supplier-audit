import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";

import {makeReports} from "../bin/localcsv-audit.mjs";

const HTML=readFileSync("offline/shopify-supplier-threeway-audit.html","utf8");
const CODE=[...HTML.matchAll(/<script>([\s\S]*?)<\/script>/g)];
const JS=CODE[0]?.[1]||"";
const INPUTS={
 current:readFileSync("fixtures/shopify-current-products.csv","utf8"),
 supplier:readFileSync("fixtures/supplier-price-update.csv","utf8"),
 proposed:readFileSync("fixtures/shopify-proposed-products.csv","utf8")
};

function file(text){
  return {size:Buffer.byteLength(text),text:async()=>text};
}

function page({source=INPUTS}={}){
 const elements={};
 const events={};
 const objectURLs=[];
 const revoked=[];
 for(const name of ["sku-audit-form","run","status","results","summary","reports","clear",
                    "review-preview","changed-fields-preview","import-risk-summary","import-risk-examples",
                    "margin-panel","margin-overview","margin-rows",
                    "cost-only","current","supplier","proposed"]){
   elements[name]={
      id:name,textContent:"",disabled:false,hidden:false,checked:false,required:true,files:[],
      children:[],addEventListener(event,callback){events[name+":"+event]=callback;},
      append(child){this.children.push(child);},
      replaceChildren(){this.children=[];},
      reset(){
        for(const key of ["current","supplier","proposed"])elements[key].files=[];
        elements["cost-only"].checked=false;
      }
   };
 }
 for(const name of ["current","supplier","proposed"]){
   elements[name].files=Object.hasOwn(source,name)&&source[name]!==null?
     [typeof source[name]==="string"?file(source[name]):source[name]]:[];
 }
 elements.results.hidden=true;
 const document={
    getElementById(name){
       if(!elements[name])throw Error("Unexpected DOM lookup: "+name);
       return elements[name];
    },
    createElement(tag){
      if(!["li","a"].includes(tag))throw Error("Unexpected tag: "+tag);
      return {tag,textContent:"",download:"",href:"",children:[],
        append(child){this.children.push(child);}};
    }
 };
 const window={addEventListener(name,callback,options){
    assert.equal(options.once,true);
    events["window:"+name]=callback;
 }};
 const URL={
    createObjectURL(blob){
      const url="blob:local-threeway-"+objectURLs.length;
      objectURLs.push({url,blob});
      return url;
    },
    revokeObjectURL(url){revoked.push(url);}
 };
 vm.runInNewContext(JS,{document,window,URL,Blob,
    fetch(){throw Error("No network allowed");},
    XMLHttpRequest:class{constructor(){throw Error("No XHR allowed");}},
    navigator:{sendBeacon(){throw Error("No telemetry allowed");}}
 },{timeout:2000,contextCodeGeneration:{strings:false,wasm:false}});
 return {elements,events,objectURLs,revoked,
    async submit(){
      let prevented=false;
      await events["sku-audit-form:submit"]({preventDefault(){prevented=true;}});
      assert.equal(prevented,true);
    },
    clear(){events["clear:click"]();},
    setTwoFile(value=true){
      elements["cost-only"].checked=value;
      events["cost-only:change"]();
    }
 };
}

test("exact standalone browser audit is byte-reproducible from four original source modules and CLI pure report logic",()=>{
 const out=execFileSync("python3",["scripts/build_supplier_browser.py","--check"],{encoding:"utf8",timeout:9000});
 assert.match(out,/REPRODUCIBLE_THREE_CSV_AUDIT_OK/);
 assert.equal(CODE.length,1);
 new vm.Script(JS);
 assert.ok(HTML.includes("connect-src 'none'"));
 assert.ok(HTML.includes("form-action 'none'"));
 assert.ok(HTML.includes("default-src 'none'"));
 assert.ok(HTML.includes("noindex,nofollow"));
 for(const forbidden of ["fetch(","XMLHttpRequest(","navigator.sendBeacon","<script src=",
                          "gtag(","google-analytics","adsterra.com","<iframe",
                          "api.github.com","github_pat_","privateKey"]){
    assert.ok(!HTML.toLowerCase().includes(forbidden.toLowerCase()),forbidden);
 }
});

test("real fictional three-CSV workflow yields EXACT seven pure CLI reports without exposing merchant files",async()=>{
 const ui=page();
 await ui.submit();
 assert.equal(ui.elements.results.hidden,false);
 assert.equal(ui.objectURLs.length,7);
 assert.equal(ui.elements.reports.children.length,7);
 assert.equal(ui.elements.run.disabled,false);
 assert.match(ui.elements.summary.textContent,/Supplier matches: 3/);
 assert.match(ui.elements.summary.textContent,/Changed records: 2/);
 assert.match(ui.elements.summary.textContent,/Manual review: YES/);
 assert.equal(ui.elements["review-preview"].hidden,false);
 assert.equal(ui.elements["changed-fields-preview"].children.length,2);
 assert.match(ui.elements["changed-fields-preview"].children[0].textContent,/TEE-BLK-M.*Price.*29.00.*31.00/);
 assert.match(ui.elements["changed-fields-preview"].children[1].textContent,/CAP-WOOL.*Inventory quantity.*7.*6/);
 assert.match(ui.elements["import-risk-summary"].textContent,/0 included cells changing to blank/);
 assert.equal(ui.elements["import-risk-examples"].children.length,0);
 assert.equal(ui.elements["margin-panel"].hidden,false);
 assert.equal(ui.elements["margin-rows"].children.length,3);
 assert.match(ui.elements["margin-overview"].textContent,/3 calculated/);
 assert.match(ui.elements["margin-overview"].textContent,/0 below supplier cost/);
 assert.match(ui.elements["margin-overview"].textContent,/SAME-CURRENCY ASSUMED/);
 assert.match(ui.elements["margin-rows"].children[0].textContent,/TEE-BLK-M.*31.00.*61.29%/);
 assert.match(ui.elements.status.textContent,/Seven local reports prepared/);
 const {files}=makeReports(INPUTS);
 for(let i=0;i<ui.objectURLs.length;i++){
   const [name,expected]=[...files][i];
   const output=ui.elements.reports.children[i].children[0];
   assert.equal(output.download,name);
   assert.equal(output.href,ui.objectURLs[i].url);
   assert.equal((await ui.objectURLs[i].blob.text()).replace(/^\uFEFF/,""),
                expected.replace(/^\uFEFF/,""));
 }
 const summary=JSON.parse(await ui.objectURLs[6].blob.text());
 assert.equal(summary.outputCannotBeImportedDirectlyIntoShopify,true);
 assert.equal(summary.advertisingLoaded,false);
 assert.equal(summary.dataUploaded,false);
});

test("ambiguous duplicate supplier SKUs abort without any created download link",async()=>{
 const duplicate=INPUTS.supplier+"TEE-BLK-M,15.00,Fictional Duplicate\n";
 const ui=page({source:{...INPUTS,supplier:duplicate}});
 await ui.submit();
 assert.equal(ui.elements.results.hidden,true);
 assert.equal(ui.objectURLs.length,0);
 assert.match(ui.elements.status.textContent,/duplicate key/i);
});

test("unsafe blank matching key aborts without silently discarding source rows",async()=>{
 const missing=INPUTS.current.replace("TEE-BLK-M","").replace("29.00","29.00");
 const ui=page({source:{...INPUTS,current:missing}});
 await ui.submit();
 assert.equal(ui.elements.results.hidden,true);
 assert.equal(ui.objectURLs.length,0);
 assert.match(ui.elements.status.textContent,/(?:blank|empty).*key|key.*(?:blank|empty)/i);
});

test("requires all three files and refuses oversized input before reading any data",async()=>{
 const noSupplier=page({source:{...INPUTS,supplier:null}});
 await noSupplier.submit();
 assert.equal(noSupplier.objectURLs.length,0);
 assert.match(noSupplier.elements.status.textContent,/Choose all three/);
 const tooBig=page({source:{...INPUTS,proposed:{size:2300000,text:async()=>{throw Error("should not read");}}}});
 await tooBig.submit();
 assert.equal(tooBig.objectURLs.length,0);
 assert.match(tooBig.elements.status.textContent,/2.2 MB/);
});

test("clearing and leaving releases all seven private report blob URLs",async()=>{
 const ui=page();
 await ui.submit();
 assert.equal(ui.objectURLs.length,7);
 ui.clear();
 assert.equal(ui.revoked.length,7);
 assert.equal(ui.elements.reports.children.length,0);
 assert.equal(ui.elements.results.hidden,true);
 assert.equal(ui.elements["review-preview"].hidden,true);
 assert.equal(ui.elements["margin-panel"].hidden,true);
 assert.equal(ui.elements["margin-rows"].children.length,0);
 assert.equal(ui.elements["changed-fields-preview"].children.length,0);
 assert.equal(ui.elements["import-risk-examples"].children.length,0);
 for(const key of ["current","supplier","proposed"]){
   assert.equal(ui.elements[key].files.length,0);
 }
 assert.match(ui.elements.status.textContent,/입력 및 결과를 지웠습니다/);
 const next=page();
 await next.submit();
 next.events["window:beforeunload"]();
 assert.equal(next.revoked.length,7);
});

test("standalone HTML presents safety limits, Korean instructions, honest free referral links",()=>{
 for(const text of [
   "한국어","3개","Seven","NEVER be imported","Cost/Supplier",
   "under 2.2 MB","Shopify updates depend on URL handles",
   "https://tools.trendbridged.com/tools/join-csv-by-key/",
   "https://tools.trendbridged.com/tools/compare-csv-files/",
   "https://tools.trendbridged.com/tools/shopify-csv-preflight/",
   "not an import"
 ]){
   assert.ok(HTML.toLowerCase().includes(text.toLowerCase()),text);
 }
});


test("real Shopify import risks count only INCLUDED fields changed to blank, option values or handles",async()=>{
 const modified=INPUTS.proposed.replace(
   "cotton-tee,Cotton Tee,TEE-BLK-M,Color,Black,Size,M,31.00",
   "cotton-tee-new,Cotton Tee,TEE-BLK-M,Color,Blue,Size,M,"
 );
 assert.notEqual(modified,INPUTS.proposed);
 const {summary,changePreview,comparisonReportLines}=makeReports({...INPUTS,proposed:modified});
 assert.equal(summary.possibleImportRisks.includedBlankCellChanges,1);
 assert.equal(summary.possibleImportRisks.variantOptionValueChanges,1);
 assert.equal(summary.possibleImportRisks.productHandleChanges,1);
 assert.equal(summary.possibleImportRisks.examples.length,3);
 assert.equal(summary.manualReviewRequired,true);
 assert.ok(comparisonReportLines>=3);
 assert.ok(changePreview.length<=12);
 const ui=page({source:{...INPUTS,proposed:modified}});
 await ui.submit();
 assert.equal(ui.elements.results.hidden,false);
 assert.equal(ui.elements["review-preview"].hidden,false);
 assert.match(ui.elements["import-risk-summary"].textContent,/1 included cells changing to blank/);
 assert.match(ui.elements["import-risk-summary"].textContent,/1 variant option values changed/);
 assert.match(ui.elements["import-risk-summary"].textContent,/1 product handles changed/);
 assert.equal(ui.elements["import-risk-examples"].children.length,3);
 assert.ok(ui.elements["import-risk-examples"].children.some(item=>/POSSIBLE_BLANK_OVERWRITE/.test(item.textContent)));
 assert.ok(ui.elements["import-risk-examples"].children.some(item=>/VARIANT_OPTION_VALUE_CHANGE/.test(item.textContent)));
 assert.ok(ui.elements["import-risk-examples"].children.some(item=>/PRODUCT_HANDLE_CHANGE/.test(item.textContent)));
});

test("omitted columns are NOT mistaken for intentionally blank cells",()=>{
 const before=INPUTS.current.replace("URL handle,Title,", "URL handle,Vendor,Title,")
  .replaceAll("cotton-tee,", "cotton-tee,Example Vendor,")
  .replace("wool-cap,", "wool-cap,Example Vendor,");
 const {summary}=makeReports({...INPUTS,current:before});
 assert.equal(summary.possibleImportRisks.includedBlankCellChanges,0,
  "Omitted import columns must not be labeled as blank overwrites");
});

test("user-controlled CSV text is added ONLY via textContent, never HTML injection",async()=>{
 const fake='<img src=x onerror=alert(1)>';
 const altered=INPUTS.proposed.replace("31.00",fake);
 const ui=page({source:{...INPUTS,proposed:altered}});
 await ui.submit();
 assert.equal(ui.elements.results.hidden,false);
 assert.ok(ui.elements["changed-fields-preview"].children.some(x=>x.textContent.includes(fake)));
 const script=JS;
 assert.ok(!script.includes(".innerHTML"));
 assert.ok(!script.includes("insertAdjacentHTML"));
 assert.ok(!script.includes("document.write"));
 assert.ok(script.includes("item.textContent="));
});

test("blanking an option value warns for BOTH overwrite and destructive variant change",()=>{
 const variant=INPUTS.proposed.replace("Color,Black,Size,M,31.00",
                                       "Color,,Size,M,31.00");
 assert.notEqual(variant,INPUTS.proposed);
 const {summary}=makeReports({...INPUTS,proposed:variant});
 const risks=summary.possibleImportRisks;
 assert.equal(risks.includedBlankCellChanges,1);
 assert.equal(risks.variantOptionValueChanges,1);
 assert.equal(risks.productHandleChanges,0);
 assert.deepEqual(risks.examples.map(x=>x.type),[
   "POSSIBLE_BLANK_OVERWRITE","VARIANT_OPTION_VALUE_CHANGE"
 ]);
 assert.equal(summary.manualReviewRequired,true);
});

test("margin screen never treats price-cost arithmetic as verified profit",async()=>{
 const ui=page();
 await ui.submit();
 assert.equal(ui.elements["margin-panel"].hidden,false);
 const message=ui.elements["margin-overview"].textContent;
 assert.match(message,/NOT real profit/);
 assert.match(message,/taxes\/shipping\/fees\/discounts NOT included/);
 assert.equal(ui.elements["margin-rows"].children.length,3);
 assert.ok(ui.elements.reports.children.some(li=>
   li.children[0]?.download==="supplier-margin-REVIEW-ONLY.csv"));
});

test("two real CSV files produce FIVE reports and never imply a proposed file or changed products",async()=>{
 const ui=page({source:{...INPUTS,proposed:null}});
 ui.setTwoFile(true);
 assert.equal(ui.elements.proposed.disabled,true);
 assert.equal(ui.elements.proposed.required,false);
 await ui.submit();
 assert.equal(ui.elements.results.hidden,false);
 assert.equal(ui.objectURLs.length,5);
 assert.equal(ui.elements.reports.children.length,5);
 assert.equal(ui.elements["review-preview"].hidden,true);
 assert.equal(ui.elements["changed-fields-preview"].children.length,0);
 assert.equal(ui.elements["margin-panel"].hidden,false);
 assert.equal(ui.elements["margin-rows"].children.length,3);
 assert.match(ui.elements["margin-overview"].textContent,/TWO-FILE SUPPLIER COST REVIEW ONLY/);
 assert.match(ui.elements["margin-rows"].children[0].textContent,/current price.*29.00/);
 assert.match(ui.elements.status.textContent,/Five local reports prepared/);
 assert.match(ui.elements.summary.textContent,/Product change comparison: NOT RUN/);
 const actual=ui.elements.reports.children.map(li=>li.children[0].download);
 assert.deepEqual(actual,[
  "supplier-matches-NOT-SHOPIFY-IMPORT.csv","unmatched-skus.csv",
  "supplier-margin-REVIEW-ONLY.csv","preflight-current.csv","summary.json"
 ]);
 const summary=JSON.parse(await ui.objectURLs[4].blob.text());
 assert.equal(summary.proposedFileSupplied,false);
 assert.equal(summary.productChangeComparisonPerformed,false);
 assert.equal(summary.changedProductRecords,null);
 assert.equal(summary.proposedShopifyPreflight,null);
 assert.equal(summary.manualReviewRequired,true);
 assert.equal(summary.supplierCostMarginReview.validComparisons,3);
 assert.equal(summary.supplierCostMarginReview.priceSource,"CURRENT_CSV_NO_PROPOSAL");
 ui.clear();
 assert.equal(ui.elements.proposed.disabled,false);
 assert.equal(ui.elements.proposed.required,true);
 assert.equal(ui.elements["cost-only"].checked,false);
 assert.equal(ui.revoked.length,5);
});

test("two-file toggle refuses silently discarding any selected proposed CSV",async()=>{
 const ui=page();
 ui.setTwoFile(true);
 assert.equal(ui.elements["cost-only"].checked,false);
 assert.equal(ui.elements.proposed.disabled,false);
 assert.match(ui.elements.status.textContent,/Do not ignore selected proposed CSV/);
 // Defend also against someone programmatically forcing the checkbox.
 ui.elements["cost-only"].checked=true;
 await ui.submit();
 assert.equal(ui.objectURLs.length,0);
 assert.equal(ui.elements.results.hidden,true);
 assert.match(ui.elements.status.textContent,/A proposed CSV is selected/);
});

test("both modes require their actual source files, and switching hides stale reports",async()=>{
 const ui=page({source:{current:null,supplier:INPUTS.supplier,proposed:null}});
 ui.setTwoFile(true);
 await ui.submit();
 assert.match(ui.elements.status.textContent,/Choose current Shopify export and supplier CSV/);
 assert.equal(ui.objectURLs.length,0);
 ui.setTwoFile(false);
 await ui.submit();
 assert.match(ui.elements.status.textContent,/Choose all three CSV files/);
});
