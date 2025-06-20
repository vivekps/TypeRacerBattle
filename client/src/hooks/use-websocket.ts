import { useEffect, useRef, useState, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';
import { type WebSocketMessage } from '@shared/schema';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

export function useWebSocket() {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const socket = useRef<Socket | null>(null);
  const messageHandlers = useRef<Map<string, (data: any) => void>>(new Map());

  const connect = useCallback(() => {
    if (socket.current?.connected) {
      return;
    }

    setConnectionStatus('connecting');
    
    console.log('Attempting Socket.IO connection...');
    
    socket.current = io({
      transports: ['websocket', 'polling']
    });

    socket.current.on('connect', () => {
      console.log('Socket.IO connected successfully');
      setConnectionStatus('connected');
    });

    socket.current.on('disconnect', () => {
      console.log('Socket.IO disconnected');
      setConnectionStatus('disconnected');
    });

    socket.current.on('connect_error', (error) => {
      console.error('Socket.IO connection error:', error);
      setConnectionStatus('disconnected');
    });

    // Listen for all possible message types directly
    socket.current.on('message', (message: WebSocketMessage) => {
      try {
        console.log('Socket.IO RAW message received:', message);
        const handler = messageHandlers.current.get(message.type);
        if (handler) {
          console.log('Calling handler for:', message.type);
          handler(message.data);
        } else {
          console.warn('No handler for message type:', message.type);
        }
      } catch (error) {
        console.error('Failed to handle Socket.IO message:', error);
      }
    });

    // Also listen for specific event types in case the server is using different emission
    socket.current.on('race_update', (data: any) => {
      console.log('Direct race_update received:', data);
      const handler = messageHandlers.current.get('race_update');
      if (handler) handler(data);
    });

    socket.current.on('race_started', (data: any) => {
      console.log('Direct race_started received:', data);
      const handler = messageHandlers.current.get('race_started');
      if (handler) handler(data);
    });
  }, []);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (socket.current?.connected) {
      socket.current.emit('message', message);
    }
  }, []);

  const addMessageHandler = useCallback((type: string, handler: (data: any) => void) => {
    messageHandlers.current.set(type, handler);
  }, []);

  const removeMessageHandler = useCallback((type: string) => {
    messageHandlers.current.delete(type);
  }, []);

  const disconnect = useCallback(() => {
    if (socket.current) {
      socket.current.disconnect();
      socket.current = null;
    }
    setConnectionStatus('disconnected');
  }, []);

  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    connectionStatus,
    sendMessage,
    addMessageHandler,
    removeMessageHandler,
    connect,
    disconnect
  };
}
