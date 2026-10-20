/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Server Bubbles contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { copyToClipboard } from "@utils/clipboard";
import { useEffect, useRef, useState } from "@webpack/common";
import type { ReactNode } from "react";

import { Icon, IconButton } from "./components";
import { CHOICES, DEFAULTS, PRESETS, RANGES } from "./defaults";
import type { BubbleGuild } from "./model";
import { importLook, Preferences, sharedLook } from "./preferences";
import { Stage } from "./Stage";
import { getPreferences, updatePreferences, usePreferences } from "./state";

const samples: BubbleGuild[] = ["Design Den", "Night Owls", "The Workshop", "Music Room", "Friends", "Game Night"].map((name, index) => ({
    id: String(index + 1), name, icon: null, folder: "", mentions: index === 2 ? 3 : 0,
    unread: index === 2, current: index === 0, favorite: index === 4, order: index
}));
const sections = ["Style", "Bubbles", "Motion", "Controls", "Share"] as const;
type Section = typeof sections[number];

function Group({ title, children }: { title: string; children: ReactNode; }) {
    return <section className="sb-studio-card"><h3>{title}</h3><div className="sb-field-grid">{children}</div></section>;
}

function Control({ id, label, settings }: { id: keyof Preferences; label: string; settings: Preferences; }) {
    const value = settings[id];
    const change = (value: string | boolean | number) => updatePreferences({ [id]: value, preset: "custom" });
    if (typeof value === "boolean") return <label className="sb-field sb-field-wide sb-switch-row">
        <span className="sb-field-title">{label}</span><input className="sb-switch" aria-label={label} type="checkbox" checked={value} onChange={event => change(event.target.checked)} />
    </label>;
    if (Object.hasOwn(RANGES, id) && typeof value === "number") {
        const [min, max] = RANGES[id as keyof typeof RANGES];
        const step = ["idleScale", "hoverScale", "iconScale", "responsiveness", "wobble", "drift", "wheelSpeed"].includes(id) ? 0.05 : 1;
        return <label className="sb-field"><span className="sb-field-title">{label}<output className="sb-field-value">{Math.round(value * 100) / 100}</output></span>
            <input className="sb-range" aria-label={label} type="range" min={min} max={max} step={step} value={value} style={{ "--fill": `${(value - min) / (max - min) * 100}%` } as React.CSSProperties} onChange={event => change(Number(event.target.value))} />
        </label>;
    }
    const options = id === "fps" ? [30, 60, 90] : id === "idleFps" ? [15, 30] : CHOICES[id as keyof typeof CHOICES];
    if (options) return <label className="sb-field"><span className="sb-field-title">{label}</span>
        <select className="sb-select" aria-label={label} value={String(value)} onChange={event => change(typeof value === "number" ? Number(event.target.value) : event.target.value)}>
            {options.map(option => <option key={option} value={option}>{String(option).replaceAll("-", " ")}</option>)}
        </select>
    </label>;
    return <label className="sb-field"><span className="sb-field-title">{label}</span><span className="sb-color-row">
        <input className="sb-color" aria-label={label} type="color" value={String(value)} onChange={event => change(event.target.value)} /><span className="sb-color-code">{String(value)}</span>
    </span></label>;
}

