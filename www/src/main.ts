import { geostations, loadStationCSVToMap, dateSetTime,
         stationNameMap, dijkstra, pathInfoHTML } from "./path-finder";
import { drawCartogram, configs } from "./spring-layout";
import { Dataset, mustGetElementById, Station } from "./common";

async function populateStationList(target: Dataset) {
    await loadStationCSVToMap(target);
    const stationList = mustGetElementById('stationList');
    stationList.replaceChildren();
    for (const key of stationNameMap[target].keys()) {
        const option = document.createElement('option');
        option.value = key;
        stationList.appendChild(option);
    }
}

async function computeCartogram(target: Dataset) {
    const startStationName =
        (document.getElementById('startStation') as HTMLInputElement).value;
    const startTimeStr = (document.getElementById('startTime') as HTMLInputElement).value;
    const startTime = dateSetTime(new Date(), startTimeStr);

    const startStation = stationNameMap[target].get(startStationName);
    if (!startStation) return;
    const earliest = await dijkstra(target, startStation, startTime);

    const infoBox = mustGetElementById('info-box');
    function showPathForStation(station: Station) {
        infoBox.append(pathInfoHTML(target, earliest, station, startTime));
    }

    drawCartogram(configs[target], geostations[target],
                  startStation, startTime, earliest, showPathForStation);
}

const scaleList = mustGetElementById('scaleList');
const basemapOriginalImage = document.createElement('img');
basemapOriginalImage.src = configs.lausanne.br.path;
basemapOriginalImage.classList.add('placeholder');
mustGetElementById('spring-layout').append(basemapOriginalImage);
const finderBox = mustGetElementById('finder-box');
const initialConfigForm = mustGetElementById('initialConfig') as HTMLFormElement;

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
                basemapOriginalImage.src = configs.lausanne.br.path;
                break;
            case "train":
                dataset = Dataset.Train;
                basemapOriginalImage.src = configs.train.br.path;
                break;
            default:
                throw new Error("invalid option for scale");
        }
        setDataset(dataset);
        finderBox!.classList.add('hidden');
        mustGetElementById('spring-layout').replaceChildren(basemapOriginalImage);
        initialConfigForm.reset();
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
