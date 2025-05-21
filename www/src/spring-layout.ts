import * as d3force from "d3-force";
import * as d3selection from "d3-selection";
import { Homography } from "homography";

const ref1X = 10;
const ref1E = 2485375.28;
const ref1Y = 1083;
const ref1N = 1110091.73;
const ref2X = 1595;
const ref2E = 2759808.80;
const ref2Y = 199;
const ref2N = 1263143.64;

const basemapOriginalWidth = 2032;
const basemapOriginalHeight = 1293;
const basemapOriginalScale = (ref2X - ref1X) / (ref2E - ref1E);

const scale = 1/500 /* pixels per meter */ ;
const width = basemapOriginalWidth * scale / basemapOriginalScale;
const height = basemapOriginalHeight * width / basemapOriginalWidth;

d3selection.select("#basemap")
    .attr("width", width)
    .attr("height", height)
    .style("position", "absolute")
    .style("z-index", "-1");

const homography = new Homography("piecewiseaffine");
const basemapContext = document.getElementById("basemap").getContext("2d");
const basemapImage = new Image();
basemapImage.crossOrigin = "anonymous";
basemapImage.src = "/basemap.png";
basemapImage.addEventListener("load", () => {
    basemapContext.drawImage(basemapImage, 0, 0, width, height);
    basemapImage.style.display = "none";
    homography.setImage(basemapContext.getImageData(0, 0, width, height));
});

function E2X(Ecoord) {
    let Erel = (Ecoord - ref1E) / (ref2E - ref1E);
    return (ref1X + Erel * (ref2X - ref1X)) * width / basemapOriginalWidth;
}

function N2Y(Ncoord) {
    let Nrel = (Ncoord - ref1N) / (ref2N - ref1N);
    return (ref1Y + Nrel * (ref2Y - ref1Y)) * height / basemapOriginalHeight;
}

const svg = d3selection.create("svg")
    .attr("viewBox", [0, 0, width, height])
    .attr("width", width)
    .attr("height", height)
    .attr("style", "max-width: 100%; height: auto;");
d3selection.select('#spring-layout').style("position", "relative").append(() => svg.node());


// E, N are meters in relation to the observatory in Bern, which is at 2600000/1200000
const nodes = [
    {'name': 'St. Gallen', 'E': 2745713.03, 'N': 1254279.06},
    {'name': 'Zürich HB', 'E': 2683190.01, 'N': 1248066.09},
    {'name': 'Bern', 'E': 2600038.01, 'N': 1199749.94},
    {'name': 'Fribourg/Freiburg', 'E': 2578047.01, 'N': 1183594.95},
    {'name': 'Lausanne', 'E': 2537875.02, 'N': 1152042.04},
    {'name': 'Morges', 'E': 2527498.01, 'N': 1151525.94},
    {'name': 'Genève', 'E': 2499969.00, 'N': 1118468.11},
];

const source = 'Lausanne';

for (let station of nodes) {
    station.x = E2X(station.E);
    station.y = N2Y(station.N);
    station.xGeo = E2X(station.E);
    station.yGeo = N2Y(station.N);
    if (station.name == source) {
        station.fx = station.x;
        station.fy = station.y;
    }
}

const pinnedCorners = [[0, 0], [width, 0], [0, height], [width, height]];
homography.setSourcePoints(nodes.map((s) => [s.xGeo, s.yGeo]).concat(pinnedCorners));

// time is in minutes
const targets = {
    'St. Gallen': {'time': 208, 'prev': 'Zürich HB'},
    'Zürich HB': {'time': 142, 'prev': 'Bern'},
    'Bern': {'time': 90, 'prev': 'Fribourg/Freiburg'},
    'Fribourg/Freiburg': {'time': 61},
    'Morges': {'time': 8},
    'Genève': {'time': 39, 'prev': 'Morges'},
};

let links = [];
const speed = 70        // km/hr
    * 1000              //  m/hr
    / 60                //  m/min
    * scale;            // px/min
for (const target in targets) {
    let t = targets[target];
    links.push({'source': source, 'target': target, 'time': t.time * speed});
    if ('prev' in t) {
        links.push({'source': t.prev, 'target': target, 'time': (t.time - targets[t.prev].time) * speed});
    }
}

const travelTimeToGeographyBias = 20;
const simulation = d3force.forceSimulation(nodes)
    .force(
        "link",
        d3force.forceLink(links)
            .id((n) => n.name)
            .distance((l) => l.time)
            .strength(1))
    .force("xGeo", d3force.forceX().x((n) => n.xGeo).strength(1/travelTimeToGeographyBias))
    .force("yGeo", d3force.forceY().y((n) => n.yGeo).strength(1/travelTimeToGeographyBias))
    .velocityDecay(0.1)
    .stop()
    .tick(2000);

svg.append("g")
    .attr("stroke", "#999")
    .attr("stroke-opacity", 0.6)
    .selectAll("line")
    .data(links)
    .join("line")
    .attr("x1", d => d.source.x)
    .attr("y1", d => d.source.y)
    .attr("x2", d => d.target.x)
    .attr("y2", d => d.target.y);

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
    homography.setDestinyPoints(nodes.map((s) => [s.x, s.y]).concat(pinnedCorners));
    basemapContext.clearRect(0, 0, width, height);
    basemapContext.putImageData(homography.warp(), 0, 0);
}

if (basemapImage.complete) {
    warpBasemap();
} else {
    basemapImage.addEventListener("load", warpBasemap);
}
