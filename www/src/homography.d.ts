declare module 'homography' {
    export class Homography {
        constructor();
        constructor(xform: "affine" | "piecewiseaffine" | "projective" | "auto" = "auto");

        setImage(imageData: ImageData): void;
        setSourcePoints(points: [number, number][]): void;
        setDestinyPoints(points: [number, number][]): void;
        warp(): ImageData;
    }
};
