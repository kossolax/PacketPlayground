// Map TCP connection states to tailwind color classes used in badges/chips.

export type TcpConnectionState =
  | 'ESTABLISHED'
  | 'FIN_WAIT_1'
  | 'FIN_WAIT_2'
  | 'TIME_WAIT'
  | 'CLOSE_WAIT'
  | 'LAST_ACK'
  | 'CLOSED';

export function stateColor(s: string): string {
  switch (s) {
    case 'ESTABLISHED':
      return 'bg-blue-100 border-blue-300';
    case 'FIN_WAIT_1':
    case 'LAST_ACK':
      return 'bg-yellow-100 border-yellow-300';
    case 'FIN_WAIT_2':
    case 'CLOSE_WAIT':
      return 'bg-orange-100 border-orange-300';
    case 'TIME_WAIT':
      return 'bg-purple-100 border-purple-300';
    case 'CLOSED':
      return 'bg-green-100 border-green-300';
    default:
      return 'bg-muted border-border';
  }
}
