import React, { useState } from 'react';
import { deleteBunkerReport, listBunkerReports, saveBunkerReport } from '../api/operations';
import { listMyVessels, listVessels } from '../api/fleet';

var KLINE_VESSELS = [
  'Global Highway','Texas Highway','Poseidon Highway','Nereus Highway',
  'Integrity Highway','Century Highway 2','Drive Green Highway','Victory Highway',
  'Courageous Highway','Majestic Highway','Excellence Highway','Grand Highway',
  'Pacific Highway','Atlantic Highway','Indian Highway','Oceanic Highway',
  'Arctic Highway','Typhoon Highway',
];

var FUEL_GRADES = [
  { code:'VLSFO', name:'VLSFO', desc:'Very Low Sulphur Fuel Oil (0.5% S)', color:'#ff8c42' },
  { code:'HFO', name:'HFO', desc:'Heavy Fuel Oil (3.5% S)', color:'#ff4560' },
  { code:'LSMGO', name:'LSMGO', desc:'Low Sulphur Marine Gas Oil (0.1% S)', color:'#ffd60a' },
  { code:'MGO', name:'MGO', desc:'Marine Gas Oil', color:'#ffd60a' },
  { code:'LNG', name:'LNG', desc:'Liquefied Natural Gas', color:'#00e896' },
  { code:'METHANOL', name:'Methanol', desc:'Methanol fuel', color:'#b06aff' },
  { code:'BIOFUEL', name:'Biofuel', desc:'B20/B30 Biofuel blend', color:'#69f0ae' },
];

var RoRo_PORTS = [
  'Bremerhaven','Zeebrugge','Southampton','Hamburg','Emden','Baltimore','Jacksonville',
  'Houston','Newark','Brunswick','Veracruz','Singapore','Dubai (Jebel Ali)',
  'Durban','Yokohama','Nagoya','Gothenburg','Rotterdam',
];

// eslint-disable-next-line no-unused-vars
var SEED_BUNKERS = [
  { id:'b1', vessel:'Global Highway', voyageNumber:'TBC', port:'Bremerhaven', berth:'Berth 12', grade:'VLSFO', quantity:1800, pricePerMT:620, totalCost:1116000, robBefore:420, robAfter:2180, supplier:'Bomin Bunker Oil', deliveryDate:'2024-05-08', notes:'Smooth delivery. Quality sample taken.' },
  { id:'b2', vessel:'Poseidon Highway', port:'Zeebrugge', berth:'ICO Berth 4', grade:'LNG', quantity:3200, pricePerMT:480, totalCost:1536000, robBefore:180, robAfter:3340, supplier:'Fluxys LNG', deliveryDate:'2024-05-07', notes:'LNG bunker via ship-to-ship. First LNG call this port.' },
  { id:'b3', vessel:'Texas Highway', port:'Baltimore', berth:'MAT Berth 2', grade:'VLSFO', quantity:2100, pricePerMT:638, totalCost:1339800, robBefore:280, robAfter:2340, supplier:'World Fuel Services', deliveryDate:'2024-05-06', notes:'Minor delay — barge late by 2h. ROB confirmed.' },
  { id:'b4', vessel:'Nereus Highway', port:'Houston', berth:'Bayport T1', grade:'LNG', quantity:2800, pricePerMT:465, totalCost:1302000, robBefore:150, robAfter:2910, supplier:'Stabilis Solutions', deliveryDate:'2024-05-05', notes:'Good delivery. No issues.' },
  { id:'b5', vessel:'Century Highway 2', port:'Southampton', berth:'WWTE Berth', grade:'MGO', quantity:180, pricePerMT:820, totalCost:147600, robBefore:40, robAfter:215, supplier:'Peninsula Petroleum', deliveryDate:'2024-05-04', notes:'MGO for manoeuvring only.' },
];

function fmtMoney(n) {
  if (n >= 1000000) return '$' + (n/1000000).toFixed(2) + 'M';
  return '$' + (n/1000).toFixed(0) + 'K';
}

function GradeTag(props) {
  var g = FUEL_GRADES.find(function(f){return f.code===props.grade;}) || FUEL_GRADES[0];
  return React.createElement('span', { style:{ fontSize:'9px', padding:'2px 7px', borderRadius:'3px', background:g.color+'22', color:g.color, border:'1px solid '+g.color+'44', fontWeight:700, letterSpacing:'0.5px' } }, g.name);
}

function voyageNumber(item) {
  return item && (item.voyageNumber || item.voyage_number) ? (item.voyageNumber || item.voyage_number) : 'TBC';
}

function VoyageBadge(props) {
  var value = voyageNumber(props.item);
  var pending = value === 'TBC';
  return React.createElement('span', { style:{ fontSize:'9px', padding:'2px 7px', borderRadius:'4px', background:pending?'rgba(255,214,10,.12)':'rgba(0,212,255,.16)', color:pending?'var(--yellow)':'var(--accent)', border:'1px solid '+(pending?'rgba(255,214,10,.45)':'rgba(0,212,255,.55)'), fontWeight:800, letterSpacing:'.5px', whiteSpace:'nowrap' } }, 'VOY '+value);
}

function emptyFuelLine(grade) {
  return { grade:grade || 'VLSFO', quantity:'', pricePerMT:'', robBefore:'', robAfter:'' };
}

var LNG_VESSELS = ['Poseidon Highway','Nereus Highway','Typhoon Highway'];

