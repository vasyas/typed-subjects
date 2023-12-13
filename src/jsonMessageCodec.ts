import {Codec, ErrorCode, NatsError} from "nats"
import {TextDecoder, TextEncoder} from "util"

const TD = new TextDecoder()
const TE = new TextEncoder()

export const jsonMessageCodec: Codec<unknown> = {
  encode(d: unknown): Uint8Array {
    try {
      if (d === undefined) {
        d = null
      }
      return TE.encode(JSON.stringify(d, messageDateToStringReplacer))
    } catch (err: any) {
      throw NatsError.errorForCode(ErrorCode.BadJson, err)
    }
  },

  decode(a: Uint8Array): unknown {
    try {
      return JSON.parse(TD.decode(a), messageStringToDaterReviver)
    } catch (err: any) {
      throw NatsError.errorForCode(ErrorCode.BadJson, err)
    }
  },
}

function format(d: Date) {
  const s = d.toISOString()
  return s.substring(0, s.lastIndexOf(".")) + "Z"
}

function messageDateToStringReplacer(this: unknown, key: string, value: unknown) {
  if (value instanceof Date) {
    return format(value)
  }

  return value
}

function messageStringToDaterReviver(this: unknown, key: string, val: unknown) {
  if (typeof val == "string") {
    if (ISO8601_secs.test(val)) {
      return new Date(val)
    }

    if (ISO8601.test(val)) {
      return new Date(val)
    }

    if (ISO8601_date.test(val)) {
      return new Date(val)
    }
  }

  return val
}

const ISO8601 = /^\d\d\d\d-\d\d-\d\dT\d\d:\d\d:\d\d.\d\d\dZ$/
const ISO8601_secs = /^\d\d\d\d-\d\d-\d\dT\d\d:\d\d:\d\dZ$/
const ISO8601_date = /^\d\d\d\d-\d\d-\d\d$/
