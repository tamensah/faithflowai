import { EventEmitter } from 'events';

export type RealtimeEvent = {
  type: 'attendance.checked_in' | 'donation.created';
  data: Record<string, unknown>;
};

const emitter = new EventEmitter();

export function emitRealtimeEvent(event: RealtimeEvent) {
  emitter.emit('event', event);
}

export function subscribeRealtime(listener: (event: RealtimeEvent) => void) {
  emitter.on('event', listener);
  return () => emitter.off('event', listener);
}
