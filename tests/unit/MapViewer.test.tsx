import { render } from "@testing-library/react";
import { MapViewer } from "../../app/(game)/play/MapViewer";
import fixture from "../fixtures/map-fixture.json";

describe("MapViewer", () => {
  it("renders one polygon per feature", () => {
    const { container } = render(
      <MapViewer geojson={fixture} centerLat={0} centerLng={0} zoom={1} />,
    );
    const paths = container.querySelectorAll("path[data-entity-name]");
    expect(paths.length).toBe(fixture.features.length);
  });

  it("colors each polygon from its color property", () => {
    const { container } = render(
      <MapViewer geojson={fixture} centerLat={0} centerLng={0} zoom={1} />,
    );
    const first = container.querySelector("path[data-entity-name]");
    expect(first?.getAttribute("fill")).toBe(
      fixture.features[0]!.properties.color,
    );
  });
});
