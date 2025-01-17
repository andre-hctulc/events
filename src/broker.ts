export type BrokerInterface = Record<string, [...any] | ((...args: any) => any)>;

export type BrokerEventType<E extends BrokerInterface = BrokerInterface> = string & keyof E;

export type BrokerListener<
    E extends BrokerInterface = BrokerInterface,
    T extends BrokerEventType<E> = BrokerEventType<E>
> = E[T] extends (...args: any) => any
    ? E[T]
    : E[T] extends [...any]
    ? (...args: E[T]) => any
    : (...args: any) => any;

export type BrokerListenerArgs<
    E extends BrokerInterface = BrokerInterface,
    T extends BrokerEventType<E> = BrokerEventType<E>
> = Parameters<BrokerListener<E, T>>;

export type BrokerListenerResult<
    E extends BrokerInterface = BrokerInterface,
    T extends BrokerEventType<E> = BrokerEventType<E>
> = ReturnType<BrokerListener<E, T>>;

export type ReadOnlyBroker<E extends BrokerInterface = BrokerInterface> = Pick<
    Broker<E>,
    "listen" | "listenGlobal" | "removeListener"
>;

/**
 * @template I Broker interface. Maps event types to listener signatures (event args or function signature).
 */
export class Broker<I extends BrokerInterface = BrokerInterface> {
    #listeners = new Map<string, Set<Function>>();
    #anyListeners = new Map<
        Function,
        { filter: ((e: BrokerEventType<I>) => boolean) | undefined; listener: Function }
    >();
    #pipe = new Set<Broker<I>>();
    #consume = new Map<Broker<I>, BrokerListener<I, BrokerEventType<I>>>();

    constructor() {}

    listen<T extends BrokerEventType<I>>(eventType: T, listener: BrokerListener<I, T>) {
        if (this.#listeners.has(eventType)) this.#listeners.get(eventType)?.add(listener);
        else this.#listeners.set(eventType, new Set([listener]));
        return listener;
    }

    listenGlobal(
        listener: BrokerListener<I, BrokerEventType<I>>,
        filter?: (e: BrokerEventType<I>) => boolean
    ) {
        this.#anyListeners.set(listener, { listener, filter });
        return listener;
    }

    removeListener<T extends BrokerEventType<I> = BrokerEventType<I>>(
        ...args:
            | [eventType: T, listener: BrokerListener<I, T>]
            | [listener: BrokerListener<I, BrokerEventType<I>>]
    ) {
        if (typeof args[0] === "function") {
            this.#anyListeners.delete(args[0]);
        } else {
            this.#listeners.get(args[0])?.delete(args[1]!);
        }
    }

    dispatch<T extends BrokerEventType<I>>(eventType: T, ...args: BrokerListenerArgs<I, T>) {
        // notify listeners
        const listeners = this.#listeners.get(eventType);
        listeners?.forEach((listener) => listener(...args));

        // notify any listeners
        this.#anyListeners.forEach((anyListener) => {
            if (anyListener.filter && !anyListener.filter(eventType)) return;
            anyListener.listener(eventType, ...args);
        });

        // pipe
        this.#pipe.forEach((handler) => {
            handler.dispatch(eventType, ...args);
        });
    }

    pipeTo(handler: Broker<I>) {
        this.#pipe.add(handler);
    }

    unpipe(handler: Broker<I>) {
        this.#pipe.delete(handler);
    }

    consume(handler: Broker<I>) {
        const listener = handler.listenGlobal(((e: any, ...args: any) => this.dispatch(e, ...args)) as any);
        this.#consume.set(handler, listener);
    }

    endConsume(handler: Broker<I>) {
        this.#consume.delete(handler);
    }

    /**
     * Unpipe and end consumptions.
     */
    removeAllListeners() {
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
