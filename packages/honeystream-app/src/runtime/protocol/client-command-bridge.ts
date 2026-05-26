import { ClientCommand, ProtocolResult, parseClientCommand } from '../../protocol'

export const validateClientCommandForRuntimeDispatch = (
  value: unknown,
  path: string = 'command'
): ProtocolResult<ClientCommand> => parseClientCommand(value, path)
