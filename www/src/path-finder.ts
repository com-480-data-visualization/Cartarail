import alasql from 'alasql';
import Papa from "papaparse";
import {
  PriorityQueue,
  ICompare
} from '@datastructures-js/priority-queue';

import type { Station, GeoStation, Target, TargetInfo } from "./common";
import { WGS84_to_LV95, infoBoxId } from "./common";

const base = import.meta.env.BASE_URL;

// =========== load data ==========

export enum Dataset {
  Lausanne = "lausanne",
  Train = "train"
}

enum Table {
  Station = "stations",
  Transport = "transport_table",
  Walk = "walk_table"
}

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

export const loaded = new Map<Dataset, Map<Table, boolean>>();
Object.values(Dataset).forEach(target => {
  loaded.set(target, new Map<Table, boolean>());
});
const allLoaded = new Map<Dataset, boolean>();
export const stationIdMap = new Map(
    Object.values(Dataset).map(v => [v, new Map<Station, string>()]));
export const stationNameMap = new Map(
    Object.values(Dataset).map(v => [v, new Map<string, Station>()]));
export var geostations = new Map(
    Object.values(Dataset).map(v => [v, <GeoStation[]>[]]));

function getDbTableName(target: Dataset, table: Table): string {
  return `${target}_${table}`;
}

export function loadStationCSVToMap(target: Dataset) {
  if (loaded.get(target)?.get(Table.Station)) return;

  return fetch(`${base}${target}/${Table.Station}.csv`)
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
          const sim = stationIdMap.get(target)!;
          const snm = stationNameMap.get(target)!;
          const gs = geostations.get(target)!;
          for (const row of res.data) {
              sim.set(row.stop_id, row.stop_name);
              snm.set(row.stop_name, row.stop_id);
              let [stop_E, stop_N] = WGS84_to_LV95(row.stop_lat, row.stop_lon);
              gs.push({name: row.stop_id, humanName: row.stop_name, E: stop_E, N: stop_N});
          }
      loaded.get(target)?.set(Table.Station, true);
      console.log(`${target} ${Table.Station}.csv is loaded into memory.`);
    })
    .catch(error => {
      console.error("Failed to load or parse CSV:", error);
      throw error;
    });
}

async function loadTransportCSVToDB(target: Dataset){
  if (loaded.get(target)?.get(Table.Transport)) return;

  const response = await fetch(`${base}${target}/${Table.Transport}.csv`);
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

  const name = getDbTableName(target, Table.Transport);
  alasql(`CREATE TABLE ${name}`);
  alasql.tables[name].data = records;

  loaded.get(target)?.set(Table.Transport, true);
  console.log(`${target} ${Table.Transport}.csv is loaded into memory.`);
}

async function loadWalkCSVToDB(target: Dataset) {
  if (loaded.get(target)?.get(Table.Walk)) return;

  const response = await fetch(`${base}${target}/${Table.Walk}.csv`);
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

  const name = getDbTableName(target, Table.Walk);
  alasql(`CREATE TABLE ${name}`);
  alasql.tables[name].data = parsed.data;

  loaded.get(target)?.set(Table.Walk, true);
  console.log(`${target} ${Table.Walk}.csv is loaded into memory.`);
}

async function loadCSV(target: Dataset) {
  await Promise.all([
    loadStationCSVToMap(target),
    loadTransportCSVToDB(target),
    loadWalkCSVToDB(target)
  ]);

  allLoaded.set(target, Object.values(Table).every(table =>
    loaded.get(target)?.get(table) === true
  ));
}

// =========== shortest path ==========

const compareTarget: ICompare<Target> = (a: Target, b: Target) => {
  return a.arrivalTime < b.arrivalTime ? -1 : 1;
}

