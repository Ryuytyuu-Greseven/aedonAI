import { Injectable, OnDestroy } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AudioProcessorSetup,
  AudioProcessorStatus,
  ClientMessage,
  ServerMessage,
} from './audio-processor.types';

/**
 * Manages a single audio_processor WebSocket session (`/ws`). Instances are meant to
 * be provided at component level so each preview owns its own connection; the service
 * closes the socket on destroy. See websockets.md for the protocol.
 */
@Injectable()
export class AudioProcessorWsService implements OnDestroy {
  private socket: WebSocket | null = null;

  private readonly statusSubject = new Subject<AudioProcessorStatus>();
  private readonly userTextSubject = new Subject<string>();
  private readonly assistantTextSubject = new Subject<string>();
  private readonly audioChunkSubject = new Subject<string>();
  private readonly turnStartSubject = new Subject<void>();
  private readonly turnCompleteSubject = new Subject<void>();
  private readonly endCallSubject = new Subject<void>();
  private readonly interruptedSubject = new Subject<void>();
  private readonly errorSubject = new Subject<string>();

  /** Connection lifecycle. */
  readonly status$: Observable<AudioProcessorStatus> = this.statusSubject.asObservable();
  /** Transcript of what the user said/typed (server echo). */
  readonly userText$: Observable<string> = this.userTextSubject.asObservable();
  /** Assistant caption text chunks from `modelTurn`. */
  readonly assistantText$: Observable<string> = this.assistantTextSubject.asObservable();
  /** Base64 LINEAR16 24 kHz audio chunks from `modelTurn`. */
  readonly audioChunk$: Observable<string> = this.audioChunkSubject.asObservable();
  /** AI is about to respond. */
  readonly turnStart$: Observable<void> = this.turnStartSubject.asObservable();
  /** AI finished speaking normally. */
  readonly turnComplete$: Observable<void> = this.turnCompleteSubject.asObservable();
  /** Server signaled conversation/call termination. */
  readonly endCall$: Observable<void> = this.endCallSubject.asObservable();
  /** User barged in; stop playback immediately. */
  readonly interrupted$: Observable<void> = this.interruptedSubject.asObservable();
  /** Server-reported error. */
  readonly error$: Observable<string> = this.errorSubject.asObservable();

  get isOpen(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  /**
   * Open the WebSocket and send `setup` once the connection is established.
   * Any previously open socket is closed first.
   */
  connect(setup: AudioProcessorSetup): void {
    this.disconnect();
    this.statusSubject.next('connecting');

    const socket = new WebSocket(environment.wsUrl);
    this.socket = socket;

    socket.onopen = () => {
      this.statusSubject.next('open');
      this.send({ setup });
    };

    socket.onmessage = (event) => this.handleMessage(event);

    socket.onerror = () => {
      this.statusSubject.next('error');
      this.errorSubject.next('WebSocket connection error');
    };

    socket.onclose = () => {
      if (this.socket === socket) {
        this.socket = null;
      }
      this.statusSubject.next('closed');
    };
  }

  /** Stream a base64 LINEAR16 16 kHz mic chunk. */
  sendAudio(base64Pcm: string): void {
    this.send({ realtimeInput: { audio: { data: base64Pcm } } });
  }

  /** Send a text chat message (no mic required). */
  sendText(text: string): void {
    const trimmed = text.trim();
    if (!trimmed) return;
    this.send({ text: trimmed });
  }

  disconnect(): void {
    const socket = this.socket;
    if (!socket) return;
    this.socket = null;
    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
      socket.close();
    }
  }

  ngOnDestroy(): void {
    this.disconnect();
  }

  private send(message: ClientMessage): void {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify(message));
  }

  private handleMessage(event: MessageEvent): void {
    let msg: ServerMessage;
    try {
      msg = JSON.parse(event.data) as ServerMessage;
    } catch {
      return;
    }

    if (msg.error) {
      this.errorSubject.next(msg.error);
      return;
    }

    if (msg.userContent?.text) {
      this.userTextSubject.next(msg.userContent.text);
      return;
    }

    const sc = msg.serverContent;
    if (!sc) return;

    if (sc.turnStart) {
      this.turnStartSubject.next();
      return;
    }

    if (sc.interrupted) {
      this.interruptedSubject.next();
      return;
    }

    if (sc.turnComplete) {
      this.turnCompleteSubject.next();
      if (sc.endCall) {
        this.endCallSubject.next();
      }
      return;
    }

    if (sc.endCall) {
      this.endCallSubject.next();
      return;
    }

    if (sc.modelTurn?.parts) {
      for (const part of sc.modelTurn.parts) {
        if (part.inlineData?.data) {
          this.audioChunkSubject.next(part.inlineData.data);
        }
        if (part.text) {
          this.assistantTextSubject.next(part.text);
        }
      }
    }
  }
}
