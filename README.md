This library provides high level abstractions over the NATS messaging system, allowing you to make type-safe synchronous
and asynchronous calls.

Typical use case is to use it in a microservices architecture for inter-service communication.

### Usage

```
import {connectSubjects, drainWorkerQueues} from "typed-subjects"
import {connect, NatsConnection} from "nats"

// Obtain connection to NATS
const natsConnection = await connect({})

// Define shape of used subjects (API between your components)
const subjects = {
    getPaymentStatus: new RemoteProcedure<{id: number}, {status: PaymentStatus}>("payments.getStatus")
    payments: new TypedSubject<PaymentUpdate>("payments.update"),
}

enum PaymentStatus = {OPEN, PAID, CANCELLED}
type PaymentUpdate = {id: number; status: PaymentStatus}

// Connect subjects to NATS
connectSubjects(subjects, natsConnection)

// Implement/subscribe subjects

subjects.payments.getPaymentStatus.implement(async ({id}) => {
    return {status: PaymentStatus.PAID}
}, {
  // concurrency: number; // Number of concurrent messages processed 
  // timeout?: number; // Max time to process the message
  // middleware: Middleware | Middleware[]; // Middleware to wrap the handler
  // queue?: string; // NATS queue name (used for horizontal scaling)
})

subjects.payments.payments.subscribe(async ({id, status}) => {
    console.log("Got payment update", {id, status})
})

// Call/publish
const {status} = await subjects.getPaymentStatus.request({id: 1})
subjects.payments.payments.publish({id: 1, status: PaymentStatus.PAID})

// At the end, call drainWorkerQueues to wait for all messages to be processed
await drainWorkerQueues()
```

### Main components

**TypedSubject**. Most basic component. Implements publish/subscribe pattern. Used to to publish messages of certain
type.

```
type PaymentUpdate = {id: number; status: PaymentStatus}
const paymentUpdate  = new TypedSubject<PaymentUpdate>("payments.update")
```

**FilteringSubject**. Subject that will allow filtering of data based on partial properties of transferred message.
Filter is defined by subject template. Implemented using NATS wildcards. Typical usage is to create subject for
particular data, ie listen to object updates by its ID.

```
type PaymentUpdate = {id: number; status: PaymentStatus}
const paymentUpdate  = new FilteringSubject<PaymentUpdate>("payments.update.$id")
```

**RemoteProcedure**. Synchronous remote procedure with single optional request object and single optional result object.
Implements NATS request/reply pattern.

```
const getPaymentStatus  = new RemoteProcedure<{id: number}, {status: PaymentStatus}>("payments.getStatus")
```

### Helper functions

**drainWorkerQueues**. Finish processing of all messages in the worker queues. This function is useful when you want to
wait for all messages to be processed before shutting down the application.