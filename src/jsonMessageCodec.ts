import {Codec, ErrorCode} from "nats"
import {NatsError} from "nats/lib/nats-base-client/error"
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
    } catch (err) {
      throw NatsError.errorForCode(ErrorCode.BAD_JSON, err)
    }
  },

  decode(a: Uint8Array): unknown {
    try {
      return JSON.parse(TD.decode(a), messageStringToDaterReviver)
    } catch (err) {
      throw NatsError.errorForCode(ErrorCode.BAD_JSON, err)
    }
  },
}

function format(d) {
  const s = d.toISOString()
  return s.substring(0, s.lastIndexOf(".")) + "Z"
}

function messageDateToStringReplacer(this, key, value) {
  if (value instanceof Date) {
    return format(value)
  }

  return value
}

function messageStringToDaterReviver(this, key, val) {
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
