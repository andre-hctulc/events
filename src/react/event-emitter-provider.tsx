"use client";

import { createContext, FC, ReactNode, useContext, useMemo } from "react";
import { EventMap } from "../types.js";
import type { EventEmitter, EventEmitterOptions } from "events";
import { EventEmitter as Emitter } from "../resolve.js";

const EventEmitterContext = createContext<EventEmitterContext | null>(null);

export interface EventEmitterContext<T extends EventMap<T> = any> {
    eventEmitter: EventEmitter<T>;
    emitterId: string | null;
    superEventEmitter: EventEmitterContext | null;
}

/**
 * @param emitterId ID of the emitter to use. If provided, the next emitter with this ID will be returned.
 */
export function useEventEmitter<T extends EventMap<T> = any>(emitterId?: string): EventEmitterContext<T> {
    const ctx = useContext(EventEmitterContext);
    const idBroker = useMemo<EventEmitterContext | null>(() => {
        if (!emitterId) return null;

        let currentCtx: EventEmitterContext | null = ctx;

        while (currentCtx) {
            if (currentCtx.emitterId === emitterId) {
                return currentCtx;
            }
            currentCtx = currentCtx.superEventEmitter;
        }

        return null;
    }, [ctx, emitterId]);

    if (emitterId) {
        if (!idBroker) {
            throw new Error(`Broker with ID "${emitterId}" not found`);
        }
        return idBroker as any;
    }

    if (!ctx) {
        throw new Error("`EventEmitterContext` not found");
    }

    return ctx as any;
}

interface EventEmitterProviderProps {
    children?: ReactNode;
    options?: EventEmitterOptions;
    eventEmitter?: EventEmitter;
    id?: string;
}

export const EventEmitterProvider: FC<EventEmitterProviderProps> = ({
    children,
    options,
    eventEmitter,
    id,
}: EventEmitterProviderProps) => {
    const emitter = useMemo(() => {
        if (eventEmitter) {
            return eventEmitter;
        }
        return new Emitter(options);
    }, [eventEmitter, options]);
    const superBrokerCtx = useContext(EventEmitterContext);
    return (
        <EventEmitterContext.Provider
            value={{
                eventEmitter: emitter,
                superEventEmitter: superBrokerCtx || null,
                emitterId: id ?? null,
            }}
        >
            {children}
        </EventEmitterContext.Provider>
    );
};
