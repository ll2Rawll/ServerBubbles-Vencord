/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Server Bubbles contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { addServerListElement, removeServerListElement, ServerListRenderPosition } from "@api/ServerList";
import ErrorBoundary from "@components/ErrorBoundary";
import { Logger } from "@utils/Logger";
import definePlugin from "@utils/types";
import { closeModal, Modal, openModal, showToast } from "@webpack/common";

import { Field } from "./Field";
import { Launcher } from "./Launcher";
import { flushPreferences, isEnabled, loadPreferences, setEnabled, useEnabled } from "./state";
import { Studio } from "./Studio";
import style from "./style.css?managed";

const logger = new Logger("ServerBubbles");
let generation = 0;
let fieldKey: string | undefined;
let studioKey: string | undefined;

function closeField(): void {
    const key = fieldKey;
    fieldKey = undefined;
    if (key) closeModal(key);
}

function closeStudio(): void {
    const key = studioKey;
    studioKey = undefined;
    if (key) closeModal(key);
}

function openField(): void {
    if (!isEnabled()) return;
    closeStudio();
    if (fieldKey) return;
    const key = openModal(props => <Modal {...props} title="Server Bubbles" size="xxl">
        <ErrorBoundary><Field onClose={props.onClose} onStudio={openStudio} /></ErrorBoundary>
    </Modal>, { onCloseCallback: () => { if (fieldKey === key) fieldKey = undefined; } });
    fieldKey = key;
}

function openStudio(): void {
    if (!isEnabled()) return;
    closeField();
    if (studioKey) return;
    const key = openModal(props => <Modal {...props} title="Customize Server Bubbles" size="xxl">
        <ErrorBoundary><Studio onExplore={openField} /></ErrorBoundary>
    </Modal>, { onCloseCallback: () => { if (studioKey === key) studioKey = undefined; } });
    studioKey = key;
}

function toggleField(): void {
    if (fieldKey) closeField();
    else openField();
}

const renderLauncher = ErrorBoundary.wrap(() => <Launcher onToggle={toggleField} />, { noop: true });

export default definePlugin({
    name: "ServerBubbles",
    description: "Explore your servers as floating bubbles, with search, favorites and a live customization studio.",
    authors: [{ name: "2Raw", id: 0n }],
    tags: ["Servers", "Appearance", "Shortcuts"],
    dependencies: ["ServerListAPI"],
    managedStyle: style,

    start() {
        const run = ++generation;
        addServerListElement(ServerListRenderPosition.Above, renderLauncher);
        void loadPreferences(() => run === generation).then(loaded => {
            if (loaded && run === generation) setEnabled(true);
        }).catch(error => {
            if (run !== generation) return;
            logger.error("Could not load preferences", error);
            showToast({ text: "Server Bubbles could not load its settings. Try disabling and enabling it again.", variant: "critical" });
        });
    },

    stop() {
        ++generation;
        setEnabled(false);
        removeServerListElement(ServerListRenderPosition.Above, renderLauncher);
        closeField();
        closeStudio();
        flushPreferences();
    },

    settingsAboutComponent() {
        const enabled = useEnabled();
        return <div>
            <p>Open the studio to change the look, motion and controls.</p>
            <button type="button" className="sb-settings-button" disabled={!enabled} onClick={openStudio}>Customize bubbles</button>
            <button type="button" className="sb-settings-button" disabled={!enabled} onClick={openField}>Open my servers</button>
        </div>;
    },

    toolboxActions: {
        "Open server bubbles": openField,
        "Customize server bubbles": openStudio
    }
});
