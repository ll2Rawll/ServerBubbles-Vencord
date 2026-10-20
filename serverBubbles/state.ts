/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Server Bubbles contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as DataStore from "@api/DataStore";
import { Logger } from "@utils/Logger";
import { React } from "@webpack/common";

import { DEFAULTS } from "./defaults";
import { normalize, Preferences } from "./preferences";

const logger = new Logger("ServerBubbles");
const key = "ServerBubbles.preferences.v1";
let preferences: Preferences = structuredClone(DEFAULTS);
let writes = Promise.resolve();
let enabled = false;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let pending: Preferences | undefined;
const listeners = new Set<() => void>();

export const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
};
export const getPreferences = () => preferences;
export const usePreferences = () => React.useSyncExternalStore(subscribe, getPreferences);
export const isEnabled = () => enabled;
export const useEnabled = () => React.useSyncExternalStore(subscribe, isEnabled);
export function setEnabled(value: boolean): void {
    enabled = value;
    for (const listener of listeners) listener();
}

export async function loadPreferences(isCurrent: () => boolean): Promise<boolean> {
    flushPreferences();
    await writes;
    const saved = await DataStore.get<unknown>(key);
    if (!isCurrent()) return false;
    preferences = normalize(saved ?? DEFAULTS);
    for (const listener of listeners) listener();
    return true;
}

export function updatePreferences(changes: Partial<Preferences>): void {
    preferences = normalize({ ...preferences, ...changes });
    for (const listener of listeners) listener();
    pending = structuredClone(preferences);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flushPreferences, 180);
}

export function flushPreferences(): void {
    clearTimeout(saveTimer);
    saveTimer = undefined;
    if (!pending) return;
    const snapshot = pending;
    pending = undefined;
    writes = writes.then(() => DataStore.set(key, snapshot)).catch(error => {
        logger.error("Could not save preferences", error);
    });
}

export function toggleFavorite(id: string): void {
    const { favorites } = preferences;
    updatePreferences({ favorites: favorites.includes(id) ? favorites.filter(value => value !== id) : [...favorites, id] });
}
