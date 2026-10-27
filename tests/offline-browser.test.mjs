import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import vm from "node:vm";
import path from "node:path";
import {fileURLToPath} from "node:url";

import {inspectShopifyProductCSV} from "../lib/shopify-preflight-core.mjs";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const HTML=readFileSync(path.join(ROOT,"offline/shopify-csv-preflight.html"),"utf8");
const SCRIPTS=[...HTML.matchAll(/<script>([\s\S]*?)<\/script>/g)];
const JS=SCRIPTS[0]?.[1]||"";
const example=readFileSync(path.join(ROOT,"fixtures/shopify-current-products.csv"),"utf8");

function mockFile(text=example) {
  return {size:Buffer.byteLength(text),text:async()=>text};
}
function offlinePage({csv=mockFile(),mode="update"}={}){
  const events={};
  const objectURLs=[];
  const revoked=[];
  const elements={};
  for(const name of ["localcsv-form","csv-file","mode","result","summary","findings","download","status","clear"]){
    elements[name]={textContent:"",hidden:false,files:[],value:"",
      addEventListener(name,listener){events[this.id+":"+name]=listener;},
      removeAttribute(attr){delete this[attr];},
      reset(){elements["csv-file"].files=[];elements.mode.value="update";}
    };
    elements[name].id=name;
  }
  elements["csv-file"].files=csv?[csv]:[];
  elements.mode.value=mode;
  elements.result.hidden=true;
  const document={getElementById(id){
    if(!elements[id])throw new Error("Unexpected HTML field "+id);
    return elements[id];
  }};
  const window={addEventListener(name,callback,opts){
    events["window:"+name]=callback;
    assert.equal(opts.once,true);
  }};
  const URL={
    createObjectURL(blob){
      assert.equal(typeof blob.text,"function");
      const fake="blob:offline-"+objectURLs.length;
      objectURLs.push({url:fake,blob});
      return fake;
    },
    revokeObjectURL(url){revoked.push(url);}
  };
  const context={document,window,URL,Blob,
    fetch(){throw Error("Network call prohibited");},
    XMLHttpRequest:class{constructor(){throw Error("Forbidden request");}},
    navigator:{sendBeacon(){throw Error("Forbidden beacon");}},
  };
  vm.runInNewContext(JS,context,{
    timeout:1500,contextCodeGeneration:{strings:false,wasm:false}
  });
  return {events,elements,objectURLs,revoked,
    async submit(){
      const e=events["localcsv-form:submit"];
      assert.equal(typeof e,"function");
      let prevented=false;
      await e({preventDefault(){prevented=true}});
      assert.equal(prevented,true);
    },
    clear(){
      const cb=events["clear:click"];
      assert.equal(typeof cb,"function");cb();
    }
  };
}

test("single offline HTML contains only pinned local JS engines and no external code",()=>{
 assert.equal(SCRIPTS.length,1);
 new vm.Script(JS);
 assert.equal(HTML.match(/<script\s+src/g)?.length||0,0);
 assert.ok(HTML.includes("connect-src 'none'"));
 assert.ok(HTML.includes("form-action 'none'"));
 assert.ok(HTML.includes("default-src 'none'"));
 assert.ok(HTML.includes("data never leaves".toLowerCase())||
           HTML.includes("Data never leaves your browser."));
 for(const banned of [
   "XMLHttpRequest(","navigator.sendBeacon","fetch(","<iframe",
   "document.write(", "gtag(","firebase","cdnjs", "google-analytics.com",
   "bauval.org","abscloud.org","araplhn.org"
 ]){
   assert.ok(!HTML.includes(banned),"Surprise network/advertiser artifact: "+banned);
 }
});

test("offline file is reproducible exactly from the four audited pure JS engines",()=>{
 const run=execFileSync("python3",["scripts/build_offline.py","--check"],{
   cwd:ROOT,encoding:"utf8",timeout:8000
 });
 assert.match(run,/REPRODUCIBLE_OFFLINE_HTML_OK/);
});

