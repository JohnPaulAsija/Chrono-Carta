import { anonClient } from "./setup";

describe("RLS — anon access", () => {
  it("returns zero rows from maps", async () => {
    const supabase = anonClient();
    const { data, error } = await supabase.from("maps").select("*");

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("returns zero rows from users", async () => {
    const supabase = anonClient();
    const { data, error } = await supabase.from("users").select("*");

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});
