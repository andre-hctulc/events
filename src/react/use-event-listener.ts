import { useEffect, useRef } from "react";
import { useEventEmitter } from "./event-emitter-provider.js";
import { EventListener, EventMap, EventName } from "../types.js";

interface UseBrokerListenerOptions {
    /**
     * ID of the emitter to use. If not provided, the nearest emitter will be used.
     */
    emitterId?: string;
}

export function useEventListener<T extends EventMap<T>, N extends EventName<T>>(
    eventName: N,
    listener: EventListener<T, N>,
    { emitterId }: UseBrokerListenerOptions = {},
) {
    const { eventEmitter: broker } = useEventEmitter(emitterId);
    const listenerRef = useRef(listener);

    useEffect(() => {
        listenerRef.current = listener;
    }, [listener]);

    useEffect(() => {
        const l = (...args: any) => {
            return listenerRef.current(...args);
        };
        broker.on(eventName, l);
        return () => {
            broker.off(eventName, l);
        };
    }, [eventName]);
}
