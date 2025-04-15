// Test the dom tree library. Can be removed.
const myHeading = document.getElementById("heading");
if (myHeading) {
  myHeading.textContent = "hello testing!";
}

// =====================================================

import {
  PriorityQueue,
  ICompare
} from '@datastructures-js/priority-queue';

import Papa from "papaparse";

// Station, identified by its id in the dataset.
type Station = string;

interface NextStationRecord {
  from: Station;
  to: Station;
  route_id: string;
}

interface QueryTableRecord {
  trip_id: string;
  arrival_time: string;
  departure_time: string;
  stop_sequence: string;
  station: Station;
  route_id: string;
  route_desc: string;
  route_short_name: string;
  stop_name: string;
}

interface StationRecord {
  station: Station;
  station_name: string;
}

function loadNextStations(): Promise<Papa.ParseResult<NextStationRecord>> {
  return fetch("/epfl_next_stations.csv")
    .then(response => {
      if (!response.ok) throw new Error("Failed to get the csv file.");
      return response.text();
    })
    .then(csvText => {
        const res = Papa.parse<NextStationRecord>(csvText, {
        header: true,
        skipEmptyLines: true
      });
      return res;
    })
    .catch(error => {
      console.error("Failed to load or parse CSV:", error);
      throw error;
    });
}

function loadQueryTable(): Promise<Papa.ParseResult<QueryTableRecord>> {
  return fetch("/epfl_query_table.csv")
    .then(response => {
      if (!response.ok) throw new Error("Failed to get the csv file.");
      return response.text();
    })
    .then(csvText => {
        const res = Papa.parse<QueryTableRecord>(csvText, {
        header: true,
        skipEmptyLines: true
      });
      return res;
    })
    .catch(error => {
      console.error("Failed to load or parse CSV:", error);
      throw error;
    });
}

function loadStations(): Promise<Papa.ParseResult<StationRecord>> {
  return fetch("/epfl_simpl_stations.csv")
    .then(response => {
      if (!response.ok) throw new Error("Failed to get the csv file.");
      return response.text();
    })
    .then(csvText => {
        const res = Papa.parse<StationRecord>(csvText, {
        header: true,
        skipEmptyLines: true
      });
      return res;
    })
    .catch(error => {
      console.error("Failed to load or parse CSV:", error);
      throw error;
    });
}

interface ArrivalInfo {
  from: Station;
  departureTime: Date; // leaves the `from` station at
  route_desc: string;  // takes this route
  route_short_name: string;
  arrivalTime: Date;   // arrives the destination station at
}

interface Arrival {
  station: Station;
  info: ArrivalInfo;
}

const compareArrival: ICompare<Arrival> = (a: Arrival, b: Arrival) => {
  return a.info.arrivalTime < b.info.arrivalTime ? -1 : 1;
}

function isLaterOrEq (a: string, b: Date): boolean {
  const [hs, ms, ss] = a.split(":");
  const [ha, ma, sa] = [parseInt(hs, 10), parseInt(ms, 10), parseInt(ss, 10)];
  const [hb, mb, sb] = [b.getHours(), b.getMinutes(), b.getSeconds()];
  return ha > hb
    || (ha === hb && ma > mb)
    || (ha === hb && ma === mb && sa >= sb);
}

function strToDate(s: string, ref: Date): Date {
  const [hours, minutes, seconds] = s.split(":").map(Number);
  return new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), hours, minutes, seconds);
}

