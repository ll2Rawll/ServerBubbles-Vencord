import * as React from "react";
import { createRoot } from "react-dom/client";
import plugin from "../serverBubbles";
import "../serverBubbles/style.css";
import { getPreferences } from "../serverBubbles/state";
import { closeModal, components, modals, revision, runtime, subscribe } from "./mocks";

runtime.preferences = getPreferences;

function TestRoot() {
    React.useSyncExternalStore(subscribe, () => revision);
    const Settings = plugin.settingsAboutComponent;
    return <>
        <nav className="test-guilds" aria-label="Normal server list">{Array.from(components, (Component, index) => <Component key={index} />)}</nav>
        <div id="settings"><Settings /></div>
        {Array.from(modals, ([key, modal]) => <React.Fragment key={key}>{modal.render({ transitionState: 1, onClose: () => closeModal(key) })}</React.Fragment>)}
    </>;
}

Object.assign(window, { plugin, testRuntime: runtime });
// TestRoot must render after the mock exports have initialized.
queueMicrotask(() => {
    createRoot(document.getElementById("app-mount")!).render(<TestRoot />);
    plugin.start();
});
