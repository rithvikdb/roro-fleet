import { useEffect, useState } from 'react';
import { getVesselPerformanceProfile, listVessels, saveVesselPerformanceProfile } from '../api/fleet';

var DEMO = [
  { id:1, name:'Gothenburg Ace', imo:'9823401', type:'PCTC', flag:'SE', built:2019, lane_meters:6200, ceu:6500, dwt:28000, status:'sea', speed:17.2, fuel_rate:68.4, cargo_util:88, cii_rating:'A', eta:'14h', next_port:'Zeebrugge', last_port:'Gothenburg', voyage_progress:62, eexi:87, co2_ytd:18400, aer:8.2 },
  { id:2, name:'Nordic Breeze', imo:'9634872', type:'PCTC', flag:'NO', built:2020, lane_meters:7100, ceu:7800, dwt:33000, status:'sea', speed:18.4, fuel_rate:82.3, cargo_util:96, cii_rating:'A', eta:'8h', next_port:'Southampton', last_port:'Emden', voyage_progress:78, eexi:91, co2_ytd:22100, aer:7.8 },
  { id:3, name:'Baltic Carrier', imo:'9741205', type:'RoRo', flag:'SE', built:2017, lane_meters:4800, ceu:0, dwt:22000, status:'port', speed:0, fuel_rate:12.1, cargo_util:82, cii_rating:'B', eta:'In port', next_port:'Travemunde', last_port:'Malmo', voyage_progress:100, eexi:82, co2_ytd:14200, aer:9.1 },
];

var CII_BG = { A:'#00c853', B:'#69f0ae', C:'#ffd60a', D:'#ff6b35', E:'#ff4560' };
var LM_PER_KXX = 1.25;
var EMPTY_PROFILE = {
  abbreviation:'', piracy_area_18kt:'', load_nor:'',
  emergency_max_rpm:'', emergency_max_speed_kt:'', emergency_max_foc:'',
  emergency_5_less_rpm:'', emergency_5_less_speed_kt:'', emergency_5_less_foc:'',
  emergency_10_less_rpm:'', emergency_10_less_speed_kt:'', emergency_10_less_foc:'',
  osr_min_load:'', osr_min_rpm:'', osr_speed_kt:'', osr_foc:'',
  target:'', not_available_rpm:'',
  at_sea_fo_mt_day:'', at_sea_do_mt_day:'', in_port_fo_mt_day:'', in_port_do_mt_day:'',
  management:'', gross_tonnage:'', owner:'',
};

function fc(p) {
  if (p >= 90) return 'var(--green)';
  if (p >= 70) return 'var(--yellow)';
  return 'var(--red)';
}

function voyageNumber(vessel) {
  return vessel && (vessel.voyage_number || vessel.voyageNumber) ? (vessel.voyage_number || vessel.voyageNumber) : 'TBC';
}

function voyageBadge(vessel) {
  var pending = voyageNumber(vessel) === 'TBC';
  return <span style={{ fontSize:10, padding:'3px 8px', borderRadius:4, background:pending?'rgba(255,214,10,.12)':'rgba(0,212,255,.16)', color:pending?'var(--yellow)':'var(--accent)', border:'1px solid '+(pending?'rgba(255,214,10,.45)':'rgba(0,212,255,.55)'), fontWeight:800, letterSpacing:'.6px', whiteSpace:'nowrap' }}>VOY {voyageNumber(vessel)}</span>;
}

function formatVesselName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').toLowerCase().replace(/\b([a-z])/g, function(match) { return match.toUpperCase(); });
}

function profileValues(data) {
  var next = Object.assign({}, EMPTY_PROFILE);
  Object.keys(next).forEach(function(key) {
    next[key] = data && data[key] !== null && data[key] !== undefined ? data[key] : '';
  });
  return next;
}

function hasBackendVesselId(vessel) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String((vessel && vessel.id) || ''));
}

