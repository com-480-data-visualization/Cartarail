import { geostations, loadStationCSVToMap, dateSetTime,
         stationNameMap, stationCache, dijkstra, pathInfoHTML } from "./path-finder";
import { drawCartogram, configs } from "./spring-layout";
import { Dataset, mustGetElementById, Station, infoBoxId, normalize } from "./common";

const startStation: HTMLInputElement = document.getElementById('startStation') as HTMLInputElement;
const stationList = mustGetElementById('stationList');

async function populateStationList(target: Dataset) {
    await loadStationCSVToMap(target);
    stationList.replaceChildren();
    for (const key of stationNameMap.get(target)!.keys()) {
        const option = document.createElement('option');
        option.value = key;
        stationList.appendChild(option);
    }
}

async function computeCartogram(target: Dataset) {
    const startTimeStr = (document.getElementById('startTime') as HTMLInputElement).value;
    const startTime = dateSetTime(new Date(), startTimeStr);

    const startStationId = stationNameMap.get(target)!.get(startStation!.value)!;
    if (!startStation) return;
    const earliest = await dijkstra(target, startStationId, startTime);

    const infoBox = mustGetElementById('info-box');
    function showPathForStation(station: Station) {
        let info = pathInfoHTML(target, earliest, station, startTime);
        info.setAttribute("id", infoBoxId(station));
        infoBox.append(info);
    }

    drawCartogram(configs.get(target)!, geostations.get(target)!,
                  startStationId, startTime, earliest, showPathForStation);
}

/*
  TODO
    slider for relative strength

  DONE (pending data)
    Lausanne/National

  DONE
    animate between warped and normal
    search for destination
    hover for path info
 */

const scaleList = mustGetElementById('scaleList');
const basemapOriginalImage =
    mustGetElementById('spring-layout').getElementsByTagName('img')[0];
const finderBox = mustGetElementById('finder-box');
const initialConfigForm = mustGetElementById('initialConfig') as HTMLFormElement;

async function setDataset(dataset: Dataset) {
    await populateStationList(dataset);
    startStation!.addEventListener("input", () => {
        const query = normalize(startStation.value);
        stationList.replaceChildren();
        for (const {name, normalizedName} of stationCache.get(dataset)!){
            if (normalizedName.includes(query)) {
                const option = document.createElement('option');
                option.value = name;
                stationList.appendChild(option);
            }
        }
    });
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
                basemapOriginalImage.src = configs.get(Dataset.Lausanne)!.br.path;
                break;
            case "train":
                dataset = Dataset.Train;
                basemapOriginalImage.src = configs.get(Dataset.Train)!.br.path;
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
