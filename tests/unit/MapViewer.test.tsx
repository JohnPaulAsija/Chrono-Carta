import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  it("shows the entity name on hover", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <MapViewer geojson={fixture} centerLat={0} centerLng={0} zoom={1} />,
    );
    const path = container.querySelector(
      'path[data-entity-name="Arcadia"]',
    )!;
    await user.hover(path);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Arcadia");
  });

  it("hides the tooltip on mouse leave", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <MapViewer geojson={fixture} centerLat={0} centerLng={0} zoom={1} />,
    );
    const path = container.querySelector(
      'path[data-entity-name="Arcadia"]',
    )!;
    await user.hover(path);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    await user.unhover(path);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});
