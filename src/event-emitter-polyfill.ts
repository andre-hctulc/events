import type { EventEmitter, EventEmitterOptions } from "events";
import { AnyEventListener, EventArgs, EventListener, EventMap, EventName } from "./types.js";

const captureRejectionSymbol = Symbol.for("nodejs.rejection");

interface OnceWrapper extends AnyEventListener {
    listener: AnyEventListener;
}

export class EventEmitterPolyfill<T extends EventMap<T> = any> implements EventEmitter<T> {
    #options: EventEmitterOptions;

    constructor(options?: EventEmitterOptions) {
        this.#options = options || {};
    }

    static defaultMaxListeners = 10;

    #listeners = new Map<string | symbol, AnyEventListener[]>();
    #maxListeners = EventEmitterPolyfill.defaultMaxListeners;

    addListener<E extends string | symbol>(eventName: EventName<T, E>, listener: EventListener<T, E>): this {
        return this.on(eventName, listener as AnyEventListener);
    }

    on<E extends string | symbol>(eventName: EventName<T, E>, listener: EventListener<T, E>): this {
        const key = eventName as string | symbol;
        if (!this.#listeners.has(key)) {
            this.#listeners.set(key, []);
        }
        this.#emitInternal("newListener", key, listener as AnyEventListener);
        this.#listeners.get(key)!.push(listener as AnyEventListener);
        this.#warnIfMaxListenersExceeded(key);
        return this;
    }

    once<E extends string | symbol>(eventName: EventName<T, E>, listener: EventListener<T, E>): this {
        const key = eventName as string | symbol;
        const wrapper: OnceWrapper = (...args: any[]) => {
            this.#removeRaw(key, wrapper);
            (listener as AnyEventListener).apply(this, args);
        };
        wrapper.listener = listener as AnyEventListener;
        return this.on(eventName, wrapper as unknown as EventListener<T, E>);
    }

    prependListener<E extends string | symbol>(
        eventName: EventName<T, E>,
        listener: EventListener<T, E>,
    ): this {
        const key = eventName as string | symbol;
        if (!this.#listeners.has(key)) {
            this.#listeners.set(key, []);
        }
        this.#emitInternal("newListener", key, listener as AnyEventListener);
        this.#listeners.get(key)!.unshift(listener as AnyEventListener);
        this.#warnIfMaxListenersExceeded(key);
        return this;
    }

    prependOnceListener<E extends string | symbol>(
        eventName: EventName<T, E>,
        listener: EventListener<T, E>,
    ): this {
        const key = eventName as string | symbol;
        const wrapper: OnceWrapper = (...args: any[]) => {
            this.#removeRaw(key, wrapper);
            (listener as AnyEventListener).apply(this, args);
        };
        wrapper.listener = listener as AnyEventListener;
        return this.prependListener(eventName, wrapper as unknown as EventListener<T, E>);
    }

    removeListener<E extends string | symbol>(
        eventName: EventName<T, E>,
        listener: EventListener<T, E>,
    ): this {
        const key = eventName as string | symbol;
        const removed = this.#removeRaw(key, listener as AnyEventListener);
        if (removed) {
            this.#emitInternal("removeListener", key, listener as AnyEventListener);
        }
        return this;
    }

    off<E extends string | symbol>(eventName: EventName<T, E>, listener: EventListener<T, E>): this {
        return this.removeListener(eventName, listener);
    }

    removeAllListeners<E extends string | symbol>(eventName?: EventName<T, E>): this {
        if (eventName !== undefined) {
            const key = eventName as string | symbol;
            const listeners = this.#listeners.get(key);
            if (listeners) {
                for (const listener of [...listeners]) {
                    this.#removeRaw(key, listener);
                    this.#emitInternal("removeListener", key, listener);
                }
            }
        } else {
            for (const event of [...this.#listeners.keys()]) {
                this.removeAllListeners(event as EventName<T, E>);
            }
        }
        return this;
    }

    emit<E extends string | symbol>(eventName: EventName<T, E>, ...args: EventArgs<T, E>): boolean {
        const key = eventName as string | symbol;
        const listeners = this.#listeners.get(key);
        if (!listeners || listeners.length === 0) return false;
        for (const listener of [...listeners]) {
            if (this.#options.captureRejections) {
                const result = listener.apply(this, args) as unknown;
                if (result instanceof Promise) {
                    result.catch((err: unknown) => {
                        const rejection = (this as any)[captureRejectionSymbol];
                        if (typeof rejection === "function") {
                            rejection.call(this, err, key, ...args);
                        } else {
                            this.#emitInternal("error", err);
                        }
                    });
                }
            } else {
                listener.apply(this, args);
            }
        }
        return true;
    }

    eventNames(): (string | symbol)[] {
        return [...this.#listeners.keys()].filter((k) => {
            const list = this.#listeners.get(k);
            return list && list.length > 0;
        });
    }

    getMaxListeners(): number {
        return this.#maxListeners;
    }

    setMaxListeners(n: number): this {
        this.#maxListeners = n;
        return this;
    }

    listenerCount<E extends string | symbol>(
        eventName: EventName<T, E>,
        listener?: EventListener<T, E>,
    ): number {
        const listeners = this.#listeners.get(eventName as string | symbol);
        if (!listeners) return 0;
        if (!listener) return listeners.length;
        const fn = listener as AnyEventListener;
        return listeners.filter((l) => l === fn || (l as OnceWrapper).listener === fn).length;
    }

    listeners<E extends string | symbol>(eventName: EventName<T, E>): EventListener<T, E>[] {
        const raw = this.#listeners.get(eventName as string | symbol) ?? [];
        return raw.map((l) => (l as OnceWrapper).listener ?? l) as EventListener<T, E>[];
    }

    rawListeners<E extends string | symbol>(eventName: EventName<T, E>): EventListener<T, E>[] {
        return [...(this.#listeners.get(eventName as string | symbol) ?? [])] as EventListener<T, E>[];
    }

    // Internal helpers — bypass the typed public API to avoid circular emit typing
    #warnIfMaxListenersExceeded(eventName: string | symbol): void {
        const max = this.#maxListeners;
        if (max === 0) return; // 0 = unlimited
        const count = this.#listeners.get(eventName)?.length ?? 0;
        if (count > max) {
            const name = this.constructor.name;
            const msg =
                `Possible EventEmitter memory leak detected. ${count} ${String(eventName)} listeners added to [${name}]. ` +
                `MaxListeners: ${max}. Use emitter.setMaxListeners() to increase limit`;
            if (typeof process !== "undefined" && typeof process.emitWarning === "function") {
                process.emitWarning(msg, { type: "MaxListenersExceededWarning" });
            } else {
                console.warn(`MaxListenersExceededWarning: ${msg}`);
            }
        }
    }

    #removeRaw(key: string | symbol, listener: AnyEventListener): boolean {
        const listeners = this.#listeners.get(key);
        if (!listeners) return false;
        const idx = listeners.findIndex((l) => l === listener || (l as OnceWrapper).listener === listener);
        if (idx !== -1) {
            listeners.splice(idx, 1);
            return true;
        }
        return false;
    }

    #emitInternal(eventName: string | symbol, ...args: any[]): void {
        const listeners = this.#listeners.get(eventName);
        if (!listeners) return;
        for (const listener of [...listeners]) {
            listener.apply(this, args);
        }
    }
}