export default function VesselDetail() {
  const [vessels, setVessels] = useState(DEMO);
  const [sel, setSel] = useState(DEMO[0]);
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [profileStatus, setProfileStatus] = useState('');

  useEffect(function() {
    listVessels().then(function(data) {
      if (data && data.length) {
        var normalized = data.map(function(vessel) { return Object.assign({}, vessel, { name:formatVesselName(vessel.name) }); });
        setVessels(normalized);
        setSel(normalized[0]);
      }
    }).catch(function() {});
  }, [setSel, setVessels]);

  useEffect(function() {
    if (!sel || !sel.id || !hasBackendVesselId(sel)) {
      setProfile(EMPTY_PROFILE);
      setProfileStatus('Refresh after PostgreSQL vessel sync to save this sheet.');
      return;
    }
    var mounted = true;
    setProfileStatus('Loading performance sheet...');
    getVesselPerformanceProfile(sel.id).then(function(data) {
      if (!mounted) return;
      setProfile(profileValues(data));
      setProfileStatus(data && data.updated_at ? 'Performance sheet loaded.' : '');
    }).catch(function() {
      if (!mounted) return;
      setProfile(EMPTY_PROFILE);
      setProfileStatus('Performance sheet is not saved yet.');
    });
    return function() { mounted = false; };
  }, [sel]);

  var v = sel || DEMO[0];
  var cargoUtil = Number(v.cargo_util || 0);
  var lm = Number(v.lane_meters || 6200);
  var lmUsed = Math.round(lm * cargoUtil / 100);
  var kxx = Math.round(lm / LM_PER_KXX);
  var kxxUsed = Math.round(lmUsed / LM_PER_KXX);
  var kxxFree = kxx - kxxUsed;

  function handleSelect(e) {
    var found = vessels.find(function(item) { return String(item.id) === String(e.target.value); });
    if (found) setSel(found);
  }

  function setProfileField(field, value) {
    setProfile(function(current) { return Object.assign({}, current, { [field]:value }); });
  }

  function saveProfile() {
    if (!hasBackendVesselId(v)) {
      setProfileStatus('This vessel is not synced to PostgreSQL yet.');
      return;
    }
    setProfileStatus('Saving performance sheet...');
    saveVesselPerformanceProfile(v.id, profile).then(function(saved) {
      setProfile(profileValues(saved));
      setProfileStatus('Performance sheet saved.');
    }).catch(function(error) {
      setProfileStatus(error.message || 'Performance sheet could not be saved.');
    });
  }

  return (
    <div style={{ height:'100%', overflowY:'auto', padding:16 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, gap:10, flexWrap:'wrap' }}>
        <div>
          <div style={{ fontFamily:'var(--syne)', fontSize:16, fontWeight:700 }}>Vessel Detail</div>
          <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:10, color:'var(--t2)', marginTop:2 }}>Deep-dive per vessel {voyageBadge(v)}</div>
        </div>
        <select value={v.id} onChange={handleSelect} style={{ padding:'6px 10px' }}>
          {vessels.map(function(item) { return <option key={item.id} value={item.id}>{formatVesselName(item.name)} - Voy {voyageNumber(item)}</option>; })}
        </select>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'minmax(320px,1fr) minmax(320px,1fr)', gap:12, marginBottom:12 }}>
        <Panel title="Vessel Info">
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <Info label="Name" value={<span style={{ display:'flex', alignItems:'center', gap:7 }}>{formatVesselName(v.name)}{voyageBadge(v)}</span>} />
            <Info label="Voyage Number" value={voyageNumber(v)} accent="var(--yellow)" />
            <Info label="IMO" value={v.imo || '-'} />
            <Info label="Type" value={v.type || '-'} />
            <Info label="Flag" value={v.flag || '-'} />
            <Info label="Built" value={v.built || '-'} />
            <Info label="Kxx Capacity" value={kxx.toLocaleString()+' Kxx'} />
            <Info label="CEU" value={v.ceu ? Number(v.ceu).toLocaleString() : 'N/A'} />
            <Info label="EEXI" value={v.eexi || '-'} accent={Number(v.eexi) >= 80 ? 'var(--green)' : undefined} />
          </div>
        </Panel>
        <Panel title="Kxx Utilisation">
          <div style={{ textAlign:'center', padding:'8px 0' }}>
            <div style={{ fontSize:48, fontFamily:'var(--syne)', fontWeight:800, color:fc(cargoUtil) }}>{cargoUtil}%</div>
            <div style={{ fontSize:10, color:'var(--t2)' }}>{kxxUsed.toLocaleString()} / {kxx.toLocaleString()} Kxx</div>
          </div>
          <div style={{ height:6, background:'var(--b1)', borderRadius:3, overflow:'hidden', margin:'8px 0 12px' }}>
            <div style={{ height:'100%', width:cargoUtil+'%', background:fc(cargoUtil), borderRadius:3 }} />
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            <Metric value={kxxUsed.toLocaleString()} label="Kxx Loaded" accent />
            <Metric value={kxxFree.toLocaleString()} label="Kxx Free" />
          </div>
        </Panel>
      </div>

      <Panel title="Current Status" style={{ marginBottom:12 }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:10, marginBottom:14 }}>
          <Status label="Speed" value={v.status === 'sea' ? v.speed+' kn' : 'At berth'} />
          <Status label="Fuel Rate" value={(v.fuel_rate || '-')+' MT/day'} />
          <Status label="CII" value={<span style={{ display:'inline-block', width:22, height:22, borderRadius:3, background:CII_BG[v.cii_rating] || '#999', color:'#000', fontSize:12, fontWeight:700, textAlign:'center', lineHeight:'22px' }}>{v.cii_rating || '-'}</span>} />
          <Status label="ETA" value={v.eta || '-'} />
          <Status label="AER" value={(v.aer || '-')+' g/t nm'} />
          <Status label="CO2 YTD" value={v.co2_ytd ? (v.co2_ytd/1000).toFixed(1)+'k MT' : '-'} />
          <Status label="Next Port" value={v.next_port || '-'} />
          <Status label="Last Port" value={v.last_port || '-'} />
        </div>
        <div style={{ fontSize:10, color:'var(--t2)', marginBottom:8 }}>VOYAGE - {v.last_port || '-'} to {v.next_port || '-'}</div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ fontSize:9, color:'var(--t2)', minWidth:60 }}>{v.last_port || '-'}</div>
          <div style={{ flex:1, height:6, background:'var(--b1)', borderRadius:3, overflow:'hidden' }}>
            <div style={{ height:'100%', width:Number(v.voyage_progress || 0)+'%', background:'var(--accent)', borderRadius:3 }} />
          </div>
          <div style={{ fontSize:9, color:'var(--t2)', minWidth:60, textAlign:'right' }}>{v.next_port || '-'}</div>
        </div>
      </Panel>

      <PerformanceSheet vessel={v} profile={profile} profileStatus={profileStatus} setProfileField={setProfileField} saveProfile={saveProfile} />
    </div>
  );
}

