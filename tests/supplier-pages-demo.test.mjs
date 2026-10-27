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
 assert.equal(scripts(audit).length,2);
 assert.deepEqual([scripts(audit)[0]],scripts(offline));
 new vm.Script(scripts(audit)[0]);
 new vm.Script(scripts(audit)[1]);
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
 assert.ok(audit.includes("seven downloadable review files"));
 assert.ok(audit.includes("supplier-matches-NOT-SHOPIFY-IMPORT.csv"));
 assert.ok(audit.includes("MUST NOT"));
 assert.ok(audit.includes("Shopify import CSV"));
 assert.ok(audit.includes("supplier unit cost"));
 assert.ok(audit.includes("same currency"));
 assert.ok(audit.includes("NOT real profit"));
 assert.ok(audit.includes("supplier-margin-REVIEW-ONLY.csv"));
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
 assert.ok(audit.includes("TWO-FILE SUPPLIER COST REVIEW ONLY"));
 assert.ok(audit.includes('id="cost-only"'));
 assert.ok(audit.includes("no product change"));
 assert.ok(audit.includes("Two-file example"));
 assert.ok(audit.includes('id="use-two-file-demo-inputs"'));
 assert.ok(audit.includes("2.2 MB"));
});

function fakeSamplePage(){
 const names=["current","supplier","proposed"];
 const sampleData={
  current:"shopify-current-products.csv",
  supplier:"supplier-price-update.csv",
  proposed:"shopify-proposed-products.csv"
 };
 const events={};
 const btn={addEventListener(name,callback){assert.equal(name,"click");this.click=callback;}};
 const btn2={addEventListener(name,callback){assert.equal(name,"click");this.click=callback;}};
 const form={count:0,requestSubmit(){this.count++}};
 const status={textContent:""};
 const fields=Object.fromEntries(names.map(name=>[name,{
   files:[],value:"",disabled:false,required:true
 }]));
 const checkbox={
   checked:false,events:[],
   dispatchEvent(event){
     assert.equal(event.type,"change");
     this.events.push(event.type);
     fields.proposed.disabled=this.checked;
     fields.proposed.required=!this.checked;
   }
 };
 const document={getElementById(id){
   if(id==="use-demo-inputs")return btn;
   if(id==="use-two-file-demo-inputs")return btn2;
   if(id==="cost-only")return checkbox;
   if(id==="sku-audit-form")return form;
   if(id==="status")return status;
   return fields[id]||null;
 }};
 class FakeFile{
   constructor(parts,name,options){this.content=parts.join("");this.name=name;this.type=options.type;}
 }
 class FakeDataTransfer{
   constructor(){this.files=[];this.items={add:file=>{this.files.push(file);}}}
 }
 class FakeEvent{
   constructor(type){this.type=type;}
 }
 vm.runInNewContext(scripts(audit)[1],{
   document,File:FakeFile,DataTransfer:FakeDataTransfer,Event:FakeEvent,
   fetch(){throw Error("No external data in sample");},
   localStorage:{getItem(){throw Error("Never inspect consent");}},
   navigator:{sendBeacon(){throw Error("Never report clicks");}}
 },{timeout:1000,contextCodeGeneration:{strings:false,wasm:false}});
 return {btn,btn2,checkbox,form,status,fields,names,sampleData};
}

test("three-file example sets ONLY bundled fictional data and never overrides user files",()=>{
 const {btn,btn2,checkbox,form,status,fields,names,sampleData}=fakeSamplePage();
 assert.equal(typeof btn.click,"function");
 assert.equal(typeof btn2.click,"function");
 btn.click();
 assert.equal(form.count,1);
 assert.equal(checkbox.checked,false);
 assert.deepEqual(checkbox.events,["change"]);
 for(const name of names){
   assert.equal(fields[name].files.length,1);
   assert.equal(fields[name].files[0].name,sampleData[name]);
   assert.equal(fields[name].files[0].content,readFileSync("fixtures/"+sampleData[name],"utf8"));
 }
 btn2.click();
 assert.equal(form.count,1,"Second sample must not replace existing uploaded CSV files");
 assert.match(status.textContent,/Clear selected files/);
});

test("two-file fictional sample selects only TWO files and asserts NO proposed export",()=>{
 const {btn,btn2,checkbox,form,status,fields,names,sampleData}=fakeSamplePage();
 btn2.click();
 assert.equal(form.count,1);
 assert.equal(checkbox.checked,true);
 assert.deepEqual(checkbox.events,["change"]);
 assert.equal(fields.proposed.files.length,0);
 assert.equal(fields.proposed.disabled,true);
 assert.equal(fields.proposed.required,false);
 for(const name of names.slice(0,2)){
   assert.equal(fields[name].files.length,1);
   assert.equal(fields[name].files[0].name,sampleData[name]);
   assert.equal(fields[name].files[0].content,readFileSync("fixtures/"+sampleData[name],"utf8"));
 }
 btn.click();
 assert.equal(form.count,1);
 assert.match(status.textContent,/Clear selected files/);
});

test("sample workflow is opt-in and remains isolated from Adsterra, analytics and external requests",()=>{
 const body=scripts(audit)[1];
 for(const token of ["fetch(", "XMLHttpRequest", "sendBeacon","gtag(","adsterra","localStorage",
                      "document.cookie","window.open","location.href","http://","https://"]){
  assert.ok(!body.includes(token),"Unexpected sample behavior "+token);
 }
 assert.ok(audit.indexOf('id="use-demo-inputs"')<audit.indexOf('id="sku-audit-form"'));
 assert.ok(audit.includes("Run fictional 3-CSV example"));
 assert.ok(audit.includes("Run fictional 2-CSV supplier cost review"));
 assert.ok(audit.includes("두 파일 예제"));
 assert.ok(audit.includes("NEVER replaces existing selections silently"));
 assert.ok(audit.includes("connect-src 'none'"));
});
