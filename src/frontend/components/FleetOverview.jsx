import React, { useState, useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { createSeaRoute, createVessel as createVesselRecord, deleteVessel as deleteVesselRecord, listMyVessels as listMyVesselsFromApi, listVessels, saveMyVessels as saveMyVesselsToApi } from '../api/fleet';
import { lookupVesselDetails } from '../../backend/services/vesselLookup';
import { allPorts } from '../data/portDictionary';

var KLINE_VESSELS = [
  { id:1, name:'Global Highway', imo:'9723298', type:'PCTC', flag:'JP', status:'sea', route:'BRE-BAL', trade:'TAL', speed:17.2, fuel_rate:91.4, cargo_util:92, cii_rating:'A', lat:48.2, lon:-22.4, eta:'4 days', next_port:'Baltimore', last_port:'Bremerhaven', lane_meters:7500, voyage_progress:58, dwt:34000, built:2016, gt:61000, propulsion:'DIESEL', call_sign:'JQAX2' },
  { id:2, name:'Texas Highway', imo:'9723303', type:'PCTC', flag:'JP', status:'sea', route:'ZEE-BRU', trade:'NAS', speed:16.8, fuel_rate:88.2, cargo_util:95, cii_rating:'A', lat:38.4, lon:-48.6, eta:'2 days', next_port:'Brunswick', last_port:'Zeebrugge', lane_meters:7500, voyage_progress:82, dwt:34000, built:2016, gt:61000, propulsion:'DIESEL', call_sign:'JQAX3' },
  { id:3, name:'Poseidon Highway', imo:'9782947', type:'PCTC', flag:'JP', status:'sea', route:'EMD-JAX', trade:'NAS', speed:18.1, fuel_rate:94.2, cargo_util:95, cii_rating:'A', lat:43.1, lon:-35.2, eta:'3 days', next_port:'Jacksonville', last_port:'Emden', lane_meters:7000, voyage_progress:64, dwt:32000, built:2019, gt:58000, propulsion:'LNG', call_sign:'JQBX1' },
  { id:4, name:'Nereus Highway', imo:'9782959', type:'PCTC', flag:'JP', status:'sea', route:'BRE-VER', trade:'TAL', speed:16.4, fuel_rate:86.8, cargo_util:90, cii_rating:'A', lat:32.6, lon:-58.8, eta:'5 days', next_port:'Veracruz', last_port:'Bremerhaven', lane_meters:7000, voyage_progress:45, dwt:32000, built:2019, gt:58000, propulsion:'LNG', call_sign:'JQBX2' },
  { id:5, name:'Integrity Highway', imo:'9654321', type:'PCTC', flag:'JP', status:'port', route:'SOT-BAL', trade:'TAL', speed:0, fuel_rate:12.4, cargo_util:88, cii_rating:'A', lat:39.26, lon:-76.57, eta:'In port', next_port:'Southampton', last_port:'Baltimore', lane_meters:6500, voyage_progress:100, dwt:30000, built:2017, gt:55000, propulsion:'DIESEL', call_sign:'JQCX1' },
  { id:6, name:'Century Highway 2', imo:'9612847', type:'PCTC', flag:'JP', status:'sea', route:'ZEE-HOU', trade:'TAL', speed:15.8, fuel_rate:82.1, cargo_util:86, cii_rating:'B', lat:29.8, lon:-72.4, eta:'1 day', next_port:'Houston', last_port:'Zeebrugge', lane_meters:6500, voyage_progress:91, dwt:30000, built:2015, gt:55000, propulsion:'DIESEL', call_sign:'JQCX2' },
  { id:7, name:'Drive Green Highway', imo:'9723315', type:'PCTC', flag:'JP', status:'sea', route:'HAM-NEW', trade:'TAL', speed:17.6, fuel_rate:92.8, cargo_util:98, cii_rating:'A', lat:52.1, lon:-8.4, eta:'6 days', next_port:'Newark', last_port:'Hamburg', lane_meters:7500, voyage_progress:28, dwt:34000, built:2016, gt:61000, propulsion:'DIESEL', call_sign:'JQAX4' },
  { id:8, name:'Victory Highway', imo:'9521847', type:'PCTC', flag:'JP', status:'loading', route:'BRE-BAL', trade:'TAL', speed:0, fuel_rate:8.2, cargo_util:71, cii_rating:'B', lat:53.54, lon:8.58, eta:'Tomorrow', next_port:'Baltimore', last_port:'Baltimore', lane_meters:6000, voyage_progress:0, dwt:28000, built:2014, gt:52000, propulsion:'DIESEL', call_sign:'JQDX1' },
  { id:9, name:'Courageous Highway', imo:'9387264', type:'PCTC', flag:'JP', status:'sea', route:'YOK-ZEE', trade:'EUROZFE', speed:16.2, fuel_rate:84.6, cargo_util:89, cii_rating:'A', lat:24.8, lon:68.2, eta:'12 days', next_port:'Zeebrugge', last_port:'Yokohama', lane_meters:6800, voyage_progress:38, dwt:31000, built:2013, gt:57000, propulsion:'DIESEL', call_sign:'JQEX1' },
  { id:10, name:'Majestic Highway', imo:'9387276', type:'PCTC', flag:'JP', status:'sea', route:'NAG-SOT', trade:'EUROZFE', speed:15.9, fuel_rate:83.2, cargo_util:84, cii_rating:'B', lat:18.4, lon:72.6, eta:'14 days', next_port:'Southampton', last_port:'Nagoya', lane_meters:6800, voyage_progress:22, dwt:31000, built:2013, gt:57000, propulsion:'DIESEL', call_sign:'JQEX2' },
  { id:11, name:'Excellence Highway', imo:'9521859', type:'PCTC', flag:'JP', status:'sea', route:'BRE-JAX', trade:'NAS', speed:17.4, fuel_rate:90.6, cargo_util:93, cii_rating:'A', lat:44.8, lon:-28.6, eta:'3 days', next_port:'Jacksonville', last_port:'Bremerhaven', lane_meters:6500, voyage_progress:68, dwt:30000, built:2014, gt:55000, propulsion:'DIESEL', call_sign:'JQDX2' },
  { id:12, name:'Grand Highway', imo:'9612859', type:'PCTC', flag:'JP', status:'discharge', route:'ZEE-HOU', trade:'TAL', speed:0, fuel_rate:11.8, cargo_util:78, cii_rating:'B', lat:29.62, lon:-95.02, eta:'Discharging', next_port:'Zeebrugge', last_port:'Zeebrugge', lane_meters:6500, voyage_progress:100, dwt:30000, built:2015, gt:55000, propulsion:'DIESEL', call_sign:'JQCX3' },
  { id:13, name:'Pacific Highway', imo:'9298741', type:'PCTC', flag:'JP', status:'sea', route:'YOK-DBN', trade:'EUROZFE', speed:16.8, fuel_rate:87.4, cargo_util:91, cii_rating:'A', lat:-8.4, lon:72.8, eta:'8 days', next_port:'Durban', last_port:'Yokohama', lane_meters:6200, voyage_progress:62, dwt:29000, built:2011, gt:51000, propulsion:'DIESEL', call_sign:'JQFX1' },
  { id:14, name:'Atlantic Highway', imo:'9298753', type:'PCTC', flag:'JP', status:'sea', route:'BRE-HOU', trade:'TAL', speed:15.6, fuel_rate:81.8, cargo_util:82, cii_rating:'B', lat:36.2, lon:-42.8, eta:'4 days', next_port:'Houston', last_port:'Bremerhaven', lane_meters:6200, voyage_progress:54, dwt:29000, built:2011, gt:51000, propulsion:'DIESEL', call_sign:'JQFX2' },
  { id:15, name:'Indian Highway', imo:'9387288', type:'PCTC', flag:'JP', status:'sea', route:'JEB-ZEE', trade:'EUROZFE', speed:16.4, fuel_rate:85.2, cargo_util:87, cii_rating:'A', lat:18.8, lon:48.4, eta:'10 days', next_port:'Zeebrugge', last_port:'Jebel Ali', lane_meters:6800, voyage_progress:32, dwt:31000, built:2013, gt:57000, propulsion:'DIESEL', call_sign:'JQEX3' },
  { id:16, name:'Oceanic Highway', imo:'9521861', type:'PCTC', flag:'JP', status:'sea', route:'SIN-BRE', trade:'EUROZFE', speed:17.1, fuel_rate:89.4, cargo_util:94, cii_rating:'A', lat:8.2, lon:88.6, eta:'16 days', next_port:'Bremerhaven', last_port:'Singapore', lane_meters:6500, voyage_progress:18, dwt:30000, built:2014, gt:55000, propulsion:'DIESEL', call_sign:'JQDX3' },
  { id:17, name:'Arctic Highway', imo:'9612861', type:'PCTC', flag:'JP', status:'sea', route:'GOT-BAL', trade:'TAL', speed:15.4, fuel_rate:80.2, cargo_util:79, cii_rating:'B', lat:56.8, lon:8.4, eta:'3 days', next_port:'Baltimore', last_port:'Gothenburg', lane_meters:6500, voyage_progress:14, dwt:30000, built:2015, gt:55000, propulsion:'DIESEL', call_sign:'JQCX4' },
  { id:18, name:'Typhoon Highway', imo:'9723327', type:'PCTC', flag:'JP', status:'sea', route:'EMD-BAL', trade:'TAL', speed:17.8, fuel_rate:93.6, cargo_util:96, cii_rating:'A', lat:51.2, lon:-4.8, eta:'5 days', next_port:'Baltimore', last_port:'Emden', lane_meters:7500, voyage_progress:42, dwt:34000, built:2016, gt:61000, propulsion:'LNG', call_sign:'JQAX5' },
];

var SC = { sea:'#00d4ff', port:'#ff8c42', loading:'#ffd60a', discharge:'#00e896' };
var SL = { sea:'AT SEA', port:'IN PORT', loading:'LOADING', discharge:'DISCHARGE' };
var CB = { A:'#00c853', B:'#69f0ae', C:'#ffd60a', D:'#ff6b35', E:'#ff4560' };
var TRADE_TAGS = [
  { code:'TAL', label:'Transatlantic / US-Mex East Coast', color:'#00d4ff' },
  { code:'NAS', label:'US East Coast', color:'#ffd60a' },
  { code:'EUROZFE', label:'Asia-Europe', color:'#00e896' },
];
var TRADE_BY_CODE = TRADE_TAGS.reduce(function(acc, item) { acc[item.code] = item; return acc; }, {});
var LM_PER_KXX = 1.25;
var SEA_LABELS = [
  { name:'North Atlantic Ocean', lat:34, lon:-42 },
  { name:'South Atlantic Ocean', lat:-28, lon:-18 },
  { name:'North Pacific Ocean', lat:34, lon:-152 },
  { name:'South Pacific Ocean', lat:-24, lon:-132 },
  { name:'Indian Ocean', lat:-18, lon:78 },
  { name:'Mediterranean Sea', lat:36, lon:18 },
  { name:'North Sea', lat:56, lon:3 },
  { name:'Gulf of Mexico', lat:24, lon:-90 },
  { name:'Caribbean Sea', lat:15, lon:-75 },
  { name:'Arabian Sea', lat:15, lon:62 },
  { name:'South China Sea', lat:13, lon:114 },
  { name:'Red Sea', lat:20, lon:39 },
];
var WORLD_OFFSETS = [-360, 0, 360];
var PORT_COORDS = {
  BAL:{ lat:39.26, lon:-76.57 }, BALTIMORE:{ lat:39.26, lon:-76.57 },
  BRE:{ lat:53.54, lon:8.58 }, BREMERHAVEN:{ lat:53.54, lon:8.58 },
  ZEE:{ lat:51.34, lon:3.20 }, ZEEBRUGGE:{ lat:51.34, lon:3.20 },
  BRU:{ lat:31.15, lon:-81.50 }, BRUNSWICK:{ lat:31.15, lon:-81.50 },
  EMD:{ lat:53.34, lon:7.19 }, EMDEN:{ lat:53.34, lon:7.19 },
  JAX:{ lat:30.40, lon:-81.58 }, JACKSONVILLE:{ lat:30.40, lon:-81.58 },
  VER:{ lat:19.20, lon:-96.14 }, VERACRUZ:{ lat:19.20, lon:-96.14 },
  HOU:{ lat:29.62, lon:-95.02 }, HOUSTON:{ lat:29.62, lon:-95.02 },
  HAM:{ lat:53.54, lon:9.98 }, HAMBURG:{ lat:53.54, lon:9.98 },
  NEW:{ lat:40.69, lon:-74.14 }, NEWARK:{ lat:40.69, lon:-74.14 }, 'PORT NEWARK':{ lat:40.69, lon:-74.14 },
  SOT:{ lat:50.90, lon:-1.40 }, SOUTHAMPTON:{ lat:50.90, lon:-1.40 },
  YOK:{ lat:35.45, lon:139.65 }, YOKOHAMA:{ lat:35.45, lon:139.65 },
  NAG:{ lat:35.05, lon:136.88 }, NAGOYA:{ lat:35.05, lon:136.88 },
  DBN:{ lat:-29.87, lon:31.05 }, DURBAN:{ lat:-29.87, lon:31.05 },
  JEB:{ lat:25.01, lon:55.06 }, 'JEBEL ALI':{ lat:25.01, lon:55.06 },
  SIN:{ lat:1.26, lon:103.82 }, SINGAPORE:{ lat:1.26, lon:103.82 },
  GOT:{ lat:57.70, lon:11.94 }, GOTHENBURG:{ lat:57.70, lon:11.94 },
};

function fc(p) {
  if (p >= 90) return 'var(--green)';
  if (p >= 70) return 'var(--yellow)';
  return 'var(--red)';
}

function getTrade(vessel) {
  return TRADE_BY_CODE[vessel.trade] || TRADE_BY_CODE.TAL;
}

function laneMetersToKxx(laneMeters) {
  var n = Number(laneMeters || 0);
  return Math.round(n / LM_PER_KXX);
}

function kxxText(laneMeters) {
  return laneMetersToKxx(laneMeters).toLocaleString() + ' Kxx';
}

function formatVesselName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').toLowerCase().replace(/\b([a-z])/g, function(match) {
    return match.toUpperCase();
  });
}

