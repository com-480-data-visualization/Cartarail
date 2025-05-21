import alasql from 'alasql';
import Papa from "papaparse";
import {
  PriorityQueue,
  ICompare
} from '@datastructures-js/priority-queue';

// Station, identified by its id in the dataset.
type Station = string;

const base = import.meta.env.BASE_URL;
const target = "lausanne";
const stationTableUrl = `${base}${target}/stations.csv`; 
const transportTableUrl = `${base}${target}/transport_table.csv`; 
const walkTableUrl = `${base}${target}/walk_table.csv`; 


// =========== load data ==========

interface StationTableRecord {
  stop_id: Station; 
  stop_name: string;
  stop_lat: number;
  stop_lon: number;
}

interface RawTransportTableRecord {
  start_station: Station; 
  next_station: Station; 
  route_id: string; 
  route_desc: string; 
  route_short_name: string; 
  departure_arrival_time: string;
}

interface TransportTableRecord {
  start_station: Station; 
  next_station: Station; 
  route_id: string; 
  route_desc: string; 
  route_short_name: string; 
  departure_arrival_time: [string, string][];
}

interface WalkTableRecord {
  start_station: Station; 
  next_station: Station;
  walk_time: number;
}

function parseDepartureArrivalTime(s: string): [string, string][] {
  try {
    const jsonCompatible = s
      .replace(/\(/g, '[')
      .replace(/\)/g, ']')
      .replace(/'/g, '"');

    return JSON.parse(jsonCompatible);
  } catch (err) {
    console.error('Failed to parse segments:', s, err);
    return [];
  }
}

let allLoaded = false, stationLoaded = false, transportLoaded = false, walkLoaded = false;
const stationIdMap = new Map<Station, string>(), stationNameMap = new Map<string, Station>();

function loadStationCSVToMap(url: string) {
  if (stationLoaded) return;
  return fetch(url)
    .then(response => {
      if (!response.ok) throw new Error("Failed to get the csv file.");
      return response.text();
    })
    .then(csvText => {
        const res = Papa.parse<StationTableRecord>(csvText, {
        header: true,
        skipEmptyLines: true
      });
      return res;
    })
    .then(res => {
      for (const row of res.data) {
        stationIdMap.set(row.stop_id, row.stop_name); 
        stationNameMap.set(row.stop_name, row.stop_id);
      }
      stationLoaded = true;
    })
    .catch(error => {
      console.error("Failed to load or parse CSV:", error);
      throw error;
    });
}

async function loadTransportCSVToDB(url: string){
  if (transportLoaded) return;

  const response = await fetch(url); // ('/lausanne/transport_table.csv');
  const csvText = await response.text();

  const parsed = Papa.parse<RawTransportTableRecord>(csvText, {
    header: true,
    skipEmptyLines: true,
    delimiter: ",",
  });

  if (parsed.errors.length) {
    console.error('CSV Parse Error:', parsed.errors);
    return;
  }

  const records: TransportTableRecord[] = parsed.data.map((r: RawTransportTableRecord) => ({
    start_station: r.start_station,
    next_station: r.next_station,
    route_id: r.route_id, 
    route_desc: r.route_desc, 
    route_short_name: r.route_short_name, 
    departure_arrival_time: parseDepartureArrivalTime(r.departure_arrival_time),
  }));

  alasql('CREATE TABLE transport_table');
  alasql.tables.transport_table.data = records;

  transportLoaded = true;
  console.log('Transport table csv is loaded into memory.');
}

async function loadWalkCSVToDB(url: string) {
  if (walkLoaded) return;

  const response = await fetch(url); // ('/lausanne/walk_table.csv');
  const csvText = await response.text();

  const parsed = Papa.parse<WalkTableRecord>(csvText, {
    header: true,
    skipEmptyLines: true,
    delimiter: ",",
  });

  if (parsed.errors.length) {
    console.error('CSV Parse Error:', parsed.errors);
    return;
  }

  // Load into AlaSQL
  alasql('CREATE TABLE walk_table');
  alasql.tables.walk_table.data = parsed.data;

  walkLoaded = true;
  console.log('Walk table CSV is loaded into memory.');
}

async function loadCSV() {
  await Promise.all([
    loadStationCSVToMap(stationTableUrl),
    loadTransportCSVToDB(transportTableUrl),
    loadWalkCSVToDB(walkTableUrl)
  ]);
  allLoaded = stationLoaded && transportLoaded && walkLoaded;
}

// =========== shortest path ==========

interface Arrival {
  station: Station;
  arrivalTime: Date;
  totalWalkTime: number;
  from: Station;
  departureTime: Date; 
  routeDesc: string;
  routeShortName: string;
}

const compareArrival: ICompare<Arrival> = (a: Arrival, b: Arrival) => {
  return a.arrivalTime < b.arrivalTime ? -1 : 1;
}

function dateToString(date: Date): string {
  const hh = date.getHours().toString().padStart(2, '0');
  const mm = date.getMinutes().toString().padStart(2, '0');
  const ss = date.getSeconds().toString().padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function dateSetTime(base: Date, timeStr: string, isNextDay: boolean = false): Date {
  const [hh, mm, ss] = timeStr.split(":").map(Number);
  const res = new Date(base); 
  if (isNextDay) {
    res.setDate(base.getDate() + 1); 
  }
  res.setHours(hh, mm, ss, 0);
  return res;
}

function getClosest(time: Date, departureArrivalTime: [string, string][]): [Date, Date] | null {
  let timeStr = dateToString(time);
  let l = 0; 
  let r = departureArrivalTime.length - 1; 
  let res: [string, string] | null = null;
  while(l <= r){
    const mid = Math.floor((l + r) / 2);
    if (departureArrivalTime[mid][0] >= timeStr) {
      res = departureArrivalTime[mid];
      r = mid - 1;
    } else {
      l = mid + 1; 
    }
  }
  if (res == null && departureArrivalTime.length >= 1) {
    res = departureArrivalTime[0]; // the next day
  }
  if (res != null) {
    const isNextDay = res[0] < timeStr ? true : false; 
    return [dateSetTime(time, res[0], isNextDay), dateSetTime(time, res[1], isNextDay)];
  }
  return null;
}

async function dijkstra(startStation: Station, startTime: Date) {
  if (allLoaded == false) {
    await loadCSV();
  }

  let earliest = new Map<Station, Arrival>();
  let queue = new PriorityQueue<Arrival>(compareArrival);
  queue.push({
    station: startStation,
    arrivalTime: startTime,
    totalWalkTime: 0,
    from: "",
    departureTime: startTime, 
    routeDesc: "",
    routeShortName: "",
  });
  let cur = queue.dequeue(); 
  while(cur) {
    if (earliest.has(cur.station)){
      cur = queue.dequeue();
      continue;
    }
    earliest.set(cur.station, cur);
    // reachable by public transportation
    const tranRecords = alasql(`SELECT * FROM transport_table WHERE start_station = "${cur.station}"`) as TransportTableRecord[];
    for (const record of tranRecords) {
      let at = cur.arrivalTime; if (record.route_desc != cur.routeDesc || record.route_short_name != cur.routeShortName) { 
        // change routes within the station (takes: 3 mins)
        at = new Date(at.getTime() + 3 * 60 * 1000); // ms 
      }
      const departureArrivalTime = getClosest(at, record.departure_arrival_time);
      if (departureArrivalTime != null) {
        queue.push({
          station: record.next_station,
          arrivalTime: departureArrivalTime[1],
          totalWalkTime: cur.totalWalkTime,
          from: record.start_station,
          departureTime: departureArrivalTime[0], 
          routeDesc: record.route_desc,
          routeShortName: record.route_short_name,
        });
      }
    }
    // reachable by foot
    const walkRecords = alasql(`SELECT * FROM walk_table WHERE start_station = "${cur.station}"`) as WalkTableRecord[];
    for (const record of walkRecords) {
      const totalWalkTime: number = cur.totalWalkTime + +record.walk_time;
      if (totalWalkTime >= 10) continue;
      queue.push({
        station: record.next_station,
        arrivalTime: new Date(cur.arrivalTime.getTime() + record.walk_time * 60 * 1000), 
        totalWalkTime: totalWalkTime,
        from: record.start_station, 
        departureTime: cur.arrivalTime, 
        routeDesc: "W",
        routeShortName: "Walk",
      });
    }
    cur = queue.dequeue();
  }
  return earliest;
}

function getPath(earliest: Map<Station, Arrival>, dest: Station): Array<Arrival> {
  const path: Array<Arrival> = [];
  let curArrival = earliest.get(dest);
  let nextArrival: Arrival | null = null;
  while (curArrival && curArrival.from !== "") {
    if (nextArrival && (curArrival.routeDesc !== nextArrival.routeDesc || curArrival.routeShortName !== nextArrival.routeShortName)) {
      path.push(nextArrival);
      nextArrival = curArrival;
    } else if (nextArrival)
      nextArrival = {
        station: nextArrival.station,
        arrivalTime: nextArrival.arrivalTime, 
        totalWalkTime: nextArrival.totalWalkTime, 
        from: curArrival.from,
        departureTime: curArrival.departureTime, 
        routeDesc: nextArrival.routeDesc,
        routeShortName: nextArrival.routeShortName,
      };
    else
      nextArrival = curArrival;
    curArrival = earliest.get(curArrival.from);
  }
  if (nextArrival) path.push(nextArrival);
  return path.reverse();
}

function tripDateToString(startTime: Date, tripTime: Date): string {
  const diff = tripTime.getDate() - startTime.getDate(); 
  return (diff > 0) ? `(+${diff}) ${dateToString(tripTime)}` : dateToString(tripTime); 
}

function formatTimeDiff(date1: Date, date2: Date): string {
  let diffMs = Math.abs(date2.getTime() - date1.getTime());
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  diffMs %= 1000 * 60 * 60;
  const minutes = Math.floor(diffMs / (1000 * 60));
  diffMs %= 1000 * 60;
  const seconds = Math.floor(diffMs / 1000);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function pathToString(path: Array<Arrival>, startTime: Date): string {
  let s = "", from = null, to = null, fromTime = "", toTime = "";
  for (const arrival of path) {
    from = stationIdMap.get(arrival.from);
    to = stationIdMap.get(arrival.station);
    fromTime = tripDateToString(startTime, arrival.departureTime);
    toTime = tripDateToString(startTime, arrival.arrivalTime);
    s += `${from} @ ${fromTime}  -----(${arrival.routeDesc}) ${arrival.routeShortName}---->  ${to} @ ${toTime} \n`;
  }
  if (path.length > 0) {
    s += `total walk time: within ${Math.ceil(path[path.length - 1].totalWalkTime)} minutes\n`;
    s += `total trip time: ${formatTimeDiff(path[0].departureTime, path[path.length - 1].arrivalTime)}\n`
  }
  return s;
}

function getPathString(earliest: Map<Station, Arrival>, dest: Station, startTime: Date): string {
  return pathToString(getPath(earliest, dest), startTime);
}

// ========== UI ==========

async function ui() {
  await loadStationCSVToMap(stationTableUrl);

  const stationList = document.getElementById('stationList');
  if (stationList) {
    for (const key of stationNameMap.keys()) {
      const option = document.createElement('option');
      option.value = key;
      stationList.appendChild(option);
    }
  }

  const searchBtn = document.getElementById('searchBtn');
  if (searchBtn) {
    searchBtn.onclick = async () => {
      const startStationName = (document.getElementById('startStation') as HTMLInputElement).value;
      const startTimeStr = (document.getElementById('startTime') as HTMLInputElement).value;
      const startTime = dateSetTime(new Date(), startTimeStr);

      const startStation = stationNameMap.get(startStationName);
      if (!startStation) return;
      const earliest = await dijkstra(startStation, startTime);
      const result = document.getElementById('result');
      if (!result) return;

      let s = "";
      for (const dest of earliest.keys()) {
        s += `To ${stationIdMap.get(dest)}: \n`
        s += getPathString(earliest, dest, startTime);
      }
      result.innerText = s;
    }
  }
}

(async () => { await ui(); })();

