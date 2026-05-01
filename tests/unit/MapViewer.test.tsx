import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MapViewer } from "../../app/(game)/play/MapViewer";
import { MapPanel } from "../../app/(game)/play/MapPanel";
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

describe("MapPanel — legend", () => {
  it("legend lists entities below the area threshold", () => {
    render(
      <MapPanel geojson={fixture} centerLat={0} centerLng={0} zoom={1} />,
    );
    const legend = screen.getByRole("complementary");
    expect(within(legend).getByText("Dalmatia")).toBeInTheDocument();
    expect(within(legend).getByText("Elysia")).toBeInTheDocument();
  });

  it("legend does not list entities above the area threshold", () => {
    render(
      <MapPanel geojson={fixture} centerLat={0} centerLng={0} zoom={1} />,
    );
    const legend = screen.getByRole("complementary");
    expect(within(legend).queryByText("Arcadia")).not.toBeInTheDocument();
    expect(within(legend).queryByText("Bohemia")).not.toBeInTheDocument();
    expect(within(legend).queryByText("Cascadia")).not.toBeInTheDocument();
  });

  it("hovering a legend item highlights the corresponding polygon", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <MapPanel geojson={fixture} centerLat={0} centerLng={0} zoom={1} />,
    );
    const legend = screen.getByRole("complementary");
    const item = within(legend).getByText("Dalmatia");
    await user.hover(item);
    const path = container.querySelector(
      'path[data-entity-name="Dalmatia"]',
    )!;
    expect(path.getAttribute("data-highlighted")).toBe("true");
  });

  it("hovering a polygon highlights the corresponding legend item", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <MapPanel geojson={fixture} centerLat={0} centerLng={0} zoom={1} />,
    );
    const path = container.querySelector(
      'path[data-entity-name="Dalmatia"]',
    )!;
    await user.hover(path);
    const legend = screen.getByRole("complementary");
    const item = within(legend).getByText("Dalmatia");
    expect(item.closest("[data-highlighted]")?.getAttribute("data-highlighted")).toBe("true");
  });
});
