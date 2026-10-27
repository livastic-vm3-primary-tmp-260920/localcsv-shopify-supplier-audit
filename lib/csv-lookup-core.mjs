/* LocalCSV Lab — safe browser-only, many-to-one CSV lookup join.
   This module does not access network, storage, DOM, advertising or analytics. */
import {parseCSV, detectDelimiter, stringifyCSV, MAX_INPUT_CHARS} from './csv-core.mjs';

const MAX_ROWS=20000;
const MAX_COLUMNS=200;
const keyValue=(value,caseSensitive)=>caseSensitive
  ? String(value??'').trim()
  : String(value??'').trim().toLocaleLowerCase('en');

export function readJoinCSV(text,label='CSV'){
  if(typeof text!=='string'||!text.trim())throw new Error(label+': paste a CSV or select a file.');
  if(text.length>MAX_INPUT_CHARS)throw new Error(label+': maximum 2 million characters.');
  const delimiter=detectDelimiter(text);
  const table=parseCSV(text,delimiter);
  if(!table.length||table[0].length<2)throw new Error(label+': include a header row with two or more named columns.');
  if(table[0].length>MAX_COLUMNS)throw new Error(label+': maximum 200 columns.');
  const headers=table[0].map(h=>String(h).trim());
  if(headers.some(h=>!h))throw new Error(label+': all header columns must be named.');
  const known=new Set();
  for(const h of headers){
    const normalized=h.toLocaleLowerCase('en');
    if(known.has(normalized))throw new Error(label+': duplicated column name '+h+'. Rename the duplicate.');
    known.add(normalized);
  }
  const records=[];
  let blankLines=0;
  for(let i=1;i<table.length;i++){
    const row=table[i];
    if(row.every(c=>String(c).trim()==='')){blankLines++;continue;}
    if(row.length!==headers.length)throw new Error(label+': row '+(i+1)+' has '+row.length+' cells; expected '+headers.length+'.');
    records.push({values:row,rowNumber:i+1});
    if(records.length>MAX_ROWS)throw new Error(label+': maximum 20,000 rows.');
  }
  if(!records.length)throw new Error(label+': no data rows.');
  return{headers,records,delimiter,blankLines};
}
export function suggestLookupKeys(primaryText,lookupText){
  const first=readJoinCSV(primaryText,'First CSV');
  const second=readJoinCSV(lookupText,'Lookup CSV');
  const candidates=['sku','id','product id','product_id','customer id','customer_id','email','handle','order id','order_id','key'];
  const firstKey=candidates.map(x=>first.headers.find(h=>h.toLocaleLowerCase('en')===x)).find(Boolean)||first.headers[0];
  const secondKey=second.headers.includes(firstKey)
    ?firstKey
    :second.headers.find(h=>h.toLocaleLowerCase('en')===firstKey.toLocaleLowerCase('en')) ||
       candidates.map(x=>second.headers.find(h=>h.toLocaleLowerCase('en')===x)).find(Boolean) ||
       second.headers[0];
  return{firstHeaders:first.headers,lookupHeaders:second.headers,firstKey,lookupKey:secondKey};
}
function makeUniqueNames(firstHeaders,secondHeaders,keyIndex){
  const names=[...firstHeaders];
  const used=new Set(firstHeaders.map(h=>h.toLocaleLowerCase('en')));
  const append=[];
  for(let i=0;i<secondHeaders.length;i++){
    if(i===keyIndex)continue;
    const original=secondHeaders[i];
    let chosen=original;
    if(used.has(chosen.toLocaleLowerCase('en'))){
      chosen=original+'_lookup';
      let num=2;
      while(used.has(chosen.toLocaleLowerCase('en')))chosen=original+'_lookup_'+num++;
    }
    names.push(chosen);
    used.add(chosen.toLocaleLowerCase('en'));
    append.push({source:i,sourceName:original,outputName:chosen});
  }
  if(names.length>MAX_COLUMNS)throw new Error('Output would exceed 200 columns. Remove unneeded fields.');
  return{headers:names,appended:append};
}
export function joinCSVByKey(primaryText,lookupText,{
  primaryKey,lookupKey,caseSensitive=true,mode='left'
}={}){
  if(!['left','inner'].includes(mode))throw new Error('Join mode must be left or inner.');
  const first=readJoinCSV(primaryText,'First CSV');
  const second=readJoinCSV(lookupText,'Lookup CSV');
  const aKey=primaryKey||first.headers[0];
  const bKey=lookupKey||second.headers[0];
  const aPos=first.headers.indexOf(aKey),bPos=second.headers.indexOf(bKey);
  if(aPos===-1)throw new Error('The first CSV does not contain the selected key: '+aKey);
  if(bPos===-1)throw new Error('The lookup CSV does not contain the selected key: '+bKey);
  const lookup=new Map();
  for(const row of second.records){
    const normalized=keyValue(row.values[bPos],caseSensitive);
    if(!normalized)throw new Error('Lookup CSV: blank key in row '+row.rowNumber+'. Every lookup key must identify one record.');
    if(lookup.has(normalized)){
      const old=lookup.get(normalized);
      throw new Error('Lookup CSV: duplicate key in rows '+old.rowNumber+' and '+row.rowNumber+'. Resolve duplicates instead of guessing.');
    }
    lookup.set(normalized,row);
  }
  const fields=makeUniqueNames(first.headers,second.headers,bPos);
  let matched=0,unmatched=0,blankPrimaryKeys=0,duplicatesInPrimary=0;
  const usedLookup=new Set(),seenLeft=new Set(),results=[fields.headers];
  const unmatchedRecords=[['csv_row',aKey,'reason']];
  for(const row of first.records){
    const original=String(row.values[aPos]??'');
    const normalized=keyValue(original,caseSensitive);
    if(!normalized)blankPrimaryKeys++;
    else if(seenLeft.has(normalized))duplicatesInPrimary++;
    else seenLeft.add(normalized);
    const found=normalized?lookup.get(normalized):null;
    if(found){
      matched++;
      usedLookup.add(normalized);
      results.push([...row.values,...fields.appended.map(field=>found.values[field.source])]);
    }else{
      unmatched++;
      unmatchedRecords.push([String(row.rowNumber),original,!normalized?'blank key':'not found in lookup']);
      if(mode==='left'){
        results.push([...row.values,...fields.appended.map(()=>'')]);
      }
    }
  }
  const unusedLookup=second.records.length-usedLookup.size;
  const metrics={
    primaryRows:first.records.length,lookupRows:second.records.length,
    matched,unmatched,outputRows:results.length-1,
    appendedColumns:fields.appended.length,
    renamedColumns:fields.appended.filter(x=>x.sourceName!==x.outputName).length,
    unusedLookup,blankPrimaryKeys,duplicatesInPrimary,
    ignoredBlankLines:first.blankLines+second.blankLines,
    mode
  };
  const notes=[
    'The first CSV remains the primary table. Rows are kept in the same original order.',
    'Lookup CSV keys must be unique and nonblank. Duplicate keys are rejected to avoid accidental row multiplication.',
    'Repeated keys in the first CSV are allowed: each matching row gets the lookup values.',
    'Leading/trailing spaces on keys are ignored, while all original cell text is preserved.',
    'Blank or missing keys in the first CSV never match; left mode keeps them and inner mode excludes them.',
    'Columns found in both files get a _lookup suffix instead of overwriting the first CSV.'
  ];
  return{
    csv:'\uFEFF'+stringifyCSV(results,',',true),
    unmatchedCSV:'\uFEFF'+stringifyCSV(unmatchedRecords,',',true),
    preview:results.slice(0,Math.min(11,results.length)),
    unmatchedPreview:unmatchedRecords.slice(0,21),
    renamed:fields.appended.filter(x=>x.sourceName!==x.outputName),
    metrics,notes,
    primaryKey:aKey,lookupKey:bKey,
    outputHeaders:fields.headers
  };
}
