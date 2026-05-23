import React, { useEffect, useState } from 'react';
import { listCustomPorts, listPortMeetings, saveCustomPort, savePortMeeting } from '../api/operations';
import { saveScheduleRecord } from '../../backend/services/scheduleRepository';
import {
  allPorts,
  lookupPortOnline,
  mergePorts,
  notifyPortsUpdated,
} from '../data/portDictionary';

var KLINE_VESSELS = [
  'Global Highway','Texas Highway','Poseidon Highway','Nereus Highway',
  'Integrity Highway','Century Highway 2','Drive Green Highway','Victory Highway',
  'Courageous Highway','Majestic Highway','Excellence Highway','Grand Highway',
  'Pacific Highway','Atlantic Highway','Indian Highway','Oceanic Highway',
  'Arctic Highway','Typhoon Highway',
];

var KLINE_TRADES = ['Europe-Atlantic','Europe-Med','US East Coast','US Gulf','Japan-Europe','Asia-Europe','Short Sea','Special Cargo'];
var DELAY_OPTIONS = ['No delay','1-2 hours','3-4 hours','5-8 hours','9-12 hours','12-24 hours','Unknown'];
function tlColor(s) {
  if (s==='go') return 'var(--green)';
  if (s==='monitor') return 'var(--yellow)';
  if (s==='risk') return 'var(--red)';
  return 'var(--t3)';
}

function StatusPill(props) {
  var map = {
    go: ['rgba(0,232,150,.15)','var(--green)','Go'],
    monitor: ['rgba(255,214,10,.15)','var(--yellow)','Monitor'],
    risk: ['rgba(255,69,96,.15)','var(--red)','At Risk'],
  };
  var s = map[props.status] || ['rgba(61,90,115,.15)','var(--t2)','TBD'];
  return React.createElement('span', { style:{ fontSize:'9px', padding:'2px 8px', borderRadius:'20px', fontWeight:600, background:s[0], color:s[1] } }, s[2]);
}

function ShiftChip(props) {
  return React.createElement('span', { style:{ fontSize:'8px', padding:'2px 5px', borderRadius:'3px', background:props.on?'rgba(0,232,150,.15)':'rgba(30,48,72,.4)', color:props.on?'var(--green)':'var(--t3)', border:'1px solid '+(props.on?'rgba(0,232,150,.3)':'var(--b1)') } }, props.label);
}

function voyageNumber(call) {
  return call && (call.voyageNumber || call.voyage_number) ? (call.voyageNumber || call.voyage_number) : 'TBC';
}

function VoyageBadge(props) {
  var value = voyageNumber(props.call);
  var pending = value === 'TBC';
  return React.createElement('span', { style:{ fontSize:'8px', padding:'2px 6px', borderRadius:'4px', background:pending?'rgba(255,214,10,.12)':'rgba(0,212,255,.16)', color:pending?'var(--yellow)':'var(--accent)', border:'1px solid '+(pending?'rgba(255,214,10,.45)':'rgba(0,212,255,.55)'), fontWeight:800, letterSpacing:'.5px', whiteSpace:'nowrap' } }, 'VOY '+value);
}

function tradeColor(trade) {
  var colors = {
    'Europe-Atlantic':'var(--accent)',
    'Europe-Med':'#ff8c42',
    'US East Coast':'#ffd60a',
    'US Gulf':'#00e896',
    'Japan-Europe':'#b06aff',
    'Asia-Europe':'#ff4560',
    'Short Sea':'#69f0ae',
  };
  return colors[trade] || 'var(--t2)';
}

function parseCallTime(value) {
  var match = String(value || '').trim().match(/^(\d{1,2})-(\d{1,2})\s+(\d{2})(\d{2})$/);
  if (!match) return null;
  return new Date(2026, parseInt(match[2],10)-1, parseInt(match[1],10), parseInt(match[3],10), parseInt(match[4],10), 0, 0);
}

function hoursBetween(a,b) {
  return (b.getTime() - a.getTime()) / 3600000;
}

function formatTick(date) {
  var day = String(date.getDate()).padStart(2,'0');
  var month = String(date.getMonth()+1).padStart(2,'0');
  var hour = String(date.getHours()).padStart(2,'0');
  return day+'-'+month+' '+hour+'00';
}

function overlaps(a,b) {
  return a.start < b.end && b.start < a.end;
}

function storageSafeId(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'') || 'item';
}

function plannerPortCode(portCode) {
  return String(portCode || '').indexOf('BAL-') === 0 ? 'BAL' : portCode;
}

function callDurationHours(call) {
  var start = parseCallTime(call.eta);
  var end = parseCallTime(call.etd);
  if (!start || !end) return 0;
  if (end <= start) end = new Date(end.getTime() + 86400000);
  return Math.max(0, Math.round(hoursBetween(start,end) * 10) / 10);
}

function meetingDateForApi(value) {
  var text = String(value || '').trim();
  var shortDate = text.match(/^(\d{1,2})-(\d{1,2})$/);
  if (!shortDate) return text || null;
  var day = String(parseInt(shortDate[1], 10)).padStart(2, '0');
  var month = String(parseInt(shortDate[2], 10)).padStart(2, '0');
  return new Date().getFullYear()+'-'+month+'-'+day;
}

// Kept only as a historical shape reference while shared Port Meeting rows load.
// eslint-disable-next-line no-unused-vars
var SEED_MEETINGS = [
  {
    id:'m1', portCode:'ZEE', meetingDate:'16-05', updatedAt:'15-05 14:30', updatedBy:'J. Anderson',
    calls:[
      { id:'c1', trade:'Europe-Atlantic', vessel:'Global Highway', eta:'16-05 0600', etd:'16-05 2200', berthNum:'Berth 4', status:'go', shifts:{ day:true, evening:true, night:false }, stevedores:24, estDelay:'No delay', reasons:[], notes:'Berth 4 confirmed. Day and evening shifts available. 24 drivers assigned.' },
      { id:'c2', trade:'US East Coast', vessel:'Texas Highway', eta:'16-05 1200', etd:'17-05 0200', berthNum:'Berth 4', status:'risk', shifts:{ day:true, evening:true, night:true }, stevedores:22, estDelay:'3-4 hours', reasons:['Berth occupied'], notes:'Same berth overlap with Global Highway. Needs internal fleet sequencing.' },
      { id:'c5', trade:'Asia-Europe', vessel:'Courageous Highway', eta:'16-05 1800', etd:'17-05 1000', berthNum:'Berth 6', status:'monitor', shifts:{ day:false, evening:true, night:true }, stevedores:20, estDelay:'1-2 hours', reasons:['Congestion'], notes:'Overlaps port window but separate berth.' },
    ]
  },
  {
    id:'m2', portCode:'BRE', meetingDate:'15-05', updatedAt:'15-05 10:00', updatedBy:'K. Larsen',
    calls:[
      { id:'c3', trade:'Europe-Atlantic', vessel:'Global Highway', eta:'17-05 0800', etd:'18-05 0400', berthNum:'ATN Nord', status:'go', shifts:{ day:true, evening:true, night:true }, stevedores:32, estDelay:'No delay', reasons:[], notes:'All shifts confirmed. 32 drivers. Clean window.' },
      { id:'c4', trade:'US East Coast', vessel:'Texas Highway', eta:'17-05 1800', etd:'18-05 1000', berthNum:'ATN Nord', status:'risk', shifts:{ day:false, evening:true, night:true }, stevedores:18, estDelay:'5-8 hours', reasons:['Berth occupied'], notes:'Same berth overlap with Global Highway at ATN Nord.' },
      { id:'c7', trade:'US Gulf', vessel:'Century Highway 2', eta:'19-05 1400', etd:'20-05 0600', berthNum:'ATN Sud', status:'monitor', shifts:{ day:false, evening:false, night:false }, stevedores:0, estDelay:'9-12 hours', reasons:['Equipment fault'], notes:'Sud berth crane issue. Monitor against other fleet calls.' },
    ]
  },
];

