/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Server Bubbles contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { ButtonHTMLAttributes, ReactNode } from "react";

import { ICONS } from "./defaults";

export type IconName = keyof typeof ICONS;

export function Icon({ name }: { name: IconName; }) {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={ICONS[name]} />
    </svg>;
}

export function IconButton({ label, icon, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; icon: IconName; children?: ReactNode; }) {
    return <button type="button" aria-label={label} title={label} {...props}><Icon name={icon} />{children}</button>;
}

export function Atmosphere() {
    return <div className="sb-atmosphere" aria-hidden="true">
        {Array.from({ length: 7 }, (_, index) => <i key={index} className="sb-bokeh" style={{ "--i": index } as React.CSSProperties} />)}
        <div className="sb-caustics" />
    </div>;
}
