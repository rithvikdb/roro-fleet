import React, { useEffect, useMemo, useState } from 'react';
import {
  deleteScheduleRecord,
  isMissingScheduleTable,
  listCustomPorts,
  listSchedules,
  saveCustomPortRecord,
  saveScheduleRecord,
} from '../../backend/services/scheduleRepository';
import { listBunkerReports, listVoyagePlans, saveVoyagePlan } from '../api/operations';
import { listMyVessels, listVessels } from '../api/fleet';
import {
  PORT_DICTIONARY,
  allPorts,
  lookupPortOnline,
  mergePorts as mergePortDictionary,
  notifyPortsUpdated,
  uniquePortCode as uniqueDictionaryPortCode,
} from '../data/portDictionary';

const INITIAL_PORTS = PORT_DICTIONARY;

const VESSELS = [
  'Gothenburg Ace',
  'Nordic Breeze',
  'Baltic Carrier',
  'Atlantic Rover',
  'Euro Highway',
  'Polaris Highway',
  'Stena Freighter',
  'Dublin Viking',
];

const TRADE_TAGS = [
  { code: 'TAL', label: 'Transatlantic / US-Mex East Coast' },
  { code: 'NAS', label: 'US East Coast' },
  { code: 'EUROZFE', label: 'Asia-Europe' },
];

const INITIAL_ROWS = [
  makeRow('HOU', { distance: 0, timeDiff: 0, speed: 15.8, etaAdj: 0, psToBerth: 4, etbAdj: 0, commenceAdj: 2, opsHours: 11, completeAdj: 1, berthToPs: 0 }),
  makeRow('PAN', { distance: 1990, timeDiff: -1, speed: 17, etaAdj: 0, psToBerth: 2, etbAdj: 0, commenceAdj: 4.5, opsHours: 8, completeAdj: 1, berthToPs: 2 }),
  makeRow('HIR', { distance: 1550, timeDiff: 4, speed: 17, etaAdj: 0, psToBerth: 1, etbAdj: 0, commenceAdj: 11, opsHours: 12, completeAdj: 1, berthToPs: 1 }),
  makeRow('HOU', { distance: 8117, timeDiff: 0, speed: 17, etaAdj: 0, psToBerth: 0, etbAdj: 0, commenceAdj: 0, opsHours: 0, completeAdj: 0, berthToPs: 0 }),
];

