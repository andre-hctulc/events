# events

Simple events handler.

## Exports

-   `Broker`
-   `BrokerEvent`
-   `BI` - Transforms any interface to a broker interface

## Basic Usage

```ts
interface Events {
    "item:delete": (itemId: string) => void;
}

const broker = new Broker<Events>();

const listener = broker.on("item:delete", (itemId) => {
    console.log("Item", itemId, "deleted");
});

broker.dispatch("item:delete", "ITEM_ID");

broker.off("item:delete", listener);
```
