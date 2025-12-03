import { Broker, BrokerEventType, BrokerListenerArgs } from "../broker.js";
import { fromEventPattern, Observable } from "rxjs";

type InferInterface<B extends Broker> = B extends Broker<infer I> ? I : any;

export function observeBrokerEvent<
    B extends Broker,
    T extends BrokerEventType<InferInterface<B>>,
    R = BrokerListenerArgs<InferInterface<B>, T>
>(
    broker: B,
    eventType: T,
    resultSelector?: (...args: BrokerListenerArgs<InferInterface<B>, T>) => R
): Observable<R> {
    return fromEventPattern<R>(
        (handler) => broker.on(eventType, handler),
        (handler) => broker.off(eventType, handler),
        resultSelector
    );
}

export function observeAnyBrokerEvent<B extends Broker, R = BrokerListenerArgs<InferInterface<B>>>(
    broker: B,
    resultSelector?: (...args: BrokerListenerArgs<InferInterface<B>>) => R
): Observable<R> {
    return fromEventPattern<R>(
        (handler) => broker.on(null, handler),
        (handler) => broker.off(null, handler),
        resultSelector
    );
}
