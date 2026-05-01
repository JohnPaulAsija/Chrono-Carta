import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { YearPicker } from "../../app/(game)/YearPicker";

const pushMock = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const options = [
  { value: "117", label: "AD 117" },
  { value: "1812", label: "AD 1812" },
  { value: "1919", label: "AD 1919" },
];

beforeEach(() => {
  pushMock.mockReset();
});

describe("YearPicker", () => {
  it("renders one <option> per provided option", () => {
    render(<YearPicker options={options} selected="117" />);
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });

  it("marks the selected option as the current value", () => {
    render(<YearPicker options={options} selected="1812" />);
    expect(screen.getByRole("combobox")).toHaveValue("1812");
  });

  it("pushes ?year=<value> when the user picks a different year", async () => {
    const user = userEvent.setup();
    render(<YearPicker options={options} selected="117" />);
    await user.selectOptions(screen.getByRole("combobox"), "1919");
    expect(pushMock).toHaveBeenCalledWith("/?year=1919");
  });
});
