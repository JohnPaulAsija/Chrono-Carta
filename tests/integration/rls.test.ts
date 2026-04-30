import { anonClient } from "./setup";

describe("RLS — anon access", () => {
  it("returns zero rows from maps", async () => {
    const supabase = anonClient();
    const { data, error } = await supabase.from("maps").select("*");

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});
