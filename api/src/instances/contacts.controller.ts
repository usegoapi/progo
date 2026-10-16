import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { InstanceAccessGuard } from '../auth/instance-access.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { jidToPhone } from '../common/utils/jid';
import { BaileysService } from './baileys.service';

@Controller('instances/:instanceId/contacts')
@UseGuards(JwtAuthGuard, InstanceAccessGuard)
export class ContactsController {
  constructor(private readonly baileys: BaileysService) {}

  @Get('groups')
  async getGroups(@Param('instanceId') instanceId: string) {
    if (!this.baileys.getSocket(instanceId)) return { groups: [] };
    const groups = await this.baileys.getAllGroups(instanceId);
    return {
      groups: groups
        .map((g) => ({
          id: g.id,
          name: g.subject,
          participants: g.participants?.length ?? 0,
          creation: g.creation,
          owner: g.owner,
        }))
        .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')),
    };
  }

  @Get('groups/:groupId/participants')
  async getGroupParticipants(@Param('instanceId') instanceId: string, @Param('groupId') groupId: string) {
    if (!this.baileys.getSocket(instanceId) || !groupId.endsWith('@g.us')) return { participants: [] };
    const metadata = await this.baileys.getGroupMetadata(instanceId, groupId);
    return {
      groupName: metadata.subject,
      groupId: metadata.id,
      participants: metadata.participants.map((p: any) => {
        const pn = p.phoneNumber || (p.id?.endsWith('@s.whatsapp.net') ? p.id : null);
        return {
          id: p.id,
          phone: pn ? jidToPhone(pn) : '',
          admin: p.admin || null,
          name: this.baileys.getContactName(instanceId, pn || p.id),
        };
      }),
    };
  }

  @Get('all')
  getAllContacts(@Param('instanceId') instanceId: string, @Query('search') search?: string) {
    const term = search?.trim().toLowerCase();
    const contacts = this.baileys
      .getContacts(instanceId)
      .filter((c) => !term || c.phone.includes(term) || c.name?.toLowerCase().includes(term))
      .slice(0, 5_000);
    return { contacts };
  }
}
