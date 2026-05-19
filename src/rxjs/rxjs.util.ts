import type { EventEmitter } from "events";
import { fromEventPattern, Observable } from "rxjs";
import { EventArgs, EventMap, EventName } from "../types.js";

export function observeEvent<T extends EventMap<T>, R = any>(
    eventEmitter: EventEmitter<T>,
    eventName: EventName<T>,
    resultSelector?: (...args: EventArgs<T, typeof eventName>) => R,
): Observable<R> {
    return fromEventPattern<R>(
        (handler) => eventEmitter.on(eventName, handler),
        (handler) => eventEmitter.off(eventName, handler),
        resultSelector,
    );
}