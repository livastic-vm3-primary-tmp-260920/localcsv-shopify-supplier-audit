#!/usr/bin/env node
/** Optional real Chrome headless end-to-end smoke test. No external traffic. */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {fileURLToPath,pathToFileURL} from "node:url";
import {spawn} from "node:child_process";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const profile=fs.mkdtempSync(path.join(os.tmpdir(),"localcsv-shopify-cdp-"));
const chrome=spawn("google-chrome",[
  "--headless=new","--no-sandbox","--disable-gpu","--disable-background-networking",
  "--disable-extensions","--disable-sync","--no-first-run","--no-default-browser-check",
  "--remote-allow-origins=*","--remote-debugging-port=0",
  "--user-data-dir="+profile,"about:blank"
],{stdio:"ignore"});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let socket;
let requested=0;
try{
 let port=0;
 for(let i=0;i<80;i++){
  const where=path.join(profile,"DevToolsActivePort");
  if(fs.existsSync(where)){
   port=Number(fs.readFileSync(where,"utf8").split("\n")[0]);
   if(port)break;
  }
  await sleep(100);
 }
 if(!port)throw Error("Chrome did not start a local CDP listener");
 const argv=process.argv.slice(2);
const runFictionalSample=argv.includes("--sample")||argv.includes("--two-sample");
const runTwoFile=argv.includes("--two")||argv.includes("--two-sample");
const useVendorMapping=argv.includes("--vendor-map");
if(useVendorMapping&&runFictionalSample){
  throw Error("Vendor column mapping must be explicitly tested with native CSV files");
}
const requestedTarget=argv.find(value=>
  !["--sample","--two","--two-sample","--vendor-map"].includes(value));
const target=requestedTarget?.startsWith("https://")?requestedTarget:
  pathToFileURL(requestedTarget?path.resolve(requestedTarget):
    path.join(ROOT,"offline/shopify-supplier-threeway-audit.html")).href;
 const created=await fetch("http://127.0.0.1:"+port+"/json/new?"+encodeURIComponent(target),{method:"PUT"});
 if(!created.ok)throw Error("Cannot open local file in isolated Chrome");
 const tab=await created.json();
 socket=new WebSocket(tab.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{
   socket.addEventListener("open",resolve,{once:true});
   socket.addEventListener("error",reject,{once:true});
 });
 let counter=0;
 const pending=new Map();
 socket.addEventListener("message",event=>{
   const response=JSON.parse(event.data);
   if(!response.id || !pending.has(response.id))return;
   const callbacks=pending.get(response.id);
   pending.delete(response.id);
   if(response.error)callbacks.reject(Error(response.error.message));
   else callbacks.resolve(response.result);
 });
 function cdp(method,params={}){
   const id=++counter;
   return new Promise((resolve,reject)=>{
     pending.set(id,{resolve,reject});
     socket.send(JSON.stringify({id,method,params}));
   });
 }
 await cdp("Network.enable");
 socket.addEventListener("message",event=>{
   const packet=JSON.parse(event.data);
   if(packet.method==="Network.requestWillBeSent"){
     const url=packet.params.request.url;
     if(/^https?:/i.test(url))requested++;
   }
 });
 await cdp("Runtime.enable");
 await cdp("DOM.enable");
 let loaded=false;
 for(let i=0;i<80;i++){
   const read=await cdp("Runtime.evaluate",{
     expression:"JSON.stringify({url:location.href,ready:document.readyState,input:!!document.getElementById('current')})",
     returnByValue:true
   });
   if(read.result?.value){
     const state=JSON.parse(read.result.value);
     if(state.input && state.ready==="complete" && state.url===target){loaded=true;break;}
   }
   await sleep(125);
 }
 assert.ok(loaded,"Target page did not finish navigating with all inputs");
 const doc=await cdp("DOM.getDocument",{depth:1});
 if(runTwoFile&&!runFictionalSample){
   const toggle=await cdp("Runtime.evaluate",{
     expression:"document.getElementById('cost-only').click()",
     returnByValue:true
   });
   const state=await cdp("Runtime.evaluate",{
     expression:"JSON.stringify({checked:document.getElementById('cost-only').checked,disabled:document.getElementById('proposed').disabled})",
     returnByValue:true
   });
   assert.deepEqual(JSON.parse(state.result.value),{checked:true,disabled:true});
 }
 if(!runFictionalSample){
   const inputs={
     current:"fixtures/shopify-current-products.csv",
     supplier:useVendorMapping?"fixtures/supplier-custom-headers.csv":
       "fixtures/supplier-price-update.csv",
     ...(runTwoFile?{}:{proposed:"fixtures/shopify-proposed-products.csv"}),
   };
   for(const [name,relative] of Object.entries(inputs)){
     const found=await cdp("DOM.querySelector",{nodeId:doc.root.nodeId,selector:"#"+name});
     assert.ok(found.nodeId,"Missing browser input "+name);
     await cdp("DOM.setFileInputFiles",{
       nodeId:found.nodeId,files:[path.join(ROOT,relative)]
     });
   }
 }else{
   const button=await cdp("DOM.querySelector",{nodeId:doc.root.nodeId,selector:
     runTwoFile?"#use-two-file-demo-inputs":"#use-demo-inputs"});
   assert.ok(button.nodeId,"Missing one-click fictional sample button");
 }
 if(useVendorMapping){
   await cdp("Runtime.evaluate",{
     expression:"document.getElementById('show-supplier-headers').click()",
     returnByValue:true
   });
   let named=false;
   for(let i=0;i<20;i++){
     const entry=await cdp("Runtime.evaluate",{
       expression:"document.getElementById('supplier-header-list').textContent",
       returnByValue:true
     });
     if(entry.result.value?.includes("Vendor Ref")&&
        entry.result.value.includes("Net Unit Price")){
       named=true;
       break;
     }
     await sleep(40);
   }
   assert.ok(named,"Review page did not show exact fictional original vendor column names");
   await cdp("Runtime.evaluate",{
     expression:"document.getElementById('supplier-sku-column').value='Vendor Ref'; document.getElementById('supplier-cost-column').value='Net Unit Price';",
     returnByValue:true
   });
 }
 const beforeAuditRequestCount=requested;
 await cdp("Runtime.evaluate",{
   expression:runFictionalSample?(runTwoFile?
      "document.getElementById('use-two-file-demo-inputs').click()":
      "document.getElementById('use-demo-inputs').click()"):
      "document.getElementById('run').click()",
   returnByValue:true
 });
 let observed;
 for(let i=0;i<45;i++){
   const payload=await cdp("Runtime.evaluate",{
      expression:"JSON.stringify({status:document.getElementById('status').textContent,summary:document.getElementById('summary').textContent,shown:!document.getElementById('results').hidden,previewShown:!document.getElementById('review-preview').hidden,previewRows:[...document.querySelectorAll('#changed-fields-preview li')].map(e=>e.textContent),riskText:document.getElementById('import-risk-summary').textContent,marginText:document.getElementById('margin-overview').textContent,marginRows:[...document.querySelectorAll('#margin-rows li')].map(a=>a.textContent),marginShown:!document.getElementById('margin-panel').hidden,vendorMapping:document.getElementById('supplier-mapping-summary').textContent,reports:[...document.querySelectorAll('#reports a')].map(a=>a.download)})",
      returnByValue:true
   });
   observed=JSON.parse(payload.result.value);
   if(observed.reports.length===(runTwoFile?5:7))break;
   await sleep(100);
 }
 assert.equal(observed.shown,true);
 assert.equal(observed.reports.length,runTwoFile?5:7);
 assert.match(observed.summary,/Supplier matches: 3/);
 if(runTwoFile){
   assert.match(observed.summary,/Product change comparison: NOT RUN/);
 }else{
   assert.match(observed.summary,/Changed records: 2/);
 }
 assert.match(observed.summary,/Manual review: YES/);
 if(runTwoFile){
   assert.equal(observed.previewShown,false);
   assert.equal(observed.previewRows.length,0);
   assert.equal(observed.riskText,"");
 }else{
   assert.equal(observed.previewShown,true);
   assert.equal(observed.previewRows.length,2);
   assert.match(observed.previewRows[0],/TEE-BLK-M.*Price.*29.00.*31.00/);
   assert.match(observed.previewRows[1],/CAP-WOOL.*Inventory quantity.*7.*6/);
   assert.match(observed.riskText,/0 included cells changing to blank/);
 }
 assert.equal(observed.marginShown,true);
 assert.equal(observed.marginRows.length,3);
 assert.match(observed.marginRows[0],runTwoFile?/TEE-BLK-M.*58.62%/:/TEE-BLK-M.*61.29%/);
 assert.match(observed.marginText,/3 calculated/);
 if(runTwoFile){
   assert.match(observed.marginText,/TWO-FILE SUPPLIER COST REVIEW ONLY/);
   assert.ok(!observed.reports.includes("proposed-changes.csv"));
   assert.ok(!observed.reports.includes("preflight-proposed.csv"));
 }else{
   assert.match(observed.marginText,/THREE-FILE/);
   assert.ok(observed.reports.includes("proposed-changes.csv"));
 }
 assert.match(observed.marginText,/SAME-CURRENCY ASSUMED/);
 if(useVendorMapping){
   assert.match(observed.vendorMapping,/reviewer-confirmed mapping ONLY/);
   assert.match(observed.vendorMapping,/Vendor Ref/);
   assert.match(observed.vendorMapping,/Net Unit Price/);
 }else{
   assert.match(observed.vendorMapping,/no mappings guessed/i);
 }
 assert.ok(observed.reports.includes("supplier-margin-REVIEW-ONLY.csv"));
 assert.ok(observed.reports.includes("supplier-matches-NOT-SHOPIFY-IMPORT.csv"));
 assert.equal(requested,beforeAuditRequestCount,"The CSV audit triggered network requests");
 console.log("CHROME_END_TO_END_PASS",JSON.stringify({
   workflow:runFictionalSample?(runTwoFile?"one-click TWO-file fictional sample":"one-click THREE-file fictional sample"):
     (runTwoFile?"TWO user-selected CSVs":"THREE user-selected CSVs"),
   reports:observed.reports.length,summary:observed.summary,
   explicitVendorHeaderMapping:useVendorMapping,
   networkRequestsDuringAudit:requested-beforeAuditRequestCount
 }));
}finally{
 try{socket?.close();}catch{}
 chrome.kill("SIGTERM");
 await sleep(250);
 try{fs.rmSync(profile,{recursive:true,force:true});}catch{}
}
