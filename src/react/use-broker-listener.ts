import React, { useEffect, useRef } from "react";
import { useBroker } from "./broker-provider.js";
import { BrokerEventType, BrokerInterface, BrokerListener } from "../broker.js";

export function useBrokerListener<
    I extends BrokerInterface = BrokerInterface,
    T extends BrokerEventType<I> = BrokerEventType<I>
>(eventType: T, listener: BrokerListener<I, T>) {
    const { broker } = useBroker();
    const listenerRef = useRef(listener);

    React.useEffect(() => {
        listenerRef.current = listener;
    }, [listener]);

    useEffect(() => {
        const l: BrokerListener = (...args: any) => {
            return listenerRef.current(...args);
        };
        broker.listen(eventType, l);
        return () => {
            broker.removeListener(eventType, l);
        };
    }, []);
}
