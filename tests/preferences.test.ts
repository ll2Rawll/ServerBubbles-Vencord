import assert from "node:assert/strict";
import { test } from "node:test";

import { DEFAULTS } from "../serverBubbles/defaults";
import { importLook, normalize, sharedLook } from "../serverBubbles/preferences";

test("stored settings are bounded and malformed values are discarded", () => {
    const preferences = normalize({
        bubbleSize: 900, idleScale: -5, glow: NaN, fps: 999, accent: "red; background:url(https://example.com)",
        sort: "invalid", favorites: ["123", "123", null, "abc"], position: { x: 9, y: -1 },
        wallpaper: "https://example.com/track.png", unexpected: true
    });
    assert.equal(preferences.bubbleSize, 210);
    assert.equal(preferences.idleScale, 0.4);
    assert.equal(preferences.glow, DEFAULTS.glow);
    assert.equal(preferences.fps, 60);
    assert.equal(preferences.accent, DEFAULTS.accent);
    assert.equal(preferences.sort, "native");
    assert.deepEqual(preferences.favorites, ["123"]);
    assert.deepEqual(preferences.position, { x: 1, y: 0 });
    assert.equal(preferences.wallpaper, "");
    assert.equal(Object.hasOwn(preferences, "unexpected"), false);
});

test("looks round-trip appearance without exporting account data", () => {
    const preferences = normalize({ ...DEFAULTS, accent: "#123456", bubbleSize: 180, background: "custom", wallpaper: "data:image/png;base64,aGVsbG8=", favorites: ["123"], recent: ["456"], position: { x: 0.2, y: 0.3 } });
    const exported = sharedLook(preferences);
    const data = JSON.parse(exported);
    for (const key of ["favorites", "recent", "position", "wallpaper", "hideNative", "shortcut"])
        assert.equal(Object.hasOwn(data.settings, key), false);
    assert.equal(data.settings.background, "cosmos");
    const imported = importLook(exported, normalize({ ...DEFAULTS, favorites: ["999"] }));
    assert.equal(imported.accent, "#123456");
    assert.equal(imported.bubbleSize, 180);
    assert.deepEqual(imported.favorites, ["999"]);
});

test("imports cannot replace private settings or inject CSS or remote wallpapers", () => {
    const current = normalize({ ...DEFAULTS, favorites: ["123"], recent: ["456"], hideNative: false });
    const imported = importLook(JSON.stringify({ format: "server-bubbles-look", version: 1, settings: {
        accent: "url(https://example.com)", favorites: ["999"], recent: [], hideNative: true,
        wallpaper: "https://example.com", background: "custom", bubbleSize: 1
    } }), current);
    assert.deepEqual(imported.favorites, ["123"]);
    assert.deepEqual(imported.recent, ["456"]);
    assert.equal(imported.hideNative, false);
    assert.equal(imported.accent, current.accent);
    assert.equal(imported.wallpaper, "");
    assert.equal(imported.background, "cosmos");
    assert.equal(imported.bubbleSize, 80);
});

test("invalid look formats fail without modifying the current preferences", () => {
    const current = normalize(DEFAULTS);
    for (const text of ["{", "null", "[]", "x".repeat(64001), JSON.stringify({ format: "server-bubbles-look", version: 2, settings: { glow: 5 } }), JSON.stringify({ format: "server-bubbles-look", version: 1, settings: { favorites: [] } })])
        assert.throws(() => importLook(text, current));
    assert.deepEqual(current, normalize(DEFAULTS));
});
