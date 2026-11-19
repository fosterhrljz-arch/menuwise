(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./engine.js'):root.MenuWiseEngine,typeof module==='object'&&module.exports?require('./import.js'):root.MenuWiseImport);if(typeof module==='object'&&module.exports)module.exports=api;else root.MenuWiseData=api;})(globalThis,function(E,I){
  'use strict';
  class InputError extends Error { constructor(code,args={}){super(code);this.code=code;this.args=args;} }
  const fail=(code,args)=>{throw new InputError(code,args);};
  const fields=['name','price','variableCost','qty','food','packaging','labor','other','feeRate','minutes','demand','min','avoidable'];
  const aliases={name:['name','dish','dish name','item','item name','product','菜品','菜名','品名','商品名称'],price:['price','selling price','unit price','售价','单价','销售价'],variableCost:['variable cost','unit variable cost','unit cost','cost per portion','variableCost','单位变动成本','单份变动成本','单份成本','变动成本'],qty:['qty','quantity','volume','sales volume','units sold','monthly portions','monthly sales','月销量','销量','销售数量'],food:['food','ingredient cost','food cost','食材成本','原料成本'],packaging:['packaging','packaging cost','包装成本','包装费'],labor:['labor','labour','piece labor','piece-rate labor','计件人工','计件工资'],other:['other','other variable cost','其他变动成本'],feeRate:['feeRate','commission','commission %','commission percent','fee rate','抽成百分比','抽成比例','平台费率'],minutes:['minutes','prep time','bottleneck minutes','minutes per portion','单份瓶颈分钟','制作分钟','制作时间'],demand:['demand','daily demand','demand cap','max daily','daily demand cap','每日需求上限','日需求上限'],min:['min','minimum','daily minimum','minimum supply','每日最低供应','最低供应'],avoidable:['avoidable','avoidable fixed cost','avoidable monthly fixed cost','月可避免固定成本','可避免固定成本']};
  const norm=s=>String(s??'').trim().toLowerCase().replace(/[\s_\-()%（）％/]+/g,'');
  function inferMapping(headers){const mapping={},ambiguous=[];for(const key of fields){const names=aliases[key].map(norm),matches=headers.map((h,i)=>names.includes(norm(h))?i:-1).filter(i=>i>=0);mapping[key]=matches.length===1?matches[0]:-1;if(matches.length>1)ambiguous.push(key);}return{mapping,ambiguous};}
  function delimiter(text){let quoted=false,line='';for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){i++;continue;}quoted=!quoted;}if(!quoted&&(c==='\n'||c==='\r'))break;if(!quoted)line+=c;}return[',',';','\t'].sort((a,b)=>line.split(b).length-line.split(a).length)[0];}
  function parse(text){try{return I.parseCSV(text,delimiter(text));}catch{fail('csvMalformed');}}
  function number(raw,key,row,style='dot'){
    if(raw===null||raw===undefined||String(raw).trim()==='')fail('missingCell',{field:key,row});
    if(typeof raw==='object')fail('formulaCell',{row});
    if(typeof raw==='number'){if(!Number.isFinite(raw)||raw<0)fail('numericCell',{field:key,row});return raw;}
    let s=String(raw).trim().replace(/^[¥￥$€£]\s*/,'').replace(/\s*[¥￥$€£]$/,'').replace(/[\u00a0\u202f]/g,'');
    if(key==='feeRate')s=s.replace(/[%％]$/,'');
    const valid=style==='comma'?/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d+)?$/:/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/;
    if(!valid.test(s))fail('numericCell',{field:key,row});
    const n=Number(style==='comma'?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,''));
    if(!Number.isFinite(n)||n<0)fail('numericCell',{field:key,row});return n;
  }
  function prepare(rows,current,options={}){
    const headerIndex=options.headerIndex||0,headers=(rows[headerIndex]||[]).map(x=>typeof x==='object'?'':String(x??''));
    const inferred=inferMapping(headers),mapping=options.mapping||inferred.mapping;
    const body=rows.slice(headerIndex+1).filter(row=>row.some(v=>v!==null&&v!==undefined&&String(v).trim()!==''));
    if(!body.length)fail('emptyImport');if(body.length>40)fail('tooManyDishes');
    for(const k of ['name','price','qty'])if(mapping[k]===undefined||mapping[k]<0)fail('mappingRequired',{field:k});
    const assigned=Object.values(mapping).filter(v=>v>=0);if(new Set(assigned).size!==assigned.length)fail('duplicateMapping');
    const hasTotal=mapping.variableCost>=0,hasDetail=['food','packaging','labor','other'].some(k=>mapping[k]>=0);
    if(!hasTotal&&!hasDetail)fail('costRequired');
    if(hasTotal&&hasDetail&&!options.costMode)fail('costConflict');
    const costMode=options.costMode||(hasTotal?'total':'detailed');
    if(costMode==='total'&&!hasTotal||costMode==='detailed'&&!hasDetail)fail('costRequired');
    const defaults=new Set(),dishes=body.map((row,i)=>{
      const rowNum=headerIndex+i+2,get=(key,optional=false)=>{const raw=mapping[key]>=0?row[mapping[key]]:undefined;if(raw===undefined||raw===null||String(raw).trim()===''){if(optional){defaults.add(key);return null;}fail('missingCell',{field:key,row:rowNum});}return number(raw,key,rowNum,options.numberStyle||'dot');};
      const rawName=row[mapping.name];if(typeof rawName==='object')fail('formulaCell',{row:rowNum});if(!String(rawName??'').trim())fail('missingCell',{field:'name',row:rowNum});
      const d={id:'import-'+i,name:String(rawName).trim(),price:get('price'),qty:get('qty'),costMode,variableCost:0,food:0,packaging:0,labor:0,other:0};
      if(costMode==='total')d.variableCost=get('variableCost');else for(const k of ['food','packaging','labor','other'])d[k]=get(k,true)??0;
      if(costMode==='detailed'&&!['food','packaging','labor','other'].some(k=>mapping[k]>=0&&row[mapping[k]]!==undefined&&row[mapping[k]]!==null&&String(row[mapping[k]]).trim()!==''))fail('costRequired',{row:rowNum});
      for(const k of ['feeRate','min','avoidable'])d[k]=get(k,true)??0;
      const minutes=get('minutes',true),demand=get('demand',true);d.minutes=minutes??0;d.timeKnown=minutes!==null;d.demand=demand??0;d.demandKnown=demand!==null;return d;
    });
    const settings=E.clone(current.settings),resetSample=current.source==='sample'&&!options.keepSampleSettings;
    if(resetSample)Object.assign(settings,{name:'My restaurant',autoName:true,commonFixed:0,capacity:0,days:1,target:0,fixedKnown:false,capacityKnown:false,daysKnown:false});
    const data={...E.clone(current),schemaVersion:2,settings,dishes,source:'imported',revision:(current.revision||0)+1,importDefaults:[...defaults],importName:options.filename||''};
    const check=E.validate(data);if(check.errors.length){const e=new Error(check.errors.join('\n'));e.engine=true;throw e;}
    return{data,defaults:[...defaults],resetSample,warnings:check.warnings,costMode};
  }
  function blank(){return{schemaVersion:2,source:'manual',revision:1,settings:{name:'My restaurant',autoName:true,days:1,daysKnown:false,commonFixed:0,fixedKnown:false,capacity:0,capacityKnown:false,target:0},dishes:[{id:'dish-1',name:'',price:null,qty:null,costMode:'total',variableCost:null,food:0,packaging:0,labor:0,other:0,feeRate:0,minutes:0,timeKnown:false,demand:0,demandKnown:false,min:0,avoidable:0}]};}
  function baseCost(d){return E.unit(d).baseCost;}
  function template(data,lang='en',mode='basic'){
    const basic=['name','price','variableCost','qty'],keys=mode==='basic'?basic:fields;
    const titles={en:{name:'Dish',price:'Price',variableCost:'Unit variable cost',qty:'Monthly portions',food:'Food cost',packaging:'Packaging cost',labor:'Piece-rate labor',other:'Other variable cost',feeRate:'Commission %',minutes:'Bottleneck minutes',demand:'Daily demand cap',min:'Daily minimum',avoidable:'Avoidable monthly fixed cost'},zh:{...Object.fromEntries(I.columns),variableCost:'单位变动成本'}};
    // Advanced template uses total base cost; component columns are omitted to avoid ambiguity.
    const chosen=keys.filter(k=>!['food','packaging','labor','other'].includes(k));
    return [chosen.map(k=>titles[lang][k]),...data.dishes.map(d=>chosen.map(k=>k==='variableCost'?baseCost(d):k==='minutes'&&d.timeKnown===false||k==='demand'&&d.demandKnown===false?'':d[k]))];
  }
  return{InputError,fail,fields,aliases,inferMapping,parse,number,prepare,blank,baseCost,template};
});
