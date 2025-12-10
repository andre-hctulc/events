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

export type BrokerEventType<I extends BrokerInterface = BrokerInterface> = string & keyof I;

export type BrokerListener<
    I extends BrokerInterface = BrokerInterface,
    T extends BrokerEventType<I> = BrokerEventType<I>
> = I[T] extends (...args: any) => any
    ? I[T]
    : I[T] extends [...any]
    ? (...args: I[T]) => any
    : (...args: any) => any;

export type GlobalBrokerListener<I extends BrokerInterface = BrokerInterface> = <
    T extends BrokerEventType<I>
>(
    eventType: T,
    ...args: I[T] extends (...args: any) => any ? Parameters<I[T]> : I[T] extends [...any] ? I[T] : any[]
) => any;

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
     * Listen to all events.
     */
    on(globalListener: GlobalBrokerListener<I>, options?: ListenerOptions): GlobalBrokerListener<I>;

    /**
     * Listen to an event.
     */
    on<T extends BrokerEventType<I>>(
        eventType: T,
        listener: BrokerListener<I, T>,
        options?: ListenerOptions
    ): BrokerListener<I, T>;

    on<T extends BrokerEventType<I>>(
        eventTypeOrListener: T | GlobalBrokerListener<I>,
        listenerOrOptions?: BrokerListener<I, T> | ListenerOptions,
        options?: ListenerOptions
    ): BrokerListener<I, T> | GlobalBrokerListener<I> {
        // Handle the case where first parameter is a function (listening to all events)
        if (typeof eventTypeOrListener === "function") {
            const listener = eventTypeOrListener as GlobalBrokerListener<I>;
            const opts = (listenerOrOptions as ListenerOptions) || {};
            this.#anyListeners.set(listener, { options: opts, listener });
            return listener;
        }

        // Handle the case where first parameter is an event type (listening to specific event)
        const eventType = eventTypeOrListener as T;
        const listener = listenerOrOptions as BrokerListener<I, T>;
        const opts = options || {};

        if (this.#listeners.has(eventType))
            this.#listeners.get(eventType)?.set(listener, { options: opts, listener });
        else this.#listeners.set(eventType, new Map([[listener, { options: opts, listener }]]));

        return listener;
    }

    /**
     * Remove a global listener.
     */
    off(globalListener: GlobalBrokerListener<I>): void;

    /**
     * Remove a listener.
     */
    off<T extends BrokerEventType<I> = BrokerEventType<I>>(
        eventType: T,
        listener: BrokerListener<I, T>
    ): void;

    off<T extends BrokerEventType<I> = BrokerEventType<I>>(
        eventTypeOrListener: T | GlobalBrokerListener<I>,
        listener?: BrokerListener<I, T>
    ): void {
        // Handle the case where first parameter is a function (removing all-event listener)
        if (typeof eventTypeOrListener === "function") {
            this.#anyListeners.delete(eventTypeOrListener as GlobalBrokerListener<I>);
            return;
        }

        // Handle the case where first parameter is an event type
        if (listener) {
            this.#listeners.get(eventTypeOrListener as T)?.delete(listener);
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
        const listener = handler.on(((e: any, ...args: any) => this.dispatch(e, ...args)) as any);
        this.#consume.set(handler, listener as any);
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
        const ro: any = {};
        Object.defineProperty(ro, "on", {
            value: this.on.bind(this),
            writable: false,
            enumerable: true,
            configurable: false,
        });
        Object.defineProperty(ro, "off", {
            value: this.off.bind(this),
            writable: false,
            enumerable: true,
            configurable: false,
        });
        return ro;
    }

    has(eventType: BrokerEventType<I>, listener?: BrokerListener<I, BrokerEventType<I>>): boolean {
        if (listener) {
            return this.#listeners.get(eventType)?.has(listener) ?? false;
        } else {
            return (this.#listeners.get(eventType)?.size ?? 0) > 0;
        }
    }
}
