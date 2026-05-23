export default function EmissionsDashboard() {
  var data = [
    { name:'Gothenburg Ace', voyage:'TBC', type:'PCTC', cii:'A', eexi:87, aer:8.2, co2:18400 },
    { name:'Nordic Breeze', voyage:'TBC', type:'PCTC', cii:'A', eexi:91, aer:7.8, co2:22100 },
    { name:'Baltic Carrier', voyage:'TBC', type:'RoRo', cii:'B', eexi:82, aer:9.1, co2:14200 },
    { name:'Atlantic Rover', voyage:'TBC', type:'PCTC', cii:'A', eexi:94, aer:7.6, co2:23400 },
    { name:'Euro Highway', voyage:'TBC', type:'PCTC', cii:'A', eexi:93, aer:8.0, co2:20800 },
    { name:'Stena Freighter', voyage:'TBC', type:'RoRo', cii:'C', eexi:74, aer:11.2, co2:9800 },
    { name:'Finnlines Alfa', voyage:'TBC', type:'RoRo', cii:'D', eexi:68, aer:13.8, co2:13400 },
    { name:'Polaris Highway', voyage:'TBC', type:'PCTC', cii:'A', eexi:96, aer:7.4, co2:25200 },
  ];

  var CII_BG = { A:'#00c853', B:'#69f0ae', C:'#ffd60a', D:'#ff6b35', E:'#ff4560' };
  var totalCO2 = data.reduce(function(s,v) { return s + v.co2; }, 0);
  var avgAer = (data.reduce(function(s,v) { return s + v.aer; }, 0) / data.length).toFixed(1);
  var etsCost = Math.round(totalCO2 * 0.62 * 85);
  var compliant = data.filter(function(v) { return v.eexi >= 80; }).length;

  var kpis = [
    { label:'Fleet Avg AER', value: avgAer + ' g/t·nm', color:'var(--accent)' },
    { label:'YTD CO2', value: (totalCO2/1000).toFixed(0) + 'k MT', color:'var(--yellow)' },
    { label:'EU ETS Est.', value: 'EUR ' + (etsCost/1000000).toFixed(1) + 'M', color:'var(--orange)' },
    { label:'EEXI OK', value: compliant + '/' + data.length, color:'var(--green)' },
  ];

  return (
    <div style={{ height:'100%', overflowY:'auto', padding:'16px' }}>
      <div style={{ fontFamily:'var(--syne)', fontSize:'16px', fontWeight:700, marginBottom:'4px' }}>Emissions Dashboard</div>
      <div style={{ fontSize:'10px', color:'var(--t2)', marginBottom:'14px' }}>CII · EEXI · EU ETS · CO2 trends</div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'10px', marginBottom:'14px' }}>
        {kpis.map(function(k) {
          return (
            <div key={k.label} style={{ background:'var(--s1)', border:'1px solid var(--b1)', borderRadius:'var(--radius)', padding:'14px' }}>
              <div style={{ fontSize:'9px', color:'var(--t3)', letterSpacing:'1.5px', marginBottom:'6px' }}>{k.label}</div>
              <div style={{ fontSize:'22px', fontFamily:'var(--syne)', fontWeight:700, color:k.color }}>{k.value}</div>
            </div>
          );
        })}
      </div>

      <div style={{ background:'var(--s1)', border:'1px solid var(--b1)', borderRadius:'var(--radius)', padding:'16px' }}>
        <div style={{ fontSize:'10px', color:'var(--t2)', letterSpacing:'2px', marginBottom:'12px' }}>VESSEL CII AND EEXI TABLE</div>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'11px' }}>
          <thead>
            <tr>
              {['Vessel / Voyage','Type','CII','AER','EEXI','CO2 YTD','Status'].map(function(h) {
                return (
                  <th key={h} style={{ color:'var(--t3)', fontSize:'9px', letterSpacing:'1.5px', textTransform:'uppercase', padding:'6px 10px', textAlign:'left', borderBottom:'1px solid var(--b1)', fontWeight:500 }}>
                    {h}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {data.map(function(v) {
              var ok = v.eexi >= 80;
              return (
                <tr key={v.name} style={{ borderBottom:'1px solid rgba(30,48,72,.4)' }}>
                  <td style={{ padding:'8px 10px', color:'var(--text)', fontWeight:500 }}>
                    <div>{v.name}</div>
                    <span style={{ display:'inline-block', marginTop:3, fontSize:9, padding:'2px 7px', borderRadius:4, background:'rgba(255,214,10,.12)', color:'var(--yellow)', border:'1px solid rgba(255,214,10,.45)', fontWeight:800 }}>VOY {v.voyage}</span>
                  </td>
                  <td style={{ padding:'8px 10px', color:'var(--t2)' }}>{v.type}</td>
                  <td style={{ padding:'8px 10px' }}>
                    <span style={{ display:'inline-block', width:'20px', height:'20px', borderRadius:'3px', background:CII_BG[v.cii]||'#999', color:'#000', fontSize:'10px', fontWeight:700, textAlign:'center', lineHeight:'20px' }}>
                      {v.cii}
                    </span>
                  </td>
                  <td style={{ padding:'8px 10px', color:'var(--t2)' }}>{v.aer}</td>
                  <td style={{ padding:'8px 10px', color: ok ? 'var(--green)' : 'var(--red)', fontWeight:500 }}>{v.eexi}</td>
                  <td style={{ padding:'8px 10px', color:'var(--t2)' }}>{v.co2.toLocaleString()} MT</td>
                  <td style={{ padding:'8px 10px' }}>
                    <span style={{ fontSize:'9px', padding:'2px 7px', borderRadius:'20px', background: ok ? 'rgba(0,232,150,.12)' : 'rgba(255,69,96,.12)', color: ok ? 'var(--green)' : 'var(--red)', border: '1px solid ' + (ok ? 'rgba(0,232,150,.3)' : 'rgba(255,69,96,.3)') }}>
                      {ok ? 'Compliant' : 'Below target'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
