import { invalidDirectionError, invalidEnvelopeError, invalidSequenceError, malformedValueError, unsupportedVersionError } from './errors'
import { parseClientCommand } from './parse-client-command'
import { parseHostEvent } from './parse-host-event'
import { err, ok, ProtocolResult } from './result'
import { PROTOCOL_VERSION, SequenceMetadata, WireEnvelope } from './types'
import { isNonNegativeInteger, isNonNegativeNumber, isRecord, isString } from './validation'

export const parseSequenceMetadata = (
  value: unknown,
  path: string = 'envelope'
): ProtocolResult<SequenceMetadata> => {
  if (!isRecord(value)) return err(invalidEnvelopeError('Expected envelope object.', path))
  if (!isNonNegativeInteger(value.version)) return err(malformedValueError(`${path}.version`, 'Expected numeric protocol version.'))
  if (value.version !== PROTOCOL_VERSION) return err(unsupportedVersionError(value.version))
  if (!isNonNegativeInteger(value.seq)) return err(invalidSequenceError('seq', isNonNegativeNumber(value.seq) ? value.seq : -1))
  if (!isNonNegativeNumber(value.sentAtMs)) return err(invalidSequenceError('sentAtMs', isNonNegativeNumber(value.sentAtMs) ? value.sentAtMs : -1))
  return ok({ version: PROTOCOL_VERSION, seq: value.seq, sentAtMs: value.sentAtMs })
}

export const parseWireEnvelope = (
  value: unknown,
  path: string = 'envelope'
): ProtocolResult<WireEnvelope> => {
  if (!isRecord(value)) return err(invalidEnvelopeError('Expected envelope object.', path))
  const metadataResult = parseSequenceMetadata(value, path)
  if (!metadataResult.ok) return metadataResult
  if (!isString(value.direction)) return err(malformedValueError(`${path}.direction`, 'Expected wire direction string.'))
  if (value.direction === 'client-to-host') {
    const commandResult = parseClientCommand(value.command, `${path}.command`)
    if (!commandResult.ok) return commandResult
    return ok({ ...metadataResult.value, direction: value.direction, command: commandResult.value })
  }
  if (value.direction === 'host-to-client') {
    const eventResult = parseHostEvent(value.event, `${path}.event`)
    if (!eventResult.ok) return eventResult
    return ok({ ...metadataResult.value, direction: value.direction, event: eventResult.value })
  }
  return err(invalidDirectionError(value.direction))
}
