import {ErrorCode, headers, MsgHdrs, NatsError, RequestOptions} from "nats"
import {TextDecoder, TextEncoder} from "util"
import zlib from 'zlib'

const TD = new TextDecoder()
const TE = new TextEncoder()

const COMPRESS_THRESHOLD = 1024

export const jsonMessageCodec = {
  encode(d: unknown, error: boolean, opts?: RequestOptions): [Uint8Array, RequestOptions?] {
    try {
      if (d === undefined) {
        d = null
      }

      const s = JSON.stringify(d, messageDateToStringReplacer)

      let hdrs: MsgHdrs | null = null
      let binary: Uint8Array

      if (s.length > COMPRESS_THRESHOLD) {
        hdrs = headers()
        hdrs.set("gzip", "true")
        binary = zlib.gzipSync(s, {
          level: zlib.constants.Z_DEFAULT_COMPRESSION
        })
      } else {
        binary = TE.encode(s)
      }

      if (error) {
        if (!hdrs) {
          hdrs = headers()
        }

        hdrs.set("error", "true")
      }

      if (hdrs) {
        return [binary, {
          ...(opts || {}),
          headers: hdrs
        } as any] // any b/c of the bug in the NATS types
      }

      return [binary, opts]
    } catch (err: any) {
      throw NatsError.errorForCode(ErrorCode.BadJson, err)
    }
  },

  decode(data: Uint8Array, headers?: MsgHdrs): unknown {
    try {
      const binary = headers?.has("gzip") ? zlib.gunzipSync(data) : data

      const string = TD.decode(binary)

      const r = JSON.parse(string, messageStringToDaterReviver)

      if (headers?.has("error")) {
        return new RemoteError(r.message)
      }

      return r
    } catch (err: any) {
      throw NatsError.errorForCode(ErrorCode.BadJson, err)
    }

  }
}

export class RemoteError extends Error {
  constructor(message: string) {
    super(message)
  }
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
