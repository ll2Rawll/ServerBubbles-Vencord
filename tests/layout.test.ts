import assert from "node:assert/strict";
import { test } from "node:test";

import { DEFAULTS } from "../serverBubbles/defaults";
import type { BubbleGuild } from "../serverBubbles/model";
import { clampCamera, edgeVelocity, layoutBubbles } from "../serverBubbles/layout";
import { normalize } from "../serverBubbles/preferences";

const guilds = Array.from({ length: 120 }, (_, index): BubbleGuild => ({ id: String(index), name: `Server ${index}`, icon: null, folder: "", mentions: index % 5, unread: true, current: index === 0, favorite: index % 7 === 0, order: index }));

test("packed bubbles stay inside the world and do not overlap at rest", () => {
    for (const [width, height] of [[360, 640], [1280, 720], [1920, 1080]]) {
        const settings = normalize(DEFAULTS);
        const layout = layoutBubbles(guilds, settings, width, height);
        for (const node of layout.nodes) {
            const radius = node.radius * settings.idleScale;
            assert.ok(Number.isFinite(node.x) && Number.isFinite(node.y));
            assert.ok(node.x - radius >= 0 && node.x + radius <= layout.width);
            assert.ok(node.y - radius >= 0 && node.y + radius <= layout.height);
            for (const other of layout.nodes) {
                if (node === other) continue;
                assert.ok(Math.hypot(node.x - other.x, node.y - other.y) >= (node.radius + other.radius) * settings.idleScale + settings.spacing - 0.01);
            }
        }
    }
});

test("empty and single-server layouts have finite bounds", () => {
    for (const input of [[], guilds.slice(0, 1)]) {
        const layout = layoutBubbles(input, normalize(DEFAULTS), 360, 640);
        assert.ok(layout.width >= 360 && layout.height >= 640);
        assert.ok(Number.isFinite(layout.width) && Number.isFinite(layout.height));
    }
});

test("camera stays bounded and edge movement has a quiet center", () => {
    assert.equal(clampCamera(-100, 2000, 800), 0);
    assert.equal(clampCamera(9999, 2000, 800), 1200);
    assert.equal(clampCamera(10, 300, 800), 0);
    assert.equal(edgeVelocity(400, 800), 0);
    assert.equal(edgeVelocity(0, 800), -1);
    assert.equal(edgeVelocity(800, 800), 1);
});
