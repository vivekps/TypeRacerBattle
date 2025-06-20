import { useEffect, useRef, useState, useCallback } from 'react';
import { type WebSocketMessage } from '@shared/schema';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

export function useWebSocket() {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const ws = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const messageHandlers = useRef<Map<string, (data: any) => void>>(new Map());

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setConnectionStatus('connecting');
    
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    try {
      ws.current = new WebSocket(wsUrl);
    } catch (error) {
      console.error('WebSocket connection error:', error);
      setConnectionStatus('disconnected');
      return;
    }

    ws.current.onopen = () => {
      setConnectionStatus('connected');
      reconnectAttempts.current = 0;
    };

    ws.current.onclose = (event) => {
      setConnectionStatus('disconnected');
      
      // Attempt to reconnect if it wasn't a manual close
      if (!event.wasClean && reconnectAttempts.current < maxReconnectAttempts) {
        setConnectionStatus('reconnecting');
        reconnectAttempts.current++;
        setTimeout(connect, 2000 * reconnectAttempts.current);
      }
    };

    ws.current.onerror = () => {
      setConnectionStatus('disconnected');
    };

    ws.current.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        const handler = messageHandlers.current.get(message.type);
        if (handler) {
          handler(message.data);
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };
  }, []);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    }
  }, []);

  const addMessageHandler = useCallback((type: string, handler: (data: any) => void) => {
    messageHandlers.current.set(type, handler);
  }, []);

  const removeMessageHandler = useCallback((type: string) => {
    messageHandlers.current.delete(type);
  }, []);

  const disconnect = useCallback(() => {
    if (ws.current) {
      ws.current.close();
      ws.current = null;
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