function meetingFromRow(row) {
  return {
    id: row.id,
    portCode: row.port_code || row.portCode,
    portName: row.port_name || row.portName,
    meetingDate: row.meeting_date || row.meetingDate || '',
    terminal: row.terminal || '',
    calls: Array.isArray(row.calls) ? row.calls : [],
    notes: row.notes || '',
    updatedAt: row.updated_at || row.updatedAt || '',
    expectedUpdatedAt: row.updated_at || row.updatedAt || '',
    updatedBy: row.updated_by || row.updatedBy || '',
  };
}

export default function PortMeetings() {
  var defaultWatched = ['ZEE','BRE'];
  var ps = useState(allPorts()); var ports = ps[0]; var setPorts = ps[1];
  var ws = useState(defaultWatched); var watched = ws[0]; var setWatched = ws[1];
  var ms = useState([]); var meetings = ms[0]; var setMeetings = ms[1];
  var vs = useState('board'); var view = vs[0]; var setView = vs[1];
  var ts = useState(null); var toast = ts[0]; var setToast = ts[1];
  var ss = useState(false); var showPortPicker = ss[0]; var setShowPortPicker = ss[1];
  var gps = useState(defaultWatched[0]); var ganttPort = gps[0]; var setGanttPort = gps[1];
  var nps = useState({ name:'' }); var newPort = nps[0]; var setNewPort = nps[1];
  var pls = useState(''); var portLookupStatus = pls[0]; var setPortLookupStatus = pls[1];
  var dps = useState(defaultWatched[0]); var detailPort = dps[0]; var setDetailPort = dps[1];

  var nfs = useState({
    portCode: 'ZEE', terminal:'', meetingDate:'', updatedBy:'',
    calls:[{ id:'nc1', trade:'Europe-Atlantic', voyageNumber:'', vessel:KLINE_VESSELS[0], eta:'', etd:'', terminal:'', berthNum:'', status:'monitor', shifts:{ day:false, evening:false, night:false }, stevedores:0, estDelay:'No delay', reasons:[], notes:'' }]
  });
  var newForm = nfs[0]; var setNewForm = nfs[1];

  useEffect(function() {
    listCustomPorts().then(function(rows) {
      setPorts(function(current) { return mergePorts(current, rows || []); });
    }).catch(function() {});
  }, [setPorts]);

  useEffect(function() {
    listPortMeetings().then(function(rows) {
      setMeetings((rows || []).map(meetingFromRow));
    }).catch(function() {});
  }, [setMeetings]);

  function showToastMsg(msg) { setToast(msg); setTimeout(function(){setToast(null);},3000); }

  function togglePort(code) {
    setWatched(function(prev) {
      return prev.includes(code) ? prev.filter(function(c){return c!==code;}) : prev.concat([code]);
    });
  }

  function addCall() {
    setNewForm(function(f) {
      return Object.assign({},f,{ calls: f.calls.concat([{ id:'nc'+Date.now(), trade:'Europe-Atlantic', voyageNumber:'', vessel:KLINE_VESSELS[0], eta:'', etd:'', terminal:f.terminal || '', berthNum:'', status:'monitor', shifts:{ day:false, evening:false, night:false }, stevedores:0, estDelay:'No delay', reasons:[], notes:'' }]) });
    });
  }

  function updateCall(callId, field, val) {
    setNewForm(function(f) {
      return Object.assign({},f,{ calls: f.calls.map(function(c) {
        if (c.id!==callId) return c;
        var n = Object.assign({},c); n[field]=val; return n;
      })});
    });
  }

  function updateCallShift(callId, shiftKey, val) {
    setNewForm(function(f) {
      return Object.assign({},f,{ calls: f.calls.map(function(c) {
        if (c.id!==callId) return c;
        return Object.assign({},c,{ shifts: Object.assign({},c.shifts,{ [shiftKey]:val }) });
      })});
    });
  }

  function removeCall(callId) {
    setNewForm(function(f) {
      return Object.assign({},f,{ calls: f.calls.filter(function(c){return c.id!==callId;}) });
    });
  }

  async function findPortOnlineForMeeting() {
    var name = String(newPort.name || '').trim();
    if (!name) {
      setPortLookupStatus('Enter a port name to search online.');
      return;
    }
    var duplicate = ports.find(function(port) {
      return port.name.toLowerCase() === name.toLowerCase() || port.code.toLowerCase() === name.toLowerCase();
    });
    if (duplicate) {
      setWatched(function(prev){return prev.includes(duplicate.code) ? prev : prev.concat([duplicate.code]);});
      setNewForm(function(f){return Object.assign({},f,{portCode:duplicate.code});});
      setPortLookupStatus(duplicate.name+' is already in the dictionary and has been selected.');
      return;
    }
    setPortLookupStatus('Searching online...');
    try {
      var found = await lookupPortOnline(name, ports);
      setPorts(function(current) { return mergePorts(current, [found]); });
      setWatched(function(prev){return prev.includes(found.code) ? prev : prev.concat([found.code]);});
      setNewForm(function(f){return Object.assign({},f,{portCode:found.code});});
      setNewPort({ name:'' });
      await saveCustomPort(found);
      setPortLookupStatus('Added shared port '+found.name+', '+found.country+' from online lookup.');
      notifyPortsUpdated();
    } catch (error) {
      setPortLookupStatus(error.message || 'Online lookup failed.');
    }
  }

  async function updateSchedulePlannerFromMeeting(meeting) {
    var port = ports.find(function(p){return p.code===meeting.portCode;}) || {};
    var plannerCode = plannerPortCode(meeting.portCode);
    var plannerPortName = plannerCode === 'BAL' ? 'Baltimore' : (port.name || plannerCode);
    var klineCalls = (meeting.calls || []).filter(function(call){return KLINE_VESSELS.includes(call.vessel);});
    var now = new Date().toISOString();
    var schedules = klineCalls.map(function(call) {
      var start = parseCallTime(call.eta) || new Date();
      var id = 'pm-'+storageSafeId(meeting.portCode)+'-'+storageSafeId(call.vessel);
      return {
        id: id,
        name: call.vessel+' - '+(call.voyageNumber ? 'Voy '+call.voyageNumber+' - ' : '')+plannerPortName+' port meeting',
        vessel: call.vessel,
        voyageNumber: call.voyageNumber || '',
        trade: call.trade || 'Europe-Atlantic',
        startDate: start.toISOString(),
        rows: [{
          id: id+'-row',
          portCode: plannerCode,
          portName: plannerPortName,
          distance: 0,
          timeDiff: port.utc || 0,
          speed: 17,
          etaAdj: 0,
          psToBerth: 0,
          etbAdj: 0,
          commenceAdj: 0,
          opsHours: callDurationHours(call),
          completeAdj: 0,
          berthToPs: 0,
          sourcePortMeetingId: meeting.id,
          terminal: call.terminal || meeting.terminal || port.terminal || '',
          berthNum: call.berthNum || '',
          trade: call.trade || 'Europe-Atlantic',
        }],
        fuel: { vlsfoPrice:584, lsmgoPrice:734, vlsfoRate:2.7, lsmgoRate:0.35 },
        updatedAt: now,
        source: 'port-meeting',
      };
    });
    await Promise.all(schedules.map(function(schedule) { return saveScheduleRecord(schedule); }));
    window.dispatchEvent(new Event('schedulePlannerSchedulesUpdated'));
    return klineCalls.length;
  }

  async function saveSharedMeeting(meeting) {
    return meetingFromRow(await savePortMeeting({
      id: meeting.id,
      portCode: meeting.portCode,
      portName: meeting.portName || (ports.find(function(port){return port.code===meeting.portCode;}) || {}).name,
      meetingDate: meetingDateForApi(meeting.meetingDate),
      terminal: meeting.terminal || null,
      calls: meeting.calls || [],
      notes: meeting.notes || '',
      expectedUpdatedAt: meeting.expectedUpdatedAt || '',
    }));
  }

  function syncSharedMeeting(meeting) {
    saveSharedMeeting(meeting).then(function(saved) {
      setMeetings(function(current) { return current.map(function(item) { return item.id === saved.id ? saved : item; }); });
    }).catch(function(error){ showToastMsg('Meeting sync failed: '+(error.message || 'unknown error')); });
  }

  async function saveMeeting() {
    var m = Object.assign({},newForm,{ id:'m'+Date.now(), updatedAt: new Date().toLocaleString('en-GB',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false,hourCycle:'h23'}).replace(',','') });
    try {
      m = await saveSharedMeeting(m);
      setMeetings(function(prev) { return [m].concat(prev); });
    } catch (error) {
      showToastMsg('Meeting save failed: '+(error.message || 'unknown error'));
      return;
    }
    setView('board');
    var portName = (ports.find(function(p){return p.code===newForm.portCode;})||{}).name;
    var klineCount = (m.calls || []).filter(function(call){return KLINE_VESSELS.includes(call.vessel);}).length;
    if (klineCount > 0 && window.confirm('Update Schedule Planner with these fleet port calls?')) {
      try {
        var updated = await updateSchedulePlannerFromMeeting(m);
        showToastMsg('Meeting saved. Shared Schedule Planner updated for '+updated+' fleet call'+(updated===1?'':'s')+'.');
      } catch (error) {
        showToastMsg('Meeting saved. Shared Schedule Planner sync failed: '+(error.message || 'unknown error'));
      }
      return;
    }
    showToastMsg('Meeting saved for '+portName);
  }

  function openPortDetail(code) {
    setDetailPort(code);
    setView('detail');
  }

  function startLogForPort(code) {
    var port = ports.find(function(p){return p.code===code;}) || {};
    setNewForm(function(f) {
      return Object.assign({}, f, {
        portCode: code,
        terminal: port.terminal || '',
        calls: [{ id:'nc'+Date.now(), trade:'Europe-Atlantic', voyageNumber:'', vessel:KLINE_VESSELS[0], eta:'', etd:'', terminal:port.terminal || '', berthNum:'', status:'monitor', shifts:{ day:false, evening:false, night:false }, stevedores:0, estDelay:'No delay', reasons:[], notes:'' }]
      });
    });
    setView('new');
  }

  function updateMeeting(meetingId, field, value) {
    setMeetings(function(current) {
      return current.map(function(meeting) {
        if (meeting.id !== meetingId) return meeting;
        var next = Object.assign({}, meeting, { [field]:value, expectedUpdatedAt:meeting.expectedUpdatedAt || meeting.updatedAt });
        syncSharedMeeting(next);
        return next;
      });
    });
  }

  function updateMeetingCall(meetingId, callId, field, value) {
    setMeetings(function(current) {
      return current.map(function(meeting) {
        if (meeting.id !== meetingId) return meeting;
        var next = Object.assign({}, meeting, {
          expectedUpdatedAt:meeting.expectedUpdatedAt || meeting.updatedAt,
          calls:(meeting.calls || []).map(function(call) {
            return call.id === callId ? Object.assign({}, call, { [field]:value }) : call;
          })
        });
        syncSharedMeeting(next);
        return next;
      });
    });
  }

  function insertMeetingCall(meetingId) {
    var port = ports.find(function(p){return p.code===detailPort;}) || {};
    setMeetings(function(current) {
      return current.map(function(meeting) {
        if (meeting.id !== meetingId) return meeting;
        var next = Object.assign({}, meeting, {
          expectedUpdatedAt:meeting.expectedUpdatedAt || meeting.updatedAt,
          calls:(meeting.calls || []).concat([{ id:'c'+Date.now(), trade:'Europe-Atlantic', voyageNumber:'', vessel:KLINE_VESSELS[0], eta:'', etd:'', terminal:meeting.terminal || port.terminal || '', berthNum:'', status:'monitor', shifts:{ day:false, evening:false, night:false }, stevedores:0, estDelay:'No delay', reasons:[], notes:'' }])
        });
        syncSharedMeeting(next);
        return next;
      });
    });
  }

  var watchedPorts = ports.filter(function(p) { return watched.includes(p.code); });

  function getPortMeetings(code) {
    return meetings.filter(function(m){return m.portCode===code;}).sort(function(a,b){return b.updatedAt.localeCompare(a.updatedAt);});
  }

  function buildGanttRows(code) {
    var latest = getPortMeetings(code)[0];
    var rawCalls = latest ? latest.calls.filter(function(call){return KLINE_VESSELS.includes(call.vessel);}) : [];
    var rows = rawCalls.map(function(call) {
      var start = parseCallTime(call.eta);
      var end = parseCallTime(call.etd);
      if (start && end && end <= start) end = new Date(end.getTime() + 86400000);
      return Object.assign({}, call, { trade:call.trade || 'Europe-Atlantic', start:start, end:end, conflicts:[], sameBerthConflict:false });
    }).filter(function(call){return call.start && call.end;}).sort(function(a,b){return a.start-b.start;});

    rows.forEach(function(a) {
      rows.forEach(function(b) {
        if (a.id === b.id || !overlaps(a,b)) return;
        var sameBerth = a.berthNum && b.berthNum && a.berthNum.toLowerCase() === b.berthNum.toLowerCase();
        a.conflicts.push({ vessel:b.vessel, trade:b.trade, berth:b.berthNum, sameBerth:sameBerth });
        if (sameBerth) a.sameBerthConflict = true;
      });
    });
    return rows;
  }

  function ganttRange(rows) {
    if (!rows.length) return null;
    var start = new Date(Math.min.apply(null, rows.map(function(r){return r.start.getTime();})));
    var end = new Date(Math.max.apply(null, rows.map(function(r){return r.end.getTime();})));
    start.setMinutes(0,0,0);
    end.setMinutes(0,0,0);
    end = new Date(end.getTime() + 3600000);
    return { start:start, end:end, hours:Math.max(1, hoursBetween(start,end)) };
  }

  var inputStyle = { width:'100%', padding:'6px 10px', fontSize:'10px' };
  var labelStyle = { fontSize:'8px', color:'var(--t3)', letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:'4px', display:'block' };

  return React.createElement('div', { style:{ height:'100%', display:'flex', flexDirection:'column', overflow:'hidden' } },

    toast && React.createElement('div', { style:{ position:'fixed', bottom:'20px', right:'20px', background:'var(--s1)', border:'1px solid var(--green)', borderRadius:'8px', padding:'12px 18px', fontSize:'11px', color:'var(--green)', zIndex:9999 } }, toast),

    React.createElement('div', { style:{ padding:'10px 16px', borderBottom:'1px solid var(--b1)', flexShrink:0 } },
      React.createElement('div', { style:{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px', flexWrap:'wrap', gap:'8px' } },
        React.createElement('div', null,
          React.createElement('div', { style:{ fontFamily:'var(--syne)', fontSize:'16px', fontWeight:700 } }, 'Port Meetings'),
          React.createElement('div', { style:{ fontSize:'10px', color:'var(--t2)', marginTop:'2px' } }, watched.length+' ports watched · '+meetings.reduce(function(s,m){return s+m.calls.length;},0)+' vessel calls logged')
        ),
        React.createElement('div', { style:{ display:'flex', gap:'8px' } },
          React.createElement('div', { style:{ display:'flex', background:'var(--s2)', border:'1px solid var(--b1)', borderRadius:'var(--radius-sm)' } },
            [['board','Board'],['gantt','Gantt'],['detail','Port Detail'],['log','Log'],['new','+ New Meeting']].map(function(item) {
              return React.createElement('button', { key:item[0], onClick:function(){setView(item[0]);}, style:{ background:view===item[0]?'var(--accent)':'none', border:'none', color:view===item[0]?'#000':'var(--t2)', fontSize:'9px', padding:'5px 11px', borderRadius:'var(--radius-sm)', cursor:'pointer', whiteSpace:'nowrap' } }, item[1]);
            })
          )
        )
      ),

      React.createElement('div', { style:{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' } },
        React.createElement('span', { style:{ fontSize:'9px', color:'var(--t3)', letterSpacing:'1px', flexShrink:0 } }, 'MY PORTS:'),
        watched.length === 0 && React.createElement('span', { style:{ fontSize:'10px', color:'var(--t3)' } }, 'No ports selected — add below'),
        watchedPorts.map(function(p) {
          var portMeetings = getPortMeetings(p.code);
          var latest = portMeetings[0];
          var worstStatus = latest ? (latest.calls.find(function(c){return c.status==='risk';}) ? 'risk' : latest.calls.find(function(c){return c.status==='monitor';}) ? 'monitor' : 'go') : null;
          return React.createElement('div', { key:p.code, style:{ display:'flex', alignItems:'center', gap:'5px', background:'var(--s2)', border:'1px solid '+(worstStatus?tlColor(worstStatus)+'44':'var(--b1)'), borderRadius:'5px', padding:'4px 10px', fontSize:'10px' } },
            worstStatus && React.createElement('div', { style:{ width:'7px', height:'7px', borderRadius:'50%', background:tlColor(worstStatus), flexShrink:0 } }),
            React.createElement('span', { style:{ fontWeight:500 } }, p.name),
            React.createElement('span', { style:{ color:'var(--t3)', fontSize:'9px' } }, String(p.terminal || p.region || p.country).split(' ').slice(0,2).join(' ')),
            React.createElement('button', { onClick:function(){togglePort(p.code);}, style:{ background:'none', border:'none', color:'var(--t3)', fontSize:'12px', cursor:'pointer', lineHeight:1, padding:'0 2px' } }, 'x')
          );
        }),
        React.createElement('button', { onClick:function(){setShowPortPicker(!showPortPicker);}, style:{ background:showPortPicker?'var(--accent)':'var(--s2)', border:'1px solid '+(showPortPicker?'var(--accent)':'var(--b1)'), color:showPortPicker?'#000':'var(--t2)', fontSize:'9px', padding:'4px 10px', borderRadius:'4px', cursor:'pointer' } }, showPortPicker?'Done':'+ Add Port')
      ),

      showPortPicker && React.createElement('div', { style:{ marginTop:'10px', background:'var(--s2)', border:'1px solid var(--b1)', borderRadius:'6px', padding:'12px' } },
        React.createElement('div', { style:{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' } },
          React.createElement('select', { value:newForm.portCode, onChange:function(e){setNewForm(function(f){return Object.assign({},f,{portCode:e.target.value});});}, style:{ minWidth:'220px', padding:'6px 10px', fontSize:'10px' } },
            ports.map(function(p) { return React.createElement('option', { key:p.code, value:p.code }, p.name+' ('+p.country+')'); })
          ),
          React.createElement('button', { onClick:function(){togglePort(newForm.portCode);}, style:{ background:'var(--accent)', border:'none', color:'#000', fontSize:'10px', fontWeight:700, padding:'7px 12px', borderRadius:'var(--radius-sm)', cursor:'pointer' } }, watched.includes(newForm.portCode)?'Remove Port':'Add Port'),
          React.createElement('input', { value:newPort.name, onChange:function(e){setNewPort({ name:e.target.value });}, placeholder:'Enter missing port name', style:{ minWidth:'220px', padding:'6px 10px', fontSize:'10px' } }),
          React.createElement('button', { onClick:findPortOnlineForMeeting, style:{ background:'var(--s1)', border:'1px solid var(--b1)', color:'var(--t2)', fontSize:'10px', fontWeight:700, padding:'7px 12px', borderRadius:'var(--radius-sm)', cursor:'pointer' } }, 'Find Online'),
          portLookupStatus && React.createElement('span', { style:{ fontSize:'10px', color:portLookupStatus.includes('failed') || portLookupStatus.includes('Enter') ? 'var(--red)' : 'var(--yellow)' } }, portLookupStatus)
        ),
        false && React.createElement('div', { style:{ display:'none' } },
        ports.map(function(p) {
          var isWatched = watched.includes(p.code);
          return React.createElement('div', { key:p.code, onClick:function(){togglePort(p.code);}, style:{ display:'flex', alignItems:'center', gap:'6px', padding:'6px 10px', borderRadius:'5px', cursor:'pointer', background:isWatched?'rgba(0,212,255,.08)':'none', border:'1px solid '+(isWatched?'var(--accent)':'var(--b1)') } },
            React.createElement('div', { style:{ width:'14px', height:'14px', borderRadius:'3px', border:'2px solid '+(isWatched?'var(--accent)':'var(--b2)'), background:isWatched?'var(--accent)':'none', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 } },
              isWatched && React.createElement('span', { style:{ fontSize:'9px', color:'#000', fontWeight:700 } }, 'v')
            ),
            React.createElement('div', null,
              React.createElement('div', { style:{ fontSize:'10px', fontWeight:500 } }, p.name),
              React.createElement('div', { style:{ fontSize:'8px', color:'var(--t3)' } }, p.country+' · UTC'+(p.utc>=0?'+':'')+p.utc)
            )
          );
        })
      )
    ),
    ),

    view === 'new' ? (
      React.createElement('div', { style:{ flex:1, overflowY:'auto', padding:'16px' } },
        React.createElement('div', { style:{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' } },
          React.createElement('div', { style:{ fontFamily:'var(--syne)', fontSize:'15px', fontWeight:700 } }, 'Log Port Meeting'),
          React.createElement('div', { style:{ display:'flex', gap:'8px' } },
            React.createElement('button', { onClick:function(){setView('board');}, style:{ background:'none', border:'1px solid var(--b1)', color:'var(--t2)', fontSize:'10px', padding:'6px 12px', borderRadius:'var(--radius-sm)', cursor:'pointer' } }, 'Cancel'),
            React.createElement('button', { onClick:saveMeeting, style:{ background:'var(--accent)', border:'none', color:'#000', fontSize:'10px', padding:'6px 14px', borderRadius:'var(--radius-sm)', fontWeight:600, cursor:'pointer' } }, 'Save Meeting')
          )
        ),

        React.createElement('div', { style:{ background:'var(--s1)', border:'1px solid var(--b1)', borderRadius:'var(--radius)', padding:'14px', marginBottom:'12px' } },
          React.createElement('div', { style:{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:'10px' } },
            React.createElement('div', null,
              React.createElement('label', { style:labelStyle }, 'PORT'),
              React.createElement('select', { style:inputStyle, value:newForm.portCode, onChange:function(e){setNewForm(function(f){return Object.assign({},f,{portCode:e.target.value});});} },
                ports.map(function(p) { return React.createElement('option', { key:p.code, value:p.code }, p.name+' ('+p.country+')'); })
              )
            ),
            React.createElement('div', null,
              React.createElement('label', { style:labelStyle }, 'TERMINAL'),
              React.createElement('input', { style:inputStyle, value:newForm.terminal || '', onChange:function(e){setNewForm(function(f){return Object.assign({},f,{terminal:e.target.value});});}, placeholder:'e.g. ATN Nord / Berth group' })
            ),
            React.createElement('div', null,
              React.createElement('label', { style:labelStyle }, 'MEETING DATE'),
              React.createElement('input', { style:inputStyle, value:newForm.meetingDate, onChange:function(e){setNewForm(function(f){return Object.assign({},f,{meetingDate:e.target.value});});}, placeholder:'DD-MM' })
            ),
            React.createElement('div', null,
              React.createElement('label', { style:labelStyle }, 'UPDATED BY'),
              React.createElement('input', { style:inputStyle, value:newForm.updatedBy, onChange:function(e){setNewForm(function(f){return Object.assign({},f,{updatedBy:e.target.value});});}, placeholder:'Your name' })
            )
          )
        ),

        React.createElement('div', { style:{ fontFamily:'var(--syne)', fontSize:'12px', fontWeight:700, marginBottom:'8px', color:'var(--text)' } }, 'Vessel Calls'),
        newForm.calls.map(function(call, ci) {
          return React.createElement('div', { key:call.id, style:{ background:'var(--s1)', border:'1px solid var(--b1)', borderRadius:'var(--radius)', padding:'14px', marginBottom:'10px' } },
            React.createElement('div', { style:{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' } },
              React.createElement('div', { style:{ fontSize:'11px', fontWeight:600, color:'var(--accent)' } }, 'Call '+(ci+1)),
              newForm.calls.length > 1 && React.createElement('button', { onClick:function(){removeCall(call.id);}, style:{ background:'rgba(255,69,96,.1)', border:'1px solid var(--red)', color:'var(--red)', fontSize:'9px', padding:'3px 8px', borderRadius:'3px', cursor:'pointer' } }, 'Remove')
            ),
            React.createElement('div', { style:{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr 1fr 1fr', gap:'10px', marginBottom:'12px' } },
              React.createElement('div', null,
                React.createElement('label', { style:labelStyle }, 'TRADE / SERVICE'),
                React.createElement('select', { style:inputStyle, value:call.trade || 'Europe-Atlantic', onChange:function(e){updateCall(call.id,'trade',e.target.value);} },
                  KLINE_TRADES.map(function(v) { return React.createElement('option', { key:v, value:v }, v); })
                )
              ),
              React.createElement('div', null,
                React.createElement('label', { style:labelStyle }, 'VESSEL'),
                React.createElement('select', { style:inputStyle, value:call.vessel, onChange:function(e){updateCall(call.id,'vessel',e.target.value);} },
                  KLINE_VESSELS.map(function(v) { return React.createElement('option', { key:v, value:v }, v); })
                )
              ),
              React.createElement('div', null,
                React.createElement('label', { style:labelStyle }, 'VOYAGE NO.'),
                React.createElement('input', { style:inputStyle, value:call.voyageNumber || '', onChange:function(e){updateCall(call.id,'voyageNumber',e.target.value);}, placeholder:'026E' })
              ),
              React.createElement('div', null,
                React.createElement('label', { style:labelStyle }, 'ETA (DD-MM HHMM)'),
                React.createElement('input', { style:inputStyle, value:call.eta, onChange:function(e){updateCall(call.id,'eta',e.target.value);}, placeholder:'16-05 0600' })
              ),
              React.createElement('div', null,
                React.createElement('label', { style:labelStyle }, 'ETD (DD-MM HHMM)'),
                React.createElement('input', { style:inputStyle, value:call.etd, onChange:function(e){updateCall(call.id,'etd',e.target.value);}, placeholder:'16-05 2200' })
              ),
              React.createElement('div', null,
                React.createElement('label', { style:labelStyle }, 'BERTH'),
                React.createElement('input', { style:inputStyle, value:call.berthNum, onChange:function(e){updateCall(call.id,'berthNum',e.target.value);}, placeholder:'e.g. Berth 4' })
              ),
              React.createElement('div', null,
                React.createElement('label', { style:labelStyle }, 'TERMINAL'),
                React.createElement('input', { style:inputStyle, value:call.terminal || newForm.terminal || '', onChange:function(e){updateCall(call.id,'terminal',e.target.value);}, placeholder:'Terminal' })
              )
            ),
            React.createElement('div', { style:{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px', marginBottom:'12px' } },
              React.createElement('div', null,
                React.createElement('label', { style:labelStyle }, 'TRAFFIC LIGHT'),
                React.createElement('div', { style:{ display:'flex', gap:'6px', marginTop:'4px' } },
                  [['go','Go','var(--green)'],['monitor','Monitor','var(--yellow)'],['risk','At Risk','var(--red)']].map(function(item) {
                    return React.createElement('button', { key:item[0], onClick:function(){updateCall(call.id,'status',item[0]);}, style:{ flex:1, padding:'5px', background:call.status===item[0]?item[2]+'22':'var(--s2)', border:'1px solid '+(call.status===item[0]?item[2]:'var(--b1)'), color:call.status===item[0]?item[2]:'var(--t2)', fontSize:'9px', borderRadius:'4px', cursor:'pointer', fontWeight:call.status===item[0]?700:400 } }, item[1]);
                  })
                )
              ),
              React.createElement('div', null,
                React.createElement('label', { style:labelStyle }, 'EST. DELAY'),
                React.createElement('select', { style:inputStyle, value:call.estDelay, onChange:function(e){updateCall(call.id,'estDelay',e.target.value);} },
                  DELAY_OPTIONS.map(function(d) { return React.createElement('option', { key:d, value:d }, d); })
                )
              ),
              React.createElement('div', null,
                React.createElement('label', { style:labelStyle }, 'STEVEDORES'),
                React.createElement('input', { type:'number', min:0, style:inputStyle, value:call.stevedores, onChange:function(e){updateCall(call.id,'stevedores',parseInt(e.target.value)||0);}, placeholder:'24' })
              )
            ),
            React.createElement('div', { style:{ marginBottom:'10px' } },
              React.createElement('label', { style:labelStyle }, 'SHIFTS AVAILABLE'),
              React.createElement('div', { style:{ display:'flex', gap:'8px', marginTop:'4px' } },
                [['day','Day 06:00-14:00'],['evening','Evening 14:00-22:00'],['night','Night 22:00-06:00']].map(function(item) {
                  return React.createElement('div', { key:item[0], onClick:function(){updateCallShift(call.id,item[0],!call.shifts[item[0]]);}, style:{ flex:1, padding:'8px', textAlign:'center', borderRadius:'5px', cursor:'pointer', border:'1px solid '+(call.shifts[item[0]]?'var(--green)':'var(--b1)'), background:call.shifts[item[0]]?'rgba(0,232,150,.1)':'var(--s2)' } },
                    React.createElement('div', { style:{ fontSize:'8px', color:'var(--t3)' } }, item[1].split(' ')[1]),
                    React.createElement('div', { style:{ fontSize:'10px', fontWeight:600, marginTop:'2px' } }, item[1].split(' ')[0]),
                    React.createElement('div', { style:{ fontSize:'8px', color:call.shifts[item[0]]?'var(--green)':'var(--t3)', marginTop:'2px' } }, call.shifts[item[0]]?'Available':'N/A')
                  );
                })
              )
            ),
            React.createElement('div', null,
              React.createElement('label', { style:labelStyle }, 'NOTES'),
              React.createElement('textarea', { style:{ width:'100%', minHeight:'60px', resize:'vertical', padding:'7px 10px', fontSize:'10px', lineHeight:'1.5' }, value:call.notes, onChange:function(e){updateCall(call.id,'notes',e.target.value);}, placeholder:'Key points from port meeting - berth readiness, sequence, special instructions...' })
            )
          );
        }),

        React.createElement('button', { onClick:addCall, style:{ width:'100%', background:'none', border:'1px dashed var(--b2)', color:'var(--t2)', fontSize:'10px', padding:'10px', borderRadius:'var(--radius)', cursor:'pointer', marginBottom:'12px', letterSpacing:'1px' } }, '+ ADD ANOTHER VESSEL CALL'),
        React.createElement('div', { style:{ display:'flex', gap:'10px' } },
          React.createElement('button', { onClick:saveMeeting, style:{ background:'var(--accent)', border:'none', color:'#000', fontSize:'11px', padding:'10px 24px', borderRadius:'var(--radius)', fontWeight:700, cursor:'pointer' } }, 'Save Meeting Log'),
          React.createElement('button', { onClick:function(){setView('board');}, style:{ background:'none', border:'1px solid var(--b1)', color:'var(--t2)', fontSize:'10px', padding:'10px 16px', borderRadius:'var(--radius)', cursor:'pointer' } }, 'Cancel')
        )
      )

    ) : view === 'gantt' ? (
      renderGanttView()
    ) : view === 'detail' ? (
      renderPortDetail()
    ) : view === 'log' ? (
      React.createElement('div', { style:{ flex:1, overflowY:'auto', padding:'16px' } },
        React.createElement('div', { style:{ fontFamily:'var(--syne)', fontSize:'14px', fontWeight:700, marginBottom:'14px' } }, 'Meeting Log'),
        meetings.length === 0 ? React.createElement('div', { style:{ color:'var(--t3)', fontSize:'11px', textAlign:'center', padding:'30px' } }, 'No meetings logged yet.') :
        meetings.map(function(m) {
          var port = ports.find(function(p){return p.code===m.portCode;});
          return React.createElement('div', { key:m.id, style:{ background:'var(--s1)', border:'1px solid var(--b1)', borderRadius:'var(--radius)', padding:'14px', marginBottom:'10px' } },
            React.createElement('div', { style:{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'12px', flexWrap:'wrap', gap:'6px' } },
              React.createElement('div', null,
                React.createElement('div', { style:{ fontFamily:'var(--syne)', fontSize:'13px', fontWeight:700 } }, port?port.name:m.portCode),
                React.createElement('div', { style:{ fontSize:'9px', color:'var(--accent)', marginTop:'2px' } }, port?port.terminal:'')
              ),
              React.createElement('div', { style:{ fontSize:'9px', color:'var(--t3)' } }, 'Updated '+m.updatedAt+(m.updatedBy?' · '+m.updatedBy:''))
            ),
            m.calls.map(function(call) {
              return React.createElement('div', { key:call.id, style:{ background:'var(--s2)', borderRadius:'6px', padding:'10px 12px', marginBottom:'6px', display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr auto', gap:'10px', alignItems:'center' } },
                React.createElement('div', null,
                  React.createElement('div', { style:{ display:'flex', alignItems:'center', gap:'6px', fontSize:'11px', fontWeight:500 } }, call.vessel, React.createElement(VoyageBadge, { call:call })),
                  React.createElement('div', { style:{ fontSize:'9px', color:'var(--t3)', marginTop:'2px' } }, 'ETA '+call.eta+' → ETD '+call.etd+(call.berthNum?' · '+call.berthNum:''))
                ),
                React.createElement(StatusPill, { status:call.status }),
                React.createElement('div', { style:{ fontSize:'10px', color:call.estDelay==='No delay'?'var(--green)':'var(--orange)' } }, call.estDelay),
                React.createElement('div', { style:{ fontSize:'10px', color:call.stevedores>0?'var(--green)':'var(--t3)' } }, call.stevedores>0?call.stevedores+' stev':'—'),
                React.createElement('div', { style:{ display:'flex', gap:'3px' } },
                  React.createElement(ShiftChip, { label:'D', on:call.shifts&&call.shifts.day }),
                  React.createElement(ShiftChip, { label:'E', on:call.shifts&&call.shifts.evening }),
                  React.createElement(ShiftChip, { label:'N', on:call.shifts&&call.shifts.night })
                ),
                call.notes ? React.createElement('div', { style:{ fontSize:'9px', color:'var(--t2)', gridColumn:'1/-1', marginTop:'4px', paddingTop:'6px', borderTop:'1px solid var(--b1)' } }, call.notes) : null
              );
            })
          );
        })
      )
    ) : (
      React.createElement('div', { style:{ flex:1, overflowY:'auto', padding:'16px' } },
        watched.length === 0 ? (
          React.createElement('div', { style:{ textAlign:'center', padding:'40px', color:'var(--t3)' } },
            React.createElement('div', { style:{ fontSize:'24px', marginBottom:'10px' } }, '📋'),
            React.createElement('div', { style:{ fontFamily:'var(--syne)', fontSize:'14px', marginBottom:'6px', color:'var(--t2)' } }, 'No ports selected'),
            React.createElement('div', { style:{ fontSize:'11px' } }, 'Click "Add Port" above to select which port meetings to monitor.')
          )
        ) : (
          React.createElement('div', null,
            watched.includes('BAL-MAT') || watched.includes('BAL-TPA') || watched.includes('BAL-DUN') ? (
              React.createElement('div', { style:{ background:'rgba(255,214,10,.04)', border:'1px solid rgba(255,214,10,.2)', borderRadius:'8px', padding:'12px', marginBottom:'14px' } },
                React.createElement('div', { style:{ fontFamily:'var(--syne)', fontSize:'11px', fontWeight:700, color:'var(--yellow)', marginBottom:'10px' } }, 'BALTIMORE — ALL THREE TERMINALS'),
                React.createElement('div', { style:{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:'10px' } },
                  ports.filter(function(p){return p.code.startsWith('BAL')&&watched.includes(p.code);}).map(function(p) { return renderPortCard(p,getPortMeetings(p.code)); })
                )
              )
            ) : null,
            React.createElement('div', { style:{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:'10px' } },
              watchedPorts.filter(function(p){return !p.code.startsWith('BAL');}).map(function(p) { return renderPortCard(p,getPortMeetings(p.code)); })
            )
          )
        )
      )
    )
  );

  function renderPortCard(port, portMeetings) {
    var latest = portMeetings[0];
    var calls = latest ? latest.calls : [];
    var worstStatus = calls.find(function(c){return c.status==='risk';}) ? 'risk' : calls.find(function(c){return c.status==='monitor';}) ? 'monitor' : calls.length>0?'go':null;
    return React.createElement('div', { key:port.code, onClick:function(){openPortDetail(port.code);}, style:{ background:'var(--s1)', border:'1px solid var(--b1)', borderRadius:'var(--radius)', overflow:'hidden', cursor:'pointer' } },
      React.createElement('div', { style:{ height:'3px', background:worstStatus?tlColor(worstStatus):'var(--t3)' } }),
      React.createElement('div', { style:{ padding:'10px 12px', borderBottom:'1px solid var(--b1)', display:'flex', justifyContent:'space-between', alignItems:'flex-start' } },
        React.createElement('div', null,
          React.createElement('div', { style:{ fontFamily:'var(--syne)', fontSize:'12px', fontWeight:700 } }, port.name),
          React.createElement('div', { style:{ fontSize:'9px', color:'var(--accent)', marginTop:'1px' } }, port.terminal),
          React.createElement('div', { style:{ fontSize:'8px', color:'var(--t3)', marginTop:'1px' } }, port.country+' · UTC'+(port.utc>=0?'+':'')+port.utc)
        ),
        React.createElement('div', { style:{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'4px' } },
          React.createElement('div', { style:{ width:'10px', height:'10px', borderRadius:'50%', background:worstStatus?tlColor(worstStatus):'var(--t3)' } }),
          latest ? React.createElement('div', { style:{ fontSize:'8px', color:'var(--t3)' } }, latest.updatedAt) : null
        )
      ),
      React.createElement('div', { style:{ padding:'8px 12px' } },
        calls.length === 0 ? (
          React.createElement('div', { style:{ fontSize:'10px', color:'var(--t3)', padding:'10px 0', textAlign:'center' } }, 'No vessel calls logged')
        ) : (
          calls.map(function(call) {
            return React.createElement('div', { key:call.id, style:{ padding:'7px 0', borderBottom:'1px solid rgba(30,48,72,.3)' } },
              React.createElement('div', { style:{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'3px' } },
                React.createElement('div', { style:{ display:'flex', alignItems:'center', gap:'6px', fontSize:'11px', fontWeight:500 } }, call.vessel, React.createElement(VoyageBadge, { call:call })),
                React.createElement(StatusPill, { status:call.status })
              ),
              React.createElement('div', { style:{ fontSize:'9px', color:'var(--t3)', marginBottom:'4px' } }, 'ETA '+call.eta+' → ETD '+call.etd+(call.berthNum?' · '+call.berthNum:'')),
              React.createElement('div', { style:{ display:'flex', justifyContent:'space-between', alignItems:'center' } },
                React.createElement('div', { style:{ display:'flex', gap:'3px' } },
                  React.createElement(ShiftChip, { label:'D', on:call.shifts&&call.shifts.day }),
                  React.createElement(ShiftChip, { label:'E', on:call.shifts&&call.shifts.evening }),
                  React.createElement(ShiftChip, { label:'N', on:call.shifts&&call.shifts.night }),
                  call.stevedores>0 && React.createElement('span', { style:{ fontSize:'8px', padding:'2px 5px', borderRadius:'3px', background:'rgba(0,232,150,.12)', color:'var(--green)', border:'1px solid rgba(0,232,150,.3)' } }, call.stevedores+' stv')
                ),
                React.createElement('span', { style:{ fontSize:'9px', color:call.estDelay==='No delay'?'var(--green)':'var(--orange)', fontWeight:500 } }, call.estDelay)
              ),
              call.notes && React.createElement('div', { style:{ fontSize:'9px', color:'var(--t2)', marginTop:'5px', padding:'5px 8px', background:'var(--s2)', borderRadius:'4px', borderLeft:'2px solid var(--b2)', lineHeight:'1.5' } }, call.notes)
            );
          })
        )
      ),
      React.createElement('div', { style:{ padding:'6px 12px', background:'var(--s2)', display:'flex', justifyContent:'space-between', alignItems:'center' } },
        React.createElement('span', { style:{ fontSize:'9px', color:'var(--t3)' } }, calls.length+' vessel call'+(calls.length!==1?'s':'')),
        React.createElement('button', { onClick:function(e){e.stopPropagation();startLogForPort(port.code);}, style:{ background:'none', border:'none', color:'var(--accent)', fontSize:'9px', cursor:'pointer' } }, '+ Log Meeting')
      )
    );
  }

  function renderPortDetail() {
    var port = ports.find(function(p){return p.code===detailPort;}) || watchedPorts[0] || ports[0];
    var portMeetings = getPortMeetings(port.code);
    return React.createElement('div', { style:{ flex:1, overflowY:'auto', padding:'16px' } },
      React.createElement('div', { style:{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'12px', marginBottom:'12px', flexWrap:'wrap' } },
        React.createElement('div', null,
          React.createElement('div', { style:{ fontFamily:'var(--syne)', fontSize:'15px', fontWeight:700 } }, port.name),
          React.createElement('div', { style:{ fontSize:'10px', color:'var(--t2)', marginTop:'3px' } }, (port.terminal || 'Multiple terminals')+' - '+portMeetings.length+' meeting log'+(portMeetings.length===1?'':'s'))
        ),
        React.createElement('div', { style:{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' } },
          React.createElement('select', { value:port.code, onChange:function(e){setDetailPort(e.target.value);}, style:{ minWidth:'220px', padding:'6px 10px', fontSize:'10px', background:'var(--s2)', color:'var(--text)', border:'1px solid var(--b1)', borderRadius:'var(--radius-sm)' } },
            watchedPorts.length ? watchedPorts.map(function(p){return React.createElement('option', { key:p.code, value:p.code }, p.name+' - '+(p.terminal || p.name));}) : ports.map(function(p){return React.createElement('option', { key:p.code, value:p.code }, p.name);})
          ),
          React.createElement('button', { onClick:function(){startLogForPort(port.code);}, style:{ background:'var(--accent)', border:'none', color:'#000', fontSize:'10px', fontWeight:700, padding:'7px 12px', borderRadius:'var(--radius-sm)', cursor:'pointer' } }, '+ Log Terminal Call'),
          React.createElement('button', { onClick:function(){setView('board');}, style:{ background:'none', border:'1px solid var(--b1)', color:'var(--t2)', fontSize:'10px', padding:'7px 12px', borderRadius:'var(--radius-sm)', cursor:'pointer' } }, 'Back')
        )
      ),
      !portMeetings.length ? React.createElement('div', { style:{ textAlign:'center', padding:'36px', background:'var(--s1)', border:'1px solid var(--b1)', borderRadius:'var(--radius)', color:'var(--t3)' } }, 'No meeting logs for this port yet.') :
      portMeetings.map(function(meeting) {
        return React.createElement('div', { key:meeting.id, style:{ background:'var(--s1)', border:'1px solid var(--b1)', borderRadius:'var(--radius)', padding:'14px', marginBottom:'12px' } },
          React.createElement('div', { style:{ display:'grid', gridTemplateColumns:'120px 1fr 1fr auto', gap:'10px', alignItems:'end', marginBottom:'12px' } },
            React.createElement('div', null, React.createElement('label', { style:labelStyle }, 'DATE'), React.createElement('input', { style:inputStyle, value:meeting.meetingDate || '', onChange:function(e){updateMeeting(meeting.id,'meetingDate',e.target.value);}, placeholder:'DD-MM' })),
            React.createElement('div', null, React.createElement('label', { style:labelStyle }, 'TERMINAL'), React.createElement('input', { style:inputStyle, value:meeting.terminal || '', onChange:function(e){updateMeeting(meeting.id,'terminal',e.target.value);}, placeholder:'Terminal / berth group' })),
            React.createElement('div', null, React.createElement('label', { style:labelStyle }, 'UPDATED BY'), React.createElement('input', { style:inputStyle, value:meeting.updatedBy || '', onChange:function(e){updateMeeting(meeting.id,'updatedBy',e.target.value);}, placeholder:'Name' })),
            React.createElement('button', { onClick:function(){insertMeetingCall(meeting.id);}, style:{ background:'var(--s2)', border:'1px solid var(--b1)', color:'var(--accent)', fontSize:'10px', padding:'7px 10px', borderRadius:'var(--radius-sm)', cursor:'pointer' } }, '+ Insert Call')
          ),
          (meeting.calls || []).map(function(call) {
            return React.createElement('div', { key:call.id, style:{ display:'grid', gridTemplateColumns:'1.2fr .7fr .9fr .9fr .9fr .9fr .8fr', gap:'8px', alignItems:'end', background:'var(--s2)', border:'1px solid var(--b1)', borderRadius:'6px', padding:'10px', marginBottom:'8px' } },
              React.createElement('div', null, React.createElement('label', { style:labelStyle }, 'VESSEL'), React.createElement('select', { style:inputStyle, value:call.vessel, onChange:function(e){updateMeetingCall(meeting.id,call.id,'vessel',e.target.value);} }, KLINE_VESSELS.map(function(v){return React.createElement('option', { key:v, value:v }, v);}))),
              React.createElement('div', null, React.createElement('label', { style:labelStyle }, 'VOYAGE'), React.createElement('input', { style:inputStyle, value:call.voyageNumber || '', onChange:function(e){updateMeetingCall(meeting.id,call.id,'voyageNumber',e.target.value);}, placeholder:'026E' })),
              React.createElement('div', null, React.createElement('label', { style:labelStyle }, 'TRADE'), React.createElement('select', { style:inputStyle, value:call.trade || 'Europe-Atlantic', onChange:function(e){updateMeetingCall(meeting.id,call.id,'trade',e.target.value);} }, KLINE_TRADES.map(function(t){return React.createElement('option', { key:t, value:t }, t);}))),
              React.createElement('div', null, React.createElement('label', { style:labelStyle }, 'ETA'), React.createElement('input', { style:inputStyle, value:call.eta || '', onChange:function(e){updateMeetingCall(meeting.id,call.id,'eta',e.target.value);}, placeholder:'16-05 0600' })),
              React.createElement('div', null, React.createElement('label', { style:labelStyle }, 'ETD'), React.createElement('input', { style:inputStyle, value:call.etd || '', onChange:function(e){updateMeetingCall(meeting.id,call.id,'etd',e.target.value);}, placeholder:'16-05 2200' })),
              React.createElement('div', null, React.createElement('label', { style:labelStyle }, 'TERMINAL'), React.createElement('input', { style:inputStyle, value:call.terminal || '', onChange:function(e){updateMeetingCall(meeting.id,call.id,'terminal',e.target.value);}, placeholder:'Terminal' })),
              React.createElement('div', null, React.createElement('label', { style:labelStyle }, 'BERTH'), React.createElement('input', { style:inputStyle, value:call.berthNum || '', onChange:function(e){updateMeetingCall(meeting.id,call.id,'berthNum',e.target.value);}, placeholder:'Berth' })),
              React.createElement('div', { style:{ gridColumn:'1/-1' } }, React.createElement('label', { style:labelStyle }, 'NOTES'), React.createElement('textarea', { style:{ width:'100%', minHeight:'48px', resize:'vertical', padding:'7px 10px', fontSize:'10px', lineHeight:'1.5' }, value:call.notes || '', onChange:function(e){updateMeetingCall(meeting.id,call.id,'notes',e.target.value);}, placeholder:'Terminal instructions, sequence, clash notes...' }))
            );
          })
        );
      })
    );
  }

  function renderGanttView() {
    var selectedPort = ports.find(function(p){return p.code===ganttPort;}) || watchedPorts[0] || ports[0];
    var rows = buildGanttRows(selectedPort.code);
    var range = ganttRange(rows);
    var conflictRows = rows.filter(function(row){return row.conflicts.length>0;});
    var sameBerthRows = rows.filter(function(row){return row.sameBerthConflict;});
    var ticks = [];
    if (range) {
      for (var h=0; h<=range.hours; h+=6) ticks.push(new Date(range.start.getTime() + h*3600000));
      if (ticks[ticks.length-1].getTime() !== range.end.getTime()) ticks.push(range.end);
    }

    return React.createElement('div', { style:{ flex:1, overflowY:'auto', padding:'16px' } },
      React.createElement('div', { style:{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'12px', marginBottom:'12px', flexWrap:'wrap' } },
        React.createElement('div', null,
          React.createElement('div', { style:{ fontFamily:'var(--syne)', fontSize:'15px', fontWeight:700 } }, 'Port Gantt'),
          React.createElement('div', { style:{ fontSize:'10px', color:'var(--t2)', marginTop:'3px' } }, 'Same-port fleet vessel windows by trade/service. Same-berth overlaps are marked as conflicts.')
        ),
        React.createElement('div', { style:{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' } },
          React.createElement('select', { value:selectedPort.code, onChange:function(e){setGanttPort(e.target.value);}, style:{ minWidth:'220px', padding:'6px 10px', fontSize:'10px', background:'var(--s2)', color:'var(--text)', border:'1px solid var(--b1)', borderRadius:'var(--radius-sm)' } },
            watchedPorts.length ? watchedPorts.map(function(p){return React.createElement('option', { key:p.code, value:p.code }, p.name+' - '+(p.terminal || p.name));}) : ports.map(function(p){return React.createElement('option', { key:p.code, value:p.code }, p.name);})
          ),
          React.createElement('button', { onClick:function(){setView('new'); setNewForm(function(f){return Object.assign({},f,{portCode:selectedPort.code});});}, style:{ background:'var(--accent)', border:'none', color:'#000', fontSize:'10px', fontWeight:700, padding:'7px 12px', borderRadius:'var(--radius-sm)', cursor:'pointer' } }, '+ Log Call')
        )
      ),

      React.createElement('div', { style:{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'10px', marginBottom:'12px' } },
        [
          ['Fleet Calls', rows.length, 'var(--text)'],
          ['Overlapping Windows', conflictRows.length, conflictRows.length?'var(--yellow)':'var(--green)'],
          ['Same Berth Conflicts', sameBerthRows.length, sameBerthRows.length?'var(--red)':'var(--green)'],
          ['Port', selectedPort.name, 'var(--accent)'],
        ].map(function(item) {
          return React.createElement('div', { key:item[0], style:{ background:'var(--s1)', border:'1px solid var(--b1)', borderRadius:'var(--radius)', padding:'12px' } },
            React.createElement('div', { style:{ fontSize:'8px', color:'var(--t3)', letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:'5px' } }, item[0]),
            React.createElement('div', { style:{ fontFamily:'var(--syne)', fontSize:'18px', fontWeight:700, color:item[2] } }, item[1])
          );
        })
      ),

      !rows.length || !range ? (
        React.createElement('div', { style:{ textAlign:'center', padding:'40px', background:'var(--s1)', border:'1px solid var(--b1)', borderRadius:'var(--radius)', color:'var(--t3)' } },
          React.createElement('div', { style:{ fontFamily:'var(--syne)', fontSize:'13px', color:'var(--t2)', marginBottom:'6px' } }, 'No fleet calls with valid ETA / ETD'),
          React.createElement('div', { style:{ fontSize:'10px' } }, 'Use DD-MM HHMM format, for example 16-05 0600.')
        )
      ) : (
        React.createElement('div', { style:{ background:'var(--s1)', border:'1px solid var(--b1)', borderRadius:'var(--radius)', overflow:'hidden' } },
          React.createElement('div', { style:{ display:'grid', gridTemplateColumns:'190px minmax(720px,1fr)', borderBottom:'1px solid var(--b1)', background:'var(--s2)' } },
            React.createElement('div', { style:{ padding:'9px 12px', fontSize:'9px', color:'var(--t3)', letterSpacing:'1.5px', textTransform:'uppercase' } }, 'Vessel / Trade'),
            React.createElement('div', { style:{ position:'relative', height:'34px', borderLeft:'1px solid var(--b1)' } },
              ticks.map(function(tick) {
                var left = Math.max(0, Math.min(100, hoursBetween(range.start,tick) / range.hours * 100));
                return React.createElement('div', { key:tick.getTime(), style:{ position:'absolute', left:left+'%', top:0, bottom:0, borderLeft:'1px solid rgba(122,155,181,.18)', paddingLeft:'4px', fontSize:'8px', color:'var(--t3)', whiteSpace:'nowrap' } }, formatTick(tick));
              })
            )
          ),
          rows.map(function(row) {
            var left = Math.max(0, hoursBetween(range.start,row.start) / range.hours * 100);
            var width = Math.max(2, hoursBetween(row.start,row.end) / range.hours * 100);
            var color = row.sameBerthConflict ? 'var(--red)' : row.conflicts.length ? 'var(--yellow)' : tradeColor(row.trade);
            return React.createElement('div', { key:row.id, style:{ display:'grid', gridTemplateColumns:'190px minmax(720px,1fr)', minHeight:'58px', borderBottom:'1px solid rgba(30,48,72,.45)' } },
              React.createElement('div', { style:{ padding:'9px 12px', borderRight:'1px solid var(--b1)' } },
                React.createElement('div', { style:{ display:'flex', alignItems:'center', gap:'6px', fontSize:'11px', fontWeight:600, color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' } }, row.vessel, React.createElement(VoyageBadge, { call:row })),
                React.createElement('div', { style:{ fontSize:'8px', color:tradeColor(row.trade), marginTop:'3px' } }, row.trade),
                React.createElement('div', { style:{ fontSize:'8px', color:'var(--t3)', marginTop:'3px' } }, row.berthNum || 'No berth')
              ),
              React.createElement('div', { style:{ position:'relative', padding:'9px 0', background:'linear-gradient(90deg, rgba(30,48,72,.18) 1px, transparent 1px)', backgroundSize:'8.333% 100%' } },
                React.createElement('div', { title:row.vessel+' '+row.eta+' - '+row.etd, style:{ position:'absolute', left:left+'%', width:width+'%', minWidth:'42px', top:'12px', height:'30px', borderRadius:'5px', background:color+'33', border:'1px solid '+color, color:color, display:'flex', alignItems:'center', padding:'0 8px', fontSize:'9px', fontWeight:700, overflow:'hidden', whiteSpace:'nowrap' } },
                  row.eta+' -> '+row.etd
                ),
                row.conflicts.length > 0 && React.createElement('div', { style:{ position:'absolute', right:'8px', top:'10px', fontSize:'8px', color:row.sameBerthConflict?'var(--red)':'var(--yellow)', maxWidth:'260px', textAlign:'right' } },
                  (row.sameBerthConflict ? 'CONFLICT: ' : 'OVERLAP: ') + row.conflicts.map(function(c){return c.vessel+(c.sameBerth?' same berth':'');}).join(', ')
                )
              )
            );
          })
        )
      )
    );
  }
}
