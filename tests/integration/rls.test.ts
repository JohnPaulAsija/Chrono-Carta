import {
  anonClient,
  cleanupTestMaps,
  mapFixture,
  signInAs,
} from "./setup";

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

describe("RLS — curator on maps", () => {
  beforeEach(cleanupTestMaps);
  afterAll(cleanupTestMaps);

  it("can insert a map with their own created_by", async () => {
    const { client, userId } = await signInAs("curator");

    const { data, error } = await client
      .from("maps")
      .insert(mapFixture(userId, "curator-insert"))
      .select()
      .single();

    expect(error).toBeNull();
    expect(data?.created_by).toBe(userId);
  });
});
