import {NatsConnection} from "nats"

export function createNatsMock() {
  let subscribeSubject: string
  let publishSubject: string

  const connection: NatsConnection = {
    msgQueue: [],

    subscribe(s: string) {
      subscribeSubject = s

      const asyncIterator = () => ({
        next: () => {
          if (this.msgQueue.length) {
            return Promise.resolve({
              value: {data: this.msgQueue.shift(), subject: publishSubject},
              done: false,
            })
          } else {
            return Promise.resolve({
              done: true,
            })
          }
        },
      })

      return {
        [Symbol.asyncIterator]: asyncIterator,
      }
    },

    async publish(s: string, data: any) {
      publishSubject = s
      this.msgQueue.push(data)
    },

    async request(args: any, data: any) {

    }
  } as any

  return {
    connection,
    subscribeSubject: () => subscribeSubject,
    publishSubject: () => publishSubject,
  }
}