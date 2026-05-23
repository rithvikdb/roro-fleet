import React, { useState } from 'react';

var VOYAGES = [
  { id:'V-2401', route:'Bremerhaven-Baltimore', vessel:'Global Highway', laneCapacity:7500, cargoLoaded:6900, revenue:1240000, bunkerCost:182000, portCosts:48000, crew:31200, other:22400, propulsion:'DIESEL' },
  { id:'V-2402', route:'Zeebrugge-Brunswick', vessel:'Texas Highway', laneCapacity:7500, cargoLoaded:7100, revenue:1180000, bunkerCost:174000, portCosts:44000, crew:29800, other:21200, propulsion:'DIESEL' },
  { id:'V-2403', route:'Emden-Jacksonville', vessel:'Poseidon Highway', laneCapacity:7000, cargoLoaded:6650, revenue:1090000, bunkerCost:161000, portCosts:42000, crew:28400, other:19800, propulsion:'LNG' },
  { id:'V-2404', route:'Bremerhaven-Veracruz', vessel:'Nereus Highway', laneCapacity:7000, cargoLoaded:6300, revenue:980000, bunkerCost:148000, portCosts:40000, crew:26800, other:18600, propulsion:'LNG' },
  { id:'V-2405', route:'Southampton-Baltimore', vessel:'Integrity Highway', laneCapacity:6500, cargoLoaded:6100, revenue:920000, bunkerCost:138000, portCosts:38000, crew:25200, other:17400, propulsion:'DIESEL' },
  { id:'V-2406', route:'Zeebrugge-Houston', vessel:'Century Highway 2', laneCapacity:6500, cargoLoaded:5900, revenue:880000, bunkerCost:132000, portCosts:36000, crew:24200, other:16800, propulsion:'DIESEL' },
  { id:'V-2407', route:'Hamburg-Newark', vessel:'Drive Green Highway', laneCapacity:7500, cargoLoaded:7350, revenue:1320000, bunkerCost:196000, portCosts:52000, crew:33400, other:24200, propulsion:'DIESEL' },
  { id:'V-2408', route:'Bremerhaven-Baltimore', vessel:'Typhoon Highway', laneCapacity:7500, cargoLoaded:7200, revenue:1280000, bunkerCost:188000, portCosts:50000, crew:32000, other:23000, propulsion:'LNG' },
];

// Internal source values are converted for display.

var LM_PER_KXX = 1.25;
var LM_PER_RT = 1.0;

function lmToUnit(lm, unit) {
  if (unit === 'KXX') return (lm / LM_PER_KXX).toFixed(1) + ' Kxx';
  if (unit === 'RT') return (lm / LM_PER_RT).toFixed(0) + ' RT';
  return (lm / LM_PER_KXX).toFixed(1) + ' Kxx';
}

function revenueToUnit(usd, lm, unit) {
  // Revenue per unit
  if (unit === 'KXX') return '$' + (usd / (lm / LM_PER_KXX)).toFixed(0) + '/Kxx';
  if (unit === 'RT') return '$' + (usd / (lm / LM_PER_RT)).toFixed(0) + '/RT';
  return '$' + (usd / (lm / LM_PER_KXX)).toFixed(0) + '/Kxx';
}

function fmtMoney(n) {
  if (n >= 1000000) return '$' + (n/1000000).toFixed(2) + 'M';
  return '$' + (n/1000).toFixed(0) + 'K';
}

function fc(p) {
  if (p >= 90) return 'var(--green)';
  if (p >= 70) return 'var(--yellow)';
  return 'var(--red)';
}

function VoyageBadge(props) {
  return React.createElement('span', { style:{ fontSize:'9px', padding:'2px 7px', borderRadius:'4px', background:'rgba(0,212,255,.16)', color:'var(--accent)', border:'1px solid rgba(0,212,255,.55)', fontWeight:800, letterSpacing:'.5px', whiteSpace:'nowrap' } }, 'VOY '+props.value);
}

