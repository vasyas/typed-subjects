import CallableInstance from "callable-instance"
import log from "loglevel"
import {NatsConnection} from "nats"
import {jsonMessageCodec} from "./jsonMessageCodec"
import {Middleware} from "./middleware"
import {assertErrorResponse, composeMiddleware, errorResponse, getObjectProps} from "./utils"
import {createWorkerQueue, QueueStats, removeWorkerQueue} from "./WorkerQueue"

/**
 * Base class for working with Subjects.
 * Subscribers have a configurable pool of workers.
 *
 * Subclasses have a more handy API.
 */
export class SubjectWithWorkers<MessageType, ResponseType = void> extends CallableInstance<
  [MessageType],
  Promise<ResponseType>
> {
  constructor(callableMethod = "requestSubject") {
    super(callableMethod)
  }

  async requestSubject(
    subject: string,
    message: MessageType,
    requestOptions: Partial<RequestOptions> = {}
  ): Promise<ResponseType> {
    if (!this.natsConnection) {
      throw new Error(`Subject ${subject} is not connected`)
    }

    const response = await this.natsConnection.request(
      subject,
      jsonMessageCodec.encode(message),
      requestOptions.timeout ? {timeout: requestOptions.timeout} : undefined
    )
    const responseData = jsonMessageCodec.decode(response.data)
    assertErrorResponse(responseData)
    return responseData as ResponseType
  }

  publishSubject(subject: string, message: MessageType) {
    if (!this.natsConnection) {
      throw new Error(`Subject ${subject} is not connected`)
    }

    this.natsConnection.publish(subject, jsonMessageCodec.encode(message))
  }

  subscribeSubject(
    subject: string,
    handle: (message: MessageType, ctx: Context) => Promise<ResponseType>,
    options: Partial<SubscriptionOptions> = {}
  ): Subscription {
    if (!this.natsConnection) {
      throw new Error(`Subject ${subject} is not connected`)
    }

    options = {
      ...defaultSubscriptionOptions,
      ...options,
    }

    const middleware = Array.isArray(options.middleware)
      ? composeMiddleware(...options.middleware)
      : options.middleware

    const subscription = this.natsConnection.subscribe(
      subject,
      options.queue ? {queue: options.queue} : undefined
    )

    const queue = createWorkerQueue({concurrency: options.concurrency})

    ;(async () => {
      for await (const m of subscription) {
        let data: MessageType

        try {
          data = jsonMessageCodec.decode(m.data) as any
        } catch (e) {
          log.error(`Cannot handle subject ${subject}, failed to parse data`, e)
          continue
        }

        // alternatively, we can await until queue size is lower then some value to apply backpressure to NATS
        queue.add(async () => {
          try {
            const context = {subject: m.subject}

            const invokeLocalMethod = (p = data) => handle(p, context)
            const r = await middleware(context, invokeLocalMethod, data)

            if (m.reply) {
              // awaiting reply
              m.respond(jsonMessageCodec.encode(r))
            }
          } catch (e) {
            log.error(`Cannot handle subject ${subject} with data ` + JSON.stringify(data), e)

            if (m.reply) {
              m.respond(jsonMessageCodec.encode(errorResponse(e)))
            }
          }
        })
      }
    })()

    return {
      async stop() {
        await subscription.drain()
        await removeWorkerQueue(queue)
      },
      monitor(opts) {
        if (opts.queue) {
          queue.setStatsListener((stats) => opts.queue(subject, stats))
        }
      },
    }
  }

  protected setNatsConnection(natsConnection: NatsConnection) {
    this.natsConnection = natsConnection
  }

  protected natsConnection: NatsConnection
}

export type Subscription = {
  stop(): Promise<void>
  monitor(opts: {queue: (name: string, size: QueueStats) => void})
}

export type Context = {
  subject: string
}

export type SubscriptionOptions = {
  concurrency: number
  middleware: Middleware | Middleware[]
  queue?: string
}

const defaultSubscriptionOptions: SubscriptionOptions = {
  concurrency: 1,
  middleware: (ctx, next, params) => next(params),
}

export function connectSubjects(root: Record<string, any>, natsConnection: NatsConnection) {
  const keys = getObjectProps(root)

  keys.forEach((key) => {
    const item = root[key]

    if (
      item &&
      (typeof item == "object" || typeof item == "function") &&
      "setNatsConnection" in item
    ) {
      item.setNatsConnection(natsConnection)
      return
    }

    if (item && typeof item == "object") {
      connectSubjects(item, natsConnection)
    }
  })
}

export type RequestOptions = {
  timeout: number
}
