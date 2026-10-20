/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Server Bubbles contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { copyToClipboard } from "@utils/clipboard";
import { ContextMenuApi, Menu, NavigationRouter, SelectedChannelStore, useRef, useState } from "@webpack/common";

import { appearance, appearanceData } from "./appearance";
import { Icon, IconButton } from "./components";
import { useGuilds } from "./guilds";
import { filterGuilds } from "./model";
import { Stage } from "./Stage";
import { getPreferences, toggleFavorite, updatePreferences, usePreferences } from "./state";

export function Field({ onClose, onStudio }: { onClose(): void; onStudio(): void; }) {
    const settings = usePreferences();
    const guilds = useGuilds(settings);
    const [query, setQuery] = useState("");
    const [filter, setFilter] = useState(settings.defaultFilter);
    const [overview, setOverview] = useState(settings.overview);
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState("");
    const search = useRef<HTMLInputElement>(null);
    const visible = filterGuilds(guilds, settings, filter, query);
    function navigate(id: string) {
        try {
            if (id === "@me") NavigationRouter.transitionTo("/channels/@me");
            else {
                const channel = SelectedChannelStore.getChannelId(id);
                NavigationRouter.transitionTo(`/channels/${id}${channel && /^\d+$/.test(channel) ? `/${channel}` : ""}`);
                updatePreferences({ recent: [id, ...getPreferences().recent.filter(value => value !== id)].slice(0, 20) });
            }
            onClose();
        } catch {
            setError("Could not open this server. The normal server list is still available.");
        }
    }
    return <div id="sb-overlay" className="sb-is-open" style={appearance(settings)} {...appearanceData(settings)}
        onKeyDown={event => {
            if (event.key === "Escape" && searching) {
                event.preventDefault();
                event.stopPropagation();
                setSearching(false);
                setQuery("");
            } else if (event.key === "/" && !(event.target instanceof HTMLInputElement)) {
                event.preventDefault();
                setSearching(true);
                requestAnimationFrame(() => search.current?.focus());
            }
        }}>
        <section className="sb-universe" aria-label="Your floating server bubbles">
            <Stage guilds={visible} settings={settings} overview={overview} onOpen={navigate} onFavorite={toggleFavorite}
                onContext={(guild, event) => {
                    event.preventDefault();
                    ContextMenuApi.openContextMenu(event, () => <Menu.Menu navId="server-bubbles" onClose={ContextMenuApi.closeContextMenu}>
                        <Menu.MenuItem id="sb-open" label="Open server" action={() => navigate(guild.id)} />
                        <Menu.MenuItem id="sb-favorite" label={guild.favorite ? "Remove from favorites" : "Add to favorites"} action={() => toggleFavorite(guild.id)} />
                        <Menu.MenuItem id="sb-copy" label="Copy server ID" action={() => { void copyToClipboard(guild.id).catch(() => setError("Could not copy the server ID.")); }} />
                    </Menu.Menu>);
                }} />
            <div className="sb-corner-controls">
                <IconButton label="Find a server" icon="search" className="sb-glass-control" onClick={() => { setSearching(true); requestAnimationFrame(() => search.current?.focus()); }} />
                <IconButton label="Direct messages" icon="home" className="sb-glass-control" onClick={() => navigate("@me")} />
                <IconButton label="See all bubbles" icon="grid" className="sb-glass-control sb-overview" aria-pressed={overview} onClick={() => setOverview(value => !value)} />
                <IconButton label="Customize bubbles" icon="more" className="sb-glass-control" onClick={onStudio} />
            </div>
            <IconButton label="Close server bubbles" icon="close" className="sb-glass-control sb-close" onClick={onClose} />
            {searching && <form role="search" className="sb-search-island" onSubmit={event => { event.preventDefault(); if (visible.length === 1) navigate(visible[0].id); }}>
                <Icon name="search" />
                <input ref={search} className="sb-search" type="search" aria-label="Search servers" placeholder="Find your space…" value={query} onChange={event => setQuery(event.target.value)} />
                <IconButton label="Close search" icon="close" className="sb-search-close" onClick={() => { setSearching(false); setQuery(""); }} />
            </form>}
            <div className="sb-vencord-filters" aria-label="Filter servers">
                {[["all", "All"], ["favorites", "Favorites"], ["unread", "Unread"], ["recent", "Recent"]].map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}
                <button type="button" onClick={() => { NavigationRouter.transitionTo("/guild-discovery"); onClose(); }}>Discover</button>
            </div>
            <span className="sb-sr-only" role="status" aria-live="polite">{visible.length} servers</span>
            {!visible.length && <p className="sb-vencord-empty">{query ? "No servers match your search." : "No servers in this view."}</p>}
            {error && <p className="sb-error" role="alert">{error}</p>}
            {settings.showHints && <div className="sb-explore-hint" aria-hidden="true">Hover to enlarge · / to search · arrow keys to explore · Esc to close</div>}
        </section>
    </div>;
}
