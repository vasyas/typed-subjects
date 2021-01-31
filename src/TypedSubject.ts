import {SubjectWithWorkers, Subscription, SubscriptionOptions} from "./SubjectWithWorkers"

export class TypedSubject<MessageType, ResponseType = never> extends SubjectWithWorkers<
  MessageType,
  ResponseType
> {
  constructor(private subject: string) {
    super("request")
  }

  publish(message: MessageType) {
    super.publishSubject(this.subject, message)
  }

  subscribe(
    handle: (message: MessageType, subject: string) => Promise<ResponseType>,
    options: Partial<SubscriptionOptions> = {}
  ): Subscription {
    return super.subscribeSubject(this.subject, handle, options)
  }

  request(message: MessageType): Promise<ResponseType> {
    return super.requestSubject(this.subject, message)
  }
}
