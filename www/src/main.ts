// import type { BasemapReference, Config } from "./types";
import { ui, Dataset } from "./path-finder";
// import { drawCartogram } from "./spring-layout";

/*
const basemap1: BasemapReference = {
    ref1X: 10,
    ref1E: 2485375.28,
    ref1Y: 1083,
    ref1N: 1110091.73,
    ref2X: 1595,
    ref2E: 2759808.80,
    ref2Y: 199,
    ref2N: 1263143.64,

    path: "/basemap.png",
    originalWidth: 2032,
    originalHeight: 1293,
};

const config1: Config = { br: basemap1, scale: 1/500, speed: 70 };
*/

(async () => { await ui(Dataset.Lausanne); })();
