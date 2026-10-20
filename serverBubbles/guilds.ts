/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Server Bubbles contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { GuildReadStateStore, GuildStore, SelectedGuildStore, SortedGuildStore, useStateFromStores } from "@webpack/common";

import type { BubbleGuild } from "./model";
import type { Preferences } from "./preferences";

export function useGuilds(settings: Preferences): BubbleGuild[] {
    return useStateFromStores([GuildStore, SortedGuildStore, GuildReadStateStore, SelectedGuildStore], () => {
        const order = new Map(SortedGuildStore.getFlattenedGuildIds().map((id, index) => [id, index]));
        const folders = new Map(SortedGuildStore.getGuildFolders().flatMap(folder => folder.guildIds.map(id => [id, folder.folderName ?? ""] as const)));
        const current = SelectedGuildStore.getGuildId();
        return Object.values(GuildStore.getGuilds()).map(guild => ({
            id: guild.id,
            name: guild.name,
            icon: guild.icon ?? null,
            folder: folders.get(guild.id) ?? "",
            mentions: GuildReadStateStore.getMentionCount(guild.id),
            unread: GuildReadStateStore.hasUnread(guild.id),
            current: guild.id === current,
            favorite: settings.favorites.includes(guild.id),
            order: order.get(guild.id) ?? order.size
        }));
    }, [settings.favorites]);
}