function vesselPropulsion(vesselName, vessels) {
  var vessel = (vessels || []).find(function(item){ return item && item.name === vesselName; });
  if (vessel && vessel.propulsion) return String(vessel.propulsion).toUpperCase();
  return LNG_VESSELS.includes(vesselName) ? 'LNG' : 'DIESEL';
}

function formForVessel(vesselName, vessels) {
  var isLng = vesselPropulsion(vesselName, vessels) === 'LNG';
  return {
    vessel:vesselName || KLINE_VESSELS[0],
    voyageNumber:'',
    port:'',
    berth:'',
    grade:isLng ? 'LNG' : 'VLSFO',
    quantity:'',
    pricePerMT:'',
    robBefore:'',
    robAfter:'',
    fuels:[emptyFuelLine('LSMGO')],
    supplier:'',
    deliveryDate:'',
    notes:'',
  };
}

function normalizeFuelLine(line) {
  var qty = parseFloat(line.quantity)||0;
  var price = parseFloat(line.pricePerMT)||0;
  return Object.assign({}, line, {
    quantity:qty,
    pricePerMT:price,
    robBefore:line.robBefore,
    robAfter:line.robAfter,
    totalCost:qty*price,
  });
}

function getFuelLines(bunker) {
  if (Array.isArray(bunker.fuels) && bunker.fuels.length) return bunker.fuels.map(normalizeFuelLine);
  return [normalizeFuelLine({
    grade:bunker.grade,
    quantity:bunker.quantity,
    pricePerMT:bunker.pricePerMT,
    robBefore:bunker.robBefore,
    robAfter:bunker.robAfter,
  })];
}

function bunkerTotalCost(bunker) {
  return getFuelLines(bunker).reduce(function(s,f){return s+f.totalCost;},0);
}

function bunkerTotalQty(bunker) {
  return getFuelLines(bunker).reduce(function(s,f){return s+f.quantity;},0);
}

