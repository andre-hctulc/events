"use client";

import { createContext, FC, useContext, useMemo } from "react";
import { Broker, BrokerConfig, BrokerInterface } from "../broker.js";

const BrokerContext = createContext<BrokerContext | null>(null);

export interface BrokerContext<I extends BrokerInterface = BrokerInterface> {
    broker: Broker<I>;
    id: string | null;
    superBroker: BrokerContext | null;
}

/**
 * @param brokerId Broker ID. If provided, the next broker with this ID will be returned.
 */
export function useBroker<I extends BrokerInterface = BrokerInterface>(brokerId?: string): BrokerContext<I> {
    const ctx = useContext(BrokerContext);
    const idBroker = useMemo<BrokerContext | null>(() => {
        if (!brokerId) return null;

        let currentCtx: BrokerContext | null = ctx;

        while (currentCtx) {
            if (currentCtx.id === brokerId) {
                return currentCtx;
            }
            currentCtx = currentCtx.superBroker;
        }

        return null;
    }, [ctx, brokerId]);

    if (brokerId) {
        if (!idBroker) {
            throw new Error(`Broker with ID "${brokerId}" not found`);
        }
        return idBroker as any;
    }

    if (!ctx) {
        throw new Error("`BrokerContext` not found");
    }

    return ctx as any;
}

interface BrokerProviderProps {
    children?: React.ReactNode;
    /**
     * Broker configuration.
     *
     * **This is a reactive property.** If the configuration changes, the broker will be recreated.
     */
    config?: BrokerConfig;
    /**
     * Broker ID. If provided, the broker will be created with this ID.
     */
    id?: string;
}

export const BrokerProvider: FC<BrokerProviderProps> = ({ children, config, id }: BrokerProviderProps) => {
    const broker = useMemo(() => {
        return new Broker(config);
    }, [config]);
    const superBrokerCtx = useContext(BrokerContext);
    return (
        <BrokerContext.Provider value={{ broker, superBroker: superBrokerCtx || null, id: id ?? null }}>
            {children}
        </BrokerContext.Provider>
    );
};
