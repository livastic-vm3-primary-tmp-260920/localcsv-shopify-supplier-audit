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
                    "current","supplier","proposed"]){
   elements[name]={
      id:name,textContent:"",disabled:false,hidden:false,files:[],
      children:[],addEventListener(event,callback){events[name+":"+event]=callback;},
      append(child){this.children.push(child);},
      replaceChildren(){this.children=[];},
      reset(){
        for(const key of ["current","supplier","proposed"])elements[key].files=[];
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
    clear(){events["clear:click"]();}
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

test("real fictional three-CSV workflow yields EXACT six pure CLI reports without exposing merchant files",async()=>{
 const ui=page();
 await ui.submit();
 assert.equal(ui.elements.results.hidden,false);
 assert.equal(ui.objectURLs.length,6);
 assert.equal(ui.elements.reports.children.length,6);
 assert.equal(ui.elements.run.disabled,false);
 assert.match(ui.elements.summary.textContent,/Supplier matches: 3/);
 assert.match(ui.elements.summary.textContent,/Changed records: 2/);
 assert.match(ui.elements.status.textContent,/Six local reports prepared/);
 const {files}=makeReports(INPUTS);
 for(let i=0;i<ui.objectURLs.length;i++){
   const [name,expected]=[...files][i];
   const output=ui.elements.reports.children[i].children[0];
   assert.equal(output.download,name);
   assert.equal(output.href,ui.objectURLs[i].url);
   assert.equal((await ui.objectURLs[i].blob.text()).replace(/^\uFEFF/,""),
                expected.replace(/^\uFEFF/,""));
 }
 const summary=JSON.parse(await ui.objectURLs[5].blob.text());
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

test("clearing and leaving releases all six private report blob URLs",async()=>{
 const ui=page();
 await ui.submit();
 assert.equal(ui.objectURLs.length,6);
 ui.clear();
 assert.equal(ui.revoked.length,6);
 assert.equal(ui.elements.reports.children.length,0);
 assert.equal(ui.elements.results.hidden,true);
 for(const key of ["current","supplier","proposed"]){
   assert.equal(ui.elements[key].files.length,0);
 }
 assert.match(ui.elements.status.textContent,/입력 및 결과를 지웠습니다/);
 const next=page();
 await next.submit();
 next.events["window:beforeunload"]();
 assert.equal(next.revoked.length,6);
});

test("standalone HTML presents safety limits, Korean instructions, honest free referral links",()=>{
 for(const text of [
   "한국어","3개","Six","NEVER be imported","Cost/Supplier",
   "under 2.2 MB","Shopify updates depend on URL handles",
   "https://tools.trendbridged.com/tools/join-csv-by-key/",
   "https://tools.trendbridged.com/tools/compare-csv-files/",
   "https://tools.trendbridged.com/tools/shopify-csv-preflight/",
   "not an import"
 ]){
   assert.ok(HTML.toLowerCase().includes(text.toLowerCase()),text);
 }
});
