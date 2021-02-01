import {Context, SubjectWithWorkers, Subscription, SubscriptionOptions} from "./SubjectWithWorkers"

/**
 * Remote procedure with single request object and single result object.
 * Both request and response are optional.
 * Implement NATS request/reply pattern
 */
export class RemoteProcedure<RequestType = void, ResponseType = void> extends SubjectWithWorkers<
  RequestType,
  ResponseType
> {
  constructor(private subject: string) {
    super("request")
  }

  implement(
    handle: (message: RequestType, ctx: Context) => Promise<ResponseType>,
    options: Partial<SubscriptionOptions> = {}
  ): Subscription {
    return super.subscribeSubject(this.subject, handle, options)
  }

  request(message: RequestType): Promise<ResponseType> {
    return super.requestSubject(this.subject, message)
  }
}
