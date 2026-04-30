import {
  adminBypassClient,
  anonClient,
  cleanupTestMaps,
  mapFixture,
  seedTestMap,
  signInAs,
  TEST_MAP_PREFIX,
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

  it("can select their own maps", async () => {
    const { client, userId } = await signInAs("curator");
    const seeded = await seedTestMap(userId, "curator-select");

    const { data, error } = await client
      .from("maps")
      .select("id, title, created_by")
      .eq("id", seeded.id)
      .single();

    expect(error).toBeNull();
    expect(data?.id).toBe(seeded.id);
    expect(data?.created_by).toBe(userId);
  });

  it("can update their own maps", async () => {
    const { client, userId } = await signInAs("curator");
    const seeded = await seedTestMap(userId, "curator-update");
    const newTitle = `${TEST_MAP_PREFIX}curator-updated_${Date.now()}`;

    const { data, error } = await client
      .from("maps")
      .update({ title: newTitle })
      .eq("id", seeded.id)
      .select("id, title")
      .single();

    expect(error).toBeNull();
    expect(data?.title).toBe(newTitle);
  });

  // Admin coverage lives in its own describe below for clarity, even
  // though admin operations also pass through maps_*_own_or_admin.

  it("CANNOT update a map owned by someone else", async () => {
    // Seed a map owned by the admin user via service-role bypass.
    const { userId: adminId } = await signInAs("admin");
    const seeded = await seedTestMap(adminId, "admin-owned-for-curator-attack");

    // Capture the original title via service-role read so we can prove
    // the eventual write was a no-op.
    const before = await adminBypassClient()
      .from("maps")
      .select("title")
      .eq("id", seeded.id)
      .single();
    expect(before.error).toBeNull();
    const originalTitle = before.data?.title;

    // The curator (signed in separately) attempts to overwrite the
    // admin's map.
    const { client: curatorClient } = await signInAs("curator");
    const evilTitle = `${TEST_MAP_PREFIX}curator-stole-it_${Date.now()}`;
    const { data, error } = await curatorClient
      .from("maps")
      .update({ title: evilTitle })
      .eq("id", seeded.id)
      .select();

    // RLS filters the row out of the curator's USING clause; PostgREST
    // returns success with zero rows affected rather than an explicit
    // permission denial.
    expect(error).toBeNull();
    expect(data).toEqual([]);

    // Hard proof the row is unchanged: re-read via service-role.
    const after = await adminBypassClient()
      .from("maps")
      .select("title")
      .eq("id", seeded.id)
      .single();
    expect(after.error).toBeNull();
    expect(after.data?.title).toBe(originalTitle);
  });
});

describe("RLS — admin on maps", () => {
  beforeEach(cleanupTestMaps);
  afterAll(cleanupTestMaps);

  it("can select a map owned by a curator", async () => {
    const { userId: curatorId } = await signInAs("curator");
    const seeded = await seedTestMap(curatorId, "curator-owned-for-admin-read");

    const { client } = await signInAs("admin");
    const { data, error } = await client
      .from("maps")
      .select("id, created_by")
      .eq("id", seeded.id)
      .single();

    expect(error).toBeNull();
    expect(data?.id).toBe(seeded.id);
    expect(data?.created_by).toBe(curatorId);
  });

  it("can insert a map with their own created_by", async () => {
    const { client, userId } = await signInAs("admin");

    const { data, error } = await client
      .from("maps")
      .insert(mapFixture(userId, "admin-insert"))
      .select()
      .single();

    expect(error).toBeNull();
    expect(data?.created_by).toBe(userId);
  });

  it("can update a map owned by a curator", async () => {
    const { userId: curatorId } = await signInAs("curator");
    const seeded = await seedTestMap(curatorId, "curator-owned-for-admin-update");

    const { client } = await signInAs("admin");
    const newTitle = `${TEST_MAP_PREFIX}admin-updated-curator-map_${Date.now()}`;
    const { data, error } = await client
      .from("maps")
      .update({ title: newTitle })
      .eq("id", seeded.id)
      .select("id, title")
      .single();

    expect(error).toBeNull();
    expect(data?.title).toBe(newTitle);
  });
});
