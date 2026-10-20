import * as React from "react";
import * as ReactDOM from "react-dom";

export { React, ReactDOM };
export const { useState, useEffect, useRef, useMemo, useReducer, useCallback } = React;

export let revision = 0;
const listeners = new Set<() => void>();
export const components = new Set<React.ComponentType>();
export const modals = new Map<string, { render: (props: unknown) => React.ReactNode; options: { onCloseCallback?(): void; }; }>();
const notify = () => { ++revision; for (const listener of listeners) listener(); };
export const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
let serial = 0;

export const runtime = {
    routes: [] as string[],
    copied: "",
    toasts: [] as unknown[],
    errors: [] as unknown[],
    writes: [] as unknown[],
    failRead: false,
    holdReads: false,
    pendingReads: [] as (() => void)[],
    releaseReads() { this.holdReads = false; for (const resolve of this.pendingReads.splice(0)) resolve(); },
    preferences: () => ({})
};

export class Logger {
    constructor(..._args: unknown[]) { }
    error(...args: unknown[]) { runtime.errors.push(args); }
}

export async function get(key: string) {
    if (runtime.holdReads) await new Promise<void>(resolve => runtime.pendingReads.push(resolve));
    if (runtime.failRead) throw new Error("Storage unavailable");
    return JSON.parse(localStorage.getItem(key) ?? "null");
}
export async function set(key: string, value: unknown) {
    runtime.writes.push(value);
    localStorage.setItem(key, JSON.stringify(value));
}
export const copyToClipboard = async (value: string) => { runtime.copied = value; };
export const NavigationRouter = { transitionTo: (path: string) => { runtime.routes.push(path); } };
export const SelectedChannelStore = { getChannelId: () => "777" };
export const SelectedGuildStore = { getGuildId: () => "101" };
const names = ["Café Coders", "Night Owls", "Design Den", "Music Room", "The Workshop", "Friends", "Game Night", "Photography", "Study Hall", "Book Club", "Weekend Crew", "Garden Club"];
const guilds = Object.fromEntries(names.map((name, index) => [String(101 + index), { id: String(101 + index), name, icon: null }]));
export const GuildStore = { getGuilds: () => guilds };
export const SortedGuildStore = {
    getFlattenedGuildIds: () => Object.keys(guilds),
    getGuildFolders: () => [{ guildIds: ["101", "102"], folderName: "Creative" }]
};
export const GuildReadStateStore = { getMentionCount: (id: string) => id === "103" ? 3 : 0, hasUnread: (id: string) => id === "103" };
export function useStateFromStores(_stores: unknown[], compute: () => unknown) { return compute(); }
export const findCssClassesLazy = () => ({ guilds: "test-guilds", base: "test-base", sidebar: "test-sidebar" });
export const ServerListRenderPosition = { Above: 0 };
export const addServerListElement = (_position: unknown, component: React.ComponentType) => { components.add(component); notify(); };
export const removeServerListElement = (_position: unknown, component: React.ComponentType) => { components.delete(component); notify(); };
export const definePlugin = (value: unknown) => value;
export const showToast = (value: unknown) => { runtime.toasts.push(value); };

export function openModal(render: (props: unknown) => React.ReactNode, options = {}) {
    const key = String(++serial);
    modals.set(key, { render, options });
    notify();
    return key;
}
export function closeModal(key: string) {
    const modal = modals.get(key);
    modals.delete(key);
    modal?.options.onCloseCallback?.();
    notify();
}
export function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose(): void; }) {
    return <section role="dialog" aria-label={title} aria-modal="true" className="test-modal" onKeyDown={event => {
        if (event.key === "Escape" && !event.defaultPrevented) onClose();
    }}><h1>{title}</h1><button type="button" aria-label="Close modal" onClick={onClose}>Close</button>{children}</section>;
}
export class ErrorBoundary extends React.Component<React.PropsWithChildren, { error: boolean; }> {
    state = { error: false };
    static getDerivedStateFromError(error: unknown) { runtime.errors.push(error); return { error: true }; }
    static wrap(Component: React.ComponentType) { return () => <ErrorBoundary><Component /></ErrorBoundary>; }
    render() { return this.state.error ? <p role="alert">Render failed</p> : this.props.children; }
}

let contextKey: string | undefined;
export const ContextMenuApi = {
    closeContextMenu() { if (contextKey) closeModal(contextKey); contextKey = undefined; },
    openContextMenu(_event: unknown, render: () => React.ReactNode) { contextKey = openModal(render); }
};
export const Menu = {
    Menu: ({ children }: React.PropsWithChildren) => <div role="menu">{children}</div>,
    MenuItem: ({ label, action }: { label: string; action(): void; }) => <button role="menuitem" onClick={() => { action(); ContextMenuApi.closeContextMenu(); }}>{label}</button>
};
