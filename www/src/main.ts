import { Dataset, geostations, loadStationCSVToMap, dateSetTime,
         stationIdMap, stationNameMap, dijkstra, getPathString } from "./path-finder";
import { drawCartogram, configLausanne, configNational } from "./spring-layout";

async function populateStationList(target: Dataset) {
  await loadStationCSVToMap(target);
  const stationList = document.getElementById('stationList');
  if (stationList) {
    stationList.replaceChildren();
      for (const key of stationNameMap.get(target)!.keys()) {
      const option = document.createElement('option');
      option.value = key;
      stationList.appendChild(option);
    }
  }
}

async function computeCartogram(target: Dataset) {
    const startStationName =
        (document.getElementById('startStation') as HTMLInputElement).value;
    const startTimeStr = (document.getElementById('startTime') as HTMLInputElement).value;
    const startTime = dateSetTime(new Date(), startTimeStr);

    const startStation = stationNameMap.get(target)!.get(startStationName);
    if (!startStation) return;
    const earliest = await dijkstra(target, startStation, startTime);
    const result = document.getElementById('result');
    if (!result) return;

    let s = "";
    for (const dest of earliest.keys()) {
        s += `To ${stationIdMap.get(target)!.get(dest)}: \n`
        s += getPathString(target, earliest, dest, startTime);
    }
    result.innerText = s;

    drawCartogram(configLausanne, geostations.get(target)!,
                  startStation, startTime, earliest);
}

/*
  TODO
    hover for path info
    slider for relative strength

  DONE (pending data)
    Lausanne/National

  DONE
    animate between warped and normal
    search for destination
 */

const scaleList = document.getElementById('scaleList');
const basemapOriginalImage =
    document.getElementById('spring-layout')!.getElementsByTagName('img')[0];
if (!scaleList) {
    throw new Error("could not find UI element #scaleList!");
}
const finderBox = document.getElementById('finder-box');
if (!finderBox) {
    throw new Error("could not find UI element #finder-box!");
}
const initialConfigForm = document.getElementById('initialConfig');
if (!initialConfigForm) {
    throw new Error("could not find UI element #initialConfig!");
}
async function setDataset(dataset: Dataset) {
    await populateStationList(dataset);
    initialConfigForm!.onsubmit = async (event) => {
        event.preventDefault();
        await computeCartogram(dataset);
        finderBox!.classList.remove('hidden');
    };
}

function registerUI() {
    scaleList!.addEventListener("change", async (event) => {
        if (!(event && event.target instanceof HTMLSelectElement)) {
            return;
        }
        let dataset: Dataset;
        switch(event.target.value) {
            case "lausanne":
                dataset = Dataset.Lausanne;
                basemapOriginalImage.src = configLausanne.br.path;
                break;
            case "train":
                dataset = Dataset.Train;
                basemapOriginalImage.src = configNational.br.path;
                break;
            default:
                throw new Error("invalid option for scale");
        }
        setDataset(dataset);
        finderBox!.classList.add('hidden');
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", async () => {
        await setDataset(Dataset.Lausanne);
        registerUI();
    });
} else {
    (async () => await setDataset(Dataset.Lausanne))();
    registerUI();
}
