(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./engine.js'):root.MenuWiseEngine);if(typeof module==='object'&&module.exports)module.exports=api;else root.MenuWiseDecisions=api;})(globalThis,function(E){
  'use strict';
  const modelVersion='2.0';
  const currency=n=>E.money(Math.round(n));
  function best(alts){return alts.filter(a=>a.feasible&&Number.isFinite(a.delta)).reduce((b,a)=>!b||a.delta>b.delta+.005?a:b,null);}
  function defaults(type,data,id){const d=data.dishes.find(x=>x.id===id)||data.dishes[0],sample=data.source==='sample';
    if(type==='menu')return{dishId:d.id,saving:sample?.5:0,improveCost:sample?200:0,extraQty:sample?130:0,promoteCost:sample?300:0,relatedLoss:0,replacement:0,replacementMinutes:0,exitCost:0};
    if(type==='pricing')return{dishId:d.id,priceA:d.price+(sample?2:0),qtyA:sample&&d.id==='beef'?1470:d.qty,extraA:sample?200:0,priceB:Math.max(0,d.price-(sample?2:0)),qtyB:sample&&d.id==='beef'?1800:d.qty,extraB:sample?600:0,sensitivity:10};
    if(type==='breakeven')return{target:data.settings.target,reduction:sample?2000:0,increase:10};
    return{days:data.settings.days,daysKnown:data.settings.daysKnown!==false,capacity:data.settings.capacity,capacityKnown:data.settings.capacityKnown!==false,extraMinutes:60,extraCost:sample?80:0,bounds:Object.fromEntries(data.dishes.map(d=>[d.id,{minutes:d.minutes,timeKnown:d.timeKnown!==false,demand:d.demand,demandKnown:d.demandKnown!==false,min:d.min}]))};
  }
  function run(type,data,p){
    const base=E.totals(data),known=E.completeness(data),r={type,modelVersion,config:E.clone(p),base,known,alternatives:[],data:E.clone(data)};
    const finish=()=>{r.alternatives=r.alternatives.map(a=>({...a,profit:known.fixed?a.profit:null,verified:a.verified??known.operations}));r.best=best(r.alternatives);return r;};
    if(type==='pricing'){
      const d=data.dishes.find(d=>d.id===p.dishId);if(!d)throw new Error('未找到所选菜品。');
      if(!Number.isFinite(p.sensitivity)||p.sensitivity<0||p.sensitivity>100)throw new Error('销量超出允许范围或精度。');
      r.alternatives=[{id:'keep',...E.priceScenario(data,d.id,{price:d.price,qty:d.qty})},{id:'priceA',...E.priceScenario(data,d.id,{price:p.priceA,qty:p.qtyA,extra:p.extraA})},{id:'priceB',...E.priceScenario(data,d.id,{price:p.priceB,qty:p.qtyB,extra:p.extraB})}];
      r.sensitivity=[-p.sensitivity,0,p.sensitivity].map(change=>({change,...E.priceScenario(data,d.id,{price:p.priceA,qty:Math.round(p.qtyA*(1+change/100)),extra:p.extraA})}));return finish();
    }
    if(type==='menu'){
      const m=E.menuDecision(data,p.dishId,p);Object.assign(r,{freedMinutes:m.freedMinutes,lostContribution:m.lostContribution});r.alternatives=m.alternatives.map((a,i)=>({...a,id:['keep','improve','promote','drop'][i]}));return finish();
    }
    if(type==='breakeven'){
      r.cvp=[{id:'current',...E.cvp(data,p.target)},{id:'fixedReduction',...E.cvp(data,p.target,p.reduction)},{id:'costStress',...E.cvp(data,p.target,0,p.increase)}];
      r.optimizer=E.optimize(data);r.recommendation=r.cvp[0].status==='incomplete'?'needFixed':!['ok','flat','boundary'].includes(r.cvp[0].status)?'fixMargin':!r.cvp[0].feasible?'changeMix':!known.operations?'verifyOperations':'testTarget';return r;
    }
    if(type==='capacity'){
      if(!Number.isFinite(p.extraMinutes)||p.extraMinutes<0||p.extraMinutes%0.5!==0||!Number.isFinite(p.extraCost)||p.extraCost<0||p.extraCost>1e6||Math.abs(p.extraCost*100-Math.round(p.extraCost*100))>1e-6)throw new Error('扩容费用或时间超出允许范围或精度。');
      if(p.capacity+p.extraMinutes>10000)throw new Error('每日瓶颈产能须为 0–10,000 分钟，按 0.5 分钟计。');
      const target=E.clone(data);target.settings.capacity=p.capacity;target.settings.capacityKnown=p.capacityKnown;target.settings.days=p.days??data.settings.days;target.settings.daysKnown=p.daysKnown!==false;
      target.dishes.forEach(d=>{if(!p.bounds?.[d.id])throw new Error('请先确认营业日、产能、菜品用时和需求上限。');Object.assign(d,p.bounds[d.id]);});
      r.constraintData=target;r.known={...E.completeness(target),fixed:known.fixed};
      r.optimizer=E.optimize(target,p.capacity);r.expanded=E.optimize(target,p.capacity+p.extraMinutes);
      const baseline=E.priceScenario(target,target.dishes[0].id,{price:target.dishes[0].price,qty:target.dishes[0].qty});
      r.alternatives=[{id:'historic',...baseline,profit:base.profit,delta:0},...[[r.optimizer,'optimized',0],[r.expanded,'expanded',p.extraCost]].map(([o,id,cost])=>({id,profit:o.status==='optimal'?currency(E.cents(o.monthlyProfit)-E.cents(cost)*target.settings.days):null,delta:o.status==='optimal'?currency(E.cents(o.monthlyProfit)-E.cents(cost)*target.settings.days-E.cents(base.profit)):null,feasible:o.status==='optimal',verified:o.status==='optimal',violations:o.status==='optimal'?[]:[o.reason]}))];
      r.incrementalCapacity=r.optimizer.status==='optimal'&&r.expanded.status==='optimal'?{dailyContribution:currency(E.cents(r.expanded.contribution)-E.cents(r.optimizer.contribution)),dailyNet:currency(E.cents(r.expanded.contribution)-E.cents(r.optimizer.contribution)-E.cents(p.extraCost)),monthlyNet:currency((E.cents(r.expanded.contribution)-E.cents(r.optimizer.contribution)-E.cents(p.extraCost))*target.settings.days)}:null;
      r.alternatives=r.alternatives.map(a=>({...a,profit:known.fixed?a.profit:null}));r.best=best(r.alternatives.filter(a=>a.verified));return r;
    }
    throw new Error('Unknown decision module');
  }
  function simulation(data,type,p,value){
    if(type==='pricing')return E.priceScenario(data,p.dishId,{price:p.priceA,qty:value,extra:p.extraA});
    if(type==='breakeven'){const t=E.totals(data);return{revenue:value,contribution:t.cmRatio===null?null:value*t.cmRatio,profit:E.completeness(data).fixed&&t.cmRatio!==null?value*t.cmRatio-t.fixed:null};}
  }
  function snapshot(type,data,config,title=''){const result=run(type,data,config);return{id:'decision-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),type,title,created:new Date().toISOString(),data:E.clone(data),config:E.clone(config),modelVersion,result,status:'planned',actuals:null,stepsDone:[]};}
  function restore(raw){
    if(!raw||![1,2].includes(raw.schemaVersion)||!raw.data||E.validate(raw.data).errors.length||!Array.isArray(raw.scenarios)||raw.scenarios.length>50)throw new Error('Invalid backup');
    const state={schemaVersion:2,data:E.clone(raw.data),lang:raw.lang==='zh'?'zh':'en',mode:raw.mode==='advanced'?'advanced':'basic',started:!!raw.started,configs:{},scenarios:[]};
    const ids=new Set();for(const s of raw.scenarios){if(!s||typeof s.id!=='string'||ids.has(s.id)||!['menu','pricing','breakeven','capacity'].includes(s.type)||!Number.isFinite(Date.parse(s.created))||!s.data||E.validate(s.data).errors.length||!s.config)throw new Error('Invalid backup');ids.add(s.id);const config={...defaults(s.type,s.data,s.config.dishId),...s.config};
      if(s.type==='capacity'){config.capacityKnown=config.capacityKnown!==false;config.bounds=Object.fromEntries(s.data.dishes.map(d=>[d.id,{minutes:d.minutes,timeKnown:d.timeKnown!==false,demand:d.demand,demandKnown:d.demandKnown!==false,min:d.min,...s.config.bounds?.[d.id]}]));}
      const result=run(s.type,s.data,config);const actuals=s.actuals&&Number.isFinite(s.actuals.revenue)&&Number.isFinite(s.actuals.variable)&&Number.isFinite(s.actuals.fixed)&&[s.actuals.revenue,s.actuals.variable,s.actuals.fixed].every(v=>v>=0)?{...s.actuals}:null;
      state.scenarios.push({id:s.id,type:s.type,title:typeof s.title==='string'?s.title.slice(0,120):'',created:s.created,data:E.clone(s.data),config,modelVersion:s.modelVersion||'1.0',result,status:['planned','testing','reviewed'].includes(s.status)?s.status:'planned',actuals,stepsDone:(s.stepsDone||raw.plans?.[s.id]||[]).filter(i=>Number.isInteger(i)&&i>=0&&i<3),legacy:s.modelVersion!=='2.0'});
    }
    for(const type of ['menu','pricing','breakeven','capacity'])if(raw.configs?.[type])try{const p={...defaults(type,state.data,raw.configs[type].dishId),...raw.configs[type]};if(type==='capacity')p.bounds=Object.fromEntries(state.data.dishes.map(d=>[d.id,{minutes:d.minutes,timeKnown:d.timeKnown!==false,demand:d.demand,demandKnown:d.demandKnown!==false,min:d.min,...p.bounds?.[d.id]}]));run(type,state.data,p);state.configs[type]=p;}catch{}
    return state;
  }
  return{modelVersion,best,defaults,run,simulation,snapshot,restore};
});
