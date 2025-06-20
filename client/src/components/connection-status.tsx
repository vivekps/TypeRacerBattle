import { useWebSocket, type ConnectionStatus } from '@/hooks/use-websocket';
import { Wifi, WifiOff, AlertTriangle } from 'lucide-react';

export function ConnectionStatus() {
  const { connectionStatus } = useWebSocket();

  const getStatusConfig = (status: ConnectionStatus) => {
    switch (status) {
      case 'connected':
        return {
          icon: Wifi,
          text: 'Connected',
          className: 'bg-green-500 text-white'
        };
      case 'connecting':
        return {
          icon: AlertTriangle,
          text: 'Connecting...',
          className: 'bg-yellow-500 text-white'
        };
      case 'reconnecting':
        return {
          icon: AlertTriangle,
          text: 'Reconnecting...',
          className: 'bg-orange-500 text-white'
        };
      case 'disconnected':
        return {
          icon: WifiOff,
          text: 'Disconnected',
          className: 'bg-red-500 text-white'
        };
    }
  };

  const config = getStatusConfig(connectionStatus);
  const Icon = config.icon;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className={`px-4 py-2 rounded-lg shadow-lg flex items-center space-x-2 ${config.className}`}>
        <Icon className="w-4 h-4" />
        <span className="text-sm font-medium">{config.text}</span>
      </div>
    </div>
  );
}
