import { db } from '../infrastructure/db';
import { ConnectionProtocol, ControlProtocolTemplate } from '../domain/types';

export class ProtocolService {
  // Connection Protocols
  getConnectionProtocols(): ConnectionProtocol[] {
    return db.getConnectionProtocols();
  }

  saveConnectionProtocol(data: Partial<ConnectionProtocol>): ConnectionProtocol {
    const id = data.id || `conn-${Date.now().toString(36)}`;
    const protocol: ConnectionProtocol = {
      id,
      name: data.name || '新建连接协议',
      type: data.type || 'MODBUS_TCP',
      port: data.port || 502,
      baudRate: data.baudRate,
      dataBits: data.dataBits,
      parity: data.parity,
      stopBits: data.stopBits,
      timeout: data.timeout || 2000,
      retryCount: data.retryCount || 3,
      createdAt: data.createdAt || new Date().toISOString()
    };
    return db.saveConnectionProtocol(protocol);
  }

  deleteConnectionProtocol(id: string): boolean {
    return db.deleteConnectionProtocol(id);
  }

  // Control Protocol Templates
  getControlTemplates(): ControlProtocolTemplate[] {
    return db.getControlTemplates();
  }

  getControlTemplateById(id: string): ControlProtocolTemplate | undefined {
    return db.getControlTemplateById(id);
  }

  saveControlTemplate(data: Partial<ControlProtocolTemplate>): ControlProtocolTemplate {
    const id = data.id || `tpl-${Date.now().toString(36)}`;
    const template: ControlProtocolTemplate = {
      id,
      name: data.name || '新建控制协议模板',
      description: data.description || '',
      points: data.points || [],
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    return db.saveControlTemplate(template);
  }

  deleteControlTemplate(id: string): boolean {
    return db.deleteControlTemplate(id);
  }
}

export const protocolService = new ProtocolService();
