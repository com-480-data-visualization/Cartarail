import { Dataset, geostations, loadStationCSVToMap, dateSetTime,
         stationIdMap, stationNameMap, dijkstra, getPathString } from "./path-finder";
import { drawCartogram, configLausanne } from "./spring-layout";

async function ui(target: Dataset) {
  await loadStationCSVToMap(target);

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
      const earliest = await dijkstra(target, startStation, startTime);
      const result = document.getElementById('result');
      if (!result) return;

      let s = "";
      for (const dest of earliest.keys()) {
        s += `To ${stationIdMap.get(dest)}: \n`
        s += getPathString(earliest, dest, startTime);
      }
      result.innerText = s;

      drawCartogram(configLausanne, geostations, startStation, startTime, earliest);
    }
  }
}

const registerUI = async () => { await ui(Dataset.Lausanne); };
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", registerUI);
} else {
    registerUI();
}
