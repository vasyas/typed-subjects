import CallableInstance from "callable-instance"
import log from "loglevel"
import {Msg, NatsConnection, NatsError} from "nats"
import {jsonMessageCodec, RemoteError} from "./jsonMessageCodec"
import {Middleware} from "./middleware"
import {composeMiddleware, getObjectProps} from "./utils"
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

    const started = Date.now()
    const step = (requestOptions.noResponderTimeout ?? 0) / 10

    let response: Msg | undefined

    // retry until responder is available
    while (true) {
      try {
        response = await this.natsConnection.request(
          subject,
          ...jsonMessageCodec.encode(
            message,
            false,
            requestOptions.timeout ? {timeout: requestOptions.timeout} : undefined
          )
        )

        break
      } catch (e: any) {
        if (e.name == "NatsError" && e.code === "503") {
          if (Date.now() - started > (requestOptions.noResponderTimeout || 0)) {
            throw e
          }

          // wait for a while before retrying
          await new Promise((r) => setTimeout(r, step))
        } else {
          throw e
        }
      }
    }

    const responseData = jsonMessageCodec.decode(response.data, response.headers)

    if (responseData instanceof RemoteError) {
      throw responseData
    }

    return responseData as ResponseType
  }

  publishSubject(subject: string, message: MessageType) {
    if (!this.natsConnection) {
      throw new Error(`Subject ${subject} is not connected`)
    }

    this.natsConnection.publish(subject, ...jsonMessageCodec.encode(message, false))
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
          data = jsonMessageCodec.decode(m.data, m.headers) as any
        } catch (e) {
          log.error(`Cannot handle subject ${subject}, failed to parse data`, e)
          continue
        }

        // alternatively, we can await until queue size is lower then some value to apply backpressure to NATS
        queue
          .add(
            async () => {
              try {
                const context = {subject: m.subject}

                const invokeLocalMethod = (p = data) => handle(p, context)
                const r = middleware
                  ? await middleware(context, invokeLocalMethod, data)
                  : await invokeLocalMethod()

                if (m.reply) {
                  // awaiting reply
                  m.respond(...jsonMessageCodec.encode(r, false))
                }
              } catch (e: any) {
                // need to log error to save stack trace
                log.error(`Cannot handle subject ${subject} with data ${JSON.stringify(data)}`, e)

                if (m.reply) {
                  m.respond(...jsonMessageCodec.encode({message: e.message}, true))
                }
              }
            },
            options.timeout ? {timeout: options.timeout, throwOnTimeout: true} : undefined
          )
          .catch((e) => {
            log.error(`Failing to handle subject ${subject} with data ${JSON.stringify(data)}`, e)
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

  protected natsConnection: NatsConnection | undefined = undefined

  isConnected() {
    return !!this.natsConnection
  }
}

export type Subscription = {
  stop(): Promise<void>
  monitor(opts: {queue: (name: string, size: QueueStats) => void}): void
}

export type Context = {
  subject: string
}

export type SubscriptionOptions = {
  concurrency: number
  timeout?: number
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
  noResponderTimeout: number
}
