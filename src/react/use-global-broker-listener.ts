import { useEffect, useRef } from "react";
import { useBroker } from "./broker-provider.js";
import { BrokerInterface, BrokerListener } from "../broker.js";

/**
 * @param brokerId Broker ID. If provided, the next broker with this ID will be returned.
 */
export function useGlobalBrokerListener<I extends BrokerInterface = BrokerInterface>(
    listener: BrokerListener<I>,
    brokerId?: string
) {
    const { broker } = useBroker(brokerId);
    const listenerRef = useRef(listener);

    useEffect(() => {
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
