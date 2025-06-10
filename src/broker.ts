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

export type ReadOnlyBroker<E extends BrokerInterface = BrokerInterface> = Pick<Broker<E>, "on" | "off">;

export interface ListenerOptions {
    /**
     * @default 50
     */
    urgency?: number;
    once?: boolean;
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
    on<T extends BrokerEventType<I>>(
        eventType: T | null,
        listener: BrokerListener<I, T>,
        options: ListenerOptions = {}
    ): BrokerListener<I, T> {
        if (eventType === null) {
            this.#anyListeners.set(listener, { options, listener });
        } else {
            if (this.#listeners.has(eventType))
                this.#listeners.get(eventType)?.set(listener, { options, listener });
            else this.#listeners.set(eventType, new Map([[listener, { options, listener }]]));
        }
        return listener;
    }

    /**
     * Removes a listener.
     * @param eventType The event type to remove the listener from. If null, removes it as a global listener.
     */
    off<T extends BrokerEventType<I> = BrokerEventType<I>>(
        eventType: T | null,
        listener: BrokerListener<I, T>
    ): void {
        if (eventType === null) {
            this.#anyListeners.delete(listener);
        } else {
            this.#listeners.get(eventType)?.delete(listener);
        }
    }

    #sortListeners(
        listeners: Map<Function, { options: ListenerOptions; listener: Function }> | undefined
    ): { options: ListenerOptions; listener: Function }[] {
        return Array.from(listeners?.values() || []).sort(({ options: o1 }, { options: o2 }) => {
            return (o2.urgency ?? 50) - (o1.urgency ?? 50);
        });
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

        const anyListeners = this.#sortListeners(this.#anyListeners);

        anyListeners.forEach(({ listener, options }) => {
            listener(eventType, ...args);
            if (options.once) {
                this.#anyListeners.delete(listener);
            }
        });

        // ## notify listeners

        const listeners = this.#sortListeners(this.#listeners.get(eventType));

        listeners.forEach(({ listener, options }) => {
            listener(...args);
            if (options.once) {
                this.#listeners.get(eventType)?.delete(listener);
            }
        });

        // ## pipe
        this.#pipe.forEach((handler) => {
            handler.dispatch(eventType, ...args);
        });

        return args;
    }

    /**
     * Dispatches an event and awaits all listeners successively.
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

        const anyListeners = this.#sortListeners(this.#anyListeners);

        for (const { listener, options } of anyListeners) {
            if (options.once) {
                this.#anyListeners.delete(listener);
            }
            await listener(eventType, ...args);
        }

        // ## notify listeners

        const listeners = this.#sortListeners(this.#listeners.get(eventType));

        for (const { listener, options } of listeners) {
            if (options.once) {
                this.#listeners.get(eventType)?.delete(listener);
            }
            await listener(...args);
        }

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
        const listener = handler.on(null, ((e: any, ...args: any) => this.dispatch(e, ...args)) as any);
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
    clear(): void {
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
            on: (eventType: any, listener: any) => {
                return this.on(eventType, listener);
            },
            off: (eventType: any, listener: any) => {
                return this.off(eventType, listener);
            },
        };
    }
}
