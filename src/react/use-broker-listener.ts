import { useEffect, useRef } from "react";
import { useBroker } from "./broker-provider.js";
import { BrokerEventType, BrokerInterface, BrokerListener } from "../broker.js";

/**
 * @param brokerId Broker ID. If provided, the next broker with this ID will be returned.
 */
export function useBrokerListener<
    I extends BrokerInterface = BrokerInterface,
    T extends BrokerEventType<I> = BrokerEventType<I>
>(eventType: T, listener: BrokerListener<I, T>, brokerId?: string) {
    const { broker } = useBroker(brokerId);
    const listenerRef = useRef(listener);

    useEffect(() => {
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
    }, [eventType]);
}
