import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(EventsGateway.name);

  afterInit() {
    this.logger.log('Events WebSocket Gateway initialized.');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe:camera')
  handleSubscribeCamera(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { cameraId: string },
  ) {
    if (data?.cameraId) {
      const room = `camera:${data.cameraId}`;
      client.join(room);
      this.logger.log(`Client ${client.id} joined room ${room}`);
      return { event: 'subscribed', data: { cameraId: data.cameraId } };
    }
  }

  @SubscribeMessage('unsubscribe:camera')
  handleUnsubscribeCamera(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { cameraId: string },
  ) {
    if (data?.cameraId) {
      const room = `camera:${data.cameraId}`;
      client.leave(room);
      this.logger.log(`Client ${client.id} left room ${room}`);
      return { event: 'unsubscribed', data: { cameraId: data.cameraId } };
    }
  }

  broadcastCameraStatus(
    cameraId: string,
    status: string,
    lastSeenAt?: string | Date | null,
  ) {
    const payload = {
      cameraId,
      status,
      lastSeenAt: lastSeenAt
        ? new Date(lastSeenAt).toISOString()
        : new Date().toISOString(),
    };

    if (this.server) {
      // Broadcast to specific room for detailed camera page
      this.server.to(`camera:${cameraId}`).emit('camera:status', payload);
      // Also broadcast globally so dashboard list view updates immediately
      this.server.emit('camera:status', payload);
    }
  }

  broadcastCameraEvent(
    cameraId: string,
    type: string,
    payload: unknown,
    createdAt?: string | Date,
  ) {
    const eventData = {
      cameraId,
      type,
      payload,
      createdAt: createdAt
        ? new Date(createdAt).toISOString()
        : new Date().toISOString(),
    };

    if (this.server) {
      this.server.to(`camera:${cameraId}`).emit('camera:event', eventData);
      this.server.emit('camera:event', eventData);
    }
  }
}
