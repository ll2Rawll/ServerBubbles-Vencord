/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Server Bubbles contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { CHOICES, DEFAULTS, LOOK_KEYS, PRESETS, RANGES } from "./defaults";

type Widen<Value> = Value extends string ? string : Value extends number ? number : Value extends boolean ? boolean : Value;
export type Preferences = { -readonly [Key in keyof typeof DEFAULTS]: Widen<typeof DEFAULTS[Key]> };

const record = (value: unknown): Record<string, unknown> =>
    value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

function ids(value: unknown): string[] {
    return Array.isArray(value)
        ? [...new Set(value.filter((id): id is string => typeof id === "string" && /^\d{1,24}$/.test(id)))].slice(0, 250)
        : [];
}

export function validWallpaper(value: unknown): value is string {
    return typeof value === "string" && value.length <= 6 * 1024 * 1024
        && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value);
}

export function normalize(value: unknown): Preferences {
    const source = record(value);
    const settings: Preferences = structuredClone(DEFAULTS);
    for (const key of Object.keys(DEFAULTS) as (keyof Preferences)[]) {
        if (typeof DEFAULTS[key] === "boolean" && typeof source[key] === "boolean")
            Object.assign(settings, { [key]: source[key] });
    }
    for (const key of Object.keys(RANGES) as (keyof typeof RANGES)[]) {
        const value = source[key];
        if (typeof value === "number" && Number.isFinite(value)) {
            const [min, max] = RANGES[key];
            settings[key] = Math.max(min, Math.min(max, value));
        }
    }
    for (const key of Object.keys(CHOICES) as (keyof typeof CHOICES)[]) {
        const value = source[key];
        if (typeof value === "string" && CHOICES[key].includes(value)) settings[key] = value;
    }
    for (const key of ["accent", "secondary"] as const) {
        const value = source[key];
        if (typeof value === "string" && /^#[\da-f]{6}$/i.test(value)) settings[key] = value;
    }
    settings.favorites = ids(source.favorites);
    settings.recent = ids(source.recent).slice(0, 20);
    settings.preset = typeof source.preset === "string" && Object.hasOwn(PRESETS, source.preset) ? source.preset : "custom";
    settings.fps = [30, 60, 90].includes(Number(source.fps)) ? Number(source.fps) : DEFAULTS.fps;
    settings.idleFps = [15, 30].includes(Number(source.idleFps)) ? Number(source.idleFps) : DEFAULTS.idleFps;
    settings.wallpaper = validWallpaper(source.wallpaper) ? source.wallpaper : "";
    const position = record(source.position);
    if (typeof position.x === "number" && Number.isFinite(position.x)
        && typeof position.y === "number" && Number.isFinite(position.y))
        settings.position = { x: Math.max(0, Math.min(1, position.x)), y: Math.max(0, Math.min(1, position.y)) };
    return settings;
}

export function sharedLook(settings: Preferences): string {
    const look = Object.fromEntries(LOOK_KEYS.map(key => [key, settings[key]]));
    if (look.background === "custom") look.background = "cosmos";
    return JSON.stringify({ format: "server-bubbles-look", version: 1, settings: look }, null, 2);
}

export function importLook(text: string, current: Preferences): Preferences {
    if (text.length > 64000) throw new Error("Keep shared looks under 64 KB.");
    let parsed: Record<string, unknown>;
    try {
        parsed = record(JSON.parse(text));
    } catch {
        throw new Error("Paste the complete JSON look, including its braces.");
    }
    if (parsed.format !== "server-bubbles-look" || parsed.version !== 1
        || !parsed.settings || typeof parsed.settings !== "object" || Array.isArray(parsed.settings))
        throw new Error("This is not a supported Server Bubbles look.");
    const input = record(parsed.settings);
    const keys = LOOK_KEYS.filter(key => Object.hasOwn(input, key));
    if (!keys.length) throw new Error("This look has no appearance settings.");
    const changes = Object.fromEntries(keys.map(key => [key, input[key]]));
    if (changes.background === "custom") changes.background = "cosmos";
    return normalize({ ...current, ...changes, preset: "custom" });
}

export function normalizeText(text: string): string {
    return text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase();
}
