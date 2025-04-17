import * as d3force from "d3-force";
import * as d3selection from "d3-selection";

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

const scale = 1/500 /* pixels per meter */ ;
for (let station of nodes) {
    let Ecoord = (station.E - 2600000) * scale;
    let Ncoord = - (station.N - 1200000) * scale;
    station.x = Ecoord;
    station.y = Ncoord;
    station.xGeo = Ecoord;
    station.yGeo = Ncoord;
    if (station.name == source) {
        station.fx = station.x;
        station.fy = station.y;
    }
}

const speed = 60        // km/hr
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

const width = 700;
const height = 400;

const svg = d3selection.create("svg")
    .attr("viewBox", [-width / 2 + 100, -height / 2, width, height])
    .attr("width", width)
    .attr("height", height)
    .attr("style", "max-width: 100%; height: auto;");
d3selection.select('#spring-layout').append(() => svg.node());

const link = svg.append("g")
    .attr("stroke", "#999")
    .attr("stroke-opacity", 0.6)
    .selectAll("line")
    .data(links)
    .join("line");

svg.append("g")
    .attr("fill", "#f00")
    .attr("stroke-width", 0)
    .selectAll("circle")
    .data(nodes)
    .join("circle")
    .attr("r", 3)
    .attr("cx", (n) => n.xGeo)
    .attr("cy", (n) => n.yGeo);

svg.append("g")
    .attr("fill", "#f88")
    .selectAll("text")
    .data(nodes)
    .join("text")
    .attr("x", (n) => n.xGeo + (n.name == source? 15: 10))
    .attr("y", (n) => n.yGeo + (n.name == source? 0: 20))
    .attr("style", (n) => n.name == source? "fill: black;": undefined)
    .text((n) => n.name);

const node = svg.append("g")
    .attr("stroke", "#fff")
    .attr("stroke-width", 1.5)
    .attr("fill", "000")
    .selectAll("circle")
    .data(nodes)
    .join("circle")
    .attr("r", 4)
    .call((n) => n.append("title").text((d) => d.name));


function ticked() {
    node.attr("cx", d => d.x)
        .attr("cy", d => d.y);

    link.attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);
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
    .on("tick", ticked);