function makeRow(portCode, values, ports = INITIAL_PORTS) {
  const port = ports.find((p) => p.code === portCode) || ports[0];
  return {
    id: `${portCode}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    portCode,
    portName: port.name,
    distance: 0,
    timeDiff: 0,
    speed: 17,
    etaAdj: 0,
    psToBerth: 0,
    etbAdj: 0,
    commenceAdj: 0,
    opsHours: 0,
    completeAdj: 0,
    berthToPs: 0,
    ...values,
  };
}

function asNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function isValidDate(date) {
  return date instanceof Date && Number.isFinite(date.getTime());
}

function safeDate(date, fallback = new Date()) {
  return isValidDate(date) ? date : fallback;
}

function addHours(date, hours) {
  const base = safeDate(date);
  return new Date(base.getTime() + Math.round(hours * 60) * 60000);
}

function floorToHalfHour(date) {
  const next = new Date(safeDate(date));
  const mins = next.getMinutes();
  next.setMinutes(mins < 30 ? 0 : 30, 0, 0);
  return next;
}

function portForRow(row, ports) {
  return (ports || []).find((port) => port.code === row.portCode) || { utc: 0, timeZone: '' };
}

function timeZoneOffsetHours(date, port) {
  const fallback = asNumber(port?.utc);
  if (!port?.timeZone || !isValidDate(date)) return fallback;
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: port.timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date).reduce((map, part) => {
      if (part.type !== 'literal') map[part.type] = Number(part.value);
      return map;
    }, {});
    const zonedAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    return Math.round(((zonedAsUtc - date.getTime()) / 3600000) * 4) / 4;
  } catch {
    return fallback;
  }
}

function formatSignedHours(hours) {
  const value = asNumber(hours);
  if (Math.abs(value) < 0.01) return '0h';
  const sign = value > 0 ? '+' : '-';
  const abs = Math.abs(value);
  return `${sign}${Number.isInteger(abs) ? abs : abs.toFixed(1)}h`;
}

function formatUtcOffset(hours) {
  const value = asNumber(hours);
  if (Math.abs(value) < 0.01) return 'UTC';
  return `UTC${formatSignedHours(value).replace('h', '')}`;
}

function automaticTimeDiff(previousDate, targetDate, previousPort, targetPort) {
  return timeZoneOffsetHours(targetDate, targetPort) - timeZoneOffsetHours(previousDate, previousPort);
}

function calcRows(rows, startDate, ports = INITIAL_PORTS) {
  let previousEtd = safeDate(startDate);
  let previousBerthToPs = 0;
  let previousPort = portForRow(rows[0] || {}, ports);

  return rows.map((row, index) => {
    const port = portForRow(row, ports);
    const steamingHours = row.speed > 0 ? row.distance / row.speed : 0;
    let timeDiff = 0;
    let eta = floorToHalfHour(startDate);
    if (index > 0) {
      const baseEta = floorToHalfHour(addHours(previousEtd, previousBerthToPs + steamingHours + row.etaAdj));
      timeDiff = automaticTimeDiff(previousEtd, baseEta, previousPort, port);
      eta = floorToHalfHour(addHours(previousEtd, previousBerthToPs + steamingHours + timeDiff + row.etaAdj));
      const correctedTimeDiff = automaticTimeDiff(previousEtd, eta, previousPort, port);
      if (Math.abs(correctedTimeDiff - timeDiff) > 0.01) {
        timeDiff = correctedTimeDiff;
        eta = floorToHalfHour(addHours(previousEtd, previousBerthToPs + steamingHours + timeDiff + row.etaAdj));
      }
    }
    const etb = floorToHalfHour(addHours(eta, row.psToBerth + row.etbAdj));
    const commence = floorToHalfHour(addHours(etb, row.commenceAdj));
    const complete = floorToHalfHour(addHours(commence, row.opsHours + row.completeAdj));
    const etd = floorToHalfHour(complete);
    const utcOffset = timeZoneOffsetHours(eta, port);

    previousEtd = etd;
    previousBerthToPs = row.berthToPs;
    previousPort = port;

    return { ...row, timeDiff, utcOffset, portTimeZone: port.timeZone, steamingHours, eta, etb, commence, complete, etd };
  });
}

function dateValue(date) {
  if (!isValidDate(date)) return '--';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  }).format(date).replace(',', '');
}

function dayValue(date) {
  if (!isValidDate(date)) return '';
  return `(${new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date)})`;
}

function toInputDate(date) {
  if (!isValidDate(date)) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseInputDate(value, fallback) {
  const next = new Date(value);
  return isValidDate(next) ? next : fallback;
}

function loadPorts() {
  return allPorts();
}

function mergePorts(localPorts, remotePorts) {
  return mergePortDictionary(localPorts, remotePorts);
}

function mergeSchedules(localSchedules, remoteSchedules) {
  const byId = new Map();
  (localSchedules || []).concat(remoteSchedules || []).forEach((schedule) => {
    if (!schedule?.id) return;
    const existing = byId.get(schedule.id);
    if (!existing || new Date(schedule.updatedAt || 0) >= new Date(existing.updatedAt || 0)) {
      byId.set(schedule.id, schedule);
    }
  });
  return Array.from(byId.values()).sort((a, b) => {
    return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
  });
}

function loadMyVesselNames() {
  return VESSELS;
}

function formatVesselName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').toLowerCase().replace(/\b([a-z])/g, (match) => match.toUpperCase());
}

function kxxText(laneMeters) {
  const n = Number(laneMeters || 0);
  if (!n) return 'TBC';
  return `${Math.round(n / 1.25).toLocaleString()} Kxx`;
}

function defaultVoyageNumber() {
  const d = new Date();
  return `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function storageSafe(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item';
}

function storedVoyagePlanFromRow(row) {
  if (!row) return null;
  return {
    vesselName: row.vessel,
    voyageNumber: row.voyage_number,
    operator: row.operator || '',
    vesselEmail: row.vessel_email || '',
    dischargeInstructions: row.discharge_instructions || '',
    instructions: row.instructions || '',
    sailingInstructions: row.sailing_instructions || '',
    scheduleRows: row.schedule_rows || [],
    bunkerReports: row.bunker_reports || [],
    updatedAt: row.updated_at,
  };
}

function portCompareKey(value) {
  return String(value || '').toLowerCase().replace(/^port of\s+/, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function bunkerFuelLines(bunker) {
  if (Array.isArray(bunker?.fuels) && bunker.fuels.length) return bunker.fuels;
  return [{
    grade: bunker?.grade,
    quantity: bunker?.quantity,
    pricePerMT: bunker?.pricePerMT,
    robBefore: bunker?.robBefore,
    robAfter: bunker?.robAfter,
  }];
}

function bunkerTotalCost(bunker) {
  return bunkerFuelLines(bunker).reduce((sum, fuel) => sum + (asNumber(fuel.quantity) * asNumber(fuel.pricePerMT)), 0);
}

// eslint-disable-next-line no-unused-vars
function VoyageBadge({ value }) {
  const pending = !value;
  return <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, background: pending ? 'rgba(255,214,10,.12)' : 'rgba(0,212,255,.16)', color: pending ? 'var(--yellow)' : 'var(--accent)', border: `1px solid ${pending ? 'rgba(255,214,10,.45)' : 'rgba(0,212,255,.55)'}`, fontWeight: 800, letterSpacing: '.6px', whiteSpace: 'nowrap' }}>VOY {value || 'TBC'}</span>;
}

function uniquePortCode(baseCode, ports) {
  return uniqueDictionaryPortCode(baseCode, ports);
}

export default function PortRotation({ selectedVessel, mode = 'schedule' } = {}) {
  const isVoyagePlan = mode === 'voyage';
  const [vesselOptions, setVesselOptions] = useState(loadMyVesselNames);
  const [vessel, setVessel] = useState(() => loadMyVesselNames()[0]);
  const [trade, setTrade] = useState('TAL');
  const [voyageNumber, setVoyageNumber] = useState(defaultVoyageNumber);
  const [scheduleName, setScheduleName] = useState('Base schedule');
  const [selectedScheduleId, setSelectedScheduleId] = useState('');
  const [savedSchedules, setSavedSchedules] = useState([]);
  const [startDate, setStartDate] = useState(new Date('2021-11-04T22:00:00'));
  const [rows, setRows] = useState(INITIAL_ROWS);
  const [ports, setPorts] = useState(loadPorts);
  const [showNewPort, setShowNewPort] = useState(false);
  const [newPort, setNewPort] = useState({ name: '', code: '', country: '', utc: 0 });
  const [portLookupStatus, setPortLookupStatus] = useState('');
  const [saveStatus, setSaveStatus] = useState('');
  const [backendStatus, setBackendStatus] = useState('Loading shared schedules...');
  const [fuel, setFuel] = useState({ vlsfoPrice: 584, lsmgoPrice: 734, vlsfoRate: 2.7, lsmgoRate: 0.35 });
  const [operator, setOperator] = useState('');
  const [vesselEmail, setVesselEmail] = useState('');
  const [instructions, setInstructions] = useState('');
  const [dischargeInstructions, setDischargeInstructions] = useState('');
  const [sailingInstructions, setSailingInstructions] = useState('');
  const [voyagePlanUpdatedAt, setVoyagePlanUpdatedAt] = useState('');
  const [instructionStatus, setInstructionStatus] = useState('');
  const [instructionTab, setInstructionTab] = useState('voyage');
  const [bunkerReports, setBunkerReports] = useState([]);
  const [fleetVessels, setFleetVessels] = useState([]);
  const [showPlanDetails, setShowPlanDetails] = useState(false);
  const [planTab, setPlanTab] = useState('schedule');

  useEffect(() => {
    let mounted = true;

    async function loadSharedData() {
      try {
        const [remotePorts, remoteSchedules] = await Promise.all([
          listCustomPorts(),
          listSchedules(),
        ]);
        if (!mounted) return;

        setPorts(mergePorts(INITIAL_PORTS, remotePorts));
        setSavedSchedules(mergeSchedules([], remoteSchedules));
        setBackendStatus('Shared backend connected');
      } catch (error) {
        if (!mounted) return;
        setBackendStatus(isMissingScheduleTable(error)
          ? 'Shared schedule tables are not created yet'
          : `Shared backend unavailable: ${error.message || 'unknown error'}`);
      }
    }

    loadSharedData();
    const refresh = () => loadSharedData();
    window.addEventListener('focus', refresh);
    return () => {
      mounted = false;
      window.removeEventListener('focus', refresh);
    };
  }, []);

  useEffect(() => {
    function refreshMyVessels() {
      const next = loadMyVesselNames();
      setVesselOptions(next);
      setVessel((current) => next.includes(current) ? current : next[0]);
    }

    refreshMyVessels();
    window.addEventListener('focus', refreshMyVessels);
    window.addEventListener('storage', refreshMyVessels);
    return () => {
      window.removeEventListener('focus', refreshMyVessels);
      window.removeEventListener('storage', refreshMyVessels);
    };
  }, []);

  useEffect(() => {
    listMyVessels().then((remote) => {
      const names = (remote || []).map((item) => formatVesselName(item.name)).filter(Boolean);
      if (!names.length) return;
      setVesselOptions(names);
      setVessel((current) => names.includes(current) ? current : names[0]);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    listVessels().then((remote) => setFleetVessels(remote || [])).catch(() => {});
  }, []);

  useEffect(() => {
    function refreshPorts() {
      listCustomPorts().then((remotePorts) => {
        setPorts((current) => mergePorts(INITIAL_PORTS.concat(current), remotePorts || []));
      }).catch(() => {});
    }

    window.addEventListener('portsDictionaryUpdated', refreshPorts);
    window.addEventListener('focus', refreshPorts);
    return () => {
      window.removeEventListener('portsDictionaryUpdated', refreshPorts);
      window.removeEventListener('focus', refreshPorts);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    function refreshBunkers() {
      listBunkerReports().then((reports) => {
        if (mounted) setBunkerReports(reports || []);
      }).catch(() => {});
    }
    refreshBunkers();
    window.addEventListener('focus', refreshBunkers);
    return () => {
      mounted = false;
      window.removeEventListener('focus', refreshBunkers);
    };
  }, []);

  useEffect(() => {
    if (!selectedVessel) return;
    setVesselOptions((current) => current.includes(selectedVessel) ? current : [selectedVessel].concat(current));
    setVessel(selectedVessel);
    setScheduleName((current) => current && current !== 'Base schedule' ? current : `${selectedVessel} schedule`);
    setSelectedScheduleId('');
  }, [selectedVessel]);

  useEffect(() => {
    setTrade((current) => current || 'TAL');
  }, [vessel]);

  useEffect(() => {
    setOperator('');
    setVesselEmail('');
    setInstructions('');
    setDischargeInstructions('');
    setSailingInstructions('');
    setVoyagePlanUpdatedAt('');
    setInstructionStatus('');
    let mounted = true;
    listVoyagePlans().then((plans) => {
      if (!mounted) return;
      const remote = (plans || []).find((plan) => formatVesselName(plan.vessel) === formatVesselName(vessel) && String(plan.voyage_number || 'TBC') === String(voyageNumber || 'TBC'));
      const shared = storedVoyagePlanFromRow(remote);
      if (!shared) return;
      setOperator(shared.operator);
      setVesselEmail(shared.vesselEmail);
      setInstructions(shared.instructions);
      setDischargeInstructions(shared.dischargeInstructions);
      setSailingInstructions(shared.sailingInstructions);
      setVoyagePlanUpdatedAt(shared.updatedAt || '');
      setInstructionStatus('Shared voyage instructions loaded');
    }).catch(() => {});
    return () => { mounted = false; };
  }, [vessel, voyageNumber]);

  const calculated = useMemo(() => calcRows(rows, startDate, ports), [rows, startDate, ports]);
  const totalDistance = calculated.reduce((sum, row) => sum + asNumber(row.distance), 0);
  const totalSteam = calculated.reduce((sum, row) => sum + row.steamingHours, 0);
  const vlsfoCons = totalSteam * fuel.vlsfoRate;
  const lsmgoCons = calculated.length * fuel.lsmgoRate;
  const totalFuelCost = (vlsfoCons * fuel.vlsfoPrice) + (lsmgoCons * fuel.lsmgoPrice);
  const avgSpeed = calculated.length ? calculated.reduce((sum, row) => sum + asNumber(row.speed), 0) / calculated.length : 0;
  const vesselDetails = useMemo(() => {
    return fleetVessels.find((item) => formatVesselName(item.name) === formatVesselName(vessel)) || null;
  }, [fleetVessels, vessel]);
  const bunkerByPort = useMemo(() => {
    const map = {};
    bunkerReports
      .filter((bunker) => {
        const sameVessel = formatVesselName(bunker.vessel) === formatVesselName(vessel);
        const bunkerVoyage = bunker.voyageNumber || bunker.voyage_number || 'TBC';
        return sameVessel && (bunkerVoyage === voyageNumber || bunkerVoyage === 'TBC' || !voyageNumber);
      })
      .forEach((bunker) => {
        const key = portCompareKey(bunker.port);
        if (!key) return;
        if (!map[key]) map[key] = [];
        map[key].push(bunker);
      });
    return map;
  }, [bunkerReports, vessel, voyageNumber]);
  const highlightedBunkerRows = calculated.filter((row) => row.bunkerPort || bunkerByPort[portCompareKey(row.portName)] || bunkerByPort[portCompareKey(row.portCode)]);
  const linkedBunkers = highlightedBunkerRows.reduce((items, row) => {
    return items.concat(bunkerByPort[portCompareKey(row.portName)] || bunkerByPort[portCompareKey(row.portCode)] || []);
  }, []);
  const linkedBunkerCost = linkedBunkers.reduce((sum, bunker) => sum + bunkerTotalCost(bunker), 0);
  const instructionDocuments = useMemo(() => {
    function documentText(title, body) {
      const lines = [];
      lines.push(title.toUpperCase());
      lines.push(`Vessel: ${vessel}`);
      lines.push(`Voyage: ${voyageNumber || 'TBC'}`);
      lines.push(`Trade: ${trade}`);
      lines.push(`Operator: ${operator || ''}`);
      lines.push(`Start: ${toInputDate(startDate).replace('T', ' ')}`);
      lines.push('');
      lines.push('SCHEDULE');
      calculated.forEach((row, index) => {
        const bunkerLabel = row.bunkerPort || bunkerByPort[portCompareKey(row.portName)] || bunkerByPort[portCompareKey(row.portCode)] ? ' | BUNKER PORT' : '';
        lines.push(`${index + 1}. ${row.portName || row.portCode || 'Port TBC'} | ETA ${dateValue(row.eta)} ${dayValue(row.eta)} | ETD ${dateValue(row.etd)} ${dayValue(row.etd)} | Distance ${asNumber(row.distance).toLocaleString()} NM | Speed ${asNumber(row.speed)} kn${bunkerLabel}`);
      });
      lines.push('');
      lines.push('PERFORMANCE');
      lines.push(`Design speed: ${vesselDetails?.speed ? `${vesselDetails.speed} kn` : `${avgSpeed.toFixed(1)} kn`}`);
      lines.push(`Cargo utilisation: ${vesselDetails?.cargo_util ? `${vesselDetails.cargo_util}%` : 'TBC'}`);
      lines.push(`Kxx: ${kxxText(vesselDetails?.lane_meters)}`);
      lines.push(`CII: ${vesselDetails?.cii_rating || 'TBC'}`);
      lines.push(`Propulsion: ${vesselDetails?.propulsion || 'TBC'}`);
      lines.push(`Total distance: ${totalDistance.toLocaleString()} NM`);
      lines.push(`Total steaming: ${totalSteam.toFixed(1)} hours`);
      lines.push('');
      lines.push('BUNKERING');
      lines.push(`VLSFO estimate: ${vlsfoCons.toFixed(1)} MT / ${currency(vlsfoCons * fuel.vlsfoPrice)}`);
      lines.push(`LSMGO estimate: ${lsmgoCons.toFixed(1)} MT / ${currency(lsmgoCons * fuel.lsmgoPrice)}`);
      lines.push(`Total fuel cost: ${currency(totalFuelCost)}`);
      lines.push(`Bunker ports: ${highlightedBunkerRows.length}`);
      lines.push(`Linked bunker reports: ${linkedBunkers.length} / ${currency(linkedBunkerCost)}`);
      linkedBunkers.forEach((bunker) => {
        lines.push(`- ${bunker.port || 'Port TBC'}: ${bunkerFuelLines(bunker).map((fuelLine) => `${fuelLine.grade || 'Grade TBC'} ${asNumber(fuelLine.quantity).toLocaleString()} MT`).join(' + ')} | Supplier ${bunker.supplier || 'TBC'} | ${bunker.deliveryDate || 'Date TBC'} | ${currency(bunkerTotalCost(bunker))}`);
      });
      lines.push('');
      lines.push(title.toUpperCase());
      lines.push(body || 'No instructions entered.');
      lines.push('');
      lines.push(`Generated: ${new Date().toLocaleString('en-GB', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit', hour12:false, hourCycle:'h23' })}`);
      return lines.join('\r\n');
    }

    return {
      discharge: {
        key: 'discharge',
        label: 'Discharge Instructions',
        slug: 'discharge-instructions',
        value: dischargeInstructions,
        text: documentText('Discharge Instructions', dischargeInstructions),
      },
      voyage: {
        key: 'voyage',
        label: 'Voyage Instructions',
        slug: 'voyage-instructions',
        value: instructions,
        text: documentText('Voyage Instructions', instructions),
      },
      sailing: {
        key: 'sailing',
        label: 'Sailing Instructions',
        slug: 'sailing-instructions',
        value: sailingInstructions,
        text: documentText('Sailing Instructions', sailingInstructions),
      },
    };
  }, [vessel, voyageNumber, trade, operator, startDate, calculated, bunkerByPort, vesselDetails, avgSpeed, totalDistance, totalSteam, vlsfoCons, lsmgoCons, totalFuelCost, fuel.vlsfoPrice, fuel.lsmgoPrice, highlightedBunkerRows, linkedBunkers, linkedBunkerCost, dischargeInstructions, instructions, sailingInstructions]);
  const displayedVesselOptions = vesselOptions.includes(vessel) ? vesselOptions : [vessel].concat(vesselOptions);

  function updateRow(id, field, value) {
    if (field === 'portCode') {
      const port = ports.find((item) => item.code === value) || ports[0];
      const next = rows.map((row) => {
        return row.id === id ? { ...row, portCode: port.code, portName: port.name } : row;
      });
      setRows(next);
      return;
    }

    setRows((current) => current.map((row) => {
      if (row.id !== id) return row;
      if (field === 'bunkerPort') return { ...row, bunkerPort: Boolean(value) };
      return { ...row, [field]: asNumber(value), ...(field === 'distance' ? { distanceSource: 'manual' } : {}) };
    }));
  }

  function toggleBunkerPort(id) {
    setRows((current) => current.map((row) => row.id === id ? { ...row, bunkerPort: !row.bunkerPort } : row));
  }

  function addPort() {
    setRows((current) => current.concat(makeRow(ports[0].code, {}, ports)));
  }

  async function addCustomPort() {
    const name = newPort.name.trim();
    if (!name) return;

    const generatedCode = name
      .replace(/[^a-z0-9]/gi, '')
      .slice(0, 3)
      .toUpperCase()
      .padEnd(3, 'X');
    const baseCode = (newPort.code.trim() || generatedCode).replace(/[^a-z0-9]/gi, '').slice(0, 6).toUpperCase();
    const code = uniquePortCode(baseCode, ports);
    const duplicate = ports.find((port) => port.name.toLowerCase() === name.toLowerCase());

    if (duplicate) {
      setRows((current) => current.concat(makeRow(duplicate.code, {}, ports)));
      setNewPort({ name: '', code: '', country: '', utc: 0 });
      setShowNewPort(false);
      return;
    }

    const port = {
      code,
      name,
      country: newPort.country.trim().toUpperCase() || '--',
      utc: asNumber(newPort.utc),
      timeZone: newPort.timeZone,
      terminal: newPort.terminal || name,
      region: newPort.region || '',
      lat: newPort.lat,
      lon: newPort.lon,
      source: newPort.source,
      custom: true,
    };

    try {
      const savedPort = await saveCustomPortRecord(port);
      setPorts((current) => current.concat(savedPort));
      setRows((current) => current.concat(makeRow(savedPort.code, {}, ports.concat(savedPort))));
      setNewPort({ name: '', code: '', country: '', utc: 0 });
      setPortLookupStatus('');
      setShowNewPort(false);
      notifyPortsUpdated();
      setBackendStatus('Shared backend connected');
    } catch (error) {
      setBackendStatus(isMissingScheduleTable(error)
        ? 'Port was not saved. Shared schedule tables are not created yet.'
        : `Port was not saved: ${error.message || 'shared backend unavailable'}`);
    }
  }

  async function findPortOnline() {
    const name = newPort.name.trim();
    if (!name) {
      setPortLookupStatus('Enter a port name to search online.');
      return;
    }

    const duplicate = ports.find((port) => port.name.toLowerCase() === name.toLowerCase() || port.code.toLowerCase() === name.toLowerCase());
    if (duplicate) {
      setNewPort({ name: duplicate.name, code: duplicate.code, country: duplicate.country, utc: duplicate.utc });
      setPortLookupStatus(`${duplicate.name} is already in the port dictionary.`);
      return;
    }

    setPortLookupStatus('Searching online...');
    try {
      const found = await lookupPortOnline(name, ports);
      setNewPort({
        name: found.name,
        code: found.code,
        country: found.country,
        utc: found.utc,
        timeZone: found.timeZone,
        terminal: found.terminal,
        region: found.region,
        lat: found.lat,
        lon: found.lon,
        source: found.source,
      });
      setPortLookupStatus(`Found ${found.name}, ${found.country}. Review and save.`);
    } catch (error) {
      setPortLookupStatus(error.message || 'Online lookup failed.');
    }
  }

  function removePort(id) {
    setRows((current) => current.length > 1 ? current.filter((row) => row.id !== id) : current);
  }

  function movePort(id, direction) {
    setRows((current) => {
      const index = current.findIndex((row) => row.id === id);
      const swap = direction === 'up' ? index - 1 : index + 1;
      if (index < 0 || swap < 0 || swap >= current.length) return current;
      const next = current.slice();
      [next[index], next[swap]] = [next[swap], next[index]];
      return next;
    });
  }

  async function saveSchedule() {
    const name = scheduleName.trim() || `${vessel} schedule`;
    const voyage = voyageNumber.trim() || defaultVoyageNumber();
    const schedule = {
      id: selectedScheduleId || `schedule-${storageSafe(vessel)}-${storageSafe(voyage)}-${Date.now()}`,
      name,
      vessel,
      trade,
      voyageNumber: voyage,
      startDate: safeDate(startDate).toISOString(),
      rows,
      fuel,
      updatedAt: new Date().toISOString(),
      expectedUpdatedAt: (savedSchedules.find((item) => item.id === selectedScheduleId) || {}).expectedUpdatedAt || null,
    };

    setSaveStatus(`Saving shared schedule "${name}"...`);

    try {
      const remoteSchedule = await saveScheduleRecord(schedule);
      const nextSchedules = mergeSchedules(savedSchedules, [remoteSchedule]);
      setSavedSchedules(nextSchedules);
      setSelectedScheduleId(remoteSchedule.id);
      setScheduleName(name);
      setVoyageNumber(voyage);
      setSaveStatus(`Saved shared schedule "${name}"`);
      setBackendStatus('Shared backend connected');
    } catch (error) {
      setSaveStatus(isMissingScheduleTable(error)
        ? `Schedule was not saved. Shared schedule tables are not created yet.`
        : `Schedule was not saved: ${error.message || 'shared backend unavailable'}`);
      setBackendStatus(isMissingScheduleTable(error)
        ? 'Shared schedule tables are not created yet'
        : `Shared backend unavailable: ${error.message || 'unknown error'}`);
    }
  }

  function loadSchedule(id) {
    const schedule = savedSchedules.find((item) => item.id === id);
    setSelectedScheduleId(id);
    if (!schedule) return;
    setScheduleName(schedule.name);
    setVessel(schedule.vessel || vesselOptions[0]);
    setTrade(schedule.trade || 'TAL');
    setVoyageNumber(schedule.voyageNumber || defaultVoyageNumber());
    setStartDate(parseInputDate(schedule.startDate || Date.now(), new Date()));
    setRows(Array.isArray(schedule.rows) && schedule.rows.length ? schedule.rows : INITIAL_ROWS);
    if (schedule.fuel) setFuel(schedule.fuel);
  }

  function newSchedule() {
    setSelectedScheduleId('');
    setScheduleName('New schedule');
    setVessel(vesselOptions[0]);
    setTrade('TAL');
    setVoyageNumber(defaultVoyageNumber());
    setStartDate(new Date());
    setRows([makeRow(ports[0].code, {}, ports)]);
  }

  async function deleteSchedule() {
    if (!selectedScheduleId) return;
    const deletingId = selectedScheduleId;
    setSaveStatus('Deleting shared schedule...');
    try {
      await deleteScheduleRecord(deletingId);
      setSavedSchedules((current) => current.filter((item) => item.id !== deletingId));
      setSelectedScheduleId('');
      setSaveStatus('Schedule deleted');
      setBackendStatus('Shared backend connected');
    } catch (error) {
      setSaveStatus(isMissingScheduleTable(error)
        ? 'Schedule was not deleted. Shared schedule tables are not created yet.'
        : `Schedule was not deleted: ${error.message || 'shared backend unavailable'}`);
    }
  }

  async function saveVoyagePlanNotes(documentLabel = 'Instructions') {
    const plan = {
      vessel: { name: vessel, trade, voyageNumber },
      vesselName: vessel,
      voyageNumber,
      trade,
      operator,
      vesselEmail,
      dischargeInstructions,
      instructions,
      sailingInstructions,
      scheduleRows: calculated.map((row) => ({
        id: row.id,
        portName: row.portName,
        portCode: row.portCode,
        eta: row.eta.toISOString(),
        etd: row.etd.toISOString(),
        distance: row.distance,
        speed: row.speed,
        bunkerPort: Boolean(row.bunkerPort),
      })),
      fuel,
      bunkerReports: linkedBunkers,
      updatedAt: new Date().toISOString(),
      expectedUpdatedAt: voyagePlanUpdatedAt || null,
      phase: 'shared',
    };
    setInstructionStatus(`Saving ${documentLabel.toLowerCase()} to shared plan...`);
    try {
      const savedPlan = await saveVoyagePlan(plan);
      setVoyagePlanUpdatedAt(savedPlan.updated_at || '');
      setInstructionStatus(`${documentLabel} saved to shared plan`);
    } catch (error) {
      setInstructionStatus(`${documentLabel} was not saved: ${error.message || 'shared sync failed'}`);
    }
  }

  function exportInstructionText(instructionDocument) {
    const blob = new Blob([instructionDocument.text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${storageSafe(vessel)}-${instructionDocument.slug}-${storageSafe(voyageNumber)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setInstructionStatus(`${instructionDocument.label} exported as text file`);
  }

  function openInstructionEmailDraft(instructionDocument) {
    const subject = encodeURIComponent(`${instructionDocument.label} - ${vessel} - VOY ${voyageNumber || 'TBC'}`);
    const body = encodeURIComponent(instructionDocument.text);
    window.location.href = `mailto:${encodeURIComponent(vesselEmail || '')}?subject=${subject}&body=${body}`;
    setInstructionStatus(`${instructionDocument.label} email draft opened`);
  }

  function tabButton(tab, label) {
    const active = planTab === tab;
    return (
      <button
        onClick={() => setPlanTab(tab)}
        style={{
          background: active ? 'var(--accent)' : 'var(--s2)',
          border: '1px solid ' + (active ? 'var(--accent)' : 'var(--b1)'),
          color: active ? '#000' : 'var(--t2)',
          fontSize: 10,
          fontWeight: 800,
          padding: '8px 12px',
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer',
          letterSpacing: 1,
        }}
      >
        {label}
      </button>
    );
  }

  function openInstructionTab(tab) {
    setInstructionTab(tab);
    setPlanTab('instructions');
  }

  function instructionPlanTabButton(tab, label) {
    const active = planTab === 'instructions' && instructionTab === tab;
    return (
      <button
        onClick={() => openInstructionTab(tab)}
        style={{
          background: active ? 'var(--accent)' : 'var(--s2)',
          border: '1px solid ' + (active ? 'var(--accent)' : 'var(--b1)'),
          color: active ? '#000' : 'var(--t2)',
          fontSize: 10,
          fontWeight: 800,
          padding: '8px 12px',
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer',
          letterSpacing: 1,
        }}
      >
        {label}
      </button>
    );
  }

  function renderPerformancePanel() {
    return (
      <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'grid', gridTemplateColumns: '1.15fr 1fr 1fr', gap: 12, alignContent: 'start' }}>
        <Summary title="Vessel Performance">
          <Metric label="Design speed" value={vesselDetails?.speed ? `${vesselDetails.speed} kn` : `${avgSpeed.toFixed(1)} kn`} />
          <Metric label="Cargo util." value={vesselDetails?.cargo_util ? `${vesselDetails.cargo_util}%` : 'TBC'} accent />
          <Metric label="Kxx" value={kxxText(vesselDetails?.lane_meters)} />
          <Metric label="CII" value={vesselDetails?.cii_rating || 'TBC'} />
          <Metric label="Propulsion" value={vesselDetails?.propulsion || 'TBC'} />
          <Metric label="Total steam" value={`${totalSteam.toFixed(1)} h`} />
        </Summary>
        <Summary title="VLSFO Cons.">
          <FuelInput label="Price" value={fuel.vlsfoPrice} onChange={(value) => setFuel((f) => ({ ...f, vlsfoPrice: asNumber(value) }))} />
          <FuelInput label="Rate mt/h" value={fuel.vlsfoRate} onChange={(value) => setFuel((f) => ({ ...f, vlsfoRate: asNumber(value) }))} />
          <Metric label="Costs" value={currency(vlsfoCons * fuel.vlsfoPrice)} accent />
        </Summary>
        <Summary title="LSMGO Cons.">
          <FuelInput label="Price" value={fuel.lsmgoPrice} onChange={(value) => setFuel((f) => ({ ...f, lsmgoPrice: asNumber(value) }))} />
          <FuelInput label="Rate mt/call" value={fuel.lsmgoRate} onChange={(value) => setFuel((f) => ({ ...f, lsmgoRate: asNumber(value) }))} />
          <Metric label="Costs" value={currency(lsmgoCons * fuel.lsmgoPrice)} accent />
        </Summary>
        <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
          <MetricCard label="Total distance" value={`${totalDistance.toLocaleString()} NM`} />
          <MetricCard label="Port calls" value={String(calculated.length)} />
          <MetricCard label="Total fuel cost" value={currency(totalFuelCost)} accent />
          <MetricCard label="Next port" value={calculated[1]?.portName || calculated[0]?.portName || 'TBC'} />
        </div>
      </div>
    );
  }

  function renderBunkeringPanel() {
    return (
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        <div style={{ border: '1px solid rgba(255,140,66,.35)', borderRadius: 6, background: 'rgba(255,140,66,.07)', padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: '#ff8c42', letterSpacing: 1.4, textTransform: 'uppercase', fontWeight: 800 }}>Bunker Ports / Linked Bunkering</div>
            <div style={{ fontSize: 11, color: 'var(--t2)' }}>{highlightedBunkerRows.length} highlighted ports - {linkedBunkers.length} linked reports - {currency(linkedBunkerCost)}</div>
          </div>
          {highlightedBunkerRows.length ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
              {highlightedBunkerRows.map((row) => {
                const rowBunkers = bunkerByPort[portCompareKey(row.portName)] || bunkerByPort[portCompareKey(row.portCode)] || [];
                return (
                  <div key={row.id} style={{ border: '1px solid rgba(255,140,66,.28)', borderRadius: 6, background: 'rgba(3,7,13,.42)', padding: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                      <div style={{ fontFamily: 'var(--syne)', fontSize: 13, fontWeight: 700, color: '#ff8c42' }}>{row.portName || row.portCode}</div>
                      <div style={{ fontSize: 10, color: 'var(--t3)' }}>{rowBunkers.length ? 'Linked' : 'Manual'}</div>
                    </div>
                    {rowBunkers.length ? rowBunkers.map((bunker) => (
                      <div key={bunker.id || `${bunker.port}-${bunker.deliveryDate}`} style={{ fontSize: 11, color: 'var(--t2)', lineHeight: 1.45, marginTop: 5 }}>
                        <div>{bunkerFuelLines(bunker).map((fuelLine) => `${fuelLine.grade}: ${asNumber(fuelLine.quantity).toLocaleString()} MT`).join(' + ')}</div>
                        <div>{bunker.supplier || 'Supplier TBC'} - {bunker.deliveryDate || 'Date TBC'} - {currency(bunkerTotalCost(bunker))}</div>
                        {(bunker.berth || bunker.notes) && <div style={{ color: 'var(--t3)' }}>{[bunker.berth, bunker.notes].filter(Boolean).join(' - ')}</div>}
                      </div>
                    )) : (
                      <div style={{ fontSize: 11, color: 'var(--t3)' }}>Marked as bunker port in this voyage plan. Add a matching report in Bunkering to pull supplier, grade, quantity, ROB, and cost.</div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: 'var(--t3)' }}>Use + BNK beside a port in the Schedule tab, or add a matching bunker report in the Bunkering tab.</div>
          )}
        </div>
      </div>
    );
  }

  function renderInstructionsPanel() {
    const instructionTabs = [
      {
        key: 'discharge',
        label: 'DISCHARGE INSTRUCTIONS',
        value: dischargeInstructions,
        onChange: setDischargeInstructions,
        placeholder: 'Paste discharge instructions here...',
      },
      {
        key: 'voyage',
        label: 'VOYAGE INSTRUCTIONS',
        value: instructions,
        onChange: setInstructions,
        placeholder: 'Paste operator voyage instructions here...',
      },
      {
        key: 'sailing',
        label: 'SAILING INSTRUCTIONS',
        value: sailingInstructions,
        onChange: setSailingInstructions,
        placeholder: 'Paste sailing instructions here...',
      },
    ];
    const activeInstructions = instructionTabs.find((tab) => tab.key === instructionTab) || instructionTabs[1];
    const activeDocument = instructionDocuments[activeInstructions.key];

    return (
      <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'grid', gridTemplateColumns: '1.25fr .75fr', gap: 12, alignContent: 'start' }}>
        <div style={{ border: '1px solid var(--b1)', borderRadius: 6, background: 'var(--s2)', padding: 12, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: 'var(--accent)', letterSpacing: 1.4, textTransform: 'uppercase', fontWeight: 800 }}>{activeInstructions.label}</div>
            {instructionStatus && <span style={{ fontSize: 10, color: instructionStatus.includes('blocked') ? 'var(--red)' : 'var(--green)' }}>{instructionStatus}</span>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '180px 220px 1fr', gap: 8, marginBottom: 10 }}>
            <Field label="Operator">
              <input value={operator} onChange={(e) => setOperator(e.target.value)} placeholder="Operator / trade desk" style={{ ...controlStyle, width: '100%' }} />
            </Field>
            <Field label="Vessel email">
              <input value={vesselEmail} onChange={(e) => setVesselEmail(e.target.value)} placeholder="vessel@example.com" style={{ ...controlStyle, width: '100%' }} />
            </Field>
            <div style={{ display: 'flex', alignItems: 'end', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => saveVoyagePlanNotes(activeDocument.label)} style={primaryButton}>SAVE</button>
              <button onClick={() => exportInstructionText(activeDocument)} style={secondaryButton}>EXPORT TXT</button>
              <button onClick={() => openInstructionEmailDraft(activeDocument)} style={secondaryButton}>EMAIL DRAFT</button>
            </div>
          </div>
          <textarea
            value={activeInstructions.value}
            onChange={(e) => activeInstructions.onChange(e.target.value)}
            placeholder={activeInstructions.placeholder}
            style={{ width: '100%', minHeight: 300, resize: 'vertical', padding: 10, background: 'rgba(3,7,13,.55)', border: '1px solid var(--b1)', color: 'var(--text)', borderRadius: 6, outline: 'none', fontSize: 12, lineHeight: 1.45, fontFamily: 'Consolas, monospace' }}
          />
        </div>
        <div style={{ border: '1px solid var(--b1)', borderRadius: 6, background: 'var(--s2)', padding: 12, minWidth: 0 }}>
          <div style={{ fontSize: 10, color: 'var(--accent)', letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 8, fontWeight: 800 }}>{activeDocument.label} Preview</div>
          <textarea readOnly value={activeDocument.text} style={{ width: '100%', minHeight: 390, resize: 'vertical', padding: 10, background: 'rgba(3,7,13,.55)', border: '1px solid var(--b1)', color: 'var(--t2)', borderRadius: 6, outline: 'none', fontSize: 10, lineHeight: 1.45, fontFamily: 'Consolas, monospace' }} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--b1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 320, flex: '1 1 420px' }}>
          <div style={{ fontSize: 9, color: 'var(--t3)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 3 }}>{isVoyagePlan ? 'Voyage Plan' : 'Schedule Planner'}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontFamily: 'var(--syne)', fontSize: 25, lineHeight: 1.1, fontWeight: 800, color: 'var(--accent)', letterSpacing: 0 }}>{vessel}</div>
            <span style={{ fontFamily: 'var(--syne)', fontSize: 18, fontWeight: 800, color: 'var(--yellow)', border: '1px solid rgba(255,214,10,.48)', background: 'rgba(255,214,10,.1)', borderRadius: 6, padding: '5px 10px', whiteSpace: 'nowrap' }}>VOY {voyageNumber || 'TBC'}</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--t2)', marginTop: 5 }}>
            {trade} - {calculated.length} port calls - {totalDistance.toLocaleString()} NM
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <input
            value={scheduleName}
            onChange={(e) => setScheduleName(e.target.value)}
            placeholder="Schedule name"
            style={{ ...controlStyle, width: 150 }}
          />
          <select value={vessel} onChange={(e) => setVessel(e.target.value)} style={controlStyle}>
            {displayedVesselOptions.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select
            value={trade}
            onChange={(e) => {
              setTrade(e.target.value);
            }}
            style={{ ...controlStyle, width: 220 }}
          >
            {TRADE_TAGS.map((item) => <option key={item.code} value={item.code}>{item.code} - {item.label}</option>)}
          </select>
          <input
            value={voyageNumber}
            onChange={(e) => {
              setVoyageNumber(e.target.value);
              setSelectedScheduleId('');
              setScheduleName(`${vessel} voyage ${e.target.value || 'new'}`);
            }}
            placeholder="Voyage no."
            style={{ ...controlStyle, width: 105 }}
          />
          <select value={selectedScheduleId} onChange={(e) => loadSchedule(e.target.value)} style={{ ...controlStyle, width: 190 }}>
            <option value="">Saved schedules</option>
            {savedSchedules.map((schedule) => (
              <option key={schedule.id} value={schedule.id}>{schedule.name} - {schedule.vessel}{schedule.voyageNumber ? ` - Voy ${schedule.voyageNumber}` : ''}</option>
            ))}
          </select>
          <label style={dateControlStyle}>
            <span style={{ color: 'var(--t3)', fontSize: 8, letterSpacing: 1.2 }}>DATE:</span>
            <input
              type="datetime-local"
              value={toInputDate(startDate)}
              onChange={(e) => setStartDate((current) => parseInputDate(e.target.value, current))}
              style={{ ...controlStyle, width: 165 }}
            />
          </label>
          <button onClick={saveSchedule} style={primaryButton}>SAVE</button>
          <button onClick={newSchedule} style={secondaryButton}>NEW</button>
          <button onClick={deleteSchedule} disabled={!selectedScheduleId} style={{ ...secondaryButton, opacity: selectedScheduleId ? 1 : 0.45 }}>DELETE</button>
          <button onClick={addPort} style={primaryButton}>+ ADD PORT</button>
          <button onClick={() => setShowNewPort((value) => !value)} style={secondaryButton}>+ NEW PORT</button>
          {saveStatus && <span style={{ fontSize: 10, color: saveStatus.includes('not found') || saveStatus.includes('failed') || saveStatus.includes('not saved') ? 'var(--yellow)' : 'var(--green)' }}>{saveStatus}</span>}
          {backendStatus && <span style={{ fontSize: 10, color: backendStatus.includes('connected') ? 'var(--green)' : 'var(--yellow)' }}>{backendStatus}</span>}
        </div>
      </div>

      {showNewPort && (
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--b1)', background: 'var(--s1)', display: 'flex', alignItems: 'end', gap: 8, flexWrap: 'wrap' }}>
          <Field label="Port name">
            <input value={newPort.name} onChange={(e) => setNewPort((port) => ({ ...port, name: e.target.value }))} placeholder="e.g. Lagos" style={{ ...controlStyle, width: 180 }} />
          </Field>
          <Field label="Code">
            <input value={newPort.code} onChange={(e) => setNewPort((port) => ({ ...port, code: e.target.value.toUpperCase() }))} placeholder="optional" style={{ ...controlStyle, width: 90 }} />
          </Field>
          <Field label="Country">
            <input value={newPort.country} onChange={(e) => setNewPort((port) => ({ ...port, country: e.target.value.toUpperCase().slice(0, 2) }))} placeholder="US" style={{ ...controlStyle, width: 70 }} />
          </Field>
          <Field label="UTC">
            <input type="number" value={newPort.utc} onChange={(e) => setNewPort((port) => ({ ...port, utc: e.target.value }))} style={{ ...controlStyle, width: 70 }} />
          </Field>
          <button onClick={findPortOnline} style={secondaryButton}>FIND ONLINE</button>
          <button onClick={addCustomPort} style={primaryButton}>SAVE PORT</button>
          <button onClick={() => setShowNewPort(false)} style={secondaryButton}>CANCEL</button>
          {portLookupStatus && <span style={{ fontSize: 10, color: portLookupStatus.includes('failed') || portLookupStatus.includes('Enter') ? 'var(--red)' : 'var(--yellow)' }}>{portLookupStatus}</span>}
        </div>
      )}

      {isVoyagePlan && (
        <div style={{ padding: '9px 16px', borderBottom: '1px solid var(--b1)', background: 'var(--s1)', display: 'flex', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>
          {tabButton('schedule', 'SCHEDULE')}
          {tabButton('performance', 'PERFORMANCE')}
          {tabButton('bunkering', 'BUNKERING')}
          {instructionPlanTabButton('discharge', 'DISCHARGE INSTRUCTIONS')}
          {instructionPlanTabButton('voyage', 'VOYAGE INSTRUCTIONS')}
          {instructionPlanTabButton('sailing', 'SAILING INSTRUCTIONS')}
        </div>
      )}

      {(!isVoyagePlan || planTab === 'schedule') && <div style={{ flex: 1, overflow: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', minWidth: 1685, width: '100%' }}>
          <thead>
            <tr>
              <GroupHeader colSpan={4}>Route</GroupHeader>
              <GroupHeader colSpan={7}>Arrival</GroupHeader>
              <GroupHeader colSpan={7}>Berth Ops</GroupHeader>
              <GroupHeader colSpan={4}>Departure</GroupHeader>
            </tr>
            <tr>
              <Header width={190} rowSpan={2}>PORT</Header>
              <Header width={84} rowSpan={2}>DISTANCE</Header>
              <Header width={72} rowSpan={2}>SPEED</Header>
              <Header width={100} rowSpan={2}>STEAMING HOUR</Header>
              <Header width={82} rowSpan={2}>ADJUSTMENT</Header>
              <Header colSpan={2}>ETA (P/S)</Header>
              <Header width={82} rowSpan={2}>ADJUSTMENT</Header>
              <Header width={96} rowSpan={2}>P/S TO BERTH</Header>
              <Header colSpan={2}>ETB</Header>
              <Header width={92} rowSpan={2}>COMMENCE ADJ</Header>
              <Header colSpan={2}>COMMENCE</Header>
              <Header width={80} rowSpan={2}>OPS HOUR</Header>
              <Header width={92} rowSpan={2}>COMPLETE ADJ</Header>
              <Header colSpan={2}>COMPLETE</Header>
              <Header colSpan={2}>ETD</Header>
              <Header width={96} rowSpan={2}>BERTH TO P/S</Header>
              <Header width={104} rowSpan={2}>ACTIONS</Header>
            </tr>
            <tr>
              {['DATE', 'DAY', 'DATE', 'DAY', 'DATE', 'DAY', 'DATE', 'DAY', 'DATE', 'DAY'].map((label, index) => (
                <SubHeader key={`${label}-${index}`}>{label}</SubHeader>
              ))}
            </tr>
          </thead>
          <tbody>
            {calculated.map((row, index) => {
              const rowBunkers = bunkerByPort[portCompareKey(row.portName)] || bunkerByPort[portCompareKey(row.portCode)] || [];
              const isBunkerPort = row.bunkerPort || rowBunkers.length > 0;
              return (
              <tr key={row.id} style={{ background: isBunkerPort ? 'rgba(255,140,66,.14)' : (index % 2 === 0 ? 'rgba(18,30,46,.92)' : 'rgba(13,21,32,.92)') }}>
                <Cell sticky>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={rowNumber}>{index + 1}</div>
                    <select value={row.portCode} onChange={(e) => updateRow(row.id, 'portCode', e.target.value)} style={{ ...cellInput, width: 126 }}>
                      {ports.map((port) => <option key={port.code} value={port.code}>{port.name}</option>)}
                    </select>
                    <span title={`${formatUtcOffset(row.utcOffset)}${row.portTimeZone ? ` - ${row.portTimeZone}` : ''}`} style={timeDiffBadge}>
                      {index === 0 ? formatUtcOffset(row.utcOffset) : formatSignedHours(row.timeDiff)}
                    </span>
                    <button
                      onClick={() => toggleBunkerPort(row.id)}
                      title={rowBunkers.length ? 'Bunker report linked from Bunkering tab' : (row.bunkerPort ? 'Remove manual bunker highlight' : 'Mark as bunker port')}
                      style={{
                        fontSize: 9,
                        color: isBunkerPort ? '#ff8c42' : 'var(--t3)',
                        border: '1px solid ' + (isBunkerPort ? 'rgba(255,140,66,.55)' : 'var(--b1)'),
                        background: isBunkerPort ? 'rgba(255,140,66,.12)' : 'rgba(122,155,181,.08)',
                        borderRadius: 4,
                        padding: '3px 6px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {rowBunkers.length ? 'BUNKER LINKED' : (row.bunkerPort ? 'BUNKER' : '+ BNK')}
                    </button>
                  </div>
                </Cell>
                <InputCell value={row.distance} onChange={(value) => updateRow(row.id, 'distance', value)} />
                <InputCell value={row.speed} onChange={(value) => updateRow(row.id, 'speed', value)} highlight />
                <FormulaCell>{row.steamingHours.toFixed(1)}</FormulaCell>
                <InputCell value={row.etaAdj} onChange={(value) => updateRow(row.id, 'etaAdj', value)} />
                <DateCell date={row.eta} />
                <DayCell date={row.eta} />
                <InputCell value={row.etbAdj} onChange={(value) => updateRow(row.id, 'etbAdj', value)} />
                <InputCell value={row.psToBerth} onChange={(value) => updateRow(row.id, 'psToBerth', value)} />
                <DateCell date={row.etb} />
                <DayCell date={row.etb} />
                <InputCell value={row.commenceAdj} onChange={(value) => updateRow(row.id, 'commenceAdj', value)} />
                <DateCell date={row.commence} />
                <DayCell date={row.commence} />
                <InputCell value={row.opsHours} onChange={(value) => updateRow(row.id, 'opsHours', value)} />
                <InputCell value={row.completeAdj} onChange={(value) => updateRow(row.id, 'completeAdj', value)} />
                <DateCell date={row.complete} />
                <DayCell date={row.complete} />
                <DateCell date={row.etd} />
                <DayCell date={row.etd} />
                <InputCell value={row.berthToPs} onChange={(value) => updateRow(row.id, 'berthToPs', value)} />
                <Cell>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => movePort(row.id, 'up')} style={smallButton}>UP</button>
                    <button onClick={() => movePort(row.id, 'down')} style={smallButton}>DN</button>
                    <button onClick={() => removePort(row.id)} style={dangerButton}>X</button>
                  </div>
                </Cell>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>}

      {isVoyagePlan && planTab === 'performance' && renderPerformancePanel()}
      {isVoyagePlan && planTab === 'bunkering' && renderBunkeringPanel()}
      {isVoyagePlan && planTab === 'instructions' && renderInstructionsPanel()}
      {isVoyagePlan && planTab === 'schedule' && (
      <div style={{ borderTop: '1px solid var(--b1)', background: 'var(--s1)', padding: '8px 16px', display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr)) auto', gap: 8, alignItems: 'center', flexShrink: 0 }}>
        <MetricCard label="Distance" value={`${totalDistance.toLocaleString()} NM`} />
        <MetricCard label="Port calls" value={String(calculated.length)} />
        <MetricCard label="Bunker ports" value={String(highlightedBunkerRows.length)} accent />
        <MetricCard label="Linked bunkers" value={`${linkedBunkers.length} / ${currency(linkedBunkerCost)}`} accent />
        <MetricCard label="Fuel estimate" value={currency(totalFuelCost)} />
        <button onClick={() => setPlanTab('performance')} style={primaryButton}>PERFORMANCE</button>
      </div>
      )}

      {false && (showPlanDetails ? (
      <div style={{ borderTop: '1px solid var(--b1)', background: 'var(--s1)', padding: '10px 16px', display: 'grid', gridTemplateColumns: '1.15fr 1fr 1fr', gap: 12, flexShrink: 0, maxHeight: '42vh', overflow: 'auto' }}>
        <Summary title="Vessel Performance">
          <Metric label="Design speed" value={vesselDetails?.speed ? `${vesselDetails.speed} kn` : `${avgSpeed.toFixed(1)} kn`} />
          <Metric label="Cargo util." value={vesselDetails?.cargo_util ? `${vesselDetails.cargo_util}%` : 'TBC'} accent />
          <Metric label="Kxx" value={kxxText(vesselDetails?.lane_meters)} />
          <Metric label="CII" value={vesselDetails?.cii_rating || 'TBC'} />
          <Metric label="Propulsion" value={vesselDetails?.propulsion || 'TBC'} />
          <Metric label="Total steam" value={`${totalSteam.toFixed(1)} h`} />
        </Summary>
        <Summary title="VLSFO Cons.">
          <FuelInput label="Price" value={fuel.vlsfoPrice} onChange={(value) => setFuel((f) => ({ ...f, vlsfoPrice: asNumber(value) }))} />
          <FuelInput label="Rate mt/h" value={fuel.vlsfoRate} onChange={(value) => setFuel((f) => ({ ...f, vlsfoRate: asNumber(value) }))} />
          <Metric label="Costs" value={currency(vlsfoCons * fuel.vlsfoPrice)} accent />
        </Summary>
        <Summary title="LSMGO Cons.">
          <FuelInput label="Price" value={fuel.lsmgoPrice} onChange={(value) => setFuel((f) => ({ ...f, lsmgoPrice: asNumber(value) }))} />
          <FuelInput label="Rate mt/call" value={fuel.lsmgoRate} onChange={(value) => setFuel((f) => ({ ...f, lsmgoRate: asNumber(value) }))} />
          <Metric label="Costs" value={currency(lsmgoCons * fuel.lsmgoPrice)} accent />
        </Summary>
        <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
          <MetricCard label="Total distance" value={`${totalDistance.toLocaleString()} NM`} />
          <MetricCard label="Port calls" value={String(calculated.length)} />
          <MetricCard label="Total fuel cost" value={currency(totalFuelCost)} accent />
          <MetricCard label="Next port" value={calculated[1]?.portName || calculated[0]?.portName || 'TBC'} />
        </div>
        <div style={{ gridColumn: '1 / -1', border: '1px solid rgba(255,140,66,.35)', borderRadius: 6, background: 'rgba(255,140,66,.07)', padding: 10, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 9, color: '#ff8c42', letterSpacing: 1.4, textTransform: 'uppercase' }}>Bunker Ports / Linked Bunkering</div>
            <div style={{ fontSize: 10, color: 'var(--t2)' }}>{highlightedBunkerRows.length} highlighted ports - {linkedBunkers.length} linked reports - {currency(linkedBunkerCost)}</div>
          </div>
          {highlightedBunkerRows.length ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}>
              {highlightedBunkerRows.map((row) => {
                const rowBunkers = bunkerByPort[portCompareKey(row.portName)] || bunkerByPort[portCompareKey(row.portCode)] || [];
                return (
                  <div key={row.id} style={{ border: '1px solid rgba(255,140,66,.28)', borderRadius: 6, background: 'rgba(3,7,13,.42)', padding: 9 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
                      <div style={{ fontFamily: 'var(--syne)', fontSize: 12, fontWeight: 700, color: '#ff8c42' }}>{row.portName || row.portCode}</div>
                      <div style={{ fontSize: 9, color: 'var(--t3)' }}>{rowBunkers.length ? 'Linked' : 'Manual'}</div>
                    </div>
                    {rowBunkers.length ? rowBunkers.map((bunker) => (
                      <div key={bunker.id || `${bunker.port}-${bunker.deliveryDate}`} style={{ fontSize: 10, color: 'var(--t2)', lineHeight: 1.45, marginTop: 4 }}>
                        <div>{bunkerFuelLines(bunker).map((fuelLine) => `${fuelLine.grade}: ${asNumber(fuelLine.quantity).toLocaleString()} MT`).join(' + ')}</div>
                        <div>{bunker.supplier || 'Supplier TBC'} - {bunker.deliveryDate || 'Date TBC'} - {currency(bunkerTotalCost(bunker))}</div>
                        {(bunker.berth || bunker.notes) && <div style={{ color: 'var(--t3)' }}>{[bunker.berth, bunker.notes].filter(Boolean).join(' - ')}</div>}
                      </div>
                    )) : (
                      <div style={{ fontSize: 10, color: 'var(--t3)' }}>Marked as bunker port in this voyage plan. Add a matching report in Bunkering to pull supplier, grade, quantity, ROB, and cost.</div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: 'var(--t3)' }}>Use + BNK beside a port to highlight a bunker port, or add a matching bunker report in the Bunkering tab.</div>
          )}
        </div>
        <div style={{ gridColumn: '1 / span 2', border: '1px solid var(--b1)', borderRadius: 6, background: 'var(--s2)', padding: 10, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
            <div style={{ fontSize: 9, color: 'var(--accent)', letterSpacing: 1.4, textTransform: 'uppercase' }}>Voyage Instructions</div>
            {instructionStatus && <span style={{ fontSize: 10, color: instructionStatus.includes('blocked') ? 'var(--red)' : 'var(--green)' }}>{instructionStatus}</span>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '180px 220px 1fr', gap: 8, marginBottom: 8 }}>
            <Field label="Operator">
              <input value={operator} onChange={(e) => setOperator(e.target.value)} placeholder="Operator / trade desk" style={{ ...controlStyle, width: '100%' }} />
            </Field>
            <Field label="Vessel email">
              <input value={vesselEmail} onChange={(e) => setVesselEmail(e.target.value)} placeholder="vessel@example.com" style={{ ...controlStyle, width: '100%' }} />
            </Field>
            <div style={{ display: 'flex', alignItems: 'end', gap: 8 }}>
              <button onClick={() => saveVoyagePlanNotes(instructionDocuments.voyage.label)} style={primaryButton}>SAVE INSTRUCTIONS</button>
              <button onClick={() => exportInstructionText(instructionDocuments.voyage)} style={secondaryButton}>EXPORT TXT</button>
              <button onClick={() => openInstructionEmailDraft(instructionDocuments.voyage)} style={secondaryButton}>EMAIL DRAFT</button>
            </div>
          </div>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Paste operator voyage instructions here..."
            style={{ width: '100%', minHeight: 120, resize: 'vertical', padding: 10, background: 'rgba(3,7,13,.55)', border: '1px solid var(--b1)', color: 'var(--text)', borderRadius: 6, outline: 'none', fontSize: 12, lineHeight: 1.45, fontFamily: 'Consolas, monospace' }}
          />
        </div>
        <div style={{ border: '1px solid var(--b1)', borderRadius: 6, background: 'var(--s2)', padding: 10, minWidth: 0 }}>
          <div style={{ fontSize: 9, color: 'var(--accent)', letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 8 }}>Export Preview</div>
          <textarea readOnly value={instructionDocuments.voyage.text} style={{ width: '100%', minHeight: 184, resize: 'vertical', padding: 10, background: 'rgba(3,7,13,.55)', border: '1px solid var(--b1)', color: 'var(--t2)', borderRadius: 6, outline: 'none', fontSize: 10, lineHeight: 1.45, fontFamily: 'Consolas, monospace' }} />
        </div>
      </div>
      ) : (
      <div style={{ borderTop: '1px solid var(--b1)', background: 'var(--s1)', padding: '8px 16px', display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr)) auto', gap: 8, alignItems: 'center', flexShrink: 0 }}>
        <MetricCard label="Distance" value={`${totalDistance.toLocaleString()} NM`} />
        <MetricCard label="Port calls" value={String(calculated.length)} />
        <MetricCard label="Bunker ports" value={String(highlightedBunkerRows.length)} accent />
        <MetricCard label="Linked bunkers" value={`${linkedBunkers.length} / ${currency(linkedBunkerCost)}`} accent />
        <MetricCard label="Fuel estimate" value={currency(totalFuelCost)} />
        <button onClick={() => setShowPlanDetails(true)} style={primaryButton}>SHOW DETAILS</button>
      </div>
      ))}
    </div>
  );
}

function Header({ children, width, colSpan, rowSpan }) {
  return (
    <th colSpan={colSpan} rowSpan={rowSpan} style={{ ...headerCell, width }}>
      {children}
    </th>
  );
}

function GroupHeader({ children, colSpan }) {
  return <th colSpan={colSpan} style={groupHeaderCell}>{children}</th>;
}

function SubHeader({ children }) {
  return <th style={subHeaderCell}>{children}</th>;
}

function Cell({ children, sticky }) {
  return <td style={{ ...bodyCell, ...(sticky ? stickyCell : null) }}>{children}</td>;
}

function InputCell({ value, onChange, highlight }) {
  return (
    <Cell>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...cellInput, ...(highlight ? speedInput : null) }}
      />
    </Cell>
  );
}

function FormulaCell({ children }) {
  return <Cell><span style={formulaText}>{children}</span></Cell>;
}

function DateCell({ date }) {
  return <Cell><span style={dateText}>{dateValue(date)}</span></Cell>;
}

function DayCell({ date }) {
  return <Cell><span style={dayText}>{dayValue(date)}</span></Cell>;
}

function Summary({ title, children }) {
  return (
    <div style={{ border: '1px solid var(--b1)', borderRadius: 6, padding: 10, background: 'var(--s2)', minWidth: 0 }}>
      <div style={{ fontSize: 9, color: 'var(--accent)', letterSpacing: 1.4, marginBottom: 8, textTransform: 'uppercase' }}>{title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>{children}</div>
    </div>
  );
}

function Metric({ label, value, accent }) {
  return (
    <div>
      <div style={{ fontSize: 8, color: 'var(--t3)', marginBottom: 3, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontFamily: 'var(--syne)', fontSize: 15, fontWeight: 700, color: accent ? 'var(--green)' : 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
    </div>
  );
}

function MetricCard({ label, value, accent }) {
  return (
    <div style={{ border: '1px solid var(--b1)', borderRadius: 6, padding: '8px 10px', background: 'var(--s2)', minWidth: 0 }}>
      <div style={{ fontSize: 8, color: 'var(--t3)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 1.1 }}>{label}</div>
      <div style={{ fontFamily: 'var(--syne)', fontSize: 14, fontWeight: 700, color: accent ? 'var(--green)' : 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
    </div>
  );
}

function FuelInput({ label, value, onChange }) {
  return (
    <label>
      <div style={{ fontSize: 8, color: 'var(--t3)', marginBottom: 3, textTransform: 'uppercase' }}>{label}</div>
      <input type="number" value={value} onChange={(e) => onChange(e.target.value)} style={{ ...controlStyle, width: '100%' }} />
    </label>
  );
}

function Field({ label, children }) {
  return (
    <label>
      <div style={{ fontSize: 8, color: 'var(--t3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1.2 }}>{label}</div>
      {children}
    </label>
  );
}

function currency(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

const headerCell = {
  position: 'sticky',
  top: 30,
  zIndex: 4,
  background: '#13354a',
  color: '#dff7ff',
  border: '1px solid #315b73',
  padding: '8px 7px',
  fontSize: 10,
  letterSpacing: 1.1,
  textTransform: 'uppercase',
  textAlign: 'center',
  whiteSpace: 'normal',
  lineHeight: 1.15,
};

const groupHeaderCell = {
  position: 'sticky',
  top: 0,
  zIndex: 5,
  background: '#082338',
  color: 'var(--accent)',
  border: '1px solid #315b73',
  padding: '7px 8px',
  fontSize: 10,
  letterSpacing: 1.5,
  textTransform: 'uppercase',
  textAlign: 'center',
  fontWeight: 800,
};

const subHeaderCell = {
  ...headerCell,
  top: 64,
  zIndex: 3,
  background: '#0f293a',
  color: 'var(--t2)',
};

const bodyCell = {
  border: '1px solid rgba(49,91,115,.65)',
  padding: 6,
  fontSize: 12,
  color: 'var(--text)',
  height: 44,
  textAlign: 'center',
  whiteSpace: 'nowrap',
};

const stickyCell = {
  position: 'sticky',
  left: 0,
  zIndex: 2,
  background: 'var(--s1)',
  textAlign: 'left',
};

const rowNumber = {
  width: 24,
  height: 24,
  borderRadius: 3,
  display: 'grid',
  placeItems: 'center',
  color: '#000',
  background: 'var(--accent)',
  fontSize: 11,
  fontWeight: 700,
  flexShrink: 0,
};

const timeDiffBadge = {
  minWidth: 42,
  padding: '4px 6px',
  borderRadius: 3,
  border: '1px solid rgba(0,212,255,.32)',
  background: 'rgba(0,212,255,.08)',
  color: 'var(--accent)',
  fontSize: 10,
  fontWeight: 800,
  textAlign: 'center',
  whiteSpace: 'nowrap',
};

const cellInput = {
  width: 74,
  height: 28,
  padding: '3px 6px',
  textAlign: 'center',
  color: 'var(--text)',
  background: 'rgba(7,12,20,.65)',
  border: '1px solid var(--b2)',
  borderRadius: 3,
  fontSize: 12,
};

const speedInput = {
  color: 'var(--yellow)',
  borderColor: 'rgba(255,214,10,.65)',
};

const formulaText = {
  display: 'inline-block',
  minWidth: 58,
  padding: '5px 7px',
  borderRadius: 3,
  background: 'rgba(0,212,255,.08)',
  color: 'var(--accent)',
};

const dateText = {
  color: 'var(--text)',
  fontWeight: 600,
};

const dayText = {
  color: 'var(--t2)',
  fontSize: 10,
};

const controlStyle = {
  height: 28,
  padding: '4px 8px',
  fontSize: 10,
};

const dateControlStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  background: 'var(--s2)',
  border: '1px solid var(--b1)',
  borderRadius: 'var(--radius-sm)',
  padding: '4px 6px',
};

const primaryButton = {
  background: 'var(--accent)',
  border: 'none',
  color: '#000',
  fontSize: 10,
  padding: '7px 12px',
  borderRadius: 'var(--radius-sm)',
  fontWeight: 700,
};

const secondaryButton = {
  background: 'var(--s2)',
  border: '1px solid var(--b1)',
  color: 'var(--t2)',
  fontSize: 10,
  padding: '7px 12px',
  borderRadius: 'var(--radius-sm)',
  fontWeight: 700,
};

const smallButton = {
  background: 'none',
  border: '1px solid var(--b1)',
  color: 'var(--t2)',
  fontSize: 9,
  padding: '4px 6px',
  borderRadius: 3,
};

const dangerButton = {
  ...smallButton,
  color: 'var(--red)',
  borderColor: 'var(--red)',
  background: 'rgba(255,69,96,.08)',
};
