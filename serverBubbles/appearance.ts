/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Server Bubbles contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { CSSProperties } from "react";

import { BACKGROUNDS } from "./defaults";
import type { Preferences } from "./preferences";

export type BubbleStyle = CSSProperties & Record<`--${string}`, string | number>;

export function appearance(settings: Preferences): BubbleStyle {
    const rgb = (color: string) => [1, 3, 5].map(index => parseInt(color.slice(index, index + 2), 16)).join(" ");
    const channels = [1, 3, 5].map(index => parseInt(settings.accent.slice(index, index + 2), 16) / 255);
    const maximum = Math.max(...channels);
    const delta = maximum - Math.min(...channels);
    const hue = !delta ? 210 : ((maximum === channels[0] ? (channels[1] - channels[2]) / delta
        : maximum === channels[1] ? (channels[2] - channels[0]) / delta + 2
            : (channels[0] - channels[1]) / delta + 4) * 60 + 360) % 360;
    const aero = `radial-gradient(ellipse at 14% 88%, rgb(${rgb(settings.accent)} / .26), transparent 50%), radial-gradient(ellipse at 85% 15%, rgb(${rgb(settings.secondary)} / .32), transparent 55%), linear-gradient(150deg, #020914, #0b2035 60%, #020711)`;
    let background = settings.background === "midnight" ? BACKGROUNDS.midnight : settings.background === "cosmos" ? BACKGROUNDS.cosmos : aero;
    if (settings.background === "theme") background = `var(--lg-photo, var(--lg-wallpaper, ${BACKGROUNDS.cosmos}))`;
    if (settings.background === "custom") background = settings.wallpaper ? `url(${JSON.stringify(settings.wallpaper)})` : BACKGROUNDS.cosmos;
    return {
        "--sb-accent": settings.accent,
        "--sb-secondary": settings.secondary,
        "--sb-accent-rgb": rgb(settings.accent),
        "--sb-secondary-rgb": rgb(settings.secondary),
        "--sb-accent-hue": hue,
        "--sb-tint": settings.glassTint / 100,
        "--sb-sheen": settings.sheen / 100,
        "--sb-glow": settings.glow / 100,
        "--sb-dim": settings.backgroundDim / 100,
        "--sb-icon-scale": settings.iconScale,
        "--sb-background": background,
        "--sb-launcher-size": `${settings.launcherSize}px`,
        "--sb-launcher-opacity": settings.launcherOpacity / 100
    };
}

export function appearanceData(settings: Preferences) {
    return {
        "data-material": settings.material,
        "data-labels": settings.labelMode,
        "data-status": String(settings.showStatus),
        "data-multicolor": String(settings.multicolor),
        "data-ambient": String(settings.ambientLights),
        "data-background": settings.background,
        "data-hints": String(settings.showHints)
    };
}
