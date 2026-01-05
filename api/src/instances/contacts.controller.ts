import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BaileysService } from './baileys.service';

@Controller('instances/:instanceId/contacts')
@UseGuards(JwtAuthGuard)
export class ContactsController {
  constructor(private baileys: BaileysService) {}

  @Get('groups')
  async getGroups(@Param('instanceId') instanceId: string) {
    const socket = this.baileys.getSocket(instanceId);
    if (!socket) return { groups: [] };
    
    try {
      const groups = await socket.groupFetchAllParticipating();
      const groupList = Object.values(groups).map((g: any) => ({
        id: g.id,
        name: g.subject,
        participants: g.participants?.length || 0,
        creation: g.creation,
        owner: g.owner,
      }));
      return { groups: groupList };
    } catch (e) {
      return { groups: [] };
    }
  }

  @Get('groups/:groupId/participants')
  async getGroupParticipants(@Param('instanceId') instanceId: string, @Param('groupId') groupId: string) {
    const socket = this.baileys.getSocket(instanceId);
    if (!socket) return { participants: [] };
    
    try {
      const metadata = await socket.groupMetadata(groupId);
      const participants = metadata.participants.map((p: any) => ({
        id: p.id,
        phone: p.id.split('@')[0],
        admin: p.admin || null,
      }));
      return { 
        groupName: metadata.subject,
        groupId: metadata.id,
        participants 
      };
    } catch (e) {
      return { participants: [] };
    }
  }

  @Get('all')
  async getAllContacts(@Param('instanceId') instanceId: string) {
    const socket = this.baileys.getSocket(instanceId);
    if (!socket) return { contacts: [] };
    
    try {
      const store = socket.store;
      if (!store?.contacts) return { contacts: [] };
      
      const contacts = Object.values(store.contacts)
        .filter((c: any) => c.id && !c.id.endsWith('@g.us') && !c.id.endsWith('@broadcast'))
        .map((c: any) => ({
          id: c.id,
          phone: c.id.split('@')[0],
          name: c.name || c.notify || c.verifiedName || null,
        }));
      return { contacts };
    } catch (e) {
      return { contacts: [] };
    }
  }
}
