import * as d3force from "d3-force";
import * as d3selection from "d3-selection";
import { Homography } from "homography";
import type { Config, Station, GeoStation, TargetInfo } from "./types";

export function drawCartogram(config: Config,
                              stations: GeoStation[],
                              source: Station,
                              departureTime: Date,
                              targets: Map<Station, TargetInfo>): void {
    const br = config.br;
    const originalScale = (br.ref2X - br.ref1X) / (br.ref2E - br.ref1E);
    const width = br.originalWidth * config.scale / originalScale;
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

    d3selection.select('#spring-layout')
        .style("position", "relative")
        .append(() => canvas.node());
    d3selection.select('#spring-layout').append(() => svg.node());

    const homography = new Homography("piecewiseaffine");
    const basemapElement = canvas.node();
    if (!(basemapElement && (basemapElement instanceof HTMLCanvasElement))) {
        throw new Error("Could not find canvas element with ID 'basemap'!");
    }
    const basemapContext = basemapElement.getContext("2d")!;
    const basemapImage = new Image();
    basemapImage.crossOrigin = "anonymous";
    basemapImage.src = br.path;
    basemapImage.addEventListener("load", () => {
        basemapContext.drawImage(basemapImage, 0, 0, width, height);
        basemapImage.style.display = "none";
        homography.setImage(basemapContext.getImageData(0, 0, width, height));
    });

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
            'x': x, 'y': y,
            'xGeo': x, 'yGeo': y,
            'fx': (station.name == source)? x: undefined,
            'fy': (station.name == source)? y: undefined,
        }
    });

    const pinnedCorners: [number, number][] =
        [[0, 0], [width, 0], [0, height], [width, height]];
    homography.setSourcePoints(
        nodes.map((s) => <[number, number]>[s.xGeo, s.yGeo]).concat(pinnedCorners));

    let links = [];
    const speed = config.speed // km/hr
        * 1000                 //  m/hr
        / 60                   //  m/min
        * config.scale;        // px/min
    for (const [target, info] of targets) {
        let travelTime = (info.arrivalTime.getTime() - departureTime.getTime()) / 1000 / 60;
        links.push({'source': source, 'target': target, 'distance': travelTime * speed});
        if (info.arrivingFrom) {
            if (!(info.arrivingFrom in targets)) {
                throw new Error("arrivingFrom must be a key in targets! " +
                    "arrivingFrom: " + info.arrivingFrom);
            }
            let prevTravelTime = (info.arrivalTime.getTime() -
                targets.get(info.arrivingFrom)!.arrivalTime.getTime()) / 1000 / 60;
            links.push({'source': info.arrivingFrom, 'target': target,
                        'distance': prevTravelTime * speed});
        }
    }

    const travelTimeToGeographyBias = 20;
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
        .tick(2000);

    svg.append("g")
        .attr("stroke", "#999")
        .attr("stroke-opacity", 0.6)
        .selectAll("line")
        .data(links)
        .join("line")
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

    svg.append("g")
        .attr("fill", "black")
        .selectAll("text")
        .data(nodes)
        .join("text")
        .attr("x", (n) => n.x + 10)
        .attr("y", (n) => n.y + 10)
        .text((n) => n.name);

    svg.append("g")
        .attr("stroke", "#fff")
        .attr("stroke-width", 1.5)
        .attr("fill", "000")
        .selectAll("circle")
        .data(nodes)
        .join("circle")
        .attr("r", 4)
        .call((n) => n.append("title").text((d) => d.name))
        .attr("cx", d => d.x)
        .attr("cy", d => d.y);

    function warpBasemap() {
        homography.setDestinyPoints(nodes.map((s) => <[number, number]>[s.x, s.y]).concat(pinnedCorners));
        basemapContext.clearRect(0, 0, width, height);
        basemapContext.putImageData(homography.warp(), 0, 0);
    }

    if (basemapImage.complete) {
        warpBasemap();
    } else {
        basemapImage.addEventListener("load", warpBasemap);
    }
}

/*
const stations1: Station[] = [
    {'name': 'St. Gallen', 'E': 2745713.03, 'N': 1254279.06},
    {'name': 'Zürich HB', 'E': 2683190.01, 'N': 1248066.09},
    {'name': 'Bern', 'E': 2600038.01, 'N': 1199749.94},
    {'name': 'Fribourg/Freiburg', 'E': 2578047.01, 'N': 1183594.95},
    {'name': 'Lausanne', 'E': 2537875.02, 'N': 1152042.04},
    {'name': 'Morges', 'E': 2527498.01, 'N': 1151525.94},
    {'name': 'Genève', 'E': 2499969.00, 'N': 1118468.11},
];
*/
