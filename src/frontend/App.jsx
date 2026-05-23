import { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { getFleetStats } from './api/fleet';
import Login from './pages/Login';
import FleetOverview from './components/FleetOverview';
import VesselDetail from './components/VesselDetail';
import PortRotation from './components/PortRotation';
import VoyagePlan from './components/VoyagePlan';
import PortMeetings from './components/PortMeetings';
import NoonReport from './components/NoonReport';
import EmissionsDashboard from './components/EmissionsDashboard';
import CharterPnL from './components/CharterPnL';
import Bunkering from './components/Bunkering';
import './styles/global.css';

const NAV = [
  { key:'fleet',     label:'Fleet Overview',  icon:'⊞', group:'vessels' },
  { key:'vessel',    label:'Vessel Detail',    icon:'🚢', group:'vessels' },
  { key:'rotation',  label:'Schedule Planner', icon:'📅', group:'ops' },
  { key:'voyage',    label:'Voyage Plan',      icon:'🧭', group:'ops' },
  { key:'meetings',  label:'Port Meetings',    icon:'📋', group:'ops', alert:true },
  { key:'noon',      label:'Noon Reports',     icon:'📍', group:'ops' },
  { key:'bunkering', label:'Bunkering',        icon:'⛽', group:'ops' },
  { key:'emissions', label:'Emissions',        icon:'📊', group:'analytics' },
  { key:'pnl',       label:'Charter P&L',      icon:'💰', group:'analytics' },
];

const VIEWS = {
  fleet: FleetOverview, vessel: VesselDetail, rotation: PortRotation, voyage: VoyagePlan,
  meetings: PortMeetings, noon: NoonReport, bunkering: Bunkering,
  emissions: EmissionsDashboard, pnl: CharterPnL,
};

export default function App() {
  const { user, role, loading, signOut } = useAuth();
  const [view, setView] = useState('fleet');
  const [selectedScheduleVessel, setSelectedScheduleVessel] = useState('');
  const [stats, setStats] = useState({ total:18, atSea:13, avgUtil:86, ciiA:11, atRisk:1, noonUpdates:3, avgSpeed:17.1 });

  useEffect(() => {
    if (!user) return;
    fetchStats();
  }, [user]);

  async function fetchStats() {
    try {
      const data = await getFleetStats();
      if (data) setStats(data);
    } catch(e) { /* use defaults */ }
  }

  if (loading) return (
    <div style={{ height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)' }}>
      <div style={{ fontFamily:'var(--syne)', color:'var(--accent)', fontSize:'14px', letterSpacing:'2px' }}>LOADING...</div>
    </div>
  );

  if (!user) return <Login />;

  const ActiveView = VIEWS[view] || FleetOverview;
  const userName = user?.user_metadata?.full_name
    || user?.user_metadata?.name
    || user?.email?.split('@')[0]
    || 'User';

  function openScheduleForVessel(vessel) {
    setSelectedScheduleVessel(vessel?.name || vessel || '');
    setView('voyage');
  }

  return (
    <div style={{ height:'100vh', display:'flex', flexDirection:'column', overflow:'hidden' }}>

      {/* TOP NAV */}
      <div style={{ background:'var(--s1)', borderBottom:'1px solid var(--b1)', height:'50px', display:'flex', alignItems:'center', padding:'0 16px', gap:'12px', flexShrink:0, zIndex:100 }}>
        <div style={{ fontFamily:'var(--syne)', fontWeight:800, fontSize:'13px', letterSpacing:'2px', color:'var(--accent)', marginRight:'8px', whiteSpace:'nowrap' }}>
          RORO <span style={{ color:'var(--t2)' }}>FLEET</span>
        </div>
        <div style={{ width:'1px', height:'22px', background:'var(--b1)' }} />
        <div style={{ display:'flex', gap:'2px', overflow:'auto', flex:1 }}>
          {NAV.map(n => (
            <button key={n.key} onClick={() => setView(n.key)} style={{
              background: view===n.key ? 'var(--accent)' : 'none',
              border:'1px solid transparent',
              color: view===n.key ? '#000' : n.alert ? 'var(--yellow)' : 'var(--t2)',
              fontSize:'10px', letterSpacing:'1px', padding:'4px 10px',
              borderRadius:'var(--radius-sm)', whiteSpace:'nowrap',
              fontWeight: view===n.key ? 600 : 400,
            }}>
              {n.label}
              {n.alert && stats.atRisk > 0 && (
                <span style={{ marginLeft:'5px', background:'var(--red)', color:'#fff', fontSize:'8px', padding:'1px 4px', borderRadius:'20px' }}>
                  {stats.atRisk}
                </span>
              )}
            </button>
          ))}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'10px', marginLeft:'auto' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'5px' }}>
            <div style={{ width:'7px', height:'7px', borderRadius:'50%', background:'var(--green)' }} />
            <span style={{ fontSize:'9px', color:'var(--green)', letterSpacing:'1px' }}>LIVE</span>
          </div>
          <div style={{ fontSize:'10px', color:'var(--t2)', background:'var(--s2)', border:'1px solid var(--b1)', borderRadius:'var(--radius-sm)', padding:'3px 8px' }}>
            {role?.toUpperCase()}
          </div>
          <div title={user?.email || userName} style={{ maxWidth:'160px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:'10px', color:'var(--text)', background:'rgba(0,212,255,.07)', border:'1px solid rgba(0,212,255,.22)', borderRadius:'var(--radius-sm)', padding:'3px 8px' }}>
            {userName}
          </div>
          <button onClick={signOut} style={{ background:'none', border:'1px solid var(--b1)', color:'var(--t2)', fontSize:'9px', padding:'3px 8px', borderRadius:'var(--radius-sm)' }}>
            SIGN OUT
          </button>
        </div>
      </div>

      {/* KPI STRIP */}
      <div style={{ background:'var(--s2)', borderBottom:'1px solid var(--b1)', padding:'7px 20px', display:'flex', gap:'24px', overflow:'auto', flexShrink:0 }}>
        {[
          ['Fleet',        stats.total,              `${stats.atSea} at sea`,    ''],
          ['Avg Util',     `${stats.avgUtil}%`,       'cargo',                   'var(--green)'],
          ['Avg Speed',    `${stats.avgSpeed} kn`,    'at sea',                  ''],
          ['CII Grade A',  `${stats.ciiA}/${stats.total}`, 'vessels',           'var(--green)'],
          ['In Port',      stats.total-stats.atSea,   'berth/load',              ''],
          ['At Risk',      stats.atRisk,              'port meeting',             stats.atRisk>0?'var(--red)':'var(--green)'],
          ['Noon Updates', stats.noonUpdates,         'today',                   'var(--green)'],
        ].map(([label,value,sub,color]) => (
          <div key={label} style={{ display:'flex', flexDirection:'column', gap:'1px', minWidth:'80px' }}>
            <div style={{ fontSize:'8px', color:'var(--t3)', letterSpacing:'1.5px', textTransform:'uppercase' }}>{label}</div>
            <div style={{ fontSize:'16px', fontWeight:600, fontFamily:'var(--syne)', color:color||'var(--text)' }}>{value}</div>
            <div style={{ fontSize:'9px', color:'var(--t2)' }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* BODY */}
      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>

        {/* SIDEBAR */}
        <div style={{ width:'200px', background:'var(--s1)', borderRight:'1px solid var(--b1)', display:'flex', flexDirection:'column', flexShrink:0, overflow:'hidden' }}>
          {['vessels','ops','analytics'].map(group => (
            <div key={group}>
              <div style={{ fontSize:'8px', color:'var(--t3)', letterSpacing:'1.5px', padding:'10px 14px 4px', textTransform:'uppercase' }}>
                {{ vessels:'Vessels', ops:'Operations', analytics:'Analytics' }[group]}
              </div>
              {NAV.filter(n => n.group===group).map(n => (
                <div key={n.key} onClick={() => setView(n.key)} style={{
                  display:'flex', alignItems:'center', gap:'8px',
                  padding:'7px 14px', cursor:'pointer', borderRadius:'var(--radius-sm)',
                  margin:'1px 6px', fontSize:'12px',
                  color: view===n.key ? 'var(--text)' : 'var(--t2)',
                  background: view===n.key ? 'var(--s2)' : 'none',
                  fontWeight: view===n.key ? 500 : 400,
                }}>
                  <span style={{ fontSize:'13px' }}>{n.icon}</span>
                  {n.label}
                  {n.alert && stats.atRisk>0 && (
                    <span style={{ marginLeft:'auto', background:'rgba(255,69,96,.15)', color:'var(--red)', border:'1px solid rgba(255,69,96,.3)', fontSize:'9px', padding:'1px 5px', borderRadius:'20px' }}>
                      {stats.atRisk}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* MAIN */}
        <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
          <ActiveView onNavigate={setView} onOpenSchedule={openScheduleForVessel} selectedVessel={selectedScheduleVessel} />
        </div>
      </div>
    </div>
  );
}