export default function Bunkering() {
  var bs = useState([]); var bunkers = bs[0]; var setBunkers = bs[1];
  var vs = useState('log'); var view = vs[0]; var setView = vs[1];
  var fs = useState('all'); var filterVessel = fs[0]; var setFilterVessel = fs[1];
  var gs = useState('all'); var filterGrade = gs[0]; var setFilterGrade = gs[1];
  var scs = useState('all'); var vesselScope = scs[0]; var setVesselScope = scs[1];
  var ts = useState(null); var toast = ts[0]; var setToast = ts[1];
  var fvs = useState([]); var fleetVessels = fvs[0]; var setFleetVessels = fvs[1];
  var mvs = useState([]); var myVesselNames = mvs[0]; var setMyVesselNames = mvs[1];

  var EMPTY = formForVessel(KLINE_VESSELS[0], fleetVessels);
  var nfs = useState(EMPTY); var newForm = nfs[0]; var setNewForm = nfs[1];

  React.useEffect(function() {
    listBunkerReports().then(function(remote) {
      setBunkers(remote || []);
    }).catch(function() {});
  }, [setBunkers]);

  React.useEffect(function() {
    Promise.all([listVessels(), listMyVessels()]).then(function(results) {
      var remoteFleet = results[0] || [];
      var remoteMine = results[1] || [];
      setFleetVessels(remoteFleet);
      setMyVesselNames(remoteMine.map(function(vessel) { return vessel.name; }).filter(Boolean));
    }).catch(function() {});
  }, [setFleetVessels, setMyVesselNames]);

  React.useEffect(function() {
    function refreshFleetContext() {
      Promise.all([listVessels(), listMyVessels()]).then(function(results) {
        setFleetVessels(results[0] || []);
        setMyVesselNames((results[1] || []).map(function(vessel) { return vessel.name; }).filter(Boolean));
      }).catch(function() {});
    }
    window.addEventListener('focus', refreshFleetContext);
    return function() { window.removeEventListener('focus', refreshFleetContext); };
  }, [setFleetVessels, setMyVesselNames]);

  function setF(k,v) { setNewForm(function(f){ var n=Object.assign({},f); n[k]=v; return n; }); }
  function setBunkerVessel(vesselName) {
    setNewForm(function(f) {
      var defaults = formForVessel(vesselName, fleetVessels);
      return Object.assign({}, f, defaults, {
        voyageNumber:f.voyageNumber,
        port:f.port,
        berth:f.berth,
        supplier:f.supplier,
        deliveryDate:f.deliveryDate,
        notes:f.notes,
      });
    });
  }
  function setFuelLine(i,k,v) {
    setNewForm(function(f) {
      var fuels = f.fuels.map(function(line,idx) {
        return idx===i ? Object.assign({}, line, { [k]:v }) : line;
      });
      return Object.assign({}, f, { fuels:fuels });
    });
  }
  function addFuelLine() {
    setNewForm(function(f){ return Object.assign({}, f, { fuels:f.fuels.concat([emptyFuelLine('LSMGO')]) }); });
  }
  function removeFuelLine(i) {
    setNewForm(function(f) {
      if (f.fuels.length === 1) return f;
      return Object.assign({}, f, { fuels:f.fuels.filter(function(_,idx){return idx!==i;}) });
    });
  }
  async function deleteBunker(bunker) {
    if (!window.confirm('Delete bunker report for '+bunker.vessel+' on '+(bunker.deliveryDate || 'this date')+'?')) return;
    try {
      await deleteBunkerReport(bunker.id);
      setBunkers(function(prev){return prev.filter(function(b){return b.id!==bunker.id;});});
      setToast('Bunker report deleted - '+bunker.vessel);
    } catch(error) {
      setToast('Bunker report was not deleted - '+(error.message || 'shared sync failed'));
    }
    setTimeout(function(){setToast(null);},3000);
  }

  async function saveBunker() {
    var primaryFuel = {
      grade:newForm.grade,
      quantity:newForm.quantity,
      pricePerMT:newForm.pricePerMT,
      robBefore:newForm.robBefore,
      robAfter:newForm.robAfter,
    };
    var fuels = [primaryFuel].concat(newForm.fuels).map(normalizeFuelLine).filter(function(f){return f.quantity > 0 || f.pricePerMT > 0;});
    if (!fuels.length) fuels = [normalizeFuelLine(primaryFuel)];
    var primary = fuels[0];
    var b = Object.assign({}, newForm, {
      id:'b'+Date.now(),
      fuels:fuels,
      grade:primary.grade,
      quantity:fuels.reduce(function(s,f){return s+f.quantity;},0),
      pricePerMT:primary.pricePerMT,
      totalCost:fuels.reduce(function(s,f){return s+f.totalCost;},0),
      robBefore:primary.robBefore,
      robAfter:primary.robAfter,
    });
    setToast('Saving shared bunker report...');
    try {
      var savedBunker = await saveBunkerReport(b);
      setBunkers(function(prev){return [savedBunker].concat(prev);});
      setNewForm(formForVessel(KLINE_VESSELS[0], fleetVessels));
      setView('log');
      setToast('Bunker report saved - '+b.vessel+' - '+fuels.map(function(f){return f.grade;}).join(' + '));
    } catch(error) {
      setToast('Bunker report was not saved - '+(error.message || 'shared sync failed'));
    }
    setTimeout(function(){setToast(null);},3000);
  }

  var filtered = bunkers.filter(function(b) {
    if (vesselScope === 'my' && !myVesselNames.includes(b.vessel)) return false;
    if (filterVessel!=='all' && b.vessel!==filterVessel) return false;
    if (filterGrade!=='all' && !getFuelLines(b).some(function(f){return f.grade===filterGrade;})) return false;
    return true;
  });

  var totalSpend = filtered.reduce(function(s,b){return s+bunkerTotalCost(b);},0);
  var totalQty = filtered.reduce(function(s,b){return s+bunkerTotalQty(b);},0);
  var avgPrice = totalQty > 0 ? (totalSpend/totalQty).toFixed(0) : 0;

  var byGrade = {};
  bunkers.forEach(function(b) {
    getFuelLines(b).forEach(function(f) {
      if (!byGrade[f.grade]) byGrade[f.grade] = { qty:0, cost:0, count:0 };
      byGrade[f.grade].qty += f.quantity;
      byGrade[f.grade].cost += f.totalCost;
      byGrade[f.grade].count++;
    });
  });

  var inputStyle = { width:'100%', padding:'7px 10px', fontSize:'10px', background:'var(--s2)', border:'1px solid var(--b1)', color:'var(--text)', borderRadius:'var(--radius-sm)', outline:'none' };
  var labelStyle = { fontSize:'8px', color:'var(--t3)', letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:'4px', display:'block' };
  var thStyle = { color:'var(--t3)', fontSize:'8px', letterSpacing:'1.5px', textTransform:'uppercase', padding:'6px 8px', textAlign:'left', borderBottom:'1px solid var(--b1)', fontWeight:500, whiteSpace:'nowrap', background:'var(--s2)', position:'sticky', top:0 };
  var tdStyle = { padding:'8px', borderBottom:'1px solid rgba(30,48,72,.4)', fontSize:'10px', verticalAlign:'middle' };
  var vesselOptions = Array.from(new Set(KLINE_VESSELS.concat(fleetVessels.map(function(v){return v && v.name;}).filter(Boolean))));

  return React.createElement('div', { style:{ height:'100%', display:'flex', flexDirection:'column', overflow:'hidden' } },

    toast && React.createElement('div', { style:{ position:'fixed', bottom:'20px', right:'20px', background:'var(--s1)', border:'1px solid var(--green)', borderRadius:'8px', padding:'12px 18px', fontSize:'11px', color:'var(--green)', zIndex:9999 } }, '✓ '+toast),

    React.createElement('div', { style:{ padding:'10px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0, borderBottom:'1px solid var(--b1)', flexWrap:'wrap', gap:'8px' } },
      React.createElement('div', null,
        React.createElement('div', { style:{ fontFamily:'var(--syne)', fontSize:'16px', fontWeight:700 } }, 'Bunkering'),
        React.createElement('div', { style:{ fontSize:'10px', color:'var(--t2)', marginTop:'2px' } }, bunkers.length+' bunker operations · Total: '+fmtMoney(bunkers.reduce(function(s,b){return s+bunkerTotalCost(b);},0)))
      ),
      React.createElement('div', { style:{ display:'flex', gap:'8px' } },
        React.createElement('div', { style:{ display:'flex', background:'var(--s2)', border:'1px solid var(--b1)', borderRadius:'var(--radius-sm)' } },
          [['log','Log'],['new','+ New Report'],['summary','Summary']].map(function(item) {
            return React.createElement('button', { key:item[0], onClick:function(){setView(item[0]);}, style:{ background:view===item[0]?'var(--accent)':'none', border:'none', color:view===item[0]?'#000':'var(--t2)', fontSize:'9px', padding:'5px 11px', borderRadius:'var(--radius-sm)', cursor:'pointer', whiteSpace:'nowrap' } }, item[1]);
          })
        )
      )
    ),

    view === 'new' ? (
      React.createElement('div', { style:{ flex:1, overflowY:'auto', padding:'16px' } },
        React.createElement('div', { style:{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' } },
          React.createElement('div', { style:{ fontFamily:'var(--syne)', fontSize:'15px', fontWeight:700 } }, 'New Bunker Report'),
          React.createElement('div', { style:{ display:'flex', gap:'8px' } },
            React.createElement('button', { onClick:function(){setView('log');}, style:{ background:'none', border:'1px solid var(--b1)', color:'var(--t2)', fontSize:'10px', padding:'6px 12px', borderRadius:'var(--radius-sm)', cursor:'pointer' } }, 'Cancel'),
            React.createElement('button', { onClick:saveBunker, style:{ background:'var(--accent)', border:'none', color:'#000', fontSize:'10px', fontWeight:700, padding:'6px 14px', borderRadius:'var(--radius-sm)', cursor:'pointer' } }, 'Save Report')
          )
        ),

        React.createElement('div', { style:{ background:'var(--s1)', border:'1px solid var(--b1)', borderRadius:'var(--radius)', padding:'16px', marginBottom:'12px' } },
          React.createElement('div', { style:{ fontFamily:'var(--syne)', fontSize:'10px', fontWeight:700, letterSpacing:'2px', color:'var(--t2)', marginBottom:'14px' } }, 'VESSEL & LOCATION'),
          React.createElement('div', { style:{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px', marginBottom:'10px' } },
            React.createElement('div', null,
              React.createElement('label', { style:labelStyle }, 'VESSEL *'),
              React.createElement('select', { style:inputStyle, value:newForm.vessel, onChange:function(e){setBunkerVessel(e.target.value);} },
                vesselOptions.map(function(v){return React.createElement('option',{key:v,value:v},v);})
              )
            ),
            React.createElement('div', null,
              React.createElement('label', { style:labelStyle }, 'VOYAGE NUMBER *'),
              React.createElement('input', { style:inputStyle, value:newForm.voyageNumber, onChange:function(e){setF('voyageNumber',e.target.value);}, placeholder:'e.g. 026E' })
            ),
            React.createElement('div', null,
              React.createElement('label', { style:labelStyle }, 'BUNKERING PORT *'),
              React.createElement('select', { style:inputStyle, value:newForm.port, onChange:function(e){setF('port',e.target.value);} },
                React.createElement('option', { value:'' }, '-- Select port --'),
                RoRo_PORTS.map(function(p){return React.createElement('option',{key:p,value:p},p);})
              )
            ),
            React.createElement('div', null,
              React.createElement('label', { style:labelStyle }, 'BERTH / LOCATION'),
              React.createElement('input', { style:inputStyle, value:newForm.berth, onChange:function(e){setF('berth',e.target.value);}, placeholder:'e.g. Berth 12 or Anchorage' })
            )
          ),
          React.createElement('div', { style:{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' } },
            React.createElement('div', null,
              React.createElement('label', { style:labelStyle }, 'DELIVERY DATE'),
              React.createElement('input', { type:'date', style:inputStyle, value:newForm.deliveryDate, onChange:function(e){setF('deliveryDate',e.target.value);} })
            ),
            React.createElement('div', null,
              React.createElement('label', { style:labelStyle }, 'SUPPLIER / TRADER'),
              React.createElement('input', { style:inputStyle, value:newForm.supplier, onChange:function(e){setF('supplier',e.target.value);}, placeholder:'e.g. World Fuel Services' })
            )
          )
        ),

        React.createElement('div', { style:{ background:'var(--s1)', border:'1px solid var(--b1)', borderRadius:'var(--radius)', padding:'16px', marginBottom:'12px' } },
          React.createElement('div', { style:{ fontFamily:'var(--syne)', fontSize:'10px', fontWeight:700, letterSpacing:'2px', color:'var(--t2)', marginBottom:'14px' } }, 'FUEL & QUANTITY'),
          React.createElement('div', { style:{ display:'grid', gridTemplateColumns:'minmax(360px,1fr) minmax(320px,.8fr)', gap:'10px', marginBottom:'14px' } },
            React.createElement('div', { style:{ padding:'12px', background:'var(--s2)', border:'1px solid var(--b1)', borderRadius:'var(--radius-sm)' } },
              React.createElement('label', { style:labelStyle }, 'PRIMARY FUEL GRADE *'),
              React.createElement('div', { style:{ display:'flex', gap:'8px', flexWrap:'wrap', marginTop:'4px' } },
                FUEL_GRADES.map(function(g) {
                  var sel = newForm.grade === g.code;
                  return React.createElement('div', { key:g.code, onClick:function(){setF('grade',g.code);}, style:{ padding:'8px 12px', borderRadius:'6px', cursor:'pointer', border:'1px solid '+(sel?g.color:'var(--b1)'), background:sel?g.color+'22':'var(--s1)', transition:'all .15s' } },
                    React.createElement('div', { style:{ fontSize:'11px', fontWeight:700, color:sel?g.color:'var(--text)', marginBottom:'2px' } }, g.name),
                    React.createElement('div', { style:{ fontSize:'8px', color:'var(--t3)' } }, g.desc)
                  );
                })
              )
            ),
            newForm.fuels[0] && React.createElement('div', { style:{ padding:'12px', background:'var(--s2)', border:'1px solid var(--b1)', borderRadius:'var(--radius-sm)' } },
              React.createElement('label', { style:labelStyle }, 'SECOND FUEL GRADE *'),
              React.createElement('div', { style:{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', alignItems:'end' } },
                React.createElement('div', { style:{ gridColumn:'1 / -1' } },
                  React.createElement('select', { style:inputStyle, value:newForm.fuels[0].grade, onChange:function(e){setFuelLine(0,'grade',e.target.value);} },
                    FUEL_GRADES.map(function(g){return React.createElement('option',{key:g.code,value:g.code},g.name);})
                  )
                ),
                React.createElement('div', null,
                  React.createElement('label', { style:labelStyle }, 'QTY MT'),
                  React.createElement('input', { type:'number', min:0, style:inputStyle, value:newForm.fuels[0].quantity, onChange:function(e){setFuelLine(0,'quantity',e.target.value);}, placeholder:'e.g. 120' })
                ),
                React.createElement('div', null,
                  React.createElement('label', { style:labelStyle }, 'PRICE / MT'),
                  React.createElement('input', { type:'number', min:0, style:inputStyle, value:newForm.fuels[0].pricePerMT, onChange:function(e){setFuelLine(0,'pricePerMT',e.target.value);}, placeholder:'e.g. 820' })
                ),
                React.createElement('div', null,
                  React.createElement('label', { style:labelStyle }, 'ROB BEFORE'),
                  React.createElement('input', { type:'number', min:0, style:inputStyle, value:newForm.fuels[0].robBefore, onChange:function(e){setFuelLine(0,'robBefore',e.target.value);}, placeholder:'MT' })
                ),
                React.createElement('div', null,
                  React.createElement('label', { style:labelStyle }, 'ROB AFTER'),
                  React.createElement('input', { type:'number', min:0, style:inputStyle, value:newForm.fuels[0].robAfter, onChange:function(e){setFuelLine(0,'robAfter',e.target.value);}, placeholder:'MT' })
                )
              ),
              React.createElement('div', { style:{ marginTop:'8px', padding:'8px 10px', background:'rgba(0,212,255,.06)', border:'1px solid rgba(0,212,255,.2)', borderRadius:'var(--radius-sm)', fontSize:'11px', fontFamily:'var(--syne)', fontWeight:700, color:'var(--accent)' } },
                newForm.fuels[0].quantity && newForm.fuels[0].pricePerMT ? 'Total '+fmtMoney((parseFloat(newForm.fuels[0].quantity)||0)*(parseFloat(newForm.fuels[0].pricePerMT)||0)) : 'Total -'
              )
            )
          ),
          React.createElement('div', { style:{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px', marginBottom:'10px' } },
            React.createElement('div', null,
              React.createElement('label', { style:labelStyle }, 'QUANTITY (MT) *'),
              React.createElement('input', { type:'number', min:0, style:inputStyle, value:newForm.quantity, onChange:function(e){setF('quantity',e.target.value);}, placeholder:'e.g. 1800' })
            ),
            React.createElement('div', null,
              React.createElement('label', { style:labelStyle }, 'PRICE PER MT (USD) *'),
              React.createElement('input', { type:'number', min:0, style:inputStyle, value:newForm.pricePerMT, onChange:function(e){setF('pricePerMT',e.target.value);}, placeholder:'e.g. 620' })
            ),
            React.createElement('div', null,
              React.createElement('label', { style:labelStyle }, 'TOTAL COST (AUTO)'),
              React.createElement('div', { style:{ padding:'8px 10px', background:'rgba(0,212,255,.06)', border:'1px solid rgba(0,212,255,.2)', borderRadius:'var(--radius-sm)', fontSize:'12px', fontFamily:'var(--syne)', fontWeight:700, color:'var(--accent)' } },
                newForm.quantity && newForm.pricePerMT ? fmtMoney(parseFloat(newForm.quantity)*parseFloat(newForm.pricePerMT)) : '—'
              )
            )
          ),
          React.createElement('div', { style:{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' } },
            React.createElement('div', null,
              React.createElement('label', { style:labelStyle }, 'ROB BEFORE (MT)'),
              React.createElement('input', { type:'number', min:0, style:inputStyle, value:newForm.robBefore, onChange:function(e){setF('robBefore',e.target.value);}, placeholder:'Remaining on board before' })
            ),
            React.createElement('div', null,
              React.createElement('label', { style:labelStyle }, 'ROB AFTER (MT)'),
              React.createElement('input', { type:'number', min:0, style:inputStyle, value:newForm.robAfter, onChange:function(e){setF('robAfter',e.target.value);}, placeholder:'Remaining on board after' })
            )
          ),
          React.createElement('div', { style:{ marginTop:'14px', borderTop:'1px solid var(--b1)', paddingTop:'12px' } },
            React.createElement('div', { style:{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'10px', marginBottom:newForm.fuels.length > 1?'10px':'0' } },
              React.createElement('div', null,
                React.createElement('div', { style:{ fontSize:'9px', color:'var(--t2)', letterSpacing:'1.5px', textTransform:'uppercase' } }, 'Other fuels'),
                React.createElement('div', { style:{ fontSize:'9px', color:'var(--t3)', marginTop:'3px' } }, 'The two default fuel grades are visible above. Add another delivered grade only when needed.')
              ),
              React.createElement('button', { onClick:addFuelLine, style:{ background:'none', border:'1px solid var(--accent)', color:'var(--accent)', fontSize:'9px', padding:'5px 10px', borderRadius:'var(--radius-sm)', cursor:'pointer', whiteSpace:'nowrap' } }, '+ Add Fuel')
            ),
            newForm.fuels.slice(1).map(function(fuel,extraIdx) {
              var idx = extraIdx + 1;
              var lineTotal = (parseFloat(fuel.quantity)||0) * (parseFloat(fuel.pricePerMT)||0);
              return React.createElement('div', { key:idx, style:{ display:'grid', gridTemplateColumns:'1.1fr .9fr .9fr .9fr .9fr .9fr auto', gap:'8px', alignItems:'end', marginTop:'8px', padding:'10px', background:'var(--s2)', border:'1px solid var(--b1)', borderRadius:'var(--radius-sm)' } },
                React.createElement('div', null,
                  React.createElement('label', { style:labelStyle }, 'GRADE'),
                  React.createElement('select', { style:inputStyle, value:fuel.grade, onChange:function(e){setFuelLine(idx,'grade',e.target.value);} },
                    FUEL_GRADES.map(function(g){return React.createElement('option',{key:g.code,value:g.code},g.name);})
                  )
                ),
                React.createElement('div', null,
                  React.createElement('label', { style:labelStyle }, 'QTY MT'),
                  React.createElement('input', { type:'number', min:0, style:inputStyle, value:fuel.quantity, onChange:function(e){setFuelLine(idx,'quantity',e.target.value);}, placeholder:'e.g. 120' })
                ),
                React.createElement('div', null,
                  React.createElement('label', { style:labelStyle }, 'PRICE / MT'),
                  React.createElement('input', { type:'number', min:0, style:inputStyle, value:fuel.pricePerMT, onChange:function(e){setFuelLine(idx,'pricePerMT',e.target.value);}, placeholder:'e.g. 820' })
                ),
                React.createElement('div', null,
                  React.createElement('label', { style:labelStyle }, 'ROB BEFORE'),
                  React.createElement('input', { type:'number', min:0, style:inputStyle, value:fuel.robBefore, onChange:function(e){setFuelLine(idx,'robBefore',e.target.value);}, placeholder:'MT' })
                ),
                React.createElement('div', null,
                  React.createElement('label', { style:labelStyle }, 'ROB AFTER'),
                  React.createElement('input', { type:'number', min:0, style:inputStyle, value:fuel.robAfter, onChange:function(e){setFuelLine(idx,'robAfter',e.target.value);}, placeholder:'MT' })
                ),
                React.createElement('div', null,
                  React.createElement('label', { style:labelStyle }, 'TOTAL'),
                  React.createElement('div', { style:{ padding:'8px 10px', background:'rgba(0,212,255,.06)', border:'1px solid rgba(0,212,255,.2)', borderRadius:'var(--radius-sm)', fontSize:'11px', fontFamily:'var(--syne)', fontWeight:700, color:'var(--accent)', minHeight:'31px' } }, lineTotal > 0 ? fmtMoney(lineTotal) : '-')
                ),
                React.createElement('button', { onClick:function(){removeFuelLine(idx);}, style:{ background:'none', border:'1px solid var(--b1)', color:'var(--t3)', fontSize:'9px', padding:'7px 9px', borderRadius:'var(--radius-sm)', cursor:'pointer' } }, 'Remove')
              );
            })
          )
        ),

        React.createElement('div', { style:{ background:'var(--s1)', border:'1px solid var(--b1)', borderRadius:'var(--radius)', padding:'14px', marginBottom:'12px' } },
          React.createElement('label', { style:labelStyle }, 'NOTES / REMARKS'),
          React.createElement('textarea', { style:{ width:'100%', minHeight:'70px', resize:'vertical', padding:'8px 10px', fontSize:'10px', lineHeight:'1.5', background:'var(--s2)', border:'1px solid var(--b1)', color:'var(--text)', borderRadius:'var(--radius-sm)', outline:'none' }, value:newForm.notes, onChange:function(e){setF('notes',e.target.value);}, placeholder:'Quality sample taken · Delivery conditions · Any issues · Surveyor name...' })
        ),

        React.createElement('div', { style:{ display:'flex', gap:'10px' } },
          React.createElement('button', { onClick:saveBunker, style:{ background:'var(--accent)', border:'none', color:'#000', fontFamily:'var(--syne)', fontSize:'11px', fontWeight:700, padding:'10px 24px', borderRadius:'var(--radius)', cursor:'pointer' } }, 'Save Bunker Report'),
          React.createElement('button', { onClick:function(){setView('log');}, style:{ background:'none', border:'1px solid var(--b1)', color:'var(--t2)', fontSize:'10px', padding:'10px 16px', borderRadius:'var(--radius)', cursor:'pointer' } }, 'Cancel')
        )
      )

    ) : view === 'summary' ? (
      React.createElement('div', { style:{ flex:1, overflowY:'auto', padding:'16px' } },
        React.createElement('div', { style:{ fontFamily:'var(--syne)', fontSize:'15px', fontWeight:700, marginBottom:'14px' } }, 'Bunkering Summary'),
        React.createElement('div', { style:{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'10px', marginBottom:'14px' } },
          [
            ['Total Spend',fmtMoney(bunkers.reduce(function(s,b){return s+bunkerTotalCost(b);},0)),'var(--accent)'],
            ['Total Quantity',bunkers.reduce(function(s,b){return s+bunkerTotalQty(b);},0).toLocaleString()+' MT','var(--text)'],
            ['Avg Price','$'+( bunkers.reduce(function(s,b){return s+bunkerTotalCost(b);},0) / Math.max(1,bunkers.reduce(function(s,b){return s+bunkerTotalQty(b);},0)) ).toFixed(0)+'/MT','var(--yellow)'],
            ['Operations',bunkers.length,'var(--green)'],
          ].map(function(item) {
            return React.createElement('div', { key:item[0], style:{ background:'var(--s1)', border:'1px solid var(--b1)', borderRadius:'var(--radius)', padding:'14px' } },
              React.createElement('div', { style:{ fontSize:'9px', color:'var(--t3)', letterSpacing:'1.5px', marginBottom:'6px' } }, item[0]),
              React.createElement('div', { style:{ fontSize:'20px', fontFamily:'var(--syne)', fontWeight:700, color:item[2] } }, item[1])
            );
          })
        ),
        React.createElement('div', { style:{ background:'var(--s1)', border:'1px solid var(--b1)', borderRadius:'var(--radius)', padding:'16px', marginBottom:'14px' } },
          React.createElement('div', { style:{ fontSize:'10px', color:'var(--t2)', letterSpacing:'2px', marginBottom:'12px' } }, 'BY FUEL GRADE'),
          React.createElement('div', { style:{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:'10px' } },
            Object.keys(byGrade).map(function(code) {
              var g = FUEL_GRADES.find(function(f){return f.code===code;}) || { name:code, color:'var(--t2)', desc:'' };
              var d = byGrade[code];
              var avgP = d.qty > 0 ? (d.cost/d.qty).toFixed(0) : 0;
              return React.createElement('div', { key:code, style:{ background:'var(--s2)', border:'1px solid '+g.color+'44', borderRadius:'var(--radius)', padding:'12px', borderLeft:'3px solid '+g.color } },
                React.createElement('div', { style:{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' } },
                  React.createElement('span', { style:{ fontFamily:'var(--syne)', fontSize:'13px', fontWeight:700, color:g.color } }, g.name),
                  React.createElement('span', { style:{ fontSize:'9px', color:'var(--t3)' } }, d.count+' lines')
                ),
                React.createElement('div', { style:{ fontSize:'11px', marginBottom:'3px' } }, d.qty.toLocaleString()+' MT'),
                React.createElement('div', { style:{ fontSize:'11px', color:'var(--accent)', marginBottom:'3px' } }, fmtMoney(d.cost)),
                React.createElement('div', { style:{ fontSize:'10px', color:'var(--t2)' } }, '$'+avgP+'/MT avg')
              );
            })
          )
        )
      )

    ) : (
      React.createElement('div', { style:{ flex:1, overflowY:'auto', padding:'16px' } },
        React.createElement('div', { style:{ display:'flex', gap:'8px', marginBottom:'14px', flexWrap:'wrap', alignItems:'center' } },
          React.createElement('span', { style:{ fontSize:'9px', color:'var(--t3)', letterSpacing:'1px' } }, 'FILTER:'),
          React.createElement('div', { style:{ display:'flex', background:'var(--s2)', border:'1px solid var(--b1)', borderRadius:'4px', overflow:'hidden' } },
            [['all','All Vessels'],['my','My Vessels']].map(function(item) {
              return React.createElement('button', {
                key:item[0],
                onClick:function(){setVesselScope(item[0]);},
                style:{ background:vesselScope===item[0]?'var(--accent)':'transparent', border:'none', color:vesselScope===item[0]?'#000':'var(--t2)', fontSize:'9px', padding:'6px 9px', cursor:'pointer', fontWeight:700, whiteSpace:'nowrap' }
              }, item[1]);
            })
          ),
          React.createElement('select', { style:{ padding:'5px 8px', fontSize:'9px', background:'var(--s2)', border:'1px solid var(--b1)', color:'var(--text)', borderRadius:'4px', outline:'none' }, value:filterVessel, onChange:function(e){setFilterVessel(e.target.value);} },
            React.createElement('option', { value:'all' }, 'All Vessels'),
            vesselOptions.map(function(v){return React.createElement('option',{key:v,value:v},v);})
          ),
          React.createElement('select', { style:{ padding:'5px 8px', fontSize:'9px', background:'var(--s2)', border:'1px solid var(--b1)', color:'var(--text)', borderRadius:'4px', outline:'none' }, value:filterGrade, onChange:function(e){setFilterGrade(e.target.value);} },
            React.createElement('option', { value:'all' }, 'All Grades'),
            FUEL_GRADES.map(function(g){return React.createElement('option',{key:g.code,value:g.code},g.name);})
          ),
          filtered.length > 0 && React.createElement('div', { style:{ marginLeft:'auto', fontSize:'10px', color:'var(--t2)' } },
            filtered.length+' records · '+fmtMoney(totalSpend)+' total · $'+avgPrice+'/MT avg · '+totalQty.toLocaleString()+' MT'
          )
        ),

        filtered.length === 0 ? (
          React.createElement('div', { style:{ textAlign:'center', padding:'40px', color:'var(--t3)' } },
            React.createElement('div', { style:{ fontSize:'28px', marginBottom:'10px' } }, '⛽'),
            React.createElement('div', { style:{ fontFamily:'var(--syne)', fontSize:'13px', color:'var(--t2)' } }, 'No bunker records match filters')
          )
        ) : (
          React.createElement('table', { style:{ width:'100%', borderCollapse:'collapse', fontSize:'10px' } },
            React.createElement('thead', null,
              React.createElement('tr', null,
                ['Date','Vessel / Voyage','Port / Berth','Fuel 1','Fuel 2','Qty MT','$/MT','Total Cost','Actions','ROB Before','ROB After','Supplier','Notes'].map(function(h) {
                  return React.createElement('th', { key:h, style:thStyle }, h);
                })
              )
            ),
            React.createElement('tbody', null,
              filtered.map(function(b) {
                var fuels = getFuelLines(b);
                var firstFuel = fuels[0];
                var secondFuel = fuels[1];
                var otherFuels = fuels.slice(2);
                var totalCost = bunkerTotalCost(b);
                var totalQuantity = bunkerTotalQty(b);
                return React.createElement('tr', { key:b.id,
                  onMouseEnter:function(e){e.currentTarget.style.background='rgba(0,212,255,.02)';},
                  onMouseLeave:function(e){e.currentTarget.style.background='';},
                },
                  React.createElement('td', { style:Object.assign({},tdStyle,{color:'var(--t3)',whiteSpace:'nowrap'}) }, b.deliveryDate),
                  React.createElement('td', { style:Object.assign({},tdStyle,{fontWeight:500,color:'var(--text)',whiteSpace:'nowrap'}) },
                    React.createElement('div', null, b.vessel),
                    React.createElement('div', { style:{ marginTop:'3px' } }, React.createElement(VoyageBadge, { item:b }))
                  ),
                  React.createElement('td', { style:tdStyle },
                    React.createElement('div', null, b.port),
                    b.berth && React.createElement('div', { style:{ fontSize:'9px', color:'var(--t3)', marginTop:'1px' } }, b.berth)
                  ),
                  React.createElement('td', { style:Object.assign({},tdStyle,{minWidth:'92px'}) },
                    React.createElement(GradeTag, { grade:firstFuel.grade }),
                    React.createElement('div', { style:{ fontSize:'8px', color:'var(--t3)', marginTop:'4px', lineHeight:1.4 } },
                      firstFuel.quantity.toLocaleString()+' MT',
                      firstFuel.pricePerMT ? ' / $'+firstFuel.pricePerMT : ''
                    )
                  ),
                  React.createElement('td', { style:Object.assign({},tdStyle,{minWidth:'108px'}) },
                    secondFuel ? React.createElement(React.Fragment, null,
                      React.createElement(GradeTag, { grade:secondFuel.grade }),
                      React.createElement('div', { style:{ fontSize:'8px', color:'var(--t3)', marginTop:'4px', lineHeight:1.4 } },
                        secondFuel.quantity.toLocaleString()+' MT',
                        secondFuel.pricePerMT ? ' / $'+secondFuel.pricePerMT : ''
                      ),
                      otherFuels.length > 0 && React.createElement('div', { style:{ display:'flex', gap:'4px', flexWrap:'wrap', marginTop:'5px' } },
                        otherFuels.map(function(f,idx){return React.createElement(GradeTag, { key:f.grade+idx, grade:f.grade });})
                      )
                    ) : React.createElement('span', { style:{ color:'var(--t3)' } }, '-')
                  ),
                  React.createElement('td', { style:Object.assign({},tdStyle,{color:'var(--text)',fontWeight:500}) },
                    totalQuantity.toLocaleString(),
                    fuels.length > 1 && React.createElement('div', { style:{ fontSize:'8px', color:'var(--t3)', marginTop:'2px', lineHeight:1.4 } }, fuels.map(function(f){return f.grade+': '+f.quantity.toLocaleString();}).join(' / '))
                  ),
                  React.createElement('td', { style:Object.assign({},tdStyle,{color:'var(--yellow)'}) },
                    fuels.length === 1 ? '$'+fuels[0].pricePerMT : 'Mixed',
                    fuels.length > 1 && React.createElement('div', { style:{ fontSize:'8px', color:'var(--t3)', marginTop:'2px', lineHeight:1.4 } }, fuels.map(function(f){return f.grade+': $'+f.pricePerMT;}).join(' / '))
                  ),
                  React.createElement('td', { style:Object.assign({},tdStyle,{color:'var(--accent)',fontWeight:600}) }, fmtMoney(totalCost)),
                  React.createElement('td', { style:Object.assign({},tdStyle,{whiteSpace:'nowrap'}) },
                    React.createElement('button', {
                      onClick:function(){deleteBunker(b);},
                      style:{ background:'rgba(255,69,96,.08)', border:'1px solid rgba(255,69,96,.35)', color:'var(--red)', fontSize:'9px', padding:'5px 9px', borderRadius:'var(--radius-sm)', cursor:'pointer' }
                    }, 'Delete')
                  ),
                  React.createElement('td', { style:Object.assign({},tdStyle,{color:'var(--t2)'}) },
                    fuels.map(function(f){return f.robBefore ? f.grade+': '+f.robBefore+' MT' : null;}).filter(Boolean).join(' / ') || '—'
                  ),
                  React.createElement('td', { style:Object.assign({},tdStyle,{color:'var(--t2)'}) },
                    fuels.map(function(f){return f.robAfter ? f.grade+': '+f.robAfter+' MT' : null;}).filter(Boolean).join(' / ') || '—'
                  ),
                  React.createElement('td', { style:Object.assign({},tdStyle,{color:'var(--t2)',fontSize:'9px'}) }, b.supplier||'—'),
                  React.createElement('td', { style:Object.assign({},tdStyle,{color:'var(--t2)',fontSize:'9px',maxWidth:'160px'}) }, b.notes||'—')
                );
              })
            )
          )
        )
      )
    )
  );
}