function PerformanceSheet(props) {
  var p = props.profile;
  var input = function(field, label, options) {
    return <ProfileField label={label} value={p[field]} numeric={options && options.numeric} placeholder={options && options.placeholder} onChange={function(value){props.setProfileField(field, value);}} />;
  };
  return (
    <Panel style={{ marginBottom:12 }}>
      <div style={{ display:'flex', justifyContent:'space-between', gap:10, alignItems:'center', flexWrap:'wrap', marginBottom:12 }}>
        <div>
          <div style={{ fontSize:10, color:'var(--t2)', letterSpacing:2, textTransform:'uppercase' }}>Performance Profile</div>
          <div style={{ fontSize:10, color:'var(--t3)', marginTop:3 }}>Operating data, consumption assumptions, and ownership details for the selected vessel.</div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          {props.profileStatus && <span style={{ fontSize:10, color:props.profileStatus.includes('could not') ? 'var(--red)' : 'var(--t2)' }}>{props.profileStatus}</span>}
          <button onClick={props.saveProfile} style={{ background:'var(--accent)', border:'none', color:'#000', fontSize:10, fontWeight:700, padding:'8px 12px', borderRadius:'var(--radius-sm)', cursor:'pointer' }}>SAVE PROFILE</button>
        </div>
      </div>
      <div style={{ display:'grid', gap:12 }}>
        <ProfileSection title="Planning Assumptions" tone="accent">
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:10 }}>
            {input('abbreviation', 'Abbreviation', { placeholder:'Short name' })}
            {input('piracy_area_18kt', 'Piracy Area 18kt', { placeholder:'Requirement / note' })}
            {input('load_nor', 'Load (=NOR)', { placeholder:'Load condition' })}
            {input('target', 'Target', { placeholder:'Target setting' })}
            {input('not_available_rpm', 'Not Available RPM', { numeric:true, placeholder:'RPM' })}
          </div>
        </ProfileSection>

        <ProfileSection title="Operating Bands" tone="service">
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:10 }}>
            <OperatingBand title="Emergency Max RPM" tone="emergency">
              {input('emergency_max_rpm', 'RPM', { numeric:true })}
              {input('emergency_max_speed_kt', 'Speed', { numeric:true, placeholder:'KT' })}
              {input('emergency_max_foc', 'FOC', { numeric:true })}
            </OperatingBand>
            <OperatingBand title="5% Less Max RPM" tone="accent">
              {input('emergency_5_less_rpm', 'RPM', { numeric:true })}
              {input('emergency_5_less_speed_kt', 'Speed', { numeric:true, placeholder:'KT' })}
              {input('emergency_5_less_foc', 'FOC', { numeric:true })}
            </OperatingBand>
            <OperatingBand title="10% Less Max RPM" tone="accent">
              {input('emergency_10_less_rpm', 'RPM', { numeric:true })}
              {input('emergency_10_less_speed_kt', 'Speed', { numeric:true, placeholder:'KT' })}
              {input('emergency_10_less_foc', 'FOC', { numeric:true })}
            </OperatingBand>
            <OperatingBand title="OSR Service" tone="green">
              {input('osr_min_load', 'Min Load', { placeholder:'Load' })}
              {input('osr_min_rpm', 'Min RPM', { numeric:true })}
              {input('osr_speed_kt', 'Speed', { numeric:true, placeholder:'KT' })}
              {input('osr_foc', 'FOC', { numeric:true })}
            </OperatingBand>
          </div>
        </ProfileSection>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:12 }}>
          <ProfileSection title="Fuel Consumption" tone="consumption">
            <div style={{ display:'grid', gap:10 }}>
              <ConsumptionBand title="At Sea">
                {input('at_sea_fo_mt_day', 'FO', { numeric:true, placeholder:'MT/day' })}
                {input('at_sea_do_mt_day', 'DO', { numeric:true, placeholder:'MT/day' })}
              </ConsumptionBand>
              <ConsumptionBand title="In Port">
                {input('in_port_fo_mt_day', 'FO', { numeric:true, placeholder:'MT/day' })}
                {input('in_port_do_mt_day', 'DO', { numeric:true, placeholder:'MT/day' })}
              </ConsumptionBand>
            </div>
          </ProfileSection>

          <ProfileSection title="Management" tone="neutral">
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))', gap:10 }}>
              {input('management', 'Management', { placeholder:'Manager' })}
              {input('owner', 'Owner', { placeholder:'Owner' })}
              {input('gross_tonnage', 'Gross Ton', { numeric:true, placeholder:'GT' })}
            </div>
          </ProfileSection>
        </div>
      </div>
    </Panel>
  );
}