function dateToString(date: Date): string {
  const hh = date.getHours().toString().padStart(2, '0');
  const mm = date.getMinutes().toString().padStart(2, '0');
  const ss = date.getSeconds().toString().padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

export function dateSetTime(base: Date, timeStr: string, isNextDay: boolean = false): Date {
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

export async function dijkstra(target: Dataset, startStation: Station, startTime: Date) {
  if (!allLoaded.has(target) || allLoaded.get(target) === false) {
    await loadCSV(target);
  }

  let earliest = new Map<Station, TargetInfo>();
  let queue = new PriorityQueue<Target>(compareTarget);
  queue.push({
    station: startStation,
    arrivalTime: startTime,
    totalWalkTime: 0,
    arrivingFrom: "",
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
    const tranRecords = alasql(`SELECT * FROM ${getDbTableName(target, Table.Transport)} WHERE start_station = "${cur.station}"`) as TransportTableRecord[];
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
          arrivingFrom: record.start_station,
          departureTime: departureArrivalTime[0],
          routeDesc: record.route_desc,
          routeShortName: record.route_short_name,
        });
      }
    }
    // reachable by foot
    const walkRecords = alasql(`SELECT * FROM ${getDbTableName(target, Table.Walk)} WHERE start_station = "${cur.station}"`) as WalkTableRecord[];
    for (const record of walkRecords) {
      const totalWalkTime: number = cur.totalWalkTime + +record.walk_time;
      if (totalWalkTime >= 10) continue;
      queue.push({
        station: record.next_station,
        arrivalTime: new Date(cur.arrivalTime.getTime() + record.walk_time * 60 * 1000),
        totalWalkTime: totalWalkTime,
        arrivingFrom: record.start_station,
        departureTime: cur.arrivalTime,
        routeDesc: "W",
        routeShortName: "Walk",
      });
    }
    cur = queue.dequeue();
  }
  return earliest;
}

function getPath(earliest: Map<Station, TargetInfo>, dest: Station): Array<Target> {
  const path: Array<Target> = [];
  let curArrival: Target = { ...earliest.get(dest)!, station: dest };
  let nextArrival: Target | null = null;
  while (curArrival && curArrival.arrivingFrom !== "") {
    if (nextArrival && (curArrival.routeDesc !== nextArrival.routeDesc || curArrival.routeShortName !== nextArrival.routeShortName)) {
      path.push(nextArrival);
      nextArrival = curArrival;
    } else if (nextArrival) {
      nextArrival.arrivingFrom = curArrival.arrivingFrom;
      nextArrival.departureTime = curArrival.departureTime;
    } else {
      nextArrival = curArrival;
    }
    curArrival = { ...earliest.get(curArrival.arrivingFrom)!,
                   station: curArrival.arrivingFrom };
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

function pathToString(target: Dataset, path: Array<Target>, startTime: Date): string {
  let s = "", arrivingFrom = null, to = null, fromTime = "", toTime = "";
  for (const arrival of path) {
    arrivingFrom = stationIdMap.get(target)!.get(arrival.arrivingFrom);
    to = stationIdMap.get(target)!.get(arrival.station);
    fromTime = tripDateToString(startTime, arrival.departureTime);
    toTime = tripDateToString(startTime, arrival.arrivalTime);
    s += `${arrivingFrom} @ ${fromTime}  -----(${arrival.routeDesc}) ${arrival.routeShortName}---->  ${to} @ ${toTime} \n`;
  }
  if (path.length > 0) {
    s += `total walk time: within ${Math.ceil(path[path.length - 1].totalWalkTime)} minutes\n`;
    s += `total trip time: ${formatTimeDiff(path[0].departureTime, path[path.length - 1].arrivalTime)}\n`
  }
  return s;
}

export function getPathString(target: Dataset,
                              earliest: Map<Station, TargetInfo>,
                              dest: Station,
                              startTime: Date): string {
    return pathToString(target, getPath(earliest, dest), startTime);
}

export function pathInfoHTML(dataset: Dataset, earliest: Map<Station, TargetInfo>,
                             destination: Station, startTime: Date): Element {
    const sim = stationIdMap.get(dataset)!;
    let path = getPath(earliest, destination);
    let info =  document.createElement("table");
    info.setAttribute("id", infoBoxId(destination));
    let infoHead = document.createElement("thead");
    infoHead.innerHTML = `
<tr>
  <th scope="col">depart</th>
  <th scope="col">to</th>
  <th scope="col">via</th>
  <th scope="col">arrive</th>
</tr>`;
    info.append(infoHead);
    for (const step of path) {
        let infoRow = document.createElement("tr");

        let depart = document.createElement("td");
        depart.append(tripDateToString(startTime, step.departureTime));
        infoRow.append(depart);

        let to_ = document.createElement("td");
        to_.append(sim.get(step.station)!);
        infoRow.append(to_);

        let via = document.createElement("td");
        via.append(step.routeDesc);
        infoRow.append(via);

        let arrive = document.createElement("td");
        arrive.append(tripDateToString(startTime, step.arrivalTime));
        infoRow.append(arrive);

        info.append(infoRow);
    }
    return info;
}
