import assert from "node:assert/strict";
import { test } from "node:test";

import { DEFAULTS } from "../serverBubbles/defaults";
import { BubbleGuild, filterGuilds } from "../serverBubbles/model";
import { normalize } from "../serverBubbles/preferences";

const guilds: BubbleGuild[] = [
    { id: "101", name: "Café Coders", icon: null, folder: "Creative", mentions: 0, unread: false, current: true, favorite: false, order: 2 },
    { id: "102", name: "Night Owls", icon: null, folder: "Friends", mentions: 3, unread: true, current: false, favorite: true, order: 0 },
    { id: "103", name: "Book Club", icon: null, folder: "", mentions: 0, unread: true, current: false, favorite: false, order: 1 }
];
const ids = (items: BubbleGuild[]) => items.map(item => item.id);

test("search matches accents, abbreviations and folder names", () => {
    const settings = normalize(DEFAULTS);
    for (const query of ["cafe", "CC", "creative"])
        assert.deepEqual(ids(filterGuilds(guilds, settings, "all", query)), ["101"]);
    assert.deepEqual(filterGuilds(guilds, settings, "all", "no match"), []);
});

test("filters and sorting preserve native order and account preferences", () => {
    const settings = normalize({ ...DEFAULTS, recent: ["101", "103"] });
    assert.deepEqual(ids(filterGuilds(guilds, settings, "all", "")), ["102", "103", "101"]);
    assert.deepEqual(ids(filterGuilds(guilds, settings, "favorites", "")), ["102"]);
    assert.deepEqual(ids(filterGuilds(guilds, settings, "unread", "")), ["102", "103"]);
    assert.deepEqual(ids(filterGuilds(guilds, settings, "recent", "")), ["103", "101"]);
    assert.deepEqual(ids(filterGuilds(guilds, { ...settings, sort: "recent" }, "all", "")), ["101", "103", "102"]);
    assert.deepEqual(ids(filterGuilds(guilds, { ...settings, sort: "name" }, "all", "")), ["103", "101", "102"]);
    assert.deepEqual(ids(filterGuilds(guilds, { ...settings, sort: "name", favoritesFirst: true }, "all", "")), ["102", "103", "101"]);
});