function getNextStations (
  srcStation: Station,
  srcTime: Date,
  nextStations: Papa.ParseResult<NextStationRecord>,
  queryTable: Papa.ParseResult<QueryTableRecord>
): Array<Arrival> {
  const infos = new Map<Station, ArrivalInfo>();
  const curNextStations = nextStations.data.filter((row: NextStationRecord) => row.from === srcStation);
  for (const next of curNextStations) {
    const trips = queryTable.data.filter((row: QueryTableRecord) =>
      row.route_id == next.route_id && row.station == srcStation && isLaterOrEq(row.departure_time, srcTime));
    // (Aggressive) optimization: assume that for all trips of the same route takes roughly the same time.
    // Otherwise, need to find the arrival time for each trip in trips and take the earliest one, which is very slow.
    const earliestDeparture = trips.reduce((res, cur) => {
      return cur.departure_time < res.departure_time ? cur : res;
    });
    const earliestArrival = queryTable.data.filter((row: QueryTableRecord) =>
      row.trip_id == earliestDeparture.trip_id && row.station == next.to && row.stop_sequence > earliestDeparture.stop_sequence)[0];
    if (!earliestArrival) continue;
    const arrivalTime = strToDate(earliestArrival.arrival_time, srcTime);
    const departureTime = strToDate(earliestDeparture.departure_time, srcTime);
    if (!infos.has(next.to) || arrivalTime < (infos.get(next.to)?.arrivalTime ?? Infinity)) {
      infos.set(next.to, {
        from: srcStation,
        departureTime: departureTime,
        route_desc: earliestDeparture.route_desc,
        route_short_name: earliestDeparture.route_short_name,
        arrivalTime: arrivalTime
      })
    }
  }
  let arrivals: Array<Arrival> = [];
  for (const [to, info] of infos) {
    arrivals.push({station: to, info: info});
  }
  return arrivals;
}

function dijkstra(
  srcStation: Station,
  srcTime: Date,
  nextStations: Papa.ParseResult<NextStationRecord>,
  queryTable: Papa.ParseResult<QueryTableRecord>
) {
  let earliest = new Map<Station, ArrivalInfo>();
  let queue = new PriorityQueue<Arrival>(compareArrival);
  queue.push({
    station: srcStation,
    info: {
      from: "",
      departureTime: srcTime,
      route_desc: "",
      route_short_name: "",
      arrivalTime: srcTime
    }
  });

  let cur = queue.dequeue();
  while(cur) {
    if (earliest.has(cur.station)) {
      cur = queue.dequeue();
      continue;
    }
    earliest.set(cur.station, cur.info);
    let nexts = getNextStations(cur.station, cur.info.arrivalTime, nextStations, queryTable);
    for (let next of nexts) {
      queue.push(next);
    }
    cur = queue.dequeue();
  }
  return earliest;
}

function getPath(dest: Station, earliest: Map<Station, ArrivalInfo>): Array<Arrival> {
  const path: Array<Arrival> = []
  let cur = dest;
  let info = earliest.get(cur);
  while(info && info.from !== ""){
    path.push({station: cur, info: info});
    cur = info.from;
    info = earliest.get(cur);
  }
  return path.reverse();
}

function formatDate(date: Date): string {
  const hour = date.getHours();
  const minute = date.getMinutes();
  const second = date.getSeconds();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(hour)}:${pad(minute)}:${pad(second)}`;
}

// For debugging.
function printPath(path: Array<Arrival>, stations: Map<Station, string>) {
  for(const {station: cur, info: info} of path){
    console.log(`Leave ${stations.get(info.from)} at ${formatDate(info.departureTime)} by ${info.route_short_name}(type: ${info.route_desc}), arrive at ${stations.get(cur)} at ${formatDate(info.arrivalTime)}.`);
  }
  console.log("Finished.");
}

async function init() {
  const stationsData = await loadStations();
  const stations = new Map<Station, string>();
  for (const r of stationsData.data) {
    stations.set(r.station, r.station_name);
  }
  const nextStations = await loadNextStations();
  const queryTable = await loadQueryTable();
  return {stations, nextStations, queryTable};
}


const {stations, nextStations, queryTable} = await init();
const epfl = "Parent8501214";
const time = new Date(2025, 3, 14, 16, 0); // 2025-04-14 16:00
let earliest = dijkstra(epfl, time, nextStations, queryTable);
// console.log(earliest);
const dest = "Parent8593868"; // Chavannes-R., Concorde
const path = getPath(dest, earliest);
console.log(`Print path from ${stations.get(epfl)} to ${stations.get(dest)}: `);
printPath(path, stations);
