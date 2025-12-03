# events

Simple events handler.

## Basic Usage

```ts
import { Broker, BrokerEvent } from "@dre44/events";

interface Events {
    "message:in": (message: object) => void;
    "message:out": (message: BrokerEvent<object>) => void;
    // or
    // "message:in": [message: object]
    // "message:out": [messageEvent: BrokerEvent<object>]
}

const broker = new Broker<Events>();

// listen
const inListener = broker.on("message:in", (itemId) => {
    console.log("Item", itemId, "deleted");
});
const outListener = broker.on("item:create", (itemId) => {
    console.log("Item", itemId, "deleted");
});

// dispatch
broker.dispatch("message:in", "ITEM_ID");
broker.dispatch("message:out", new BrokerEvent("ITEM_ID"));

// off
broker.off("message:in", inListener);
broker.off("message:out", outListener);
```

## Use With

-   **react** (`@dre44/events/react`)
-   **rsjx** (`@dre44/events/rxjs`)