test("actual 3-row fictional Shopify export runs locally and returns 0 errors/warnings",async()=>{
 const ui=offlinePage();
 await ui.submit();
 assert.equal(ui.elements.result.hidden,false);
 assert.match(ui.elements.summary.textContent,/CSV rows: 3/);
 assert.match(ui.elements.summary.textContent,/Products: 2/);
 assert.match(ui.elements.summary.textContent,/Errors: 0/);
 assert.match(ui.elements.summary.textContent,/Warnings: 0/);
 assert.match(ui.elements.status.textContent,/Local check complete/);
 assert.equal(ui.objectURLs.length,1);
 assert.equal(ui.elements.download.download,"shopify-preflight-findings.csv");
 assert.equal(ui.elements.download.href,ui.objectURLs[0].url);
 assert.equal((await ui.objectURLs[0].blob.text()).replace(/^\uFEFF/,""),
  inspectShopifyProductCSV(example,{mode:"update"}).csv.replace(/^\uFEFF/,""));
});

test("incorrect price is identified safely and downloadable report contains the finding",async()=>{
 const bad=example.replace("29.00","not-a-price");
 const ui=offlinePage({csv:mockFile(bad)});
 await ui.submit();
 assert.equal(ui.elements.result.hidden,false);
 assert.match(ui.elements.summary.textContent,/Errors: 1/);
 assert.match(ui.elements.findings.textContent,/Price is not a plain nonnegative decimal number/);
 const report=await ui.objectURLs[0].blob.text();
 assert.ok(report.includes("Price is not a plain nonnegative decimal number"));
});

test("create mode is an actual different user-selectable preflight",async()=>{
 const ui=offlinePage({mode:"create"});
 await ui.submit();
 assert.equal(ui.elements.result.hidden,false);
 assert.equal((await ui.objectURLs[0].blob.text()).replace(/^\uFEFF/,""),
   inspectShopifyProductCSV(example,{mode:"create"}).csv.replace(/^\uFEFF/,""));
});

test("missing file cannot generate a report or make network calls",async()=>{
 const ui=offlinePage({csv:null});
 await ui.submit();
 assert.equal(ui.objectURLs.length,0);
 assert.equal(ui.elements.result.hidden,true);
 assert.match(ui.elements.status.textContent,/Choose a CSV file/);
});

test("oversized file is rejected before reading or creating a report",async()=>{
 const file={size:2300000,text:async()=>{throw Error("Must not read");}};
 const ui=offlinePage({csv:file});
 await ui.submit();
 assert.equal(ui.objectURLs.length,0);
 assert.equal(ui.elements.result.hidden,true);
 assert.match(ui.elements.status.textContent,/File too large/);
});

test("invalid CSV stops safely without showing stale reports",async()=>{
 const ui=offlinePage({csv:mockFile("SKU,Price\nA,10.00")});
 await ui.submit();
 assert.equal(ui.elements.result.hidden,true);
 assert.equal(ui.objectURLs.length,0);
 assert.match(ui.elements.status.textContent,/Required product column missing: Title/);
});

test("clearing resets the file and revokes temporary downloadable blob link",async()=>{
 const ui=offlinePage();
 await ui.submit();
 assert.equal(ui.objectURLs.length,1);
 assert.equal(ui.revoked.length,0);
 ui.clear();
 assert.equal(ui.revoked.length,1);
 assert.equal(ui.revoked[0],ui.objectURLs[0].url);
 assert.equal(ui.elements.result.hidden,true);
 assert.equal(ui.elements["csv-file"].files.length,0);
 assert.match(ui.elements.status.textContent,/Cleared local file selection/);
});

test("public source, real fictional inputs and license remain separated from the offline file",()=>{
 const docs=readFileSync(path.join(ROOT,"README.md"),"utf8");
 assert.ok(docs.includes("https://tools.trendbridged.com"));
 assert.ok(HTML.includes("https://tools.trendbridged.com/tools/shopify-csv-preflight/"));
 assert.ok(HTML.includes("한국어"));
 assert.ok(HTML.includes("MIT-licensed"));
 assert.ok(HTML.includes("NOT")||HTML.includes("not"));
 assert.ok(HTML.includes("never")||HTML.includes("does not"));
 assert.ok(!HTML.includes("github_pat_"));
 assert.ok(!HTML.includes("privateKey"));
 assert.ok(!HTML.includes("customer@"));
});