function voyageNumber(vessel) {
  return vessel && (vessel.voyage_number || vessel.voyageNumber) ? (vessel.voyage_number || vessel.voyageNumber) : 'TBC';
}

function voyageBadge(vessel) {
  var value = voyageNumber(vessel);
  var pending = value === 'TBC';
  return React.createElement('span', { title:'Voyage number', style:{ fontSize:'9px', padding:'3px 7px', borderRadius:'4px', background:pending?'rgba(255,214,10,.12)':'rgba(0,212,255,.16)', color:pending?'var(--yellow)':'var(--accent)', border:'1px solid '+(pending?'rgba(255,214,10,.45)':'rgba(0,212,255,.55)'), fontWeight:800, letterSpacing:'.6px', whiteSpace:'nowrap', flexShrink:0 } }, 'VOY '+value);
}

function portKey(value) {
  return String(value || '').trim().toUpperCase();
}

function portLookupKey(value) {
  return portKey(value).replace(/^PORT\s+OF\s+/, '').replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ');
}

function resolveFleetPort(value, ports) {
  var key = portLookupKey(value);
  if (!key) return null;
  var direct = PORT_COORDS[key];
  var found = (ports || []).find(function(port) {
    return portLookupKey(port.code) === key || portLookupKey(port.name) === key;
  });
  var coords = direct || (found && Number.isFinite(Number(found.lat)) && Number.isFinite(Number(found.lon)) ? { lat:Number(found.lat), lon:Number(found.lon) } : null);
  if (!coords) return null;
  return {
    code:found ? found.code : key,
    name:found ? found.name : String(value),
    lat:coords.lat,
    lon:coords.lon,
  };
}

function seaRouteKey(origin, destination) {
  return [origin.lat, origin.lon, destination.lat, destination.lon].map(function(value) {
    return Number(value).toFixed(4);
  }).join(':');
}

function collectRelevantPorts(vessels, ports) {
  var byKey = {};
  (vessels || []).forEach(function(vessel) {
    var names = [vessel.last_port, vessel.next_port];
    String(vessel.route || '').split('-').forEach(function(code) { names.push(code); });
    names.forEach(function(name) {
      var port = resolveFleetPort(name, ports);
      if (!port) return;
      var key = portLookupKey(port.code || port.name);
      if (!byKey[key]) byKey[key] = Object.assign({}, port, { vessels:[] });
      if (!byKey[key].vessels.includes(vessel.name)) byKey[key].vessels.push(vessel.name);
    });
  });
  return Object.keys(byKey).map(function(key) { return byKey[key]; });
}

function tradeBadge(vessel) {
  var trade = getTrade(vessel);
  return React.createElement('span', { title:trade.label, style:{ fontSize:'8px', padding:'2px 6px', borderRadius:'4px', background:trade.color+'18', color:trade.color, border:'1px solid '+trade.color+'55', fontWeight:700, letterSpacing:'.5px', whiteSpace:'nowrap' } }, trade.code);
}

function LngBadge() {
  return React.createElement('span', { style:{ fontSize:'7px', padding:'1px 5px', borderRadius:'3px', background:'rgba(0,232,150,.15)', color:'var(--green)', border:'1px solid rgba(0,232,150,.4)', fontWeight:700, letterSpacing:'0.5px' } }, 'LNG');
}

function vesselIdKey(id) {
  return String(id === null || id === undefined ? '' : id);
}

function hasVesselId(ids, id) {
  var key = vesselIdKey(id);
  return key && (ids || []).some(function(value) { return vesselIdKey(value) === key; });
}

function uniqueVesselIds(ids) {
  var seen = {};
  return (ids || []).filter(function(id) {
    var key = vesselIdKey(id);
    if (!key || seen[key]) return false;
    seen[key] = true;
    return true;
  });
}

function validMyVesselIds(ids, vessels) {
  var allowed = {};
  (vessels || []).forEach(function(vessel) {
    var key = vesselIdKey(vessel.id);
    if (key) allowed[key] = true;
  });
  return uniqueVesselIds(ids).filter(function(id) { return allowed[vesselIdKey(id)]; });
}

function sameFleetVessel(left, right) {
  if (vesselIdKey(left.id) === vesselIdKey(right.id)) return true;
  if (left.imo && right.imo) return String(left.imo) === String(right.imo);
  var leftName = formatVesselName(left.name);
  return leftName && leftName === formatVesselName(right.name);
}

function sameVesselIds(left, right) {
  var a = uniqueVesselIds(left);
  var b = uniqueVesselIds(right);
  return a.length === b.length && a.every(function(id, index) { return vesselIdKey(id) === vesselIdKey(b[index]); });
}

function inferTrade(vessel) {
  var route = String(vessel.route || '').toUpperCase();
  var next = String(vessel.next_port || '').toUpperCase();
  if (route.includes('YOK') || route.includes('NAG') || route.includes('SIN') || route.includes('JEB') || next.includes('ZEEBRUGGE') || next.includes('BREMERHAVEN')) return 'EUROZFE';
  if (route.includes('JAX') || route.includes('BRU') || next.includes('JACKSONVILLE') || next.includes('BRUNSWICK')) return 'NAS';
  return 'TAL';
}

function normalizeFleetVessels(list) {
  return (list || []).map(function(v) {
    var formattedName = formatVesselName(v.name);
    return Object.assign({}, v, {
      name:formattedName || v.name,
      trade:v.trade || inferTrade(v),
      voyage_number:v.voyage_number || v.voyageNumber || 'TBC'
    });
  });
}

