/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Server Bubbles contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { normalizeText,Preferences } from "./preferences";

export interface BubbleGuild {
    id: string;
    name: string;
    icon: string | null;
    folder: string;
    mentions: number;
    unread: boolean;
    current: boolean;
    favorite: boolean;
    order: number;
}

export function filterGuilds(guilds: BubbleGuild[], settings: Preferences, filter: string, query: string): BubbleGuild[] {
    const needle = normalizeText(query.trim());
    return guilds.filter(guild => {
        if (filter === "favorites" && !guild.favorite) return false;
        if (filter === "unread" && !guild.unread && !guild.mentions) return false;
        if (filter === "recent" && !settings.recent.includes(guild.id)) return false;
        const initials = guild.name.split(/\s+/).map(word => word[0] ?? "").join("");
        return !needle || normalizeText(`${guild.name} ${guild.folder} ${initials}`).includes(needle);
    }).sort((a, b) => {
        if (settings.favoritesFirst && a.favorite !== b.favorite) return Number(b.favorite) - Number(a.favorite);
        if (settings.sort === "name") return a.name.localeCompare(b.name);
        if (settings.sort === "unread") return b.mentions - a.mentions || Number(b.unread) - Number(a.unread) || a.order - b.order;
        if (settings.sort === "recent") {
            const rank = (id: string) => { const index = settings.recent.indexOf(id); return index < 0 ? Infinity : index; };
            return (rank(a.id) - rank(b.id)) || a.order - b.order;
        }
        return a.order - b.order;
    });
}
