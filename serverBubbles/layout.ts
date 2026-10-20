/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Server Bubbles contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { BubbleGuild } from "./model";
import type { Preferences } from "./preferences";

export interface BubbleNode {
    id: string;
    x: number;
    y: number;
    radius: number;
    seed: number;
}

export interface BubbleLayout {
    nodes: BubbleNode[];
    width: number;
    height: number;
}

export function hash(value: string): number {
    return [...value].reduce((seed, char) => (seed * 31 + char.charCodeAt(0)) >>> 0, 0);
}

export function layoutBubbles(guilds: BubbleGuild[], settings: Preferences, width: number, height: number): BubbleLayout {
    const base = settings.bubbleSize * (width < 500 ? 0.8 : 1);
    const diameters = guilds.map(guild => base + (guild.current ? 40 : guild.favorite ? 28 : guild.mentions && settings.showUnread ? 18 : [0, 8, 16][hash(guild.id) % 3]));
    const area = diameters.reduce((sum, diameter) => sum + (diameter * settings.idleScale + settings.spacing) ** 2, 0);
    const edge = 80;
    const worldWidth = Math.max(width, Math.sqrt(area * Math.max(0.8, Math.min(1.65, width / height))) + edge * 2);
    const nodes: BubbleNode[] = [];
    guilds.forEach((guild, index) => {
        const radius = diameters[index] / 2;
        const resting = radius * settings.idleScale;
        let best = { x: edge + resting, y: Infinity };
        for (let x = edge + resting; x <= worldWidth - edge - resting + 1; x += 6) {
            let y = edge + resting;
            for (const other of nodes) {
                const dx = Math.abs(x - other.x);
                const distance = resting + other.radius * settings.idleScale + settings.spacing;
                if (dx < distance) y = Math.max(y, other.y + Math.sqrt(distance ** 2 - dx ** 2));
            }
            if (y < best.y) best = { x, y };
        }
        nodes.push({ ...best, radius, id: guild.id, seed: hash(guild.id) });
    });
    const bottom = Math.max(0, ...nodes.map(node => node.y + node.radius * settings.idleScale)) + edge;
    const right = Math.max(0, ...nodes.map(node => node.x + node.radius * settings.idleScale)) + edge;
    for (const node of nodes) {
        if (right < width) node.x += (width - right) / 2;
        if (bottom < height) node.y += (height - bottom) / 2;
    }
    return { nodes, width: worldWidth, height: Math.max(height, bottom) };
}

export function clampCamera(value: number, world: number, viewport: number): number {
    return Math.max(0, Math.min(Math.max(0, world - viewport), value));
}

export function edgeVelocity(position: number, length: number): number {
    const edge = Math.min(160, length * 0.22);
    if (position < edge) return -Math.min(1, (1 - position / edge) ** 2);
    if (position > length - edge) return Math.min(1, (1 - (length - position) / edge) ** 2);
    return 0;
}