function Panel(props) {
  return <div style={Object.assign({ background:'var(--s1)', border:'1px solid var(--b1)', borderRadius:'var(--radius)', padding:16 }, props.style || {})}>
    {props.title && <div style={{ fontSize:10, color:'var(--t2)', letterSpacing:2, textTransform:'uppercase', marginBottom:12 }}>{props.title}</div>}
    {props.children}
  </div>;
}

function Info(props) {
  return <div><div style={{ fontSize:9, color:'var(--t3)' }}>{props.label}</div><div style={{ fontSize:12, marginTop:2, color:props.accent }}>{props.value}</div></div>;
}

function Metric(props) {
  return <div style={{ textAlign:'center', padding:10, background:'var(--s2)', borderRadius:6 }}><div style={{ fontSize:18, fontFamily:'var(--syne)', fontWeight:700, color:props.accent ? 'var(--accent)' : 'var(--t2)' }}>{props.value}</div><div style={{ fontSize:8, color:'var(--t3)', marginTop:2, textTransform:'uppercase' }}>{props.label}</div></div>;
}

function Status(props) {
  return <div style={{ background:'var(--s2)', borderRadius:6, padding:10 }}><div style={{ fontSize:9, color:'var(--t3)', marginBottom:4 }}>{props.label}</div><div style={{ fontSize:13, fontWeight:500 }}>{props.value}</div></div>;
}

