import React, { useEffect, useRef } from "react";
import { useBroker } from "./broker-provider.js";
import { BrokerInterface, BrokerListener } from "../broker.js";

export function useGlobalBrokerListener<I extends BrokerInterface = BrokerInterface>(
    listener: BrokerListener<I>
) {
    const { broker } = useBroker();
    const listenerRef = useRef(listener);

    React.useEffect(() => {
        listenerRef.current = listener;
    }, [listener]);

    useEffect(() => {
        const l: BrokerListener = (...args: any) => {
            return listenerRef.current(...args);
        };
        broker.listenGlobal(l);
        return () => {
            broker.removeListener(l);
        };
    }, []);
}