export default function CharterPnL() {
  var us = useState('KXX'); var unit = us[0]; var setUnit = us[1];

  var voyages = VOYAGES.map(function(v) {
    var totalCost = v.bunkerCost + v.portCosts + v.crew + v.other;
    var profit = v.revenue - totalCost;
    var margin = profit / v.revenue * 100;
    var util = Math.round(v.cargoLoaded / v.laneCapacity * 100);
    return Object.assign({}, v, { totalCost:totalCost, profit:profit, margin:margin, util:util });
  });

  var totalRev = voyages.reduce(function(s,v){return s+v.revenue;},0);
  var totalCost = voyages.reduce(function(s,v){return s+v.totalCost;},0);
  var totalProfit = totalRev - totalCost;
  var avgMargin = (totalProfit/totalRev*100).toFixed(1);
  var totalLM = voyages.reduce(function(s,v){return s+v.cargoLoaded;},0);
  var totalCapLM = voyages.reduce(function(s,v){return s+v.laneCapacity;},0);
  var fleetUtil = Math.round(totalLM/totalCapLM*100);

  var unitDesc = {
    KXX: 'Kxx commercial freight billing unit used in charter parties',
    RT: 'Revenue Tonne, standard shipping billing unit',
  };

  var unitExplain = {
    KXX: function(lm){ return (lm/LM_PER_KXX).toFixed(1)+' Kxx'; },
    RT: function(lm){ return (lm/LM_PER_RT).toFixed(0)+' RT'; },
  };

  var thStyle = { color:'var(--t3)', fontSize:'8px', letterSpacing:'1.5px', textTransform:'uppercase', padding:'6px 8px', textAlign:'left', borderBottom:'1px solid var(--b1)', fontWeight:500, whiteSpace:'nowrap', background:'var(--s2)', position:'sticky', top:0 };
  var tdStyle = { padding:'7px 8px', borderBottom:'1px solid rgba(30,48,72,.4)', fontSize:'10px', verticalAlign:'middle' };

  return React.createElement('div', { style:{ height:'100%', overflowY:'auto', padding:'16px' } },

    React.createElement('div', { style:{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'14px', flexWrap:'wrap', gap:'10px' } },
      React.createElement('div', null,
        React.createElement('div', { style:{ fontFamily:'var(--syne)', fontSize:'16px', fontWeight:700 } }, 'Charter P&L'),
        React.createElement('div', { style:{ fontSize:'10px', color:'var(--t2)', marginTop:'2px' } }, 'Fleet · '+voyages.length+' voyages · '+unitDesc[unit])
      ),
      React.createElement('div', { style:{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'6px' } },
        React.createElement('div', { style:{ fontSize:'9px', color:'var(--t3)', marginBottom:'2px' } }, 'CARGO UNIT'),
        React.createElement('div', { style:{ display:'flex', background:'var(--s2)', border:'1px solid var(--b1)', borderRadius:'var(--radius-sm)', overflow:'hidden' } },
          [['KXX','Kxx'],['RT','RT']].map(function(item) {
            return React.createElement('button', { key:item[0], onClick:function(){setUnit(item[0]);}, style:{ background:unit===item[0]?'var(--accent)':'none', border:'none', color:unit===item[0]?'#000':'var(--t2)', fontSize:'11px', fontWeight:unit===item[0]?700:400, padding:'7px 16px', cursor:'pointer', letterSpacing:'1px', fontFamily:'var(--mono)', transition:'all .15s' } }, item[1]);
          })
        ),
        React.createElement('div', { style:{ fontSize:'9px', color:'var(--t3)', textAlign:'right' } }, unitDesc[unit])
      )
    ),

    React.createElement('div', { style:{ background:'var(--s2)', border:'1px solid var(--b1)', borderRadius:'var(--radius)', padding:'10px 14px', marginBottom:'14px', display:'flex', gap:'24px', flexWrap:'wrap' } },
      React.createElement('div', { style:{ fontSize:'9px', color:'var(--t3)', alignSelf:'center', letterSpacing:'1px' } }, 'UNIT CONVERSION:'),
      [
        ['1 Kxx', '= 1.25 RT', 'commercial unit', 'var(--accent)'],
        ['1 RT', '= 0.80 Kxx', 'billing unit', 'var(--yellow)'],
      ].map(function(item) {
        return React.createElement('div', { key:item[0], style:{ display:'flex', alignItems:'center', gap:'6px', fontSize:'10px' } },
          React.createElement('span', { style:{ fontFamily:'var(--syne)', fontWeight:700, color:item[3] } }, item[0]),
          React.createElement('span', { style:{ color:'var(--t2)' } }, item[1]),
          React.createElement('span', { style:{ color:'var(--t3)' } }, item[2])
        );
      })
    ),

    React.createElement('div', { style:{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'10px', marginBottom:'14px' } },
      [
        { label:'Total Revenue', value:fmtMoney(totalRev), sub:voyages.length+' voyages', color:'var(--accent)' },
        { label:'Total Costs', value:fmtMoney(totalCost), sub:'bunker 62%', color:'var(--orange)' },
        { label:'Net Profit', value:fmtMoney(totalProfit), sub:avgMargin+'% avg margin', color:'var(--green)' },
        { label:'Fleet Utilisation', value:fleetUtil+'%', sub:unitExplain[unit](totalLM)+' loaded', color:'var(--yellow)' },
        { label:'Cargo Loaded', value:unitExplain[unit](totalLM), sub:'of '+unitExplain[unit](totalCapLM)+' cap.', color:'var(--text)' },
        { label:'Available Space', value:unitExplain[unit](totalCapLM-totalLM), sub:'unfilled capacity', color:'var(--t2)' },
      ].map(function(k) {
        return React.createElement('div', { key:k.label, style:{ background:'var(--s1)', border:'1px solid var(--b1)', borderRadius:'var(--radius)', padding:'12px 14px' } },
          React.createElement('div', { style:{ fontSize:'9px', color:'var(--t3)', letterSpacing:'1.5px', marginBottom:'5px' } }, k.label),
          React.createElement('div', { style:{ fontSize:'20px', fontFamily:'var(--syne)', fontWeight:700, color:k.color } }, k.value),
          React.createElement('div', { style:{ fontSize:'9px', color:'var(--t2)', marginTop:'3px' } }, k.sub)
        );
      })
    ),

    React.createElement('div', { style:{ background:'var(--s1)', border:'1px solid var(--b1)', borderRadius:'var(--radius)', padding:'16px' } },
      React.createElement('div', { style:{ fontSize:'10px', color:'var(--t2)', letterSpacing:'2px', marginBottom:'12px' } }, 'VOYAGE P&L — FLEET'),
      React.createElement('div', { style:{ overflowX:'auto' } },
        React.createElement('table', { style:{ width:'100%', borderCollapse:'collapse', minWidth:'900px' } },
          React.createElement('thead', null,
            React.createElement('tr', null,
              ['Voyage','Route','Vessel','Cargo ('+unit+')','Cap ('+unit+')','Util','Revenue','Bunker','Port','Net Profit','Margin','Per '+unit].map(function(h) {
                return React.createElement('th', { key:h, style:thStyle }, h);
              })
            )
          ),
          React.createElement('tbody', null,
            voyages.map(function(v) {
              var isLNG = v.propulsion === 'LNG';
              return React.createElement('tr', { key:v.id,
                onMouseEnter:function(e){e.currentTarget.style.background='rgba(0,212,255,.02)';},
                onMouseLeave:function(e){e.currentTarget.style.background='';},
              },
                React.createElement('td', { style:Object.assign({},tdStyle,{color:'var(--accent)'}) }, React.createElement(VoyageBadge, { value:v.id })),
                React.createElement('td', { style:tdStyle }, v.route),
                React.createElement('td', { style:Object.assign({},tdStyle,{fontWeight:500}) },
                  React.createElement('span', null, v.vessel),
                  React.createElement('span', { style:{ marginLeft:'6px' } }, React.createElement(VoyageBadge, { value:v.id })),
                  isLNG && React.createElement('span', { style:{ marginLeft:'5px', fontSize:'7px', padding:'1px 4px', borderRadius:'2px', background:'rgba(0,232,150,.15)', color:'var(--green)', border:'1px solid rgba(0,232,150,.3)', fontWeight:700 } }, 'LNG')
                ),
                React.createElement('td', { style:tdStyle }, lmToUnit(v.cargoLoaded, unit)),
                React.createElement('td', { style:Object.assign({},tdStyle,{color:'var(--t2)'}) }, lmToUnit(v.laneCapacity, unit)),
                React.createElement('td', { style:Object.assign({},tdStyle,{color:fc(v.util),fontWeight:500}) }, v.util+'%'),
                React.createElement('td', { style:tdStyle }, fmtMoney(v.revenue)),
                React.createElement('td', { style:Object.assign({},tdStyle,{color:isLNG?'var(--green)':'var(--orange)'}) }, fmtMoney(v.bunkerCost)+(isLNG?' (LNG)':'')),
                React.createElement('td', { style:Object.assign({},tdStyle,{color:'var(--t2)'}) }, fmtMoney(v.portCosts)),
                React.createElement('td', { style:Object.assign({},tdStyle,{color:'var(--green)',fontWeight:600}) }, fmtMoney(v.profit)),
                React.createElement('td', { style:Object.assign({},tdStyle,{color:v.margin>=25?'var(--green)':v.margin>=15?'var(--yellow)':'var(--red)',fontWeight:500}) }, v.margin.toFixed(1)+'%'),
                React.createElement('td', { style:Object.assign({},tdStyle,{color:'var(--t2)'}) }, revenueToUnit(v.revenue, v.laneCapacity, unit))
              );
            })
          ),
          React.createElement('tfoot', null,
            React.createElement('tr', { style:{ background:'var(--s2)' } },
              React.createElement('td', { colSpan:5, style:Object.assign({},tdStyle,{fontFamily:'var(--syne)',fontWeight:700,color:'var(--text)'}) }, 'TOTALS'),
              React.createElement('td', { style:Object.assign({},tdStyle,{color:fc(fleetUtil),fontWeight:700}) }, fleetUtil+'%'),
              React.createElement('td', { style:Object.assign({},tdStyle,{fontWeight:700}) }, fmtMoney(totalRev)),
              React.createElement('td', { style:Object.assign({},tdStyle,{color:'var(--orange)',fontWeight:700}) }, fmtMoney(voyages.reduce(function(s,v){return s+v.bunkerCost;},0))),
              React.createElement('td', { style:Object.assign({},tdStyle,{color:'var(--t2)',fontWeight:700}) }, fmtMoney(voyages.reduce(function(s,v){return s+v.portCosts;},0))),
              React.createElement('td', { style:Object.assign({},tdStyle,{color:'var(--green)',fontWeight:700}) }, fmtMoney(totalProfit)),
              React.createElement('td', { style:Object.assign({},tdStyle,{color:parseFloat(avgMargin)>=25?'var(--green)':'var(--yellow)',fontWeight:700}) }, avgMargin+'%'),
              React.createElement('td', { style:tdStyle }, '—')
            )
          )
        )
      )
    )
  );
}