export function Studio({ onExplore }: { onExplore(): void; }) {
    const settings = usePreferences();
    const [section, setSection] = useState<Section>("Style");
    const [paused, setPaused] = useState(false);
    const [incoming, setIncoming] = useState("");
    const [message, setMessage] = useState("");
    const [previous, setPrevious] = useState<Preferences | null>(null);
    const upload = useRef<FileReader | null>(null);
    useEffect(() => () => upload.current?.abort(), []);
    const controls = (items: [keyof Preferences, string][]) => items.map(([id, label]) => <Control key={id} id={id} label={label} settings={settings} />);
    function remember() { setPrevious(structuredClone(getPreferences())); }
    return <div className="sb-studio">
        <header className="sb-studio-header">
            <div className="sb-identity"><span className="sb-brand-mark"><Icon name="bubbles" /></span><div><h2>bubbles.</h2><span className="sb-brand-caption">Your servers, in motion.</span></div></div>
            <button type="button" className="sb-studio-button" onClick={onExplore}>Open my servers</button>
        </header>
        <section className="sb-studio-hero" aria-label="Live preview">
            <div className="sb-preview-bar"><span className="sb-playground-title">Playground</span><span className="sb-playground-hint">Sample servers · hover to try</span>
                <IconButton label={paused ? "Resume preview" : "Pause preview"} icon={paused ? "play" : "pause"} className="sb-preview-pause" aria-pressed={paused} onClick={() => setPaused(value => !value)} />
            </div>
            <Stage guilds={samples} settings={settings} preview paused={paused} />
        </section>
        <div className="sb-vencord-presets" aria-label="Starting looks">
            {Object.entries(PRESETS).map(([id, preset]) => <button type="button" key={id} aria-pressed={settings.preset === id} onClick={() => { remember(); updatePreferences({ ...preset.settings, preset: id }); }}>
                <span style={{ background: `linear-gradient(135deg, ${preset.colors.join(", ")})` }} /><strong>{preset.name}</strong><small>{preset.note}</small>
            </button>)}
        </div>
        <div className="sb-studio-workbench">
            <div role="tablist" aria-label="Customization" className="sb-studio-tabs">
                {sections.map(name => <button type="button" key={name} id={`sb-tab-${name}`} role="tab" aria-selected={section === name} aria-controls="sb-studio-panel" className="sb-studio-tab" onClick={() => setSection(name)}>{name}</button>)}
            </div>
            <div id="sb-studio-panel" role="tabpanel" aria-labelledby={`sb-tab-${section}`} className="sb-studio-body">
                {section === "Style" && <>
                    <Group title="Glass and color">{controls([["accent", "Accent"], ["secondary", "Atmosphere color"], ["material", "Surface"], ["multicolor", "Different bubble colors"], ["glassTint", "Glass tint"], ["sheen", "Reflections"], ["glow", "Glow"]])}</Group>
                    <Group title="Atmosphere">{controls([["background", "Background"], ["backgroundDim", "Background dimming"], ["ambientLights", "Ambient lights"]])}
                        <label className="sb-field sb-field-wide"><span className="sb-field-title">Local wallpaper</span>
                            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={event => {
                                const file = event.target.files?.[0];
                                if (!file) return;
                                if (file.size > 4 * 1024 * 1024 || !["image/png", "image/jpeg", "image/webp"].includes(file.type)) { setMessage("Choose a PNG, JPEG or WebP image under 4 MB."); return; }
                                upload.current?.abort();
                                const reader = new FileReader();
                                upload.current = reader;
                                reader.onload = () => { updatePreferences({ wallpaper: String(reader.result), background: "custom", preset: "custom" }); setMessage("Wallpaper saved locally."); };
                                reader.onerror = () => setMessage("Could not read that image.");
                                reader.readAsDataURL(file);
                            }} />
                        </label>
                        <button type="button" className="sb-studio-button" onClick={() => updatePreferences({ wallpaper: "", background: "cosmos" })}>Remove wallpaper</button>
                    </Group>
                </>}
                {section === "Bubbles" && <>
                    <Group title="Size and layout">{controls([["bubbleSize", "Diameter"], ["idleScale", "Resting size"], ["hoverScale", "Hover size"], ["spacing", "Spacing"], ["iconScale", "Icon size"]])}</Group>
                    <Group title="Details">{controls([["labelMode", "Server names"], ["showStatus", "Status text"], ["showUnread", "Unread badges"], ["sort", "Ordering"], ["favoritesFirst", "Favorites first"], ["defaultFilter", "Starting filter"], ["overview", "Start with all bubbles visible"]])}</Group>
                </>}
                {section === "Motion" && <>
                    <Group title="Feel">{controls([["softMotion", "Soft motion"], ["responsiveness", "Responsiveness"], ["wobble", "Wobble"], ["drift", "Drift"], ["hoverReach", "Hover reach"], ["parallax", "Parallax"], ["clickRipples", "Click ripples"]])}</Group>
                    <Group title="Exploration">{controls([["edgePan", "Pan near screen edges"], ["panSpeed", "Pan speed"], ["wheelSpeed", "Wheel sensitivity"]])}</Group>
                    <Group title="Performance">{controls([["fps", "Interaction frame limit"], ["idleFps", "Idle frame limit"], ["respectReducedMotion", "Follow reduced motion preference"]])}</Group>
                </>}
                {section === "Controls" && <>
                    <Group title="Launcher">{controls([["launcherSize", "Size"], ["launcherOpacity", "Opacity"], ["launcherCorner", "Corner"], ["shortcut", "Keyboard shortcut"]])}
                        <button type="button" className="sb-studio-button" onClick={() => updatePreferences({ position: null })}>Reset position</button>
                    </Group>
                    <Group title="Navigation">{controls([["hideNative", "Hide the regular server list"], ["showHints", "Navigation hints"]])}</Group>
                </>}
                {section === "Share" && <Group title="Share a look">
                    <p className="sb-card-description sb-field-wide">Looks include appearance and motion settings. Server IDs, favorites, recent servers and wallpapers stay on this computer.</p>
                    <textarea className="sb-look-text sb-field-wide" aria-label="Your shareable look" readOnly value={sharedLook(settings)} />
                    <button type="button" className="sb-studio-button" onClick={() => { void copyToClipboard(sharedLook(settings)).then(() => setMessage("Look copied."), () => setMessage("Select and copy the look above.")); }}>Copy look</button>
                    <a className="sb-studio-button" href={`data:application/json;charset=utf-8,${encodeURIComponent(sharedLook(settings))}`} download="ServerBubbles.look.json">Download look</a>
                    <textarea className="sb-look-text sb-field-wide" aria-label="Import a look" placeholder="Paste a Server Bubbles look…" value={incoming} onChange={event => setIncoming(event.target.value)} />
                    <button type="button" className="sb-studio-button sb-primary" onClick={() => {
                        try { const imported = importLook(incoming, getPreferences()); remember(); updatePreferences(imported); setMessage("Look applied."); }
                        catch (error) { setMessage(error instanceof Error ? error.message : "Could not import that look."); }
                    }}>Apply look</button>
                </Group>}
            </div>
        </div>
        <p className="sb-share-status" role="status">{message}</p>
        <footer className="sb-studio-footer">
            <button type="button" className="sb-studio-button" disabled={!previous} onClick={() => { if (previous) { const current = structuredClone(getPreferences()); updatePreferences(previous); setPrevious(current); } }}>Undo look</button>
            <button type="button" className="sb-studio-button sb-quiet" onClick={() => {
                remember();
                const { favorites, recent, position, wallpaper } = getPreferences();
                updatePreferences({ ...DEFAULTS, favorites, recent, position, wallpaper });
            }}>Restore default look</button>
        </footer>
    </div>;
}
