import { describe, expect, it } from "vitest";
import { fitWithin, PHOTO_MAX_DIMENSION } from "./imageCompression";

describe("fitWithin", () => {
  it("scales a landscape phone photo so its long side is the maximum", () => {
    expect(fitWithin(4000, 3000, PHOTO_MAX_DIMENSION)).toEqual({ width: 2560, height: 1920 });
  });

  it("scales a portrait photo by its height", () => {
    expect(fitWithin(3024, 4032, PHOTO_MAX_DIMENSION)).toEqual({ width: 1920, height: 2560 });
  });

  it("never upscales a photo that is already small enough", () => {
    expect(fitWithin(1280, 720, PHOTO_MAX_DIMENSION)).toEqual({ width: 1280, height: 720 });
  });
});
