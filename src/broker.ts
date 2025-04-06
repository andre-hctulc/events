import { BrokerEvent } from "./broker-event.js";
/**
 * A broker listener signature.
 * Either a function or an array of arguments.
 */
export type BrokerListenerSignature = ((...args: any) => any) | [...any];

/**
 * A broker interface.
 * Maps event types to listener signatures.
 */
export type BrokerInterface = Record<string, BrokerListenerSignature>;

// NOTE Some interfaces or types may not conform to the broker interface, this type is used to map such interfaces to broker interfaces.
/**
 * Maps an interface to a string index signature suitable as broker interface.
 */
export type BI<I> = I extends object
    ? { [K in string & keyof I]: I[K] extends BrokerListenerSignature ? I[K] : BrokerListenerSignature }
    : BrokerInterface;

export type BrokerEventType<E extends BrokerInterface = BrokerInterface> = string & keyof E;

export type BrokerListener<
    I extends BrokerInterface = BrokerInterface,
    T extends BrokerEventType<I> = BrokerEventType<I>
> = I[T] extends (...args: any) => any
    ? I[T]
    : I[T] extends [...any]
    ? (...args: I[T]) => any
    : (...args: any) => any;

export type BrokerListenerArgs<
    I extends BrokerInterface = BrokerInterface,
    T extends BrokerEventType<I> = BrokerEventType<I>
> = Parameters<BrokerListener<I, T>>;

export type ReadOnlyBroker<E extends BrokerInterface = BrokerInterface> = Pick<
    Broker<E>,
    "listen" | "listenGlobal" | "removeListener"
>;

export interface ListenerOptions {
    /**
     * @default 50
     */
    urgency?: number;
}

export interface BrokerConfig {
    /**
     * If true, the event type will be automatically set on the event object.
     * @default true
     */
    autoEventTypes: boolean;
}

/**
 * @template I Broker interface
 */
export class Broker<I extends BrokerInterface = BrokerInterface> {
    #listeners = new Map<string, Map<Function, { options: ListenerOptions; listener: Function }>>();
    #anyListeners = new Map<
        Function,
        {
            filter: ((e: BrokerEventType<I>) => boolean) | undefined;
            options: ListenerOptions;
            listener: Function;
        }
    >();
    #pipe = new Set<Broker<I>>();
    #consume = new Map<Broker<I>, BrokerListener<I, BrokerEventType<I>>>();
    #config: BrokerConfig = { autoEventTypes: true };

    constructor(config?: Partial<BrokerConfig>) {
        this.#config = { ...this.#config, ...config };
    }

    /**
     * Listen to an event.
     */
    listen<T extends BrokerEventType<I>>(
        eventType: T,
        listener: BrokerListener<I, T>,
        options: ListenerOptions = {}
    ): BrokerListener<I, T> {
        if (this.#listeners.has(eventType))
            this.#listeners.get(eventType)?.set(listener, { options, listener });
        else this.#listeners.set(eventType, new Map([[listener, { options, listener }]]));
        return listener;
    }

    /**
     * Listen to all events.
     */
    listenGlobal(
        listener: BrokerListener<I, BrokerEventType<I>>,
        options: ListenerOptions & { filter?: (e: BrokerEventType<I>) => boolean } = {}
    ): BrokerListener<I, BrokerEventType<I>> {
        this.#anyListeners.set(listener, { listener, filter: options.filter, options });
        return listener;
    }

    /**
     * Removes a listener.
     */
    removeListener<T extends BrokerEventType<I> = BrokerEventType<I>>(
        ...args:
            | [eventType: T, listener: BrokerListener<I, T>]
            | [listener: BrokerListener<I, BrokerEventType<I>>]
    ): void {
        if (typeof args[0] === "function") {
            this.#anyListeners.delete(args[0]);
        } else {
            this.#listeners.get(args[0])?.delete(args[1]!);
        }
    }

    /**
     * Dispatches an event.
     */
    dispatch<T extends BrokerEventType<I>>(
        eventType: T,
        ...args: BrokerListenerArgs<I, T>
    ): BrokerListenerArgs<I, T> {
        if (this.#config.autoEventTypes) {
            args.forEach((arg) => {
                if (arg instanceof BrokerEvent && !arg.type) {
                    arg._setType(eventType);
                }
            });
        }

        // ## notify any listeners

        const anyListeners = Array.from(this.#anyListeners.values());

        anyListeners
            .sort(({ options: o1 }, { options: o2 }) => {
                return (o2.urgency ?? 50) - (o1.urgency ?? 50);
            })
            .forEach(({ listener, filter }) => {
                if (filter && !filter(eventType)) return;
                listener(eventType, ...args);
            });

        // ## notify listeners

        const listeners = Array.from(this.#listeners.get(eventType)?.values() || []);

        listeners
            .sort(({ options: o1 }, { options: o2 }) => {
                return (o1.urgency || 50) - (o2.urgency || 50);
            })
            .forEach(({ listener }) => {
                listener(...args);
            });

        // ## pipe
        this.#pipe.forEach((handler) => {
            handler.dispatch(eventType, ...args);
        });

        return args;
    }

    /**
     * Dispatches an event and awaits all listeners.
     */
    async dispatchAsync<T extends BrokerEventType<I>>(
        eventType: T,
        ...args: BrokerListenerArgs<I, T>
    ): Promise<BrokerListenerArgs<I, T>> {
        if (this.#config.autoEventTypes) {
            args.forEach((arg) => {
                if (arg instanceof BrokerEvent && !arg.type) {
                    arg._setType(eventType);
                }
            });
        }

        // ##notify any listeners
        await Promise.all(
            Array.from(this.#anyListeners).map(([_, anyListener]) => {
                if (anyListener.filter && !anyListener.filter(eventType)) return;
                return anyListener.listener(eventType, ...args);
            })
        );

        // ## notify listeners
        await Promise.all(
            Array.from(this.#listeners.get(eventType) || []).map(([, listener]) => {
                return listener.listener(...args);
            })
        );

        // ## pipe
        await Promise.all(
            Array.from(this.#pipe).map((handler) => {
                return handler.dispatch(eventType, ...args);
            })
        );

        return args;
    }

    /**
     * Pipes events to another broker.
     */
    pipeTo(handler: Broker<I>): void {
        this.#pipe.add(handler);
    }

    /**
     * Un-pipes events from another broker.
     */
    unpipe(handler: Broker<I>): void {
        this.#pipe.delete(handler);
    }

    /**
     * Consumes events from another broker.
     */
    consume(handler: Broker<I>): void {
        const listener = handler.listenGlobal(((e: any, ...args: any) => this.dispatch(e, ...args)) as any);
        this.#consume.set(handler, listener);
    }

    /**
     * Ends consumption of events from another broker.
     */
    endConsume(handler: Broker<I>): void {
        this.#consume.delete(handler);
    }

    /**
     * Unpipe and end consumptions.
     */
    removeAllListeners(): void {
        this.#anyListeners.clear();
        this.#listeners.clear();
        this.#consume.clear();
        this.#pipe.clear();
    }

    /**
     * Creates a read-only proxy of the broker.
     */
    readOnly(): ReadOnlyBroker<I> {
        return {
            listenGlobal: (listener: any) => {
                return this.listenGlobal(listener);
            },
            listen: (eventType: string, listener: Function) => {
                return this.listen(eventType as any, listener as any);
            },
            removeListener: (...args: any) => {
                return (this.removeListener as any)(...args);
            },
        };
    }
}
