export type Station = string;
// E, N are meters in relation to the observatory in Bern, which is at 2600000/1200000
export type GeoStation =  { name: Station, E: number, N: number }

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
    scale: number, /* pixels per meter */
    speed: number, /* kilometers per hour */
}
