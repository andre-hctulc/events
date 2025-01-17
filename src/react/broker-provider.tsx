import { createContext, FC, useContext, useMemo } from "react";
import { Broker, BrokerConfig, BrokerInterface } from "../broker.js";

const Context = createContext<BrokerContext | null>(null);

export interface BrokerContext<I extends BrokerInterface = BrokerInterface> {
    broker: Broker<I>;
}

export function useBroker<I extends BrokerInterface = BrokerInterface>(): BrokerContext<I> {
    const ctx = useContext(Context);
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
}

export const BrokerProvider: FC<BrokerProviderProps> = ({ children, config }: BrokerProviderProps) => {
    const broker = useMemo(() => {
        return new Broker(config);
    }, [config]);
    return <Context.Provider value={{ broker }}>{children}</Context.Provider>;
};
