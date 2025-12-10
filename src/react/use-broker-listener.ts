import { useEffect, useRef } from "react";
import { useBroker } from "./broker-provider.js";
import {
    GlobalBrokerListener,
    BrokerEventType,
    BrokerInterface,
    BrokerListener,
    ListenerOptions,
} from "../broker.js";

/**
 * @param brokerId Broker ID. If provided, the next broker with this ID will be returned.
 */
export function useBrokerListener<
    I extends BrokerInterface = BrokerInterface,
    T extends BrokerEventType<I> = BrokerEventType<I>
>(eventType: T, listener: BrokerListener<I, T>, options?: ListenerOptions & { brokerId?: string }) {
    const { broker } = useBroker(options?.brokerId);
    const listenerRef = useRef(listener);

    useEffect(() => {
        listenerRef.current = listener;
    }, [listener]);

    useEffect(() => {
        const l: BrokerListener = (...args: any) => {
            return listenerRef.current(...args);
        };
        broker.on(eventType, l, options);
        return () => {
            broker.off(eventType, l);
        };
    }, [eventType]);
}

/**
 * Listen to all events from the broker.
 * @param brokerId Broker ID. If provided, the next broker with this ID will be returned.
 */
export function useGlobalBrokerListener<I extends BrokerInterface = BrokerInterface>(
    globalListener: GlobalBrokerListener<I>,
    options?: ListenerOptions & { brokerId?: string }
) {
    const { broker } = useBroker(options?.brokerId);
    const listenerRef = useRef<(...args: any[]) => any>(globalListener);

    useEffect(() => {
        listenerRef.current = globalListener;
    }, [globalListener]);

    useEffect(() => {
        const l: GlobalBrokerListener = (...args) => {
            return listenerRef.current(...args);
        };
        broker.on(l, options);
        return () => {
            broker.off(l);
        };
    }, []);
}
