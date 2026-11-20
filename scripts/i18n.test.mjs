import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const source = read("i18n.js");
const storageKey = "poe-exchange-language";
const flush = () => new Promise((resolve) => setImmediate(resolve));

function openPage({ storage = new Map(), fetch } = {}) {
  let onSelect;
  let expire;
  const select = { addEventListener: (_, listener) => { onSelect = listener; } };
  const template = { content: { querySelectorAll: () => [] } };
  const document = {
    documentElement: {},
    querySelector: (selector) => selector === "#languageSelect" ? select : template,
    querySelectorAll: () => []
  };
  const requests = [];
  const updates = [];
  const context = vm.createContext({
    document,
    localStorage: { getItem: (key) => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    AbortController,
    fetch: (url, options) => {
      requests.push({ url, options });
      return fetch(url, options);
    },
    setTimeout: (callback, delay) => {
      assert.equal(delay, 2000);
      expire = callback;
      return 1;
    },
    clearTimeout: () => {},
    updates
  });
  const run = (code) => vm.runInContext(code, context);
  run(source);
  run("I18n.init(() => updates.push(I18n.locale))");
  return {
    requests,
    updates,
    run,
    get locale() { return document.documentElement.lang; },
    get choice() { return select.value; },
    change(value) { select.value = value; onSelect(); },
    timeout() { expire(); }
  };
}

test("Auto starts in English and switches to Vietnamese for a Vietnam IP", async () => {
  const page = openPage({ fetch: async () => ({ ok: true, json: async () => ({ country: "VN" }) }) });
  assert.equal(page.choice, "auto");
  assert.equal(page.locale, "en");
  await flush();
  assert.equal(page.locale, "vi");
  assert.deepEqual(page.updates, ["vi"]);
  assert.equal(page.requests[0].url, "https://api.country.is/");
  assert.equal(page.requests[0].options.credentials, "omit");
  assert.equal(page.requests[0].options.referrerPolicy, "no-referrer");
  assert.equal(page.run('I18n.t("copy", { name: "Divine Orb" })'), "Sao chép Divine Orb");
});

test("Auto keeps English for other countries, failures, malformed data and timeouts", async () => {
  for (const fetch of [
    async () => ({ ok: true, json: async () => ({ country: "US" }) }),
    async () => ({ ok: false }),
    async () => ({ ok: true, json: async () => { throw new SyntaxError("invalid JSON"); } }),
    async () => ({ ok: true, json: async () => ({ country: [] }) }),
    async () => { throw new Error("offline"); }
  ]) {
    const page = openPage({ fetch });
    await flush();
    assert.equal(page.locale, "en");
    assert.deepEqual(page.updates, []);
  }

  let respond;
  const page = openPage({ fetch: () => new Promise((resolve) => { respond = resolve; }) });
  page.timeout();
  assert.equal(page.requests[0].options.signal.aborted, true);
  respond({ ok: true, json: async () => ({ country: "VN" }) });
  await flush();
  assert.equal(page.locale, "en");
});

test("manual language cancels pending Auto, persists, and skips location until Auto is selected again", async () => {
  const storage = new Map();
  const respond = [];
  const page = openPage({ storage, fetch: () => new Promise((resolve) => respond.push(resolve)) });
  page.change("en");
  assert.equal(page.requests[0].options.signal.aborted, true);
  respond[0]({ ok: true, json: async () => ({ country: "VN" }) });
  await flush();
  assert.equal(page.locale, "en");
  assert.equal(storage.get(storageKey), "en");

  page.change("vi");
  assert.equal(page.locale, "vi");
  const reopened = openPage({ storage });
  assert.equal(reopened.locale, "vi");
  assert.equal(reopened.choice, "vi");
  assert.equal(reopened.requests.length, 0);

  page.change("auto");
  assert.equal(page.locale, "en");
  respond[1]({ ok: true, json: async () => ({ country: "VN" }) });
  await flush();
  assert.equal(page.locale, "vi");
});

test("Vietnamese campaign text matches all English act, area, and objective IDs", () => {
  const { acts } = JSON.parse(read("data/poe2_data/campaign-checklist.json"));
  const translations = JSON.parse(read("data/poe2_data/campaign-checklist.vi.json"));
  const translatedFields = (entry, fields) => fields.filter((field) => entry[field]);
  assert.deepEqual(Object.keys(translations).sort(), acts.map(({ id }) => id).sort());
  for (const act of acts) {
    const localized = translations[act.id];
    assert.deepEqual(Object.keys(localized), [...translatedFields(act, ["subtitle"]), "areas"]);
    if (act.subtitle) assert.ok(localized.subtitle.trim());
    assert.deepEqual(Object.keys(localized.areas).sort(), act.areas.map(({ id }) => id).sort());
    for (const area of act.areas) {
      const localizedArea = localized.areas[area.id];
      assert.deepEqual(Object.keys(localizedArea), [...translatedFields(area, ["note"]), "objectives"]);
      if (area.note) assert.ok(localizedArea.note.trim());
      assert.deepEqual(
        Object.keys(localizedArea.objectives).sort(),
        area.objectives.filter(({ text, note }) => text || note).map(({ id }) => id).sort()
      );
      for (const objective of area.objectives) {
        const fields = translatedFields(objective, ["text", "note"]);
        if (!fields.length) continue;
        const translation = localizedArea.objectives[objective.id];
        assert.deepEqual(Object.keys(translation), fields);
        for (const field of fields) assert.ok(translation[field].trim());
      }
    }
  }
});
