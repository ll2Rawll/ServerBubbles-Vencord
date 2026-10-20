/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Server Bubbles contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findCssClassesLazy } from "@webpack";
import { ReactDOM, useEffect, useRef, useState } from "@webpack/common";

import { appearance, appearanceData } from "./appearance";
import { Icon } from "./components";
import { useGuilds } from "./guilds";
import { updatePreferences, useEnabled, usePreferences } from "./state";

const sidebar = findCssClassesLazy("guilds", "base", "sidebar");

export function Launcher({ onToggle }: { onToggle(): void; }) {
    const enabled = useEnabled();
    const settings = usePreferences();
    const guilds = useGuilds(settings);
    const [viewport, setViewport] = useState({ width: innerWidth, height: innerHeight });
    const [drag, setDrag] = useState<{ x: number; y: number; } | null>(null);
    const origin = useRef<{ x: number; y: number; left: number; top: number; } | null>(null);
    const moved = useRef(false);
    const { shortcut } = settings;
    useEffect(() => {
        if (!enabled) return;
        const resize = () => setViewport({ width: innerWidth, height: innerHeight });
        const keydown = (event: KeyboardEvent) => {
            const { target } = event;
            if (event.repeat || event.isComposing || event.metaKey || target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea, select"))) return;
            const matches = shortcut === "ctrl-shift-space" ? event.ctrlKey && event.shiftKey && !event.altKey && event.code === "Space"
                : shortcut === "alt-b" ? event.altKey && !event.ctrlKey && !event.shiftKey && event.code === "KeyB"
                    : shortcut === "ctrl-alt-b" && event.ctrlKey && event.altKey && !event.shiftKey && event.code === "KeyB";
            if (!matches) return;
            event.preventDefault();
            event.stopPropagation();
            onToggle();
        };
        window.addEventListener("resize", resize);
        document.addEventListener("keydown", keydown, true);
        return () => {
            window.removeEventListener("resize", resize);
            document.removeEventListener("keydown", keydown, true);
        };
    }, [enabled, shortcut, onToggle]);
    if (!enabled) return null;
    const limit = { x: Math.max(1, viewport.width - settings.launcherSize - 12), y: Math.max(1, viewport.height - settings.launcherSize - 12) };
    const x = Math.min(limit.x, drag?.x ?? (settings.position ? settings.position.x * limit.x : settings.launcherCorner.endsWith("left") ? 24 : limit.x - 12));
    const y = Math.min(limit.y, drag?.y ?? (settings.position ? settings.position.y * limit.y : settings.launcherCorner.startsWith("top") ? 52 : limit.y - 76));
    const mentions = guilds.reduce((sum, guild) => sum + guild.mentions, 0);
    return ReactDOM.createPortal(<>
        {settings.hideNative && <style>{`#app-mount .${sidebar.guilds} { display: none !important; } #app-mount { --custom-guild-list-width: 0px; }`}</style>}
        <button id="sb-launcher" type="button" title="Open your servers. Drag to reposition." aria-label={`Open your ${guilds.length} servers${mentions && settings.showUnread ? `, ${mentions} mentions` : ""}`} aria-haspopup="dialog"
            style={{ ...appearance(settings), left: Math.max(12, x), top: Math.max(12, y) }} {...appearanceData(settings)}
            onClick={() => { if (!moved.current) onToggle(); }}
            onPointerDown={event => {
                if (event.button !== 0) return;
                moved.current = false;
                origin.current = { x: event.clientX, y: event.clientY, left: x, top: y };
                event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={event => {
                if (!origin.current) return;
                const dx = event.clientX - origin.current.x, dy = event.clientY - origin.current.y;
                if (!moved.current && Math.hypot(dx, dy) < 6) return;
                moved.current = true;
                setDrag({ x: Math.max(12, Math.min(limit.x, origin.current.left + dx)), y: Math.max(12, Math.min(limit.y, origin.current.top + dy)) });
            }}
            onPointerUp={event => {
                if (!origin.current) return;
                origin.current = null;
                if (moved.current) updatePreferences({ position: { x: x / limit.x, y: y / limit.y } });
                setDrag(null);
                event.currentTarget.releasePointerCapture(event.pointerId);
            }}
            onPointerCancel={() => { origin.current = null; setDrag(null); }}>
            <Icon name="bubbles" />
            {settings.showUnread && mentions > 0 && <span className="sb-launcher-badge">{mentions > 99 ? "99+" : mentions}</span>}
            {settings.showHints && <span className="sb-launcher-tip">Your spaces</span>}
        </button>
    </>, document.body);
}
