/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Server Bubbles contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useEffect, useMemo, useRef, useState } from "@webpack/common";

import { appearance, appearanceData, BubbleStyle } from "./appearance";
import { Atmosphere, Icon, IconButton } from "./components";
import { BubbleLayout, clampCamera, edgeVelocity, hash, layoutBubbles } from "./layout";
import type { BubbleGuild } from "./model";
import type { Preferences } from "./preferences";

export function useReducedMotion(respect: boolean): boolean {
    const [reduced, setReduced] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
    useEffect(() => {
        const query = matchMedia("(prefers-reduced-motion: reduce)");
        const change = () => setReduced(query.matches);
        query.addEventListener("change", change);
        return () => query.removeEventListener("change", change);
    }, []);
    return respect && reduced;
}

interface StageProps {
    guilds: BubbleGuild[];
    settings: Preferences;
    preview?: boolean;
    paused?: boolean;
    overview?: boolean;
    onOpen?(id: string): void;
    onFavorite?(id: string): void;
    onContext?(guild: BubbleGuild, event: React.MouseEvent): void;
}

export function Stage({ guilds, settings, preview = false, paused = false, overview = true, onOpen, onFavorite, onContext }: StageProps) {
    const root = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState({ width: 800, height: 600 });
    const [focused, setFocused] = useState<string | null>(null);
    const [visible, setVisible] = useState(!document.hidden);
    const [intersecting, setIntersecting] = useState(true);
    const [frame, setFrame] = useState<{ layout: BubbleLayout | null; positions: { x: number; y: number; scale: number; rotate: number; }[]; }>({ layout: null, positions: [] });
    const pointer = useRef({ x: 0, y: 0, active: false });
    const camera = useRef({ x: 0, y: 0 });
    const hovered = useRef<string | null>(null);
    const [ripples, setRipples] = useState<{ id: number; x: number; y: number; }[]>([]);
    const rippleSerial = useRef(0);
    const touch = useRef<{ x: number; y: number; moved: boolean; } | null>(null);
    const suppressTouchClick = useRef(false);
    const reduced = useReducedMotion(settings.respectReducedMotion);
    const signature = guilds.map(guild => `${guild.id}:${guild.current}:${guild.favorite}:${guild.mentions}`).join("|");
    const layout = useMemo(() => layoutBubbles(guilds, settings, size.width, size.height), [signature, settings, size.width, size.height]);
    const zoom = preview || overview ? Math.min(1, (size.width - 32) / layout.width, (size.height - 32) / layout.height) : 1;
    const motion = useMemo(() => new Map<string, { x: number; y: number; scale: number; rotate: number; }>(), [layout, zoom]);

    useEffect(() => {
        const element = root.current;
        if (!element) return;
        const resize = new ResizeObserver(([entry]) => {
            const { width, height } = entry.contentRect;
            if (width > 0 && height > 0) setSize({ width, height });
        });
        resize.observe(element);
        const intersection = new IntersectionObserver(([entry]) => setIntersecting(entry.isIntersecting));
        intersection.observe(element);
        const visibility = () => setVisible(!document.hidden);
        document.addEventListener("visibilitychange", visibility);
        return () => {
            resize.disconnect();
            intersection.disconnect();
            document.removeEventListener("visibilitychange", visibility);
        };
    }, []);

    useEffect(() => {
        camera.current = { x: 0, y: 0 };
        const selected = layout.nodes.find(node => node.id === focused);
        if (selected && !overview && !preview) camera.current = {
            x: clampCamera(selected.x - size.width / 2, layout.width, size.width),
            y: clampCamera(selected.y - size.height / 2, layout.height, size.height)
        };
    }, [layout, focused, overview, preview, size.width, size.height]);

    useEffect(() => {
        let handle = 0;
        let last = 0;
        const initialX = (size.width - layout.width * zoom) / 2 - (overview || preview ? 0 : camera.current.x);
        const initialY = (size.height - layout.height * zoom) / 2 - (overview || preview ? 0 : camera.current.y);
        const positions = layout.nodes.map(node => motion.get(node.id) ?? { x: node.x * zoom + initialX, y: node.y * zoom + initialY, scale: settings.idleScale * zoom, rotate: 0 });
        layout.nodes.forEach((node, index) => motion.set(node.id, positions[index]));
        const draw = (now: number) => {
            const fps = pointer.current.active || focused ? settings.fps : settings.idleFps;
            if (!last || now - last >= 1000 / fps - 0.5) {
                const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
                last = now;
                const point = pointer.current;
                if (!overview && !preview && settings.edgePan && point.active && !focused) {
                    camera.current.x = clampCamera(camera.current.x + edgeVelocity(point.x, size.width) * settings.panSpeed * dt, layout.width, size.width);
                    camera.current.y = clampCamera(camera.current.y + edgeVelocity(point.y, size.height) * settings.panSpeed * dt, layout.height, size.height);
                }
                const offsetX = (size.width - layout.width * zoom) / 2 - (overview || preview ? 0 : camera.current.x);
                const offsetY = (size.height - layout.height * zoom) / 2 - (overview || preview ? 0 : camera.current.y);
                let target = layout.nodes.find(node => node.id === focused);
                if (!target && point.active) target = layout.nodes.find((node, index) => node.id === hovered.current
                    && Math.hypot(point.x - positions[index].x, point.y - positions[index].y) < node.radius * positions[index].scale);
                if (!target && point.active) target = layout.nodes.find(node => Math.hypot(point.x - (node.x * zoom + offsetX), point.y - (node.y * zoom + offsetY)) < node.radius * settings.idleScale * zoom + settings.hoverReach);
                hovered.current = target?.id ?? null;
                const ease = reduced ? 1 : 1 - Math.exp(-dt * 12 * settings.responsiveness);
                const parallaxX = !reduced && settings.parallax && point.active ? (point.x / size.width - 0.5) * -10 : 0;
                const parallaxY = !reduced && settings.parallax && point.active ? (point.y / size.height - 0.5) * -8 : 0;
                layout.nodes.forEach((node, index) => {
                    const current = positions[index];
                    let pushX = 0, pushY = 0;
                    if (target && node !== target) {
                        const dx = node.x - target.x, dy = node.y - target.y;
                        const distance = Math.max(1, Math.hypot(dx, dy));
                        const reach = target.radius * settings.hoverScale + node.radius * settings.idleScale + settings.spacing;
                        const push = Math.max(0, reach - distance);
                        pushX = dx / distance * push;
                        pushY = dy / distance * push;
                    }
                    const drift = reduced || !settings.softMotion ? 0 : settings.drift * 3;
                    const x = (node.x + pushX + Math.sin(now / 1900 + node.seed) * drift) * zoom + offsetX + parallaxX;
                    const y = (node.y + pushY + Math.cos(now / 2300 + node.seed) * drift) * zoom + offsetY + parallaxY;
                    current.x += (x - current.x) * ease;
                    current.y += (y - current.y) * ease;
                    current.scale += ((node === target ? settings.hoverScale : settings.idleScale) * zoom - current.scale) * ease;
                    current.rotate = reduced || !settings.softMotion ? 0 : Math.sin(now / 1200 + node.seed) * settings.wobble * (node === target ? 1.4 : 0.35);
                });
                setFrame({ layout, positions: positions.map(position => ({ ...position })) });
            }
            handle = requestAnimationFrame(draw);
        };
        // A still frame also keeps reduced-motion and paused previews usable.
        draw(performance.now());
        if (paused || !visible || !intersecting) cancelAnimationFrame(handle);
        return () => cancelAnimationFrame(handle);
    }, [layout, motion, settings, focused, zoom, overview, preview, paused, visible, intersecting, reduced, size.width, size.height]);

    function moveFocus(event: React.KeyboardEvent, index: number) {
        const offset = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 1, ArrowUp: -1 }[event.key];
        const next = event.key === "Home" ? 0 : event.key === "End" ? guilds.length - 1 : offset == null ? null : (index + offset + guilds.length) % guilds.length;
        if (next == null) return;
        event.preventDefault();
        const buttons = root.current?.querySelectorAll<HTMLButtonElement>(".sb-server-open");
        buttons?.[next]?.focus();
    }

    return <div ref={root} className={preview ? "sb-preview-canvas" : "sb-vencord-stage"} style={appearance(settings)} {...appearanceData(settings)} data-reduced={String(reduced)}
        onPointerDown={event => {
            if (event.pointerType === "touch") {
                touch.current = { x: event.clientX, y: event.clientY, moved: false };
                suppressTouchClick.current = false;
            }
            if (settings.clickRipples && !reduced) {
                const rect = event.currentTarget.getBoundingClientRect();
                const ripple = { id: ++rippleSerial.current, x: event.clientX - rect.left, y: event.clientY - rect.top };
                setRipples(current => [...current.slice(-5), ripple]);
            }
        }} onPointerMove={event => {
            if (event.pointerType === "touch") {
                const start = touch.current;
                if (start && !overview && !preview) {
                    const dx = event.clientX - start.x, dy = event.clientY - start.y;
                    if (Math.hypot(dx, dy) > 6 || start.moved) {
                        camera.current.x = clampCamera(camera.current.x - dx, layout.width, size.width);
                        camera.current.y = clampCamera(camera.current.y - dy, layout.height, size.height);
                        touch.current = { x: event.clientX, y: event.clientY, moved: true };
                        suppressTouchClick.current = true;
                    }
                }
                return;
            }
            const rect = event.currentTarget.getBoundingClientRect();
            pointer.current = { x: event.clientX - rect.left, y: event.clientY - rect.top, active: true };
        }} onPointerLeave={() => { pointer.current.active = false; touch.current = null; }}
        onPointerUp={() => { touch.current = null; }} onPointerCancel={() => { touch.current = null; }}
        onClickCapture={event => { if (suppressTouchClick.current) { event.preventDefault(); event.stopPropagation(); suppressTouchClick.current = false; } }}
        onWheel={event => {
            if (overview || preview) return;
            camera.current.x = clampCamera(camera.current.x + (event.shiftKey ? event.deltaY : event.deltaX) * settings.wheelSpeed, layout.width, size.width);
            camera.current.y = clampCamera(camera.current.y + (event.shiftKey ? 0 : event.deltaY) * settings.wheelSpeed, layout.height, size.height);
        }}>
        <Atmosphere />
        {ripples.map(ripple => <span key={ripple.id} className="sb-water-ripple" style={{ left: ripple.x, top: ripple.y }} onAnimationEnd={() => setRipples(current => current.filter(item => item.id !== ripple.id))} />)}
        <div className="sb-world" role="group" aria-label={preview ? "Sample server bubbles" : "Your servers"}>
            {layout.nodes.map((node, index) => {
                const guild = guilds[index];
                const position = frame.layout === layout ? frame.positions[index] : {
                    x: node.x * zoom + (size.width - layout.width * zoom) / 2,
                    y: node.y * zoom + (size.height - layout.height * zoom) / 2,
                    scale: settings.idleScale * zoom, rotate: 0
                };
                const style: BubbleStyle = {
                    width: node.radius * 2, height: node.radius * 2,
                    transform: `translate3d(${position.x - node.radius}px, ${position.y - node.radius}px, 0) scale(${position.scale}) rotate(${position.rotate}deg)`,
                    zIndex: position.scale > settings.idleScale * zoom + 0.01 ? 10 : 1,
                    "--sb-diameter": `${node.radius * 2}px`, "--sb-label-size": `${Math.max(11, Math.min(14, node.radius * 0.15))}px`,
                    "--sb-logo-size": `${Math.max(32, Math.min(49, node.radius * 0.49))}px`,
                    "--sb-hue": settings.multicolor ? [208, 218, 230, 245, 188][hash(guild.id) % 5] : 210
                };
                return <article key={guild.id} style={style} className={`sb-card${guild.current ? " sb-card-current" : ""}${guild.favorite ? " sb-card-favorite" : ""}${focused === guild.id ? " sb-is-near" : ""}`}>
                    <div className="sb-bubble-motion">
                        <button type="button" className="sb-server-open" aria-label={`${guild.name}${guild.mentions ? `, ${guild.mentions} mentions` : guild.unread ? ", unread" : ""}`} aria-current={guild.current ? "page" : undefined}
                            onFocus={event => { if (event.currentTarget.matches(":focus-visible")) setFocused(guild.id); }} onBlur={() => setFocused(null)}
                            onKeyDown={event => moveFocus(event, index)} onClick={() => onOpen?.(guild.id)} onContextMenu={event => onContext?.(guild, event)}>
                            <span className="sb-orbit"><span className="sb-server-icon">
                                <span className="sb-initials">{guild.name.split(/\s+/).slice(0, 3).map(word => Array.from(word)[0]).join("")}</span>
                                {guild.icon && /^[\w]+$/.test(guild.icon) && <ServerImage id={guild.id} icon={guild.icon} />}
                            </span></span>
                            <span className="sb-server-name">{guild.name}</span>
                            <span className="sb-server-status">{guild.current ? "You are here" : guild.folder || (guild.favorite ? "Favorite" : "Open server")}</span>
                            {guild.current && <span className="sb-active-mark"><Icon name="check" /></span>}
                        </button>
                        {settings.showUnread && (guild.mentions > 0 ? <span className="sb-mention">{guild.mentions > 99 ? "99+" : guild.mentions}</span> : guild.unread ? <span className="sb-unread-dot" /> : null)}
                        <IconButton label={`${guild.favorite ? "Unfavorite" : "Favorite"} ${guild.name}`} icon="star" className={`sb-pin${guild.favorite ? " sb-is-pinned" : ""}`} aria-pressed={guild.favorite} onClick={() => onFavorite?.(guild.id)} />
                    </div>
                </article>;
            })}
        </div>
    </div>;
}

function ServerImage({ id, icon }: { id: string; icon: string; }) {
    const [failed, setFailed] = useState(false);
    return failed ? null : <img className="sb-server-image" src={`https://cdn.discordapp.com/icons/${id}/${icon}.webp?size=128`} alt="" loading="lazy" decoding="async" draggable={false} onError={() => setFailed(true)} />;
}
