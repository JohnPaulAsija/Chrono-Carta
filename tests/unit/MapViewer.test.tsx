import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { MapFeatureCollection } from "../../app/(game)/play/types";
import { MapViewer } from "../../app/(game)/play/MapViewer";
import { MapPanel } from "../../app/(game)/play/MapPanel";
import fixtureRaw from "../fixtures/map-fixture.json";

const fixture = fixtureRaw as unknown as MapFeatureCollection;

describe("MapViewer", () => {
  it("renders one polygon per feature", () => {
    const { container } = render(
      <MapViewer geojson={fixture} />,
    );
    const paths = container.querySelectorAll("path[data-entity-name]");
    expect(paths.length).toBe(fixture.features.length);
  });

  it("colors each polygon from its color property", () => {
    const { container } = render(
      <MapViewer geojson={fixture} />,
    );
    const first = container.querySelector("path[data-entity-name]");
    expect(first?.getAttribute("fill")).toBe(
      fixture.features[0]!.properties.color,
    );
  });

  it("shows the entity name on hover", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <MapViewer geojson={fixture} />,
    );
    const path = container.querySelector(
      'path[data-entity-name="Arcadia"]',
    )!;
    await user.hover(path);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Arcadia");
  });

  it("renders an ocean background", () => {
    const { container } = render(<MapViewer geojson={fixture} />);
    const sphere = container.querySelector("[data-testid='sphere']");
    expect(sphere).not.toBeNull();
    expect(sphere?.getAttribute("fill")).toBe("#a8d5e2");
  });

  it("hides the tooltip on mouse leave", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <MapViewer geojson={fixture} />,
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

describe("MapPanel — permanent labels", () => {
  it("shows a label for entities above the area threshold", () => {
    const { container } = render(
      <MapPanel geojson={fixture} />,
    );
    const labels = container.querySelectorAll("text[data-label]");
    const labelNames = Array.from(labels).map((el) =>
      el.getAttribute("data-label"),
    );
    expect(labelNames).toContain("Arcadia");
    expect(labelNames).toContain("Bohemia");
    expect(labelNames).toContain("Cascadia");
  });

  it("does not show a label for entities below the area threshold", () => {
    const { container } = render(
      <MapPanel geojson={fixture} />,
    );
    const labels = container.querySelectorAll("text[data-label]");
    const labelNames = Array.from(labels).map((el) =>
      el.getAttribute("data-label"),
    );
    expect(labelNames).not.toContain("Dalmatia");
    expect(labelNames).not.toContain("Elysia");
  });
});

describe("MapPanel — legend", () => {
  it("legend lists entities below the area threshold", () => {
    render(
      <MapPanel geojson={fixture} />,
    );
    const legend = screen.getByRole("complementary");
    expect(within(legend).getByText("Dalmatia")).toBeInTheDocument();
    expect(within(legend).getByText("Elysia")).toBeInTheDocument();
  });

  it("legend does not list entities above the area threshold", () => {
    render(
      <MapPanel geojson={fixture} />,
    );
    const legend = screen.getByRole("complementary");
    expect(within(legend).queryByText("Arcadia")).not.toBeInTheDocument();
    expect(within(legend).queryByText("Bohemia")).not.toBeInTheDocument();
    expect(within(legend).queryByText("Cascadia")).not.toBeInTheDocument();
  });

  it("hovering a legend item highlights the corresponding polygon", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <MapPanel geojson={fixture} />,
    );
    const legend = screen.getByRole("complementary");
    const item = within(legend).getByText("Dalmatia");
    await user.hover(item);
    const path = container.querySelector(
      'path[data-entity-name="Dalmatia"]',
    )!;
    expect(path.getAttribute("data-highlighted")).toBe("true");
  });

  it("clicking a legend item zooms the map to that entity", async () => {
    const user = userEvent.setup();
    const { container } = render(<MapPanel geojson={fixture} />);
    const legend = screen.getByRole("complementary");
    const item = within(legend).getByText("Dalmatia");

    await user.click(item);

    const zoomGroup = container.querySelector("[data-testid='zoomable-group']")!;
    const zoom = Number(zoomGroup.getAttribute("data-zoom"));
    expect(zoom).toBeGreaterThan(1);
  });

  it("hovering a polygon highlights the corresponding legend item", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <MapPanel geojson={fixture} />,
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

describe("MapPanel — zoom controls", () => {
  it("renders zoom in, zoom out, and reset buttons", () => {
    render(<MapPanel geojson={fixture} />);
    expect(screen.getByRole("button", { name: "Zoom in" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zoom out" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset view" })).toBeInTheDocument();
  });

  it("clicking zoom in increases the zoom level", async () => {
    const user = userEvent.setup();
    const { container } = render(<MapPanel geojson={fixture} />);
    const zoomGroup = container.querySelector("[data-testid='zoomable-group']")!;
    const initialZoom = zoomGroup.getAttribute("data-zoom");

    await user.click(screen.getByRole("button", { name: "Zoom in" }));

    const newZoom = zoomGroup.getAttribute("data-zoom");
    expect(Number(newZoom)).toBeGreaterThan(Number(initialZoom));
  });

  it("clicking zoom out decreases the zoom level", async () => {
    const user = userEvent.setup();
    const { container } = render(<MapPanel geojson={fixture} />);

    await user.click(screen.getByRole("button", { name: "Zoom in" }));
    await user.click(screen.getByRole("button", { name: "Zoom in" }));
    const zoomGroup = container.querySelector("[data-testid='zoomable-group']")!;
    const zoomedIn = Number(zoomGroup.getAttribute("data-zoom"));

    await user.click(screen.getByRole("button", { name: "Zoom out" }));
    const zoomedOut = Number(zoomGroup.getAttribute("data-zoom"));

    expect(zoomedOut).toBeLessThan(zoomedIn);
  });

  it("clicking reset returns to initial zoom", async () => {
    const user = userEvent.setup();
    const { container } = render(<MapPanel geojson={fixture} />);
    const zoomGroup = container.querySelector("[data-testid='zoomable-group']")!;
    const initialZoom = zoomGroup.getAttribute("data-zoom");

    await user.click(screen.getByRole("button", { name: "Zoom in" }));
    await user.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(zoomGroup.getAttribute("data-zoom")).not.toBe(initialZoom);

    await user.click(screen.getByRole("button", { name: "Reset view" }));
    expect(zoomGroup.getAttribute("data-zoom")).toBe(initialZoom);
  });
});

describe("MapPanel — layout", () => {
  it("renders with responsive grid layout classes", () => {
    const { container } = render(<MapPanel geojson={fixture} />);
    const root = container.firstElementChild!;
    expect(root.className).toContain("grid");
    expect(root.className).toContain("lg:grid-cols-[2fr_1fr]");
  });

  it("map container has a fixed aspect ratio", () => {
    const { container } = render(<MapPanel geojson={fixture} />);
    const mapContainer = container.querySelector("[data-testid='composable-map']")!
      .closest("[class*='aspect-']");
    expect(mapContainer).not.toBeNull();
  });
});