function profileTone(tone) {
  var colors = {
    accent:{ border:'rgba(0,212,255,.34)', edge:'var(--accent)', background:'rgba(0,212,255,.07)' },
    emergency:{ border:'rgba(255,69,96,.34)', edge:'var(--red)', background:'rgba(255,69,96,.08)' },
    service:{ border:'rgba(0,232,150,.28)', edge:'var(--green)', background:'rgba(0,232,150,.06)' },
    green:{ border:'rgba(0,232,150,.28)', edge:'var(--green)', background:'rgba(0,232,150,.06)' },
    consumption:{ border:'rgba(122,155,181,.35)', edge:'var(--b2)', background:'rgba(122,155,181,.08)' },
    neutral:{ border:'var(--b1)', edge:'var(--b2)', background:'var(--s2)' }
  };
  return colors[tone] || colors.neutral;
}

function ProfileSection(props) {
  var tone = profileTone(props.tone);
  return <section style={{ background:'var(--s2)', border:'1px solid ' + tone.border, borderLeft:'3px solid ' + tone.edge, borderRadius:7, padding:12 }}>
    <div style={{ fontSize:9, color:'var(--t2)', fontWeight:800, letterSpacing:'1.3px', textTransform:'uppercase', marginBottom:10 }}>{props.title}</div>
    {props.children}
  </section>;
}

function OperatingBand(props) {
  var tone = profileTone(props.tone);
  return <div style={{ background:tone.background, border:'1px solid ' + tone.border, borderRadius:6, padding:10 }}>
    <div style={{ color:tone.edge, fontSize:10, fontWeight:800, marginBottom:9 }}>{props.title}</div>
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(74px,1fr))', gap:8 }}>{props.children}</div>
  </div>;
}

function ConsumptionBand(props) {
  return <div style={{ display:'grid', gridTemplateColumns:'minmax(72px,.55fr) repeat(2,minmax(90px,1fr))', gap:8, alignItems:'end', background:'rgba(122,155,181,.08)', border:'1px solid var(--b1)', borderRadius:6, padding:10 }}>
    <div style={{ fontSize:10, color:'var(--text)', fontWeight:700, paddingBottom:9 }}>{props.title}</div>
    {props.children}
  </div>;
}

function ProfileField(props) {
  return <label style={{ display:'grid', gap:4, minWidth:0 }}>
    <span style={{ fontSize:8, color:'var(--t3)', letterSpacing:'1.1px', textTransform:'uppercase' }}>{props.label}</span>
    <input type={props.numeric ? 'number' : 'text'} step={props.numeric ? 'any' : undefined} value={props.value} placeholder={props.placeholder} onChange={function(e){props.onChange(e.target.value);}} style={{ width:'100%', minWidth:0, padding:'8px 9px', background:'var(--s1)', border:'1px solid var(--b1)', color:'var(--text)', borderRadius:5, fontSize:11 }} />
  </label>;
}
