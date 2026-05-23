import { useState, useEffect } from 'react';
import { parseNoonReport } from '../../backend/services/groq';
import { listVessels, updateVessel } from '../api/fleet';
import { listNoonReports, saveNoonReport } from '../api/operations';

const SAMPLE = `NOON POSITION REPORT
Vessel: Nordic Breeze
Voyage Number: TBC
IMO: 9634872
Date/Time: 2024-01-14 12:00 UTC
Position: 52°18'N 002°24'E
Speed Made Good: 17.6 knots
Distance Sailed: 422 NM
ETA Next Port: Southampton, 2024-01-14 20:30 UTC
HFO Consumed: 84.2 MT
MDO Consumed: 1.8 MT
Kxx Loaded: 5,560 Kxx
Kxx Capacity: 5,680 Kxx
Utilization: 97.9%
Wind: W 4 Bft
Swell: 1.5m
Master: Capt. E. Lindqvist`;

export default function NoonReport() {
  const [text, setText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);
  const [drag, setDrag] = useState(false);
  const cargoKxx = value => value ? `${Math.round(Number(value) / 1.25).toLocaleString()} Kxx` : 'â€”';
  const voyageNumber = value => value || parsed?.voyageNumber || parsed?.voyage_number || 'TBC';
  const formatVesselName = value => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase().replace(/\b([a-z])/g, match => match.toUpperCase());

  useEffect(() => {
    listNoonReports().then(data => { if (data) setHistory(data); }).catch(() => {});
  }, []);

  const handleFile = file => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => setText(e.target.result);
    reader.readAsText(file);
  };

  const handleParse = async () => {
    if (!text.trim()) return;
    setParsing(true); setError(''); setParsed(null);
    try {
      const result = await parseNoonReport(text);
      setParsed(result);
    } catch(e) {
      setError(e.message);
    } finally {
      setParsing(false);
    }
  };

  const handleApply = async () => {
    if (!parsed) return;
    const now = new Date().toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', hour12:false, hourCycle:'h23' });
    try {
      const vessels = await listVessels();
      const match = vessels?.find(v => parsed.vesselName && v.name.toLowerCase().includes(parsed.vesselName.toLowerCase().split(' ')[0]));
      if (match) {
        await updateVessel(match.id, {
          ...(parsed.lat!=null && { lat:parsed.lat }),
          ...(parsed.lon!=null && { lon:parsed.lon }),
          ...(parsed.speed!=null && { speed:parsed.speed }),
          ...(parsed.cargoUtil!=null && { cargo_util:parsed.cargoUtil }),
          ...(parsed.nextPort && { next_port:parsed.nextPort }),
          ...(parsed.eta && { eta:parsed.eta }),
          updated_by: now,
        });
      }
      await saveNoonReport({
        vessel_id: match?.id||null,
        report_text: text, parsed_data: parsed,
      });
      setParsed(p => ({ ...p, _applied:true }));
      setHistory(h => [{ id:Date.now(), vessels:{ name:formatVesselName(parsed.vesselName) }, created_at:new Date().toISOString(), cargo_util:parsed.cargoUtil, status:parsed.status }, ...h.slice(0,19)]);
    } catch(e) {
      setParsed(p => ({ ...p, _applied:true }));
    }
  };

  return (
    <div style={{ height:'100%', display:'grid', gridTemplateColumns:'1fr 1fr', overflow:'hidden' }}>
      <div style={{ padding:'16px', overflowY:'auto', borderRight:'1px solid var(--b1)' }}>
        <div style={{ fontFamily:'var(--syne)', fontSize:'16px', fontWeight:700, marginBottom:'4px' }}>Noon Reports</div>
        <div style={{ fontSize:'10px', color:'var(--t2)', marginBottom:'14px' }}>AI parses & updates fleet data · Groq / Llama 3.1</div>

        <div onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)}
          onDrop={e=>{e.preventDefault();setDrag(false);handleFile(e.dataTransfer.files[0]);}}
          onClick={()=>document.getElementById('noon-file').click()}
          style={{ border:`2px dashed ${drag?'var(--accent)':'var(--b2)'}`, borderRadius:'var(--radius)', padding:'24px', textAlign:'center', cursor:'pointer', marginBottom:'12px', background:drag?'rgba(0,212,255,.04)':'none' }}>
          <input id="noon-file" type="file" accept=".txt,.csv" style={{ display:'none' }} onChange={e=>handleFile(e.target.files[0])} />
          <div style={{ fontSize:'24px', marginBottom:'6px' }}>📋</div>
          <div style={{ fontFamily:'var(--syne)', fontSize:'12px', fontWeight:700 }}>Drop noon report here</div>
          <div style={{ fontSize:'10px', color:'var(--t2)', marginTop:'4px' }}>.txt · .csv</div>
        </div>

        <div style={{ textAlign:'center', fontSize:'10px', color:'var(--t3)', margin:'8px 0' }}>— OR PASTE TEXT —</div>

        <textarea value={text} onChange={e=>setText(e.target.value)} placeholder="Paste noon report text here…"
          style={{ width:'100%', minHeight:'130px', resize:'vertical', lineHeight:'1.6', marginBottom:'8px' }} />

        <div style={{ display:'flex', gap:'6px', marginBottom:'8px' }}>
          <button onClick={()=>setText(SAMPLE)} style={{ background:'var(--s2)', border:'1px solid var(--b1)', color:'var(--t2)', fontSize:'9px', padding:'4px 10px', borderRadius:'var(--radius-sm)' }}>↓ Load sample</button>
          {text && <button onClick={()=>{setText('');setParsed(null);}} style={{ background:'var(--s2)', border:'1px solid var(--b1)', color:'var(--t2)', fontSize:'9px', padding:'4px 10px', borderRadius:'var(--radius-sm)', marginLeft:'auto' }}>✕ Clear</button>}
        </div>

        <button onClick={handleParse} disabled={!text.trim()||parsing} style={{
          width:'100%', padding:'10px',
          background:(!text.trim()||parsing)?'var(--b2)':'var(--accent)',
          border:'none', borderRadius:'var(--radius)',
          fontFamily:'var(--syne)', fontWeight:700, fontSize:'11px', letterSpacing:'1px',
          color:(!text.trim()||parsing)?'var(--t2)':'#000',
          cursor:(!text.trim()||parsing)?'not-allowed':'pointer',
        }}>
          {parsing ? 'PARSING WITH AI…' : '⚡ PARSE & EXTRACT DATA'}
        </button>

        {error && <div style={{ marginTop:'8px', padding:'10px', background:'rgba(255,69,96,.08)', border:'1px solid rgba(255,69,96,.2)', borderRadius:'var(--radius-sm)', fontSize:'10px', color:'var(--red)' }}>{error}</div>}

        {parsed && (
          <div style={{ marginTop:'12px', background:'var(--s2)', border:'1px solid var(--b1)', borderRadius:'var(--radius)', padding:'14px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, fontFamily:'var(--syne)', fontWeight:700, fontSize:'13px' }}>
                {formatVesselName(parsed.vesselName)||'Unknown'}
                <span style={{ fontSize:9, padding:'2px 7px', borderRadius:4, background:'rgba(255,214,10,.12)', color:'var(--yellow)', border:'1px solid rgba(255,214,10,.45)', fontWeight:800 }}>VOY {voyageNumber()}</span>
              </div>
              {parsed._applied
                ? <span style={{ fontSize:'9px', background:'rgba(0,232,150,.15)', border:'1px solid var(--green)', color:'var(--green)', padding:'2px 8px', borderRadius:'20px' }}>✓ APPLIED</span>
                : <span style={{ fontSize:'9px', color:'var(--yellow)' }}>Ready to apply</span>}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'10px' }}>
              {[['Voyage',voyageNumber()],['Position',parsed.lat!=null?`${Number(parsed.lat).toFixed(2)}°N ${Number(parsed.lon).toFixed(2)}°E`:'—'],['Speed',parsed.speed?`${parsed.speed} kn`:'—'],['Fuel',parsed.fuelConsumed?`${parsed.fuelConsumed} MT`:'—'],['Cargo Kxx',cargoKxx(parsed.cargoLM)],['Utilisation',parsed.cargoUtil?`${parsed.cargoUtil}%`:'—'],['Status',parsed.status||'—'],['Next Port',parsed.nextPort||'—'],['ETA',parsed.eta||'—']].map(([l,v]) => (
                <div key={l}>
                  <div style={{ fontSize:'8px', color:'var(--t3)', letterSpacing:'1px', textTransform:'uppercase' }}>{l}</div>
                  <div style={{ fontSize:'11px', marginTop:'2px' }}>{v}</div>
                </div>
              ))}
            </div>
            {!parsed._applied && (
              <button onClick={handleApply} style={{ width:'100%', padding:'8px', background:'rgba(0,232,150,.1)', border:'1px solid var(--green)', color:'var(--green)', borderRadius:'var(--radius-sm)', fontSize:'10px', letterSpacing:'1px' }}>
                ✓ APPLY TO FLEET — UPDATE VESSEL DATA
              </button>
            )}
          </div>
        )}
      </div>

      <div style={{ padding:'16px', overflowY:'auto' }}>
        <div style={{ fontFamily:'var(--syne)', fontSize:'14px', fontWeight:700, marginBottom:'12px' }}>Report History</div>
        {history.length===0
          ? <div style={{ color:'var(--t3)', fontSize:'11px', padding:'20px 0', textAlign:'center' }}>No reports yet. Parse one to see history.</div>
          : history.map((h,i) => (
            <div key={h.id||i} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'8px 0', borderBottom:'1px solid rgba(30,48,72,.4)', fontSize:'11px' }}>
              <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:'var(--green)', flexShrink:0 }} />
              <div style={{ flex:1 }}>
                <div style={{ color:'var(--text)', fontWeight:500 }}>{formatVesselName(h.vessels?.name)||'Unknown'}</div>
                <div style={{ fontSize:'9px', color:'var(--t3)', marginTop:'1px' }}>Util: {h.cargo_util||'—'}% · {h.status||'—'}</div>
              </div>
              <div style={{ fontSize:'9px', color:'var(--t3)' }}>
                {h.created_at ? new Date(h.created_at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',hour12:false,hourCycle:'h23'}) : '—'}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
