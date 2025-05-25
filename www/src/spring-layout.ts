import * as d3force from "d3-force";
import * as d3selection from "d3-selection";
import { Homography } from "homography";
import type { BasemapReference, Config, Station, GeoStation, TargetInfo } from "./common";
import { mustGetElementById, infoBoxId } from "./common";

export function drawCartogram(config: Config,
                              stations: GeoStation[],
                              source: Station,
                              departureTime: Date,
                              targets: Map<Station, TargetInfo>,
                              infoCallback: (s: Station) => void): void {
    const br = config.br;
    const originalScale = (br.ref2X - br.ref1X) / (br.ref2E - br.ref1E);
    const width = 700;
    const scale = width / br.originalWidth * originalScale;
    const height = br.originalHeight * width / br.originalWidth;

    const svg = d3selection.create("svg")
        .attr("viewBox", [0, 0, width, height])
        .attr("width", width)
        .attr("height", height);

    const canvas = d3selection.create("canvas")
        .attr("width", width)
        .attr("height", height)
        .attr("id", "basemap")
        .style("position", "absolute")
        .style("z-index", "-1");

    const layout = d3selection.select('#spring-layout');
    layout.selectChildren().remove();
    layout.style("position", "relative");
    layout.append(() => canvas.node());
    layout.append(() => svg.node());

    function E2X(Ecoord: number): number {
        let Erel = (Ecoord - br.ref1E) / (br.ref2E - br.ref1E);
        return (br.ref1X + Erel * (br.ref2X - br.ref1X)) * width / br.originalWidth;
    }

    function N2Y(Ncoord: number): number {
        let Nrel = (Ncoord - br.ref1N) / (br.ref2N - br.ref1N);
        return (br.ref1Y + Nrel * (br.ref2Y - br.ref1Y)) * height / br.originalHeight;
    }

    const nodes = stations.map((station) => {
        let x = E2X(station.E);
        let y = N2Y(station.N);
        return {
            'name': station.name,
            'humanName': station.humanName,
            'x': x, 'y': y,
            'xGeo': x, 'yGeo': y,
            'fx': (station.name == source)? x: undefined,
            'fy': (station.name == source)? y: undefined,
        }
    });

    let links = [];
    const speed = config.speed // km/hr
        * 1000                 //  m/hr
        / 60                   //  m/min
        * scale;               // px/min
    for (const [target, info] of targets) {
        let travelTime = (info.arrivalTime.getTime() - departureTime.getTime()) / 1000 / 60;
        links.push({'source': source, 'target': target, 'distance': travelTime * speed});
        if (info.arrivingFrom) {
            if (!targets.has(info.arrivingFrom)) {
                throw new Error("arrivingFrom must be a key in targets! " +
                    "arrivingFrom: " + info.arrivingFrom);
            }
            let prevTravelTime = (info.arrivalTime.getTime() -
                targets.get(info.arrivingFrom)!.arrivalTime.getTime()) / 1000 / 60;
            links.push({'source': info.arrivingFrom, 'target': target,
                        'distance': prevTravelTime * speed});
        }
    }

    const travelTimeToGeographyBias = 5;
    d3force.forceSimulation(nodes)
        .force(
            "link",
            d3force.forceLink(links)
                .id((n: any) => n.name)
                .distance((l) => l.distance)
                .strength(1))
        .force("xGeo", d3force.forceX().x((n: any) => n.xGeo).strength(1/travelTimeToGeographyBias))
        .force("yGeo", d3force.forceY().y((n: any) => n.yGeo).strength(1/travelTimeToGeographyBias))
        .velocityDecay(0.1)
        .stop()
        .tick(10000);

    // svg.append("g")
    //     .attr("stroke", "#999")
    //     .attr("stroke-opacity", 0.2)
    //     .selectAll("line")
    //     .data(links)
    //     .join("line")
    //     .attr("x1", (d: any) => d.source.x)
    //     .attr("y1", (d: any) => d.source.y)
    //     .attr("x2", (d: any) => d.target.x)
    //     .attr("y2", (d: any) => d.target.y);

    // svg.append("g")
    //     .attr("fill", "black")
    //     .selectAll("text")
    //     .data(nodes)
    //     .join("text")
    //     .attr("x", (n) => n.x + 10)
    //     .attr("y", (n) => n.y + 10)
    //     .text((n) => n.humanName);

    const graphNodes = svg.append("g")
        .attr("stroke", "#fff")
        .attr("stroke-width", 1)
        .attr("fill", "000")
        .selectAll("circle")
        .data(nodes)
        .join("circle")
        .attr("r", 2)
        .call((n) => n.append("title").text((d) => d.humanName))
        .on("click", (event) => {
            event.target.classList.toggle('selected-node');
            event.target.dispatchEvent(new Event('mouseleave'));
        })
        .on("mouseenter", (event, d) => {
            if (!event.target.classList.contains('selected-node')) {
                infoCallback(d.name);
            }
        })
        .on("mouseleave", (event, d) => {
            if (!event.target.classList.contains('selected-node')) {
                document.getElementById(infoBoxId(d.name))?.remove();
            }
        });

    document.getElementById('station-finder')!.addEventListener('input', (event) => {
        if (!(event && event.target instanceof HTMLInputElement)) return;
        let val = event.target.value.trim().toLowerCase();
        graphNodes.classed("found-node", false);
        if (val != '') {
            graphNodes
                .filter((d) => d.humanName.toLowerCase().includes(val))
                .classed("found-node", true);
        }
    });

    const homography = new Homography("piecewiseaffine");
    const basemapElement = canvas.node();
    if (!(basemapElement && (basemapElement instanceof HTMLCanvasElement))) {
        throw new Error("Could not find canvas element with ID 'basemap'!");
    }
    const homographies: ImageData[] = [];
    const numHomographies = 21;
    const basemapContext = basemapElement.getContext("2d")!;
    const basemapImage = new Image();
    basemapImage.crossOrigin = "anonymous";
    basemapImage.src = br.path;

    const pinnedCorners: [number, number][] =
        [[0, 0], [width, 0], [0, height], [width, height]];
    function computeBasemapWarps() {
        let srcs: [number, number][] = [];
        let reldsts: [number, number, number, number][] = [];
        for (const s of nodes) {
            if ((0 > s.xGeo) || (s.xGeo >= width) || (0 > s.yGeo) || (s.yGeo >= height)) {
                continue;
            }
            if ((-20 > s.x) || (s.x >= width + 20) || (-20 > s.y) || (s.y >= height + 20)) {
                continue;
            }
            srcs.push([s.xGeo, s.yGeo]);
            reldsts.push([s.xGeo, s.x - s.xGeo, s.yGeo, s.y - s.yGeo]);
        }
        homography.setSourcePoints(srcs.concat(pinnedCorners));
        for (const i of Array(numHomographies-1).keys()) {
            homography.setDestinyPoints(reldsts
                .map(([x, dx, y, dy]) => <[number, number]>[x + (i+1)/20*dx, y + (i+1)/20*dy])
                .concat(pinnedCorners));
            homographies.push(homography.warp());
        }
    }

    let warped = false;
    function toggleBasemapWarp() {
        let idx = warped? numHomographies-1: 0;
        let prevTs: number;
        function loop(ts: number) {
            if (prevTs === undefined || (ts - prevTs > 30)) {
                console.log('looping');
                prevTs = ts;
                basemapContext.clearRect(0, 0, width, height);
                basemapContext.putImageData(homographies[idx], 0, 0);
                graphNodes
                    .attr("cx", d => d.xGeo + (d.x - d.xGeo)*idx/(numHomographies-1))
                    .attr("cy", d => d.yGeo + (d.y - d.yGeo)*idx/(numHomographies-1));
                if (warped) {
                    idx -= 1;
                    if (idx >= 0) {
                        requestAnimationFrame(loop);
                    } else {
                        warped = false; // done, stop animating
                    }
                } else {
                    idx += 1;
                    if (idx < numHomographies) {
                        requestAnimationFrame(loop);
                    } else {
                        warped = true; // done, stop animating
                    }
                }
            } else {
                requestAnimationFrame(loop); // wait a bit longer for next frame
            }
        }
        requestAnimationFrame(loop);
    }

    function whenBasemapLoaded() {
        basemapContext.drawImage(basemapImage, 0, 0, width, height);
        basemapImage.style.display = "none";
        let imgd = basemapContext.getImageData(0, 0, width, height);
        homography.setImage(imgd);
        homographies.push(imgd);
        computeBasemapWarps();
        toggleBasemapWarp();
        mustGetElementById('toggleWarp').addEventListener("click", toggleBasemapWarp);
        document.addEventListener('keydown', (event) => {
            if (!(event && event instanceof KeyboardEvent)) return;
            if (event.key == "w" && (event.altKey || event.metaKey) && !event.repeat) {
                toggleBasemapWarp();
            }
        });
    }
    if (basemapImage.complete) {
        whenBasemapLoaded();
    } else {
        basemapImage.addEventListener("load", whenBasemapLoaded);
    }
}

export const basemapLausanne: BasemapReference = {
    ref1X: 556,
    ref1Y: 768,
    ref1E: 2_533_128,
    ref1N: 1_153_421,
    ref2X: 2337,
    ref2Y: 137,
    ref2E: 2_542_166,
    ref2N: 1_156_617,

    path: "lausanne/basemap.png",
    originalWidth: 2687,
    originalHeight: 1565,
}

export const configLausanne: Config = { br: basemapLausanne, speed: 10 };

export const basemapNational: BasemapReference = {
    ref1X: 10,
    ref1E: 2485375.28,
    ref1Y: 1083,
    ref1N: 1110091.73,
    ref2X: 1595,
    ref2E: 2759808.80,
    ref2Y: 199,
    ref2N: 1263143.64,

    path: "train/basemap.png",
    originalWidth: 2032,
    originalHeight: 1293,
};

export const configNational: Config = { br: basemapNational, speed: 70 };