// ── VESSEL SEARCH & ADD ───────────────────────────────────────────────────────
function AddVesselModal(props) {
  var onAdd = props.onAdd; var onClose = props.onClose;
  var qs = useState(''); var q = qs[0]; var setQ = qs[1];
  var ls = useState(false); var loading = ls[0]; var setLoading = ls[1];
  var rs = useState(null); var result = rs[0]; var setResult = rs[1];
  var es = useState(''); var error = es[0]; var setError = es[1];
  var ms = useState(false); var manualMode = ms[0]; var setManualMode = ms[1];

  var EMPTY = { name:'', imo:'', mmsi:'', type:'PCTC', flag:'', status:'sea', route:'', trade:'TAL', voyage_number:'', speed:16.0, fuel_rate:80.0, cargo_util:85, cii_rating:'A', lat:0, lon:0, eta:'', next_port:'', last_port:'', lane_meters:6500, voyage_progress:0, dwt:28000, built:2015, gt:50000, propulsion:'DIESEL', call_sign:'', id: Date.now() };
  var fs = useState(EMPTY); var form = fs[0]; var setForm = fs[1];

  function setF(k,v) { setForm(function(f) { var n=Object.assign({},f); n[k]=v; return n; }); }

  async function searchVessel() {
    if (!q.trim()) return;
    setLoading(true); setError(''); setResult(null);
    try {
      var parsed = await lookupVesselDetails(q);
      if (parsed.found === false) {
        setError('Vessel not found in database. Enter details manually below.');
        setManualMode(true);
        setForm(function(f) { return Object.assign({},f,{ name: q.trim() }); });
      } else {
        setResult(parsed);
        setForm(function(f) { return Object.assign({},f, parsed, { id: Date.now(), status:'sea', route:'', trade:f.trade || 'TAL', voyage_number:f.voyage_number || '', speed:16.0, fuel_rate:80.0, cargo_util:85, cii_rating:'A', lat:0, lon:0, eta:'', next_port:'', last_port:'', voyage_progress:0 }); });
      }
      setLoading(false);
      return;
    } catch(e) {
      setError((e && e.message ? e.message : 'Could not fetch vessel data') + '. Enter details manually.');
      setManualMode(true);
      setForm(function(f) { return Object.assign({},f,{ name: q.trim() }); });
    }
    setLoading(false);
  }

  var inputStyle = { width:'100%', padding:'7px 10px', fontSize:'10px' };
  var labelStyle = { fontSize:'8px', color:'var(--t3)', letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:'4px', display:'block' };
  var sectionStyle = { marginBottom:'12px' };

  return React.createElement('div', { onClick:function(e){if(e.target===e.currentTarget)onClose();}, style:{ position:'fixed', inset:0, background:'rgba(0,0,0,.8)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(8px)' } },
    React.createElement('div', { style:{ background:'var(--s1)', border:'1px solid var(--b2)', borderRadius:'12px', width:'560px', maxHeight:'85vh', display:'flex', flexDirection:'column', overflow:'hidden' } },
      React.createElement('div', { style:{ padding:'16px 20px', borderBottom:'1px solid var(--b1)', display:'flex', justifyContent:'space-between', alignItems:'center' } },
        React.createElement('div', { style:{ fontFamily:'var(--syne)', fontSize:'14px', fontWeight:700 } }, 'Add Vessel to Fleet'),
        React.createElement('button', { onClick:onClose, style:{ background:'none', border:'none', color:'var(--t2)', fontSize:'20px', cursor:'pointer' } }, 'x')
      ),
      React.createElement('div', { style:{ padding:'16px 20px', overflowY:'auto', flex:1 } },

        React.createElement('div', { style:{ marginBottom:'14px' } },
          React.createElement('label', { style:labelStyle }, 'SEARCH BY VESSEL NAME OR IMO NUMBER'),
          React.createElement('div', { style:{ display:'flex', gap:'8px' } },
            React.createElement('input', { value:q, onChange:function(e){setQ(e.target.value);}, onKeyDown:function(e){if(e.key==='Enter')searchVessel();}, placeholder:'e.g. "Poseidon Highway" or "9782947"', style:Object.assign({},inputStyle,{flex:1}) }),
            React.createElement('button', { onClick:searchVessel, disabled:loading||!q.trim(), style:{ background:loading?'var(--b2)':'var(--accent)', border:'none', color:loading?'var(--t2)':'#000', fontSize:'10px', padding:'7px 14px', borderRadius:'var(--radius-sm)', cursor:loading?'not-allowed':'pointer', fontWeight:600, whiteSpace:'nowrap' } }, loading?'Searching...':'Search')
          ),
          React.createElement('div', { style:{ display:'flex', gap:'8px', marginTop:'6px' } },
            React.createElement('button', { onClick:function(){setManualMode(!manualMode);setResult(null);setError('');}, style:{ background:'none', border:'1px solid var(--b1)', color:'var(--t2)', fontSize:'9px', padding:'3px 10px', borderRadius:'3px', cursor:'pointer' } }, manualMode?'Back to search':'Enter manually instead')
          )
        ),

        error && React.createElement('div', { style:{ background:'rgba(255,214,10,.08)', border:'1px solid rgba(255,214,10,.2)', borderRadius:'6px', padding:'10px 12px', marginBottom:'12px', fontSize:'10px', color:'var(--yellow)' } }, error),

        result && React.createElement('div', { style:{ background:'rgba(0,232,150,.06)', border:'1px solid rgba(0,232,150,.2)', borderRadius:'8px', padding:'14px', marginBottom:'14px' } },
          React.createElement('div', { style:{ fontFamily:'var(--syne)', fontSize:'13px', fontWeight:700, marginBottom:'10px', color:'var(--green)' } }, 'Vessel Found' + (result.source ? ' via ' + result.source : '')),
          React.createElement('div', { style:{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px' } },
            [['Name',result.name],['IMO',result.imo],['Type',result.type],['Flag',result.flag],['Built',result.built],['DWT',result.dwt?result.dwt.toLocaleString()+' MT':'—'],['GT',result.gt?result.gt.toLocaleString():'—'],['Call Sign',result.call_sign||'—'],['Propulsion',result.propulsion||'DIESEL']].map(function(item) {
              return React.createElement('div', { key:item[0], style:{ background:'var(--s2)', borderRadius:'5px', padding:'8px 10px' } },
                React.createElement('div', { style:{ fontSize:'8px', color:'var(--t3)', marginBottom:'2px' } }, item[0]),
                React.createElement('div', { style:{ fontSize:'11px', fontWeight:500 } }, item[1]||'—')
              );
            })
          )
        ),

        (result || manualMode) && React.createElement('div', null,
          React.createElement('div', { style:{ fontFamily:'var(--syne)', fontSize:'11px', fontWeight:700, color:'var(--t2)', marginBottom:'10px', letterSpacing:'1px' } }, 'OPERATIONAL DETAILS'),

          React.createElement('div', { style:{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'10px' } },
            !result && React.createElement('div', { style:sectionStyle },
              React.createElement('label', { style:labelStyle }, 'VESSEL NAME *'),
              React.createElement('input', { style:inputStyle, value:form.name, onChange:function(e){setF('name',e.target.value);}, placeholder:'e.g. Global Highway' })
            ),
            !result && React.createElement('div', { style:sectionStyle },
              React.createElement('label', { style:labelStyle }, 'IMO NUMBER *'),
              React.createElement('input', { style:inputStyle, value:form.imo, onChange:function(e){setF('imo',e.target.value);}, placeholder:'7 digit number' })
            ),
            !result && React.createElement('div', { style:sectionStyle },
              React.createElement('label', { style:labelStyle }, 'MMSI'),
              React.createElement('input', { style:inputStyle, value:form.mmsi || '', onChange:function(e){setF('mmsi',e.target.value.replace(/[^0-9]/g,'').slice(0,9));}, placeholder:'9 digit MMSI' })
            ),
            !result && React.createElement('div', { style:sectionStyle },
              React.createElement('label', { style:labelStyle }, 'FLAG (2 letters)'),
              React.createElement('input', { style:inputStyle, value:form.flag, onChange:function(e){setF('flag',e.target.value.toUpperCase().slice(0,2));}, placeholder:'e.g. JP' })
            ),
            !result && React.createElement('div', { style:sectionStyle },
              React.createElement('label', { style:labelStyle }, 'TYPE'),
              React.createElement('select', { style:inputStyle, value:form.type, onChange:function(e){setF('type',e.target.value);} },
                ['PCTC','RoRo','ConRo','PCC'].map(function(t){return React.createElement('option',{key:t,value:t},t);})
              )
            ),
            !result && React.createElement('div', { style:sectionStyle },
              React.createElement('label', { style:labelStyle }, 'BUILT YEAR'),
              React.createElement('input', { type:'number', style:inputStyle, value:form.built, onChange:function(e){setF('built',parseInt(e.target.value)||2015);} })
            ),
            !result && React.createElement('div', { style:sectionStyle },
              React.createElement('label', { style:labelStyle }, 'DWT (MT)'),
              React.createElement('input', { type:'number', style:inputStyle, value:form.dwt, onChange:function(e){setF('dwt',parseInt(e.target.value)||28000);} })
            )
          ),

          React.createElement('div', { style:{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px', marginBottom:'10px' } },
            React.createElement('div', { style:sectionStyle },
              React.createElement('label', { style:labelStyle }, 'KXX CAPACITY'),
              React.createElement('input', { type:'number', style:inputStyle, value:laneMetersToKxx(form.lane_meters), onChange:function(e){setF('lane_meters',Math.round((parseFloat(e.target.value)||0) * LM_PER_KXX));} })
            ),
            React.createElement('div', { style:sectionStyle },
              React.createElement('label', { style:labelStyle }, 'STATUS'),
              React.createElement('select', { style:inputStyle, value:form.status, onChange:function(e){setF('status',e.target.value);} },
                ['sea','port','loading','discharge'].map(function(s){return React.createElement('option',{key:s,value:s},(SL[s]||s));})
              )
            ),
            React.createElement('div', { style:sectionStyle },
              React.createElement('label', { style:labelStyle }, 'PROPULSION'),
              React.createElement('select', { style:inputStyle, value:form.propulsion||'DIESEL', onChange:function(e){setF('propulsion',e.target.value);} },
                ['DIESEL','LNG','METHANOL','BIOFUEL','DUAL-FUEL'].map(function(p){return React.createElement('option',{key:p,value:p},p);})
              )
            )
          ),

          React.createElement('div', { style:{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'10px' } },
            React.createElement('div', { style:sectionStyle },
              React.createElement('label', { style:labelStyle }, 'TRADE ROUTE (e.g. BRE-BAL)'),
              React.createElement('input', { style:inputStyle, value:form.route, onChange:function(e){setF('route',e.target.value);}, placeholder:'e.g. BRE-BAL' })
            ),
            React.createElement('div', { style:sectionStyle },
              React.createElement('label', { style:labelStyle }, 'TRADE USE TAG'),
              React.createElement('select', { style:inputStyle, value:form.trade || 'TAL', onChange:function(e){setF('trade',e.target.value);} },
                TRADE_TAGS.map(function(t){return React.createElement('option',{key:t.code,value:t.code},t.code+' - '+t.label);})
              )
            ),
            React.createElement('div', { style:sectionStyle },
              React.createElement('label', { style:labelStyle }, 'VOYAGE NUMBER'),
              React.createElement('input', { style:inputStyle, value:form.voyage_number || '', onChange:function(e){setF('voyage_number',e.target.value);}, placeholder:'e.g. 026E' })
            ),
            React.createElement('div', { style:sectionStyle },
              React.createElement('label', { style:labelStyle }, 'CII RATING'),
              React.createElement('select', { style:inputStyle, value:form.cii_rating, onChange:function(e){setF('cii_rating',e.target.value);} },
                ['A','B','C','D','E'].map(function(c){return React.createElement('option',{key:c,value:c},c);})
              )
            ),
            React.createElement('div', { style:sectionStyle },
              React.createElement('label', { style:labelStyle }, 'DESIGN SPEED (kn)'),
              React.createElement('input', { type:'number', step:0.1, style:inputStyle, value:form.speed, onChange:function(e){setF('speed',parseFloat(e.target.value)||16);} })
            ),
            React.createElement('div', { style:sectionStyle },
              React.createElement('label', { style:labelStyle }, 'FUEL RATE (MT/day)'),
              React.createElement('input', { type:'number', step:0.1, style:inputStyle, value:form.fuel_rate, onChange:function(e){setF('fuel_rate',parseFloat(e.target.value)||80);} })
            )
          )
        )
      ),
      React.createElement('div', { style:{ padding:'14px 20px', borderTop:'1px solid var(--b1)', display:'flex', justifyContent:'flex-end', gap:'8px' } },
        React.createElement('button', { onClick:onClose, style:{ background:'none', border:'1px solid var(--b1)', color:'var(--t2)', fontSize:'10px', padding:'7px 14px', borderRadius:'5px', cursor:'pointer' } }, 'Cancel'),
        (result || manualMode) && React.createElement('button', { onClick:function(){if(form.name&&form.imo){onAdd(Object.assign({},form,result||{}));onClose();}}, style:{ background:'var(--accent)', border:'none', color:'#000', fontSize:'10px', fontWeight:700, padding:'7px 16px', borderRadius:'5px', cursor:'pointer' } }, 'Add to Fleet')
      )
    )
  );
}

// ── VOYAGE SIMULATOR ─────────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
function VoyageSimulator(props) {
  var vessel = props.vessel; var onClose = props.onClose;
  var ds = useState(''); var departDate = ds[0]; var setDepartDate = ds[1];
  var ts = useState('00:00'); var departTime = ts[0]; var setDepartTime = ts[1];

  var etaDays = vessel.eta && vessel.eta.includes('day') ? parseInt(vessel.eta) : 3;
  var progress = 0;

  function getArrivalDateTime() {
    if (!departDate) return '—';
    try {
      var d = new Date(departDate + 'T' + departTime + ':00');
      d.setDate(d.getDate() + etaDays);
        return d.toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit', hour12:false, hourCycle:'h23' });
    } catch(e) { return '—'; }
  }


  return React.createElement('div', { onClick:function(e){if(e.target===e.currentTarget)onClose();}, style:{ position:'fixed', inset:0, background:'rgba(0,0,0,.85)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(10px)' } },
    React.createElement('div', { style:{ background:'var(--s1)', border:'1px solid var(--b2)', borderRadius:'14px', width:'520px', padding:'28px', boxShadow:'0 0 80px rgba(0,212,255,.12)' } },
      React.createElement('div', { style:{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'20px' } },
        React.createElement('div', null,
          React.createElement('div', { style:{ fontFamily:'var(--syne)', fontSize:'18px', fontWeight:800, color:'var(--accent)' } }, vessel.name),
          React.createElement('div', { style:{ fontSize:'10px', color:'var(--t2)', marginTop:'3px' } }, vessel.route+' · '+vessel.last_port+' → '+vessel.next_port),
          vessel.propulsion==='LNG' && React.createElement('span', { style:{ fontSize:'8px', padding:'1px 6px', borderRadius:'3px', background:'rgba(0,232,150,.15)', color:'var(--green)', border:'1px solid rgba(0,232,150,.4)', fontWeight:700, marginTop:'4px', display:'inline-block' } }, 'LNG POWERED')
        ),
        React.createElement('button', { onClick:onClose, style:{ background:'none', border:'none', color:'var(--t2)', fontSize:'22px', cursor:'pointer' } }, 'x')
      ),

      React.createElement('div', { style:{ background:'var(--s2)', border:'1px solid var(--b1)', borderRadius:'8px', padding:'14px', marginBottom:'20px' } },
        React.createElement('div', { style:{ fontFamily:'var(--syne)', fontSize:'10px', fontWeight:700, letterSpacing:'1.5px', color:'var(--t2)', marginBottom:'12px' } }, 'DEPARTURE'),
        React.createElement('div', { style:{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' } },
          React.createElement('div', null,
            React.createElement('div', { style:{ fontSize:'8px', color:'var(--t3)', letterSpacing:'1.5px', marginBottom:'4px' } }, 'DEPARTURE DATE'),
            React.createElement('input', { type:'date', style:{ width:'100%', padding:'7px 10px', fontSize:'11px', background:'var(--s1)', border:'1px solid var(--b1)', color:'var(--text)', borderRadius:'5px', outline:'none' }, value:departDate, onChange:function(e){setDepartDate(e.target.value);} })
          ),
          React.createElement('div', null,
            React.createElement('div', { style:{ fontSize:'8px', color:'var(--t3)', letterSpacing:'1.5px', marginBottom:'4px' } }, 'DEPARTURE TIME (UTC)'),
            React.createElement('input', { type:'time', style:{ width:'100%', padding:'7px 10px', fontSize:'11px', background:'var(--s1)', border:'1px solid var(--b1)', color:'var(--text)', borderRadius:'5px', outline:'none' }, value:departTime, onChange:function(e){setDepartTime(e.target.value);} })
          )
        ),
        departDate && React.createElement('div', { style:{ marginTop:'10px', fontSize:'10px', color:'var(--accent)' } }, 'Est. arrival: '+getArrivalDateTime()+' · '+vessel.next_port)
      ),

      React.createElement('div', { style:{ textAlign:'center', marginBottom:'20px' } },
        React.createElement('div', { style:{ fontSize:'22px', fontFamily:'var(--syne)', fontWeight:800, color:'var(--accent)', marginBottom:'6px', lineHeight:1.2 } }, vessel.last_port+' to '+vessel.next_port),
        React.createElement('div', { style:{ fontSize:'11px', color:'var(--t2)', marginBottom:'4px' } }, 'Voyage plan only. No percentage countdown is shown.'),
        React.createElement('div', { style:{ fontSize:'14px', fontFamily:'var(--syne)', color:'var(--yellow)' } }, etaDays+' days estimated sea time'),
        departDate && React.createElement('div', { style:{ fontSize:'10px', color:'var(--t3)', marginTop:'3px' } }, 'ETA: '+getArrivalDateTime()),
        progress >= 100 && React.createElement('div', { style:{ fontSize:'14px', fontFamily:'var(--syne)', color:'var(--green)' } }, 'ARRIVED — '+vessel.next_port)
      ),

      React.createElement('div', { style:{ background:'var(--s2)', borderRadius:'8px', padding:'4px', marginBottom:'20px' } },
        React.createElement('div', { style:{ height:'16px', background:'var(--b1)', borderRadius:'6px', overflow:'hidden' } },
          React.createElement('div', { style:{ height:'100%', width:'100%', background:'linear-gradient(90deg,var(--accent),#00ff9d)', borderRadius:'6px' } })
        )
      ),

      React.createElement('div', { style:{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'8px', marginBottom:'20px' } },
        [['SPEED',vessel.speed+' kn'],['FUEL',vessel.fuel_rate+' MT/d'],['UTIL',vessel.cargo_util+'%'],['KXX',kxxText(vessel.lane_meters)]].map(function(item) {
          return React.createElement('div', { key:item[0], style:{ textAlign:'center', padding:'8px', background:'var(--s2)', borderRadius:'6px' } },
            React.createElement('div', { style:{ fontSize:'8px', color:'var(--t3)', letterSpacing:'1px', marginBottom:'3px' } }, item[0]),
            React.createElement('div', { style:{ fontSize:'13px', fontFamily:'var(--syne)', fontWeight:700, color:item[0]==='UTIL'?fc(vessel.cargo_util):'var(--text)' } }, item[1])
          );
        })
      ),

      React.createElement('div', { style:{ display:'flex', gap:'8px' } },
        React.createElement('button', { onClick:onClose, style:{ flex:1, background:'var(--green)', border:'none', color:'#000', fontFamily:'var(--syne)', fontSize:'12px', fontWeight:700, padding:'12px', borderRadius:'8px', cursor:'pointer', letterSpacing:'1px' } }, 'CONFIRM VOYAGE PLAN'),
        false,
        false,
        false,
        React.createElement('button', { onClick:onClose, style:{ background:'none', border:'1px solid var(--b2)', color:'var(--t2)', fontSize:'10px', padding:'12px 14px', borderRadius:'8px', cursor:'pointer' } }, 'Close')
      )
    )
  );
}

/* eslint-disable no-unused-vars, no-unreachable */
function disabledSeaChart(props) {
  var vessels = props.vessels || [];
  var myVessels = props.myVessels || [];
  var onVessel = props.onVessel;
  return React.createElement('div', { style:{ height:'100%', width:'100%', position:'relative', overflow:'hidden', background:'radial-gradient(circle at 50% 45%, rgba(0,212,255,.12), transparent 45%), linear-gradient(180deg,#06111c,#081826 55%,#050b12)' } },
    React.createElement('svg', { viewBox:'0 0 1000 520', preserveAspectRatio:'none', style:{ position:'absolute', inset:0, width:'100%', height:'100%' } },
      React.createElement('defs', null,
        React.createElement('pattern', { id:'grid', width:'50', height:'40', patternUnits:'userSpaceOnUse' },
          React.createElement('path', { d:'M 50 0 L 0 0 0 40', fill:'none', stroke:'rgba(122,155,181,.12)', strokeWidth:'1' })
        )
      ),
      React.createElement('rect', { x:0, y:0, width:1000, height:520, fill:'url(#grid)' }),
      [
        'M130,135 L205,85 L285,120 L300,205 L250,250 L170,230 L120,190 Z',
        'M250,260 L305,300 L330,380 L300,475 L250,430 L230,340 Z',
        'M430,120 L510,85 L605,120 L625,190 L565,235 L455,205 Z',
        'M545,235 L625,245 L650,315 L610,365 L535,330 Z',
        'M660,150 L750,120 L830,160 L850,230 L780,275 L690,245 Z',
        'M760,315 L835,330 L890,385 L870,450 L790,430 L740,370 Z',
        'M410,345 L455,355 L470,405 L430,430 L395,395 Z'
      ].map(function(d,i) {
        return React.createElement('path', { key:i, d:d, fill:'rgba(20,49,67,.78)', stroke:'rgba(0,212,255,.22)', strokeWidth:1.2 });
      }),
      [-120,-60,0,60,120].map(function(lon) {
        var x = ((lon + 180) / 360) * 1000;
        return React.createElement('text', { key:'lon'+lon, x:x+4, y:512, fill:'rgba(122,155,181,.45)', fontSize:'10' }, lon+'°');
      }),
      [-60,-30,0,30,60].map(function(lat) {
        var y = ((90 - lat) / 180) * 520;
        return React.createElement('text', { key:'lat'+lat, x:8, y:y-4, fill:'rgba(122,155,181,.45)', fontSize:'10' }, lat+'°');
      })
    ),
    vessels.map(function(v) {
      var p = { x:0, y:0 };
      var trade = getTrade(v);
      var isMine = hasVesselId(myVessels, v.id);
      return React.createElement('button', { key:v.id, title:v.name+' · '+trade.code+' · '+(v.aisUpdatedAt ? 'AIS '+v.aisUpdatedAt : 'stored position'), onClick:function(){onVessel && onVessel(v);}, style:{ position:'absolute', left:p.x+'%', top:p.y+'%', transform:'translate(-50%,-50%)', width:isMine?22:17, height:isMine?22:17, borderRadius:'50%', background:trade.color, border:'2px solid '+(isMine?'#fff':'rgba(255,255,255,.35)'), boxShadow:'0 0 12px '+trade.color, color:'#001018', fontSize:'8px', fontWeight:900, display:'grid', placeItems:'center', cursor:'pointer', padding:0 } }, v.propulsion === 'LNG' ? 'L' : '');
    }),
    React.createElement('div', { style:{ position:'absolute', left:16, bottom:14, display:'flex', gap:'8px', flexWrap:'wrap' } },
      TRADE_TAGS.map(function(t) {
        return React.createElement('span', { key:t.code, style:{ fontSize:'9px', color:t.color, border:'1px solid '+t.color+'55', background:t.color+'12', borderRadius:'4px', padding:'4px 7px', fontWeight:700 } }, t.code+' - '+t.label);
      })
    )
  );
}
/* eslint-enable no-unused-vars, no-unreachable */

/* eslint-disable no-unused-vars */
function projectPoint(lat, lon) {
  return {
    x: ((Number(lon) + 180) / 360) * 1000,
    y: ((90 - Number(lat)) / 180) * 520,
  };
}

function GradientWorldMap(props) {
  var vessels = props.vessels || [];
  var myVessels = props.myVessels || [];
  var onVessel = props.onVessel;
  var validPositions = vessels.filter(function(v) {
    var lat = Number(v.lat);
    var lon = Number(v.lon);
    return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
  });
  var landPaths = [
    'M95,150 L125,120 L178,94 L245,82 L310,102 L335,140 L322,188 L274,218 L235,252 L188,258 L146,238 L112,202 Z',
    'M260,260 L302,298 L323,356 L308,425 L278,482 L240,430 L220,360 L230,306 Z',
    'M360,70 L420,42 L465,68 L450,120 L392,128 Z',
    'M455,132 L505,108 L575,112 L635,138 L625,188 L552,205 L495,190 Z',
    'M512,202 L575,218 L604,284 L586,358 L540,432 L494,375 L474,292 Z',
    'M594,132 L675,90 L785,98 L905,142 L940,205 L890,258 L782,260 L704,226 L634,198 Z',
    'M700,245 L765,264 L812,322 L846,384 L816,448 L748,420 L710,350 Z',
    'M815,338 L880,348 L922,388 L902,438 L832,430 Z',
    'M700,54 L760,58 L795,88 L760,112 L700,100 Z',
    'M884,256 L934,280 L956,330 L928,360 L888,320 Z',
    'M428,218 L470,224 L455,252 L418,248 Z',
    'M790,258 L840,270 L822,304 L770,294 Z',
  ];
  var seaLabels = [
    { name:'NORTH ATLANTIC', x:375, y:210 },
    { name:'SOUTH ATLANTIC', x:415, y:390 },
    { name:'PACIFIC OCEAN', x:120, y:315 },
    { name:'INDIAN OCEAN', x:665, y:365 },
    { name:'ARABIAN SEA', x:640, y:285 },
    { name:'NORTH SEA', x:505, y:150 },
  ];

  return React.createElement('div', { style:{ height:'100%', minHeight:'520px', position:'relative', overflow:'hidden', background:'#03070d' } },
    React.createElement('svg', { viewBox:'0 0 1000 520', preserveAspectRatio:'xMidYMid meet', style:{ position:'absolute', inset:0, width:'100%', height:'100%' } },
      React.createElement('defs', null,
        React.createElement('radialGradient', { id:'oceanGlow', cx:'50%', cy:'48%', r:'62%' },
          React.createElement('stop', { offset:'0%', stopColor:'#0b2740', stopOpacity:.92 }),
          React.createElement('stop', { offset:'48%', stopColor:'#061421', stopOpacity:.96 }),
          React.createElement('stop', { offset:'100%', stopColor:'#02050a', stopOpacity:1 })
        ),
        React.createElement('linearGradient', { id:'landCyan', x1:'0%', y1:'0%', x2:'100%', y2:'0%' },
          React.createElement('stop', { offset:'0%', stopColor:'#00d4ff' }),
          React.createElement('stop', { offset:'48%', stopColor:'#0aa8bd' }),
          React.createElement('stop', { offset:'100%', stopColor:'#00e6d2' })
        ),
        React.createElement('filter', { id:'landGlow', x:'-20%', y:'-20%', width:'140%', height:'140%' },
          React.createElement('feGaussianBlur', { stdDeviation:'3.5', result:'blur' }),
          React.createElement('feColorMatrix', { in:'blur', type:'matrix', values:'0 0 0 0 0  0 0 0 0 0.72  0 0 0 0 0.9  0 0 0 .42 0', result:'glow' }),
          React.createElement('feMerge', null,
            React.createElement('feMergeNode', { in:'glow' }),
            React.createElement('feMergeNode', { in:'SourceGraphic' })
          )
        ),
        React.createElement('pattern', { id:'chartGrid', width:'60', height:'52', patternUnits:'userSpaceOnUse' },
          React.createElement('path', { d:'M60 0 L0 0 0 52', fill:'none', stroke:'rgba(0,212,255,.08)', strokeWidth:'1' })
        )
      ),
      React.createElement('rect', { width:1000, height:520, fill:'url(#oceanGlow)' }),
      React.createElement('rect', { width:1000, height:520, fill:'url(#chartGrid)', opacity:.55 }),
      React.createElement('ellipse', { cx:500, cy:270, rx:390, ry:210, fill:'none', stroke:'rgba(0,212,255,.08)', strokeWidth:1.2 }),
      landPaths.map(function(d, i) {
        return React.createElement('path', { key:i, d:d, fill:'url(#landCyan)', opacity:.78, filter:'url(#landGlow)' });
      }),
      seaLabels.map(function(label) {
        return React.createElement('text', { key:label.name, x:label.x, y:label.y, textAnchor:'middle', fill:'rgba(180,225,245,.34)', fontSize:'12', fontFamily:'Georgia, serif', fontStyle:'italic', letterSpacing:'2px' }, label.name);
      }),
      validPositions.map(function(v) {
        var p = projectPoint(v.lat, v.lon);
        var trade = getTrade(v);
        var isMine = hasVesselId(myVessels, v.id);
        return React.createElement('g', { key:v.id, onClick:function(){ if (onVessel) onVessel(v); }, style:{ cursor:'pointer' } },
          React.createElement('circle', { cx:p.x, cy:p.y, r:isMine?8:6, fill:'none', stroke:trade.color, strokeOpacity:.24, strokeWidth:8 }),
          React.createElement('circle', { cx:p.x, cy:p.y, r:isMine?5:3.5, fill:trade.color, stroke:isMine?'#fff':'rgba(255,255,255,.68)', strokeWidth:1.1 }),
          React.createElement('title', null, v.name+' - '+trade.code+' - '+Number(v.lat).toFixed(3)+', '+Number(v.lon).toFixed(3))
        );
      })
    ),
    React.createElement('div', { style:{ position:'absolute', top:14, left:14, background:'rgba(3,7,13,.76)', border:'1px solid rgba(0,212,255,.22)', borderRadius:'6px', padding:'8px 10px', pointerEvents:'none', boxShadow:'0 0 24px rgba(0,212,255,.08)' } },
      React.createElement('div', { style:{ fontFamily:'var(--syne)', fontSize:'11px', fontWeight:700, color:'var(--text)' } }, 'Fleet World Map'),
      React.createElement('div', { style:{ fontSize:'9px', color:'var(--t2)', marginTop:'2px' } }, validPositions.length+' noon report positions')
    ),
    React.createElement('div', { style:{ position:'absolute', left:14, bottom:14, display:'flex', gap:'7px', flexWrap:'wrap', pointerEvents:'none' } },
      TRADE_TAGS.map(function(t) {
        return React.createElement('span', { key:t.code, style:{ fontSize:'9px', color:t.color, border:'1px solid '+t.color+'55', background:'rgba(3,7,13,.78)', borderRadius:'4px', padding:'4px 7px', fontWeight:700 } }, t.code);
      })
    )
  );
}
/* eslint-enable no-unused-vars */

function LeafletWorldMap(props) {
  var vessels = props.vessels;
  var myVessels = props.myVessels;
  var onVessel = props.onVessel;
  var containerRef = useRef(null);
  var mapRef = useRef(null);
  var landRef = useRef(null);
  var gridRef = useRef([]);
  var markersRef = useRef([]);
  var portMarkersRef = useRef([]);
  var routeLinesRef = useRef([]);
  var seaLabelsRef = useRef([]);
  var srs = useState({}); var seaRoutes = srs[0]; var setSeaRoutes = srs[1];
  var validPositions = useMemo(function() { return (vessels || []).filter(function(v) {
    var lat = Number(v.lat);
    var lon = Number(v.lon);
    return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
  }); }, [vessels]);
  var knownPorts = useMemo(function() { return allPorts(); }, []);
  var relevantPorts = useMemo(function() { return collectRelevantPorts(vessels || [], knownPorts); }, [vessels, knownPorts]);

  useEffect(function() {
    var cancelled = false;
    var pending = {};
    validPositions.forEach(function(vessel) {
      var lastPort = resolveFleetPort(vessel.last_port, knownPorts);
      var nextPort = resolveFleetPort(vessel.next_port, knownPorts);
      if (!lastPort || !nextPort) return;
      pending[seaRouteKey(lastPort, nextPort)] = [lastPort, nextPort];
    });
    Promise.all(Object.keys(pending).map(function(key) {
      var ports = pending[key];
      return createSeaRoute([ports[0].lon, ports[0].lat], [ports[1].lon, ports[1].lat])
        .then(function(route) { return [key, route.coordinates || []]; })
        .catch(function() { return [key, []]; });
    })).then(function(routes) {
      if (cancelled) return;
      var next = {};
      routes.forEach(function(item) {
        next[item[0]] = item[1]
          .filter(function(point) { return Array.isArray(point) && point.length >= 2; })
          .map(function(point) { return [Number(point[1]), Number(point[0])]; });
      });
      setSeaRoutes(next);
    });
    return function() { cancelled = true; };
  }, [validPositions, knownPorts, setSeaRoutes]);

  useEffect(function() {
    if (!containerRef.current || mapRef.current) return;
    mapRef.current = L.map(containerRef.current, {
      center:[20, 5],
      zoom:2,
      minZoom:2,
      maxZoom:6,
      worldCopyJump:true,
      zoomControl:true,
      attributionControl:false,
      preferCanvas:true,
    });
    L.control.attribution({ prefix:false }).addAttribution('Natural Earth / OpenStreetMap').addTo(mapRef.current);
    WORLD_OFFSETS.forEach(function(offset) {
      [-60,-30,0,30,60].forEach(function(lat) {
        gridRef.current.push(L.polyline([[lat, -180 + offset], [lat, 180 + offset]], { color:'rgba(0,212,255,.12)', weight:1, interactive:false }).addTo(mapRef.current));
      });
      [-120,-60,0,60,120].forEach(function(lon) {
        gridRef.current.push(L.polyline([[-70, lon + offset], [80, lon + offset]], { color:'rgba(0,212,255,.10)', weight:1, interactive:false }).addTo(mapRef.current));
      });
    });
    fetch('/data/countries.geojson').then(function(response) { return response.json(); }).then(function(geojson) {
      if (!mapRef.current) return;
      landRef.current = L.layerGroup();
      WORLD_OFFSETS.forEach(function(offset) {
        L.geoJSON(geojson, {
          coordsToLatLng:function(coords) {
            return new L.LatLng(coords[1], coords[0] + offset);
          },
          style:function() {
            return {
              fillColor:'#00d4ff',
              fillOpacity:.68,
              color:'rgba(0,232,210,.58)',
              weight:.45,
              opacity:.85,
              interactive:false,
            };
          },
        }).addTo(landRef.current);
      });
      landRef.current.addTo(mapRef.current);
    }).catch(function() {});
    setTimeout(function(){ if (mapRef.current) mapRef.current.invalidateSize(true); }, 120);
    return function() {
      gridRef.current.forEach(function(line) { line.remove(); });
      gridRef.current = [];
      if (landRef.current) {
        landRef.current.remove();
        landRef.current = null;
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(function() {
    if (!mapRef.current) return;
    markersRef.current.forEach(function(marker) { marker.remove(); });
    markersRef.current = [];
    portMarkersRef.current.forEach(function(marker) { marker.remove(); });
    portMarkersRef.current = [];
    routeLinesRef.current.forEach(function(line) { line.remove(); });
    routeLinesRef.current = [];
    seaLabelsRef.current.forEach(function(label) { label.remove(); });
    seaLabelsRef.current = [];
    WORLD_OFFSETS.forEach(function(offset) {
      SEA_LABELS.forEach(function(label) {
        var seaIcon = L.divIcon({
          html:'<div class="fleet-sea-label">'+label.name+'</div>',
          className:'fleet-sea-label-icon',
          iconSize:[160, 18],
          iconAnchor:[80, 9],
        });
        seaLabelsRef.current.push(L.marker([label.lat, label.lon + offset], { icon:seaIcon, interactive:false, keyboard:false }).addTo(mapRef.current));
      });
    });
    validPositions.forEach(function(v) {
      var lat = Number(v.lat);
      var lon = Number(v.lon);
      var isMine = hasVesselId(myVessels, v.id);
      var lastPort = resolveFleetPort(v.last_port, knownPorts);
      var nextPort = resolveFleetPort(v.next_port, knownPorts);
      WORLD_OFFSETS.forEach(function(offset) {
        var routePoints = lastPort && nextPort
          ? (seaRoutes[seaRouteKey(lastPort, nextPort)] || []).map(function(point) { return [point[0], point[1] + offset]; })
          : [];
        if (routePoints.length > 1) {
          routeLinesRef.current.push(L.polyline(routePoints, {
            color:'rgba(0,212,255,.42)',
            weight:1.8,
            opacity:.86,
            dashArray:'7 8',
            lineCap:'round',
            lineJoin:'round',
            interactive:false,
          }).addTo(mapRef.current));
        }
        var markerSize = isMine ? 14 : 11;
        var heading = Number.isFinite(Number(v.heading)) ? Number(v.heading) : 90;
        var html = '<div style="width:0;height:0;border-left:'+(markerSize/2)+'px solid transparent;border-right:'+(markerSize/2)+'px solid transparent;border-bottom:'+markerSize+'px solid #ff334f;filter:drop-shadow(0 0 5px rgba(255,51,79,.75));transform:rotate('+heading+'deg);transform-origin:50% 65%;"></div>';
        var icon = L.divIcon({ html:html, className:'fleet-vessel-triangle', iconSize:[markerSize,markerSize], iconAnchor:[markerSize/2,markerSize/2] });
        var marker = L.marker([lat, lon + offset], { icon:icon }).addTo(mapRef.current);
        marker.bindTooltip(v.name, {
          direction:'top',
          offset:[0, -8],
          opacity:.96,
          sticky:true,
        });
        marker.bindPopup('<div style="min-width:180px;background:#0b1522;color:#e8f4ff;font-family:Arial,sans-serif"><b>'+v.name+'</b><br/>IMO '+(v.imo||'')+(v.mmsi?' / MMSI '+v.mmsi:'')+'<br/>Lat '+lat.toFixed(3)+' / Lon '+lon.toFixed(3)+'<br/>Speed '+(v.status==='sea'?v.speed+' kn':'-')+'<br/>Position: '+(v.updated_by?'Noon report '+v.updated_by:'Noon report / stored')+'</div>');
        marker.on('click', function(){ if (onVessel) onVessel(v); });
        markersRef.current.push(marker);
      });
    });
    relevantPorts.forEach(function(port) {
      WORLD_OFFSETS.forEach(function(offset) {
        var icon = L.divIcon({
          html:'<div style="width:12px;height:12px;border-radius:50%;border:1px solid rgba(0,212,255,.85);background:rgba(0,212,255,.14);box-shadow:0 0 10px rgba(0,212,255,.22);position:relative"><div style="position:absolute;left:4px;top:4px;width:4px;height:4px;border-radius:50%;background:#00d4ff"></div></div>',
          className:'fleet-port-marker',
          iconSize:[12,12],
          iconAnchor:[6,6],
        });
        var marker = L.marker([port.lat, port.lon + offset], { icon:icon }).addTo(mapRef.current);
        marker.bindPopup('<div style="min-width:170px;background:#0b1522;color:#e8f4ff;font-family:Arial,sans-serif"><b>'+port.name+'</b><br/>Code '+(port.code || '-')+'<br/>Relevant vessels: '+port.vessels.length+'</div>');
        portMarkersRef.current.push(marker);
      });
    });
    mapRef.current.setView([20, 5], 2);
    setTimeout(function(){ if (mapRef.current) mapRef.current.invalidateSize(true); }, 80);
  }, [validPositions, myVessels, onVessel, knownPorts, relevantPorts, seaRoutes]);

  return React.createElement('div', { className:'fleet-nautical-map', style:{ height:'100%', minHeight:'520px', width:'100%', position:'relative', background:'#02050a', overflow:'hidden' } },
    React.createElement('style', null, '.fleet-nautical-map .leaflet-container{background:radial-gradient(circle at 50% 48%,#0b2740 0%,#061421 42%,#02050a 100%)}.fleet-nautical-map .leaflet-overlay-pane svg{filter:drop-shadow(0 0 8px rgba(0,212,255,.22))}.fleet-nautical-map .leaflet-marker-pane{z-index:650}.fleet-nautical-map .leaflet-control-attribution{background:rgba(3,7,13,.74);color:#7a9bb5}.fleet-nautical-map .leaflet-control-zoom a{background:#06111c;color:#00d4ff;border-color:rgba(0,212,255,.22)}.fleet-nautical-map .leaflet-popup-content-wrapper,.fleet-nautical-map .leaflet-popup-tip{background:#06111c;color:#e8f4ff;border:1px solid rgba(0,212,255,.2)}.fleet-nautical-map .leaflet-tooltip{background:rgba(3,7,13,.94);border:1px solid rgba(0,212,255,.42);border-radius:4px;color:#e8f4ff;font-size:10px;font-weight:700;padding:4px 7px;box-shadow:0 0 16px rgba(0,212,255,.16)}.fleet-nautical-map .leaflet-tooltip-top:before{border-top-color:rgba(0,212,255,.42)}.fleet-sea-label{font-family:Georgia,serif;font-size:12px;font-style:italic;letter-spacing:1.6px;text-transform:uppercase;color:rgba(180,225,245,.38);text-shadow:0 1px 2px rgba(0,0,0,.95),0 0 12px rgba(0,212,255,.18);text-align:center;white-space:nowrap;pointer-events:none}.fleet-sea-label-icon{background:transparent;border:none}'),
    React.createElement('div', { style:{ position:'absolute', inset:0, zIndex:0, background:'radial-gradient(circle at 50% 48%,rgba(0,212,255,.14),transparent 44%),linear-gradient(180deg,#03070d,#061421 52%,#02050a)' } },
      React.createElement('div', { style:{ position:'absolute', inset:0, opacity:.18, backgroundImage:'linear-gradient(rgba(0,212,255,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,.12) 1px, transparent 1px)', backgroundSize:'72px 72px' } })
    ),
    React.createElement('div', { ref:containerRef, style:{ height:'100%', width:'100%', position:'relative', zIndex:1 } }),
    React.createElement('div', { style:{ position:'absolute', inset:0, zIndex:2, pointerEvents:'none', background:'linear-gradient(90deg,rgba(0,212,255,.08),transparent 36%,rgba(0,232,210,.08))', mixBlendMode:'screen' } }),
    React.createElement('div', { style:{ position:'absolute', inset:0, zIndex:3, pointerEvents:'none', boxShadow:'inset 0 0 58px rgba(0,0,0,.52)' } }),
    React.createElement('div', { style:{ position:'absolute', top:14, left:14, zIndex:500, background:'rgba(3,7,13,.78)', border:'1px solid rgba(0,212,255,.22)', borderRadius:'6px', padding:'8px 10px', pointerEvents:'none', boxShadow:'0 0 24px rgba(0,212,255,.08)' } },
      React.createElement('div', { style:{ fontFamily:'var(--syne)', fontSize:'11px', fontWeight:700, color:'var(--text)' } }, 'Nautical Fleet Chart'),
      React.createElement('div', { style:{ fontSize:'9px', color:'var(--t2)', marginTop:'2px' } }, validPositions.length+' vessel positions / '+relevantPorts.length+' relevant ports')
    ),
    !validPositions.length && React.createElement('div', { style:{ position:'absolute', inset:0, zIndex:450, display:'grid', placeItems:'center', pointerEvents:'none' } },
      React.createElement('div', { style:{ background:'rgba(7,19,31,.9)', border:'1px solid rgba(0,212,255,.24)', borderRadius:'8px', padding:'14px 18px', textAlign:'center' } },
        React.createElement('div', { style:{ fontFamily:'var(--syne)', fontSize:'13px', fontWeight:700, color:'var(--accent)', marginBottom:'4px' } }, 'No noon report positions'),
        React.createElement('div', { style:{ fontSize:'10px', color:'var(--t2)' } }, 'Apply noon reports with latitude and longitude to update the map.')
      )
    ),
    React.createElement('div', { style:{ position:'absolute', left:14, bottom:14, zIndex:500, display:'flex', gap:'7px', flexWrap:'wrap', pointerEvents:'none' } },
      TRADE_TAGS.map(function(t) {
        return React.createElement('span', { key:t.code, style:{ fontSize:'9px', color:t.color, border:'1px solid '+t.color+'44', background:'rgba(7,19,31,.82)', borderRadius:'4px', padding:'4px 7px', fontWeight:700 } }, t.code);
      })
    )
  );
}

/* eslint-disable no-unused-vars */
function PositionBoard(props) {
  var vessels = props.vessels || [];
  var myVessels = props.myVessels || [];
  var onVessel = props.onVessel;
  return React.createElement('div', { style:{ height:'100%', overflowY:'auto', padding:'14px', background:'linear-gradient(180deg,rgba(0,212,255,.04),transparent 180px)' } },
    React.createElement('div', { style:{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:'10px' } },
      vessels.map(function(v) {
        var isMine = hasVesselId(myVessels, v.id);
        return React.createElement('button', { key:v.id, onClick:function(){onVessel && onVessel(v);}, style:{ textAlign:'left', background:'var(--s1)', border:'1px solid '+(isMine?'var(--accent)':'var(--b1)'), borderRadius:'var(--radius)', padding:'12px', color:'var(--text)', cursor:'pointer' } },
          React.createElement('div', { style:{ display:'flex', justifyContent:'space-between', gap:'8px', alignItems:'flex-start', marginBottom:'8px' } },
            React.createElement('div', null,
              React.createElement('div', { style:{ fontFamily:'var(--syne)', fontSize:'12px', fontWeight:700 } }, v.name),
              React.createElement('div', { style:{ fontSize:'9px', color:'var(--t3)', marginTop:'2px' } }, 'IMO '+v.imo+(v.mmsi?' · MMSI '+v.mmsi:'' ))
            ),
            tradeBadge(v)
          ),
          React.createElement('div', { style:{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'7px', marginBottom:'8px' } },
            [['LAT', Number(v.lat || 0).toFixed(3)], ['LON', Number(v.lon || 0).toFixed(3)], ['STATUS', SL[v.status] || v.status], ['SPEED', v.status==='sea' ? v.speed+' kn' : '—']].map(function(item) {
              return React.createElement('div', { key:item[0], style:{ background:'var(--s2)', border:'1px solid var(--b1)', borderRadius:'5px', padding:'7px 8px' } },
                React.createElement('div', { style:{ fontSize:'8px', color:'var(--t3)', marginBottom:'2px' } }, item[0]),
                React.createElement('div', { style:{ fontSize:'11px', fontWeight:600 } }, item[1])
              );
            })
          ),
          React.createElement('div', { style:{ fontSize:'9px', color:'var(--t2)' } }, v.updated_by ? 'Noon report updated '+v.updated_by : 'Noon report / stored position')
        );
      })
    )
  );
}
/* eslint-enable no-unused-vars */

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function FleetOverview({ onNavigate, onOpenSchedule }) {
  var s1 = useState(function() { return normalizeFleetVessels(KLINE_VESSELS); }); var vessels = s1[0]; var setVessels = s1[1];
  var s2 = useState('fleet'); var activeTab = s2[0]; var setActiveTab = s2[1];
  var s3 = useState('all'); var filter = s3[0]; var setFilter = s3[1];
  var s4 = useState(false); var mapMode = s4[0]; var setMapMode = s4[1];
  var s5 = useState([]); var myVessels = s5[0]; var setMyVessels = s5[1];
  var s7 = useState(false); var showAdd = s7[0]; var setShowAdd = s7[1];
  var s8 = useState(null); var deleteConfirm = s8[0]; var setDeleteConfirm = s8[1];
  var s9 = useState(null); var actionVessel = s9[0]; var setActionVessel = s9[1];
  var s10 = useState(''); var noonStatus = s10[0]; var setNoonStatus = s10[1];
  var s11 = useState(false); var mapMyOnly = s11[0]; var setMapMyOnly = s11[1];
  var s12 = useState(false); var myVesselsLoaded = s12[0]; var setMyVesselsLoaded = s12[1];
  var mapRef = useRef(null); var leafletRef = useRef(null); var markersRef = useRef([]);

  useEffect(function() {
    listVessels().then(function(data) {
      if (data && data.length) {
        setVessels(function(current) {
          var merged = current.slice();
          data.forEach(function(remoteVessel) {
            var index = merged.findIndex(function(localVessel) {
              return sameFleetVessel(localVessel, remoteVessel);
            });
            if (index >= 0) merged[index] = Object.assign({}, merged[index], remoteVessel, { trade:remoteVessel.trade || merged[index].trade || inferTrade(remoteVessel) });
            else merged.push(Object.assign({}, remoteVessel, { trade:remoteVessel.trade || inferTrade(remoteVessel) }));
          });
          return normalizeFleetVessels(merged);
        });
      }
    }).catch(function() {});
  }, [setVessels]);

  useEffect(function() {
    listMyVesselsFromApi().then(function(data) {
      setVessels(function(current) {
        var merged = current.slice();
        (data || []).forEach(function(remoteVessel) {
          var index = merged.findIndex(function(localVessel) { return vesselIdKey(localVessel.id) === vesselIdKey(remoteVessel.id); });
          if (index >= 0) merged[index] = Object.assign({}, merged[index], remoteVessel);
          else merged.push(remoteVessel);
        });
        return normalizeFleetVessels(merged);
      });
      setMyVessels(uniqueVesselIds((data || []).map(function(vessel) { return vessel.id; })));
      setMyVesselsLoaded(true);
    }).catch(function() {
      setMyVesselsLoaded(true);
    });
  }, [setVessels, setMyVessels, setMyVesselsLoaded]);

  useEffect(function() {
    var validIds = validMyVesselIds(myVessels, vessels);
    if (!sameVesselIds(myVessels, validIds)) {
      setMyVessels(validIds);
      return;
    }
    if (myVesselsLoaded) {
      saveMyVesselsToApi(validIds).catch(function(error) {
        console.warn('My vessels save failed.', error.message);
      });
    }
  }, [myVessels, vessels, myVesselsLoaded, setMyVessels]);

  useEffect(function() {
    if (true || !mapMode || activeTab !== 'fleet') return;
    var L = window.L;
    if (!L || !mapRef.current) return;
    if (!leafletRef.current) {
      leafletRef.current = L.map(mapRef.current, { center:[30,0], zoom:3, zoomControl:true, attributionControl:false });
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom:18, subdomains:'abcd' }).addTo(leafletRef.current);
    }
    markersRef.current.forEach(function(m) { m.remove(); });
    markersRef.current = [];
    vessels.forEach(function(v) {
      var color = SC[v.status] || '#fff';
      var html = '<div style="width:20px;height:20px;background:'+color+';border-radius:50%;border:2px solid rgba(255,255,255,.3);box-shadow:0 0 6px '+color+';display:flex;align-items:center;justify-content:center;font-size:7px;color:#000;font-weight:bold">'+(v.propulsion==='LNG'?'L':'K')+'</div>';
      var icon = L.divIcon({ html:html, className:'', iconAnchor:[10,10] });
      var marker = L.marker([v.lat||0, v.lon||0], { icon:icon }).addTo(leafletRef.current);
      marker.bindPopup('<div style="font-family:monospace;min-width:170px"><b style="color:#e8f4ff;font-size:12px">'+v.name+'</b>'+(v.propulsion==='LNG'?' <span style="color:#00e896;font-size:9px">[LNG]</span>':'')+'<br/><span style="color:'+color+'">'+v.route+'</span><br/>Speed: '+v.speed+' kn · Util: '+v.cargo_util+'%<br/>ETA: '+v.eta+'</div>');
      markersRef.current.push(marker);
    });
  }, [vessels, mapMode, activeTab]);


  async function addVessel(vessel) {
    try {
      var saved = await createVesselRecord(vessel);
      var newV = normalizeFleetVessels([saved])[0];
      setVessels(function(prev) { return prev.concat([newV]); });
    } catch(error) {
      console.warn('Vessel save failed.', error.message);
    }
  }

  function deleteVessel(id) {
    setVessels(function(prev) { return prev.filter(function(v){return v.id!==id;}); });
    setMyVessels(function(prev) { return prev.filter(function(x){return vesselIdKey(x)!==vesselIdKey(id);}); });
    deleteVesselRecord(id).catch(function(error) {
      console.warn('Vessel delete failed.', error.message);
    });
    setDeleteConfirm(null);
  }

  function toggleMyVessel(id) {
    setMyVessels(function(prev) { return hasVesselId(prev, id) ? prev.filter(function(x){return vesselIdKey(x)!==vesselIdKey(id);}) : uniqueVesselIds(prev.concat([id])); });
  }

  function openScheduleFromFleet(vessel) {
    if (onOpenSchedule) onOpenSchedule(vessel);
    else if (onNavigate) onNavigate('rotation');
  }

  function refreshNoonPositions() {
    setNoonStatus('Refreshing noon report positions...');
    listVessels().then(function(remote) {
      if (!remote.length) {
        setNoonStatus('No noon report positions found.');
        return;
      }
      setVessels(function(current) {
        var merged = current.slice();
        remote.forEach(function(remoteVessel) {
          var index = merged.findIndex(function(localVessel) {
            return String(localVessel.id) === String(remoteVessel.id) || (remoteVessel.imo && String(localVessel.imo) === String(remoteVessel.imo));
          });
          var normalized = normalizeFleetVessels([Object.assign({}, remoteVessel, { trade:remoteVessel.trade || inferTrade(remoteVessel) })])[0];
          if (index >= 0) merged[index] = Object.assign({}, merged[index], normalized);
          else merged.push(normalized);
        });
        return normalizeFleetVessels(merged);
      });
      setNoonStatus('Noon report positions refreshed.');
    }).catch(function() {
      setNoonStatus('Could not refresh noon report positions.');
    });
  }

  var filtered = filter==='all' ? vessels : vessels.filter(function(v){return v.status===filter;});
  var myVesselList = vessels.filter(function(v){return hasVesselId(myVessels, v.id);});
  var dashboardVessels = activeTab === 'my' ? myVesselList : filtered;
  var mapVessels = mapMyOnly ? myVesselList : filtered;

  return React.createElement('div', { style:{ height:'100%', display:'flex', flexDirection:'column', overflow:'hidden' } },

    showAdd && React.createElement(AddVesselModal, { onAdd:addVessel, onClose:function(){setShowAdd(false);} }),

    deleteConfirm && React.createElement('div', { onClick:function(e){if(e.target===e.currentTarget)setDeleteConfirm(null);}, style:{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', zIndex:999, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(6px)' } },
      React.createElement('div', { style:{ background:'var(--s1)', border:'1px solid var(--red)', borderRadius:'10px', padding:'24px', width:'340px', textAlign:'center' } },
        React.createElement('div', { style:{ fontSize:'24px', marginBottom:'10px' } }, '🗑'),
        React.createElement('div', { style:{ fontFamily:'var(--syne)', fontSize:'14px', fontWeight:700, marginBottom:'6px' } }, 'Delete Vessel?'),
        React.createElement('div', { style:{ fontSize:'11px', color:'var(--t2)', marginBottom:'20px' } }, 'Remove '+deleteConfirm.name+' from the fleet? This cannot be undone.'),
        React.createElement('div', { style:{ display:'flex', gap:'8px', justifyContent:'center' } },
          React.createElement('button', { onClick:function(){setDeleteConfirm(null);}, style:{ background:'none', border:'1px solid var(--b1)', color:'var(--t2)', fontSize:'10px', padding:'8px 16px', borderRadius:'6px', cursor:'pointer' } }, 'Cancel'),
          React.createElement('button', { onClick:function(){deleteVessel(deleteConfirm.id);}, style:{ background:'rgba(255,69,96,.15)', border:'1px solid var(--red)', color:'var(--red)', fontSize:'10px', fontWeight:700, padding:'8px 16px', borderRadius:'6px', cursor:'pointer' } }, 'Delete')
        )
      )
    ),

    false && actionVessel && React.createElement('div', { onClick:function(e){if(e.target===e.currentTarget)setActionVessel(null);}, style:{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', zIndex:999, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(6px)' } },
      React.createElement('div', { style:{ background:'var(--s1)', border:'1px solid var(--b2)', borderRadius:'10px', padding:'22px', width:'360px' } },
        React.createElement('div', { style:{ display:'flex', alignItems:'center', gap:'7px', marginBottom:'4px' } },
          React.createElement('div', { style:{ fontFamily:'var(--syne)', fontSize:'14px', fontWeight:700 } }, actionVessel.name),
          voyageBadge(actionVessel)
        ),
        React.createElement('div', { style:{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'18px', flexWrap:'wrap' } },
          React.createElement('span', { style:{ fontSize:'10px', color:'var(--t2)' } }, 'IMO '+actionVessel.imo+' - '+(actionVessel.route||'No route set')),
          tradeBadge(actionVessel)
        ),
        React.createElement('div', { style:{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'14px' } },
          React.createElement('button', { onClick:function(){openScheduleFromFleet(actionVessel);setActionVessel(null);}, style:{ background:'var(--green)', border:'none', color:'#000', fontFamily:'var(--syne)', fontSize:'11px', fontWeight:700, padding:'10px', borderRadius:'6px', cursor:'pointer' } }, 'VOYAGE PLAN'),
          React.createElement('button', { onClick:function(){if(onOpenSchedule)onOpenSchedule(actionVessel);else if(onNavigate)onNavigate('rotation');setActionVessel(null);}, style:{ background:'var(--accent)', border:'none', color:'#000', fontFamily:'var(--syne)', fontSize:'11px', fontWeight:700, padding:'10px', borderRadius:'6px', cursor:'pointer' } }, 'SCHEDULE')
        ),
        React.createElement('button', { onClick:function(){setActionVessel(null);}, style:{ width:'100%', background:'none', border:'1px solid var(--b1)', color:'var(--t2)', fontSize:'10px', padding:'8px', borderRadius:'6px', cursor:'pointer' } }, 'Close')
      )
    ),

    React.createElement('div', { style:{ padding:'10px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0, borderBottom:'1px solid var(--b1)', flexWrap:'wrap', gap:'8px' } },
      React.createElement('div', { style:{ display:'flex', gap:'2px', background:'var(--s2)', border:'1px solid var(--b1)', borderRadius:'var(--radius-sm)' } },
        [['fleet','Fleet ('+vessels.length+')'],['my','My Vessels ('+myVesselList.length+')']].map(function(item) {
          return React.createElement('button', { key:item[0], onClick:function(){setActiveTab(item[0]); if(item[0]==='my')setMapMyOnly(true);}, style:{ background:activeTab===item[0]?'var(--accent)':'none', border:'none', color:activeTab===item[0]?'#000':'var(--t2)', fontSize:'10px', padding:'6px 14px', borderRadius:'var(--radius-sm)', cursor:'pointer', fontWeight:activeTab===item[0]?600:400, whiteSpace:'nowrap' } }, item[1]);
        })
      ),
      React.createElement('div', { style:{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' } },
        activeTab==='fleet' && !mapMode && React.createElement('div', { style:{ display:'flex', gap:'4px' } },
          ['all','sea','port','loading','discharge'].map(function(f) {
            return React.createElement('button', { key:f, onClick:function(){setFilter(f);}, style:{ background:filter===f?'var(--accent)':'var(--s2)', border:'1px solid var(--b1)', color:filter===f?'#000':'var(--t2)', fontSize:'9px', padding:'4px 8px', borderRadius:'var(--radius-sm)', cursor:'pointer' } }, f.toUpperCase());
          })
        ),
        activeTab==='fleet' && React.createElement('div', { style:{ display:'flex', background:'var(--s2)', border:'1px solid var(--b1)', borderRadius:'var(--radius-sm)' } },
          React.createElement('button', { onClick:function(){setMapMode(true);}, style:{ background:mapMode?'var(--accent)':'none', border:'none', color:mapMode?'#000':'var(--t2)', fontSize:'9px', padding:'5px 10px', borderRadius:'var(--radius-sm)', cursor:'pointer' } }, 'MAP'),
          React.createElement('button', { onClick:function(){setMapMode(false);}, style:{ background:!mapMode?'var(--accent)':'none', border:'none', color:!mapMode?'#000':'var(--t2)', fontSize:'9px', padding:'5px 10px', borderRadius:'var(--radius-sm)', cursor:'pointer' } }, 'CARDS')
        ),
        mapMode && React.createElement('label', { style:{ display:'flex', alignItems:'center', gap:'5px', fontSize:'9px', color:'var(--t2)', background:'var(--s2)', border:'1px solid var(--b1)', borderRadius:'var(--radius-sm)', padding:'5px 8px' } },
          React.createElement('input', { type:'checkbox', checked:mapMyOnly, onChange:function(e){setMapMyOnly(e.target.checked);} }),
          'My vessels'
        ),
        mapMode && React.createElement('button', { onClick:refreshNoonPositions, style:{ background:'var(--s2)', border:'1px solid var(--b1)', color:'var(--accent)', fontSize:'9px', padding:'5px 10px', borderRadius:'var(--radius-sm)', cursor:'pointer' } }, 'REFRESH NOON POSITIONS'),
        mapMode && noonStatus && React.createElement('span', { style:{ fontSize:'9px', color:noonStatus.includes('refreshed')?'var(--green)':'var(--yellow)' } }, noonStatus),
        React.createElement('button', { onClick:function(){setShowAdd(true);}, style:{ background:'var(--accent)', border:'none', color:'#000', fontSize:'10px', fontWeight:700, padding:'6px 14px', borderRadius:'var(--radius-sm)', cursor:'pointer', whiteSpace:'nowrap' } }, '+ Add Vessel')
      )
    ),

    false && activeTab === 'my' ? (
      React.createElement('div', { style:{ flex:1, overflowY:'auto', padding:'16px' } },
        React.createElement('div', { style:{ fontFamily:'var(--syne)', fontSize:'15px', fontWeight:700, marginBottom:'4px' } }, 'My Vessels'),
        React.createElement('div', { style:{ fontSize:'10px', color:'var(--t2)', marginBottom:'16px' } }, 'Vessels you are PIC for. Click + My Vessel on any card to nominate.'),
        myVesselList.length === 0 ? (
          React.createElement('div', { style:{ textAlign:'center', padding:'40px', color:'var(--t3)' } },
            React.createElement('div', { style:{ fontSize:'28px', marginBottom:'10px' } }, '🚢'),
            React.createElement('div', { style:{ fontFamily:'var(--syne)', fontSize:'13px', color:'var(--t2)', marginBottom:'6px' } }, 'No vessels nominated yet'),
            React.createElement('div', { style:{ fontSize:'11px', marginBottom:'16px' } }, 'Go to Fleet tab and click + My Vessel on any card'),
            React.createElement('button', { onClick:function(){setActiveTab('fleet');}, style:{ background:'var(--accent)', border:'none', color:'#000', fontSize:'11px', padding:'8px 16px', borderRadius:'var(--radius-sm)', fontWeight:600, cursor:'pointer' } }, 'Go to Fleet')
          )
        ) : (
          React.createElement('div', { style:{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:'12px' } },
            myVesselList.map(function(v) {
              return React.createElement('div', { key:v.id, style:{ background:'var(--s1)', border:'1px solid var(--accent)', borderRadius:'var(--radius)', padding:'16px' } },
                React.createElement('div', { style:{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'8px' } },
                  React.createElement('div', null,
                    React.createElement('div', { style:{ fontFamily:'var(--syne)', fontWeight:700, fontSize:'13px', marginBottom:'3px' } }, v.name),
                    React.createElement('div', { style:{ display:'flex', gap:'5px', alignItems:'center', flexWrap:'wrap' } },
                      React.createElement('span', { style:{ fontSize:'9px', color:'var(--t3)' } }, v.imo+' · '+v.type),
                      voyageBadge(v),
                      tradeBadge(v),
                      v.propulsion==='LNG' && React.createElement(LngBadge)
                    )
                  ),
                  React.createElement('button', { onClick:function(){toggleMyVessel(v.id);}, style:{ background:'rgba(255,69,96,.1)', border:'1px solid var(--red)', color:'var(--red)', fontSize:'8px', padding:'2px 6px', borderRadius:'3px', cursor:'pointer' } }, 'Remove')
                ),
                React.createElement('div', { style:{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'6px', marginBottom:'10px' } },
                  [['Status',(SL[v.status]||v.status),SC[v.status]||'var(--text)'],['Speed',v.status==='sea'?v.speed+' kn':'Berth','var(--text)'],['Util',v.cargo_util+'%',fc(v.cargo_util)],['Kxx',kxxText(v.lane_meters),'var(--accent)'],['Voyage',v.voyage_number || '—','var(--yellow)'],['ETA',v.eta,'var(--text)'],['Route',v.route,'var(--t2)']].map(function(item) {
                    return React.createElement('div', { key:item[0], style:{ background:'var(--s2)', borderRadius:'5px', padding:'7px 8px' } },
                      React.createElement('div', { style:{ fontSize:'8px', color:'var(--t3)', marginBottom:'2px' } }, item[0]),
                      React.createElement('div', { style:{ fontSize:'11px', fontWeight:500, color:item[2] } }, item[1])
                    );
                  })
                ),
                React.createElement('div', { style:{ height:'4px', background:'var(--b1)', borderRadius:'2px', overflow:'hidden', marginBottom:'12px' } },
                  React.createElement('div', { style:{ height:'100%', width:v.cargo_util+'%', background:fc(v.cargo_util), borderRadius:'2px' } })
                ),
                React.createElement('button', { onClick:function(){openScheduleFromFleet(v);}, style:{ width:'100%', background:'linear-gradient(135deg,rgba(0,232,150,.15),rgba(0,212,255,.15))', border:'1px solid var(--green)', color:'var(--green)', fontFamily:'var(--syne)', fontSize:'11px', fontWeight:700, padding:'9px', borderRadius:'6px', cursor:'pointer', letterSpacing:'1px' } }, 'VOYAGE PLAN')
              );
            })
          )
        )
      )
    ) : (
      React.createElement('div', { style:{ flex:1, overflow:'hidden' } },
        mapMode ? (
          React.createElement(LeafletWorldMap, { vessels:mapVessels, myVessels:myVessels, onVessel:openScheduleFromFleet })
        ) : (
          React.createElement('div', { style:{ height:'100%', overflowY:'auto', padding:'14px', display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(270px,1fr))', gap:'10px', alignContent:'start' } },
            dashboardVessels.map(function(v) {
              var isMyVessel = hasVesselId(myVessels, v.id);
              var isLNG = v.propulsion === 'LNG' || v.propulsion === 'METHANOL';
              return React.createElement('div', { key:v.id, onClick:function(){openScheduleFromFleet(v);},
                onMouseEnter:function(e){e.currentTarget.style.borderColor=isMyVessel?'var(--accent)':'var(--b3)';},
                onMouseLeave:function(e){e.currentTarget.style.borderColor=isMyVessel?'var(--accent)':'var(--b1)';},
                style:{ background:'var(--s1)', border:'1px solid '+(isMyVessel?'var(--accent)':'var(--b1)'), borderRadius:'var(--radius)', padding:'14px', cursor:'pointer', position:'relative' }
              },
                React.createElement('div', { style:{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'8px' } },
                  React.createElement('div', { style:{ flex:1, minWidth:0 } },
                    React.createElement('div', { style:{ display:'flex', alignItems:'flex-start', gap:'5px', marginBottom:'2px', flexWrap:'wrap' } },
                      React.createElement('div', { style:{ fontFamily:'var(--syne)', fontWeight:700, fontSize:'12px', lineHeight:1.25, whiteSpace:'normal', overflowWrap:'anywhere', flex:'1 1 150px' } }, v.name),
                      voyageBadge(v),
                      tradeBadge(v),
                      isLNG && React.createElement(LngBadge)
                    ),
                    React.createElement('div', { style:{ fontSize:'8px', color:'var(--t3)' } }, 'IMO '+v.imo+' · '+v.route)
                  ),
                  React.createElement('span', { style:{ fontSize:'8px', padding:'2px 6px', borderRadius:'20px', fontWeight:500, background:(SC[v.status]||'#fff')+'22', color:(SC[v.status]||'#fff'), flexShrink:0, marginLeft:'4px' } }, SL[v.status]||v.status)
                ),
                React.createElement('div', { style:{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'5px', marginBottom:'7px' } },
                  React.createElement('div', null, React.createElement('div',{style:{fontSize:'8px',color:'var(--t3)'}}, 'SPEED'), React.createElement('div',{style:{fontSize:'11px'}}, v.status==='sea'?v.speed+' kn':'—')),
                  React.createElement('div', null, React.createElement('div',{style:{fontSize:'8px',color:'var(--t3)'}}, 'FUEL'), React.createElement('div',{style:{fontSize:'11px'}}, v.fuel_rate+' MT/d')),
                  React.createElement('div', null, React.createElement('div',{style:{fontSize:'8px',color:'var(--t3)'}}, 'UTIL'), React.createElement('div',{style:{fontSize:'11px',color:fc(v.cargo_util)}}, v.cargo_util+'%')),
                  React.createElement('div', null, React.createElement('div',{style:{fontSize:'8px',color:'var(--t3)'}}, 'VOYAGE'), React.createElement('div',{style:{fontSize:'11px',color:'var(--yellow)',fontWeight:700}}, voyageNumber(v))),
                  React.createElement('div', null, React.createElement('div',{style:{fontSize:'8px',color:'var(--t3)'}}, 'CII'), React.createElement('span',{style:{display:'inline-block',width:'16px',height:'16px',borderRadius:'2px',background:CB[v.cii_rating]||'#999',color:'#000',fontSize:'9px',fontWeight:700,textAlign:'center',lineHeight:'16px'}}, v.cii_rating))
                ),
                React.createElement('div', { style:{ height:'3px', background:'var(--b1)', borderRadius:'2px', overflow:'hidden', marginBottom:'4px' } },
                  React.createElement('div', { style:{ height:'100%', width:v.cargo_util+'%', background:fc(v.cargo_util) } })
                ),
                React.createElement('div', { style:{ fontSize:'9px', color:'var(--t3)', marginBottom:'8px' } }, 'Voy '+voyageNumber(v)+' · '+v.eta+' · '+v.next_port),
                React.createElement('div', { style:{ display:'flex', gap:'5px' } },
                  React.createElement('button', { onClick:function(e){e.stopPropagation();toggleMyVessel(v.id);}, style:{ flex:1, background:isMyVessel?'rgba(255,69,96,.08)':'rgba(0,212,255,.07)', border:'1px solid '+(isMyVessel?'rgba(255,69,96,.3)':'rgba(0,212,255,.3)'), color:isMyVessel?'var(--red)':'var(--accent)', fontSize:'8px', padding:'5px', borderRadius:'4px', cursor:'pointer', fontWeight:600 } }, isMyVessel?'- Remove':'+ My Vessel'),
                  React.createElement('button', { onClick:function(e){e.stopPropagation();openScheduleFromFleet(v);}, style:{ background:'rgba(0,212,255,.08)', border:'1px solid rgba(0,212,255,.3)', color:'var(--accent)', fontSize:'8px', padding:'5px 7px', borderRadius:'4px', cursor:'pointer', fontWeight:600 } }, 'Voyage Plan'),
                  React.createElement('button', { onClick:function(e){e.stopPropagation();setDeleteConfirm(v);}, style:{ background:'rgba(255,69,96,.08)', border:'1px solid rgba(255,69,96,.3)', color:'var(--red)', fontSize:'8px', padding:'5px 7px', borderRadius:'4px', cursor:'pointer' } }, 'Del')
                )
              );
            })
          )
        )
      )
    )
  );
}
