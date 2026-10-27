/* LocalCSV Lab — pure Shopify product CSV preflight diagnostics.
   Reads text only. Does not send data or perform a Shopify import. */
import {parseCSV, stringifyCSV, MAX_INPUT_CHARS} from './csv-core.mjs';

const MAX_ROWS=20000, MAX_COLUMNS=200, MAX_FINDINGS=3000;
const HEADER=['severity','csv_row','handle','sku','field','problem','suggested_review'];
const FIELD_ALIASES={
 handle:['URL handle','Handle'],
 title:['Title'],
 sku:['SKU','Variant SKU'],
 price:['Price','Variant Price'],
 compare:['Compare-at price','Variant Compare-at Price'],
 tracker:['Inventory tracker','Variant Inventory Tracker'],
 quantity:['Inventory quantity','Variant Inventory Qty'],
 image:['Product image URL','Image Src'],
 position:['Image position','Image Position'],
 opt1n:['Option1 name','Option1 Name'],
 opt1v:['Option1 value','Option1 Value'],
 opt2n:['Option2 name','Option2 Name'],
 opt2v:['Option2 value','Option2 Value'],
 opt3n:['Option3 name','Option3 Name'],
 opt3v:['Option3 value','Option3 Value']
};

function normalize(name) {return name.trim().toLowerCase();}
function currency(text) {
  const value=String(text??'').trim();
  if(!value)return null;
  if(!/^\d+(?:\.\d+)?$/.test(value))return NaN;
  return Number(value);
}
function resolveHeaders(headers) {
  const index=new Map();
  for(const [i,header] of headers.entries()) {
    const normalized=normalize(header);
    if(!normalized)throw new Error('Every CSV column header must be named.');
    if(index.has(normalized))throw new Error('Repeated header: '+header+' (column '+(i+1)+'). Rename it first.');
    index.set(normalized,i);
  }
  const field={};
  for(const [role,names] of Object.entries(FIELD_ALIASES)) {
    const matched=[...new Set(names.map(name=>normalize(name)).filter(name=>index.has(name)))];
    if(matched.length>1)throw new Error('Conflicting old and new Shopify columns for '+role+'. Keep one version.');
    field[role]=matched.length ? index.get(matched[0]) : -1;
  }
  return field;
}
export function inspectShopifyProductCSV(csvText,{mode='update'}={}) {
  if(mode!=='create'&&mode!=='update')throw new Error('Choose create or update mode.');
  if(typeof csvText!=='string'||!csvText.trim())throw new Error('Paste or load the product CSV first.');
  if(csvText.length>MAX_INPUT_CHARS)throw new Error('CSV exceeds the 2 million character limit.');
  // Shopify documents comma separated product imports. Do not auto-detect semicolon here.
  const rows=parseCSV(csvText,',');
  if(rows.length<2)throw new Error('CSV must contain a header row and at least one data row.');
  const headers=rows[0].map(x=>x.trim().replace(/^\uFEFF/,''));
  if(headers.length>MAX_COLUMNS)throw new Error('More than 200 columns; split the file before validating.');
  const field=resolveHeaders(headers);
  if(field.title===-1)throw new Error('Required product column missing: Title.');
  if(mode==='update'&&field.handle===-1)throw new Error('Product update imports require a URL handle or legacy Handle column.');
  if(rows.length-1>MAX_ROWS)throw new Error('More than 20,000 rows; split the export before checking.');
  const findings=[];
  let countErrors=0,countWarnings=0,countInfo=0,skipped=0,variantRows=0;
  const handles=new Map(), skuRows=new Map(), variantSignatures=new Map(), imagePositions=new Map();
  const add=(severity,row,handle,sku,sourceField,problem,review)=>{
    if(severity==='ERROR')countErrors++;
    else if(severity==='WARNING')countWarnings++;
    else countInfo++;
    if(findings.length<MAX_FINDINGS)findings.push([severity,String(row||''),handle||'',sku||'',sourceField||'',problem,review]);
  };
  const column=role=>field[role]===-1?'':headers[field[role]];
  const has=role=>field[role]!==-1;
  const get=(cells,role)=>has(role)?String(cells[field[role]]??'').trim():'';
  const importantVariantCols=['sku','price','compare','tracker','quantity'].filter(has);
  const hasVariantFields=importantVariantCols.length>0;
  if(mode==='update'&&hasVariantFields&&(!has('opt1n')||!has('opt1v'))){
    add('ERROR',1,'','',column('sku')||column('price')||column('quantity'),
        'Variant-related updates need Option1 name and Option1 value columns.',
        'Export a full product CSV and preserve both option columns before updating variants.');
  }
  if(mode==='create'&&hasVariantFields&&(!has('opt1n')||!has('opt1v'))){
    add('WARNING',1,'','',column('sku')||column('price'),
        'Variant-related fields found without both Option1 columns.',
        'Confirm whether each product is simple or has variants before importing.');
  }
  for(let i=1;i<rows.length;i++){
    const cells=rows[i], number=i+1;
    if(cells.length===1 && !cells[0].trim()){skipped++;continue;}
    if(cells.length!==headers.length){
      add('ERROR',number,'','','CSV columns',
          'Field count '+cells.length+' does not match '+headers.length+' header columns.',
          'Inspect quoting, embedded commas and field delimiters in the source row.');
      continue;
    }
    const handle=get(cells,'handle'),sku=get(cells,'sku'),title=get(cells,'title');
    const image=get(cells,'image');
    const optionValues=['opt1v','opt2v','opt3v'].map(role=>get(cells,role));
    const hasOptions=optionValues.some(Boolean);
    const variantFieldsFilled=importantVariantCols.some(role=>get(cells,role)!=='')||hasOptions;
    const imageOnly=!!(handle&&image&&!title&&!variantFieldsFilled);
    if(variantFieldsFilled)variantRows++;
    if(!handle){
      if(mode==='update'||image||variantFieldsFilled){
        add('ERROR',number,'',sku,column('handle')||'URL handle',
            'Missing product handle on a variant, image or update row.',
            'Use the exact URL handle from a current Shopify product export.');
      }else if(mode==='create'&&title){
        add('INFO',number,'',sku,'URL handle',
            'Title-only product: Shopify can generate a handle on new single-product imports.',
            'If adding variants or additional images, include a stable URL handle.');
      }
    } else {
      if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(handle)){
        add('WARNING',number,handle,sku,column('handle'),
            'Handle includes characters outside lowercase letters, digits and single hyphens.',
            'Review the handle before importing; use a stable URL-safe value.');
      }
      const group=handles.get(handle)||{rows:[],titles:0};
      group.rows.push(number);
      if(title)group.titles++;
      handles.set(handle,group);
    }
    if(imageOnly) {
      // Shopify permits image-only rows with the same handle and blank title / variant values.
    } else if(variantFieldsFilled) {
      for(let j=1;j<=3;j++){
        const name=get(cells,'opt'+j+'n'),value=get(cells,'opt'+j+'v');
        if(name&&!value) {
          add('WARNING',number,handle,sku,column('opt'+j+'v')||('Option'+j+' value'),
              'Option'+j+' name is present but its value is blank on this variant row.',
              'Check that the variant is identified by the intended option value.');
        } else if(value&&!name) {
          add('WARNING',number,handle,sku,column('opt'+j+'n')||('Option'+j+' name'),
              'Option'+j+' value is present without its option name.',
              'Include the matching option name or review this variant row.');
        }
      }
      if(handle&&has('opt1v')&&optionValues[0]){
        const signature=JSON.stringify([handle,...optionValues.map(x=>x.toLowerCase())]);
        if(variantSignatures.has(signature)){
          add('WARNING',number,handle,sku,column('opt1v'),
              'Possible repeated variant option combination; previously seen at row '+variantSignatures.get(signature)+'.',
              'Verify distinct variant option combinations within the same product.');
        }else variantSignatures.set(signature,number);
      }
    }
    if(sku){
      if(skuRows.has(sku)){
        add('WARNING',number,handle,sku,column('sku'),
            'SKU also appears at CSV row '+skuRows.get(sku)+'.',
            'Check whether the same SKU was unintentionally assigned to multiple variants.');
      } else skuRows.set(sku,number);
    }
    if(has('price')&&get(cells,'price')){
      const value=currency(get(cells,'price'));
      if(!Number.isFinite(value)){
        add('ERROR',number,handle,sku,column('price'),
            'Price is not a plain nonnegative decimal number.',
            'Remove currency symbols and thousand separators; use e.g. 19.99.');
      }
    }
    if(has('compare')&&get(cells,'compare')){
      const list=currency(get(cells,'compare')),sale=currency(get(cells,'price'));
      if(!Number.isFinite(list)){
        add('ERROR',number,handle,sku,column('compare'),
            'Compare-at price is not a plain nonnegative decimal number.',
            'Use a plain price such as 29.99 or leave the field empty.');
      }else if(Number.isFinite(sale)&&list<=sale) {
        add('WARNING',number,handle,sku,column('compare'),
            'Compare-at price is not greater than the regular price.',
            'Review the intended discount; a compare-at price usually exceeds the price.');
      }
    }
    if(has('quantity')&&get(cells,'quantity')){
      const quantity=get(cells,'quantity');
      if(!/^-?\d+$/.test(quantity)){
        add('ERROR',number,handle,sku,column('quantity'),
            'Inventory quantity is not an integer.',
            'Use a whole number and confirm your Shopify inventory location setup.');
      }
      if(!get(cells,'tracker')) {
        add('WARNING',number,handle,sku,column('quantity'),
            'Quantity is supplied without an inventory tracker.',
            'Check if the product should track inventory and whether this file is appropriate for your store.');
      }
    } else if(get(cells,'tracker')&&!get(cells,'quantity')&&has('quantity')){
      add('WARNING',number,handle,sku,column('quantity'),
          'Inventory tracker is set, but the quantity cell is blank.',
          'Verify required quantities and multi-location inventory import requirements.');
    }
    if(image){
      let parsed;
      try{parsed=new URL(image);}catch{/* invalid URL */}
      if(!parsed||!['https:','http:'].includes(parsed.protocol)||!parsed.hostname){
        add('ERROR',number,handle,sku,column('image'),
            'Image URL is not an absolute HTTP(S) URL.',
            'Use an accessible absolute image URL; local file paths are not supported.');
      }else if(parsed.protocol!=='https:'){
        add('WARNING',number,handle,sku,column('image'),
            'Image URL is HTTP rather than HTTPS.',
            'Prefer a publicly accessible HTTPS image URL before import.');
      }else if(/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(parsed.hostname)){
        add('WARNING',number,handle,sku,column('image'),
            'Image host appears private or local and might not be reachable by Shopify.',
            'Use a public HTTPS address; this checker never fetches image URLs.');
      }
      if(handle&&has('position')&&get(cells,'position')){
        const pos=get(cells,'position');
        if(!/^[1-9]\d*$/.test(pos)){
          add('WARNING',number,handle,sku,column('position'),
              'Image position should be a positive whole number.',
              'Check the order of images for this product.');
        }else{
          const signature=handle+'|'+pos;
          if(imagePositions.has(signature)){
            add('WARNING',number,handle,sku,column('position'),
                'Image position duplicates row '+imagePositions.get(signature)+' for this handle.',
                'Review the order of product images before importing.');
          }else imagePositions.set(signature,number);
        }
      }
    }
  }
  for(const [handle,group] of handles){
    if(group.titles===0){
      add('WARNING',group.rows[0],handle,'',column('title'),
          'No nonempty Title value appears for this handle in the submitted file.',
          'For a product create/update import, verify the parent product row and title.');
    }
  }
  const count=countErrors+countWarnings+countInfo;
  const metrics={totalRows:rows.length-1-skipped,products:handles.size,variantRows,
    errors:countErrors,warnings:countWarnings,info:countInfo,issueCount:count,
    shown:findings.length,truncated:Math.max(0,count-findings.length),
    blankRows:skipped,mode};
  const notices=[
    'This is a preflight diagnostic, not Shopify import validation or a guarantee.',
    'Existing products may be overwritten or variants changed when dependent columns are missing; always back up and test one or two products.',
    'No image URLs were fetched and no Shopify account was accessed.',
    'A WARNING is a review item, not necessarily a Shopify upload error.'
  ];
  const exportRows=[HEADER,...findings];
  // Spreadsheet programs can execute data cells as formulas. Protect every report data row.
  const csv='\uFEFF'+stringifyCSV(exportRows,',',true);
  return{metrics,findings,notices,csv,headers,columns:field};
}
