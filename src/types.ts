import type { EventEmitterEventMap } from "events";

export type EventMap<T> = Record<keyof T, any[]>;

type IfEventMap<E extends EventMap<E>, True, False> = {} extends E ? False : True;

export type EventArgs<E extends EventMap<E>, EventName extends string | symbol> = IfEventMap<
    E,
    EventName extends keyof E
        ? E[EventName]
        : EventName extends keyof EventEmitterEventMap
          ? EventEmitterEventMap[EventName]
          : any[],
    any[]
>;

export type EventName<
    E extends EventMap<E>,
    N extends string | symbol = keyof E & (string | symbol),
> = IfEventMap<E, N | (keyof E & (string | symbol)) | keyof EventEmitterEventMap, string | symbol>;

export type AnyEventListener = (...args: any[]) => void;

export type EventListener<E extends EventMap<E>, EventName extends string | symbol> = IfEventMap<
    E,
    (...args: EventArgs<E, EventName>) => void,
    AnyEventListener
>;
