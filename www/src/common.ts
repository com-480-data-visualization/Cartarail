export type Station = string;
// E, N are meters in relation to the observatory in Bern, which is at 2600000/1200000
export type GeoStation =  { name: Station, humanName: string, E: number, N: number }

export interface TargetInfo {
  arrivalTime: Date;
  totalWalkTime: number;
  arrivingFrom: Station;
  departureTime: Date;
  routeDesc: string;
  routeShortName: string;
}

export interface Target extends TargetInfo {
    station: Station;
}

export type BasemapReference = {
    ref1X: number, ref1E: number, ref1Y: number, ref1N: number,  /* real and image coordinates of reference point 1 */
    ref2X: number, ref2E: number, ref2Y: number, ref2N: number,  /* ditto of ref. pt. 2 */
    path: string, originalWidth: number, originalHeight: number, /* image info */
}

export type Config = {
    br: BasemapReference,
    speed: number, /* kilometers per hour */
}

export enum Dataset {
  Lausanne = "lausanne",
  Train = "train"
}

export type DatasetKeyed<Type> = {
    lausanne: Type,
    train: Type,
}

export function initDatasetKeyed<Type>(initType: () => Type): DatasetKeyed<Type> {
    return {"lausanne": initType(), "train": initType()};
}

// from https://www.swisstopo.admin.ch/en/transformation-calculation-services
export function WGS84_to_LV95(lat: number, lon: number): [number, number] {
    let auxlat = (lat * 3600 - 169_028.66) / 10_000;
    let auxlon = (lon * 3600 -  26_782.5 ) / 10_000;
    let pow = (latexp: number, lonexp: number) => auxlat ** latexp * auxlon ** lonexp;
    return [
        2_600_072.37
            + 211_455.93 * pow(0, 1)
            -  10_938.51 * pow(1, 1)
            -       0.36 * pow(2, 1)
            -      44.54 * pow(0, 3),
        1_200_147.07
            + 308_807.95 * pow(1, 0)
            +   3_745.25 * pow(0, 2)
            +      76.63 * pow(2, 0)
            -     194.56 * pow(1, 2)
            +     119.79 * pow(3, 0),
    ];
}

export function mustGetElementById(id: string): Element {
    let elem = document.getElementById(id);
    if (!elem) {
        throw new Error("could not find element #" + id + "!");
    }
    return elem;
}

export function infoBoxId(station: Station): string {
    return "info" + station;
}
