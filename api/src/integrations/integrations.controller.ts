import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, Request, HttpException, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IntegrationsService } from './integrations.service';
import { CreateTypebotDto, CreateN8nDto, CreateChatwootDto, UpdateIntegrationDto } from './dto/integration.dto';
import axios from 'axios';

@Controller('integrations')
@UseGuards(JwtAuthGuard)
export class IntegrationsController {
  constructor(private integrationsService: IntegrationsService) {}

  @Get()
  findAll(@Request() req) {
    return this.integrationsService.findAll(req.user.id);
  }

  @Post('typebot')
  async createTypebot(@Body() dto: CreateTypebotDto, @Request() req) {
    // Validar conexão com Typebot se habilitado
    if (dto.enabled) {
      if (!dto.apiUrl || !dto.publicName) {
        throw new HttpException({
          success: false,
          message: 'Typebot requer API URL e Public Name',
        }, HttpStatus.BAD_REQUEST);
      }

      try {
        const apiUrl = dto.apiUrl.endsWith('/') ? dto.apiUrl.slice(0, -1) : dto.apiUrl;
        // Testar conexão com o Typebot
        await axios.get(`${apiUrl}/api/v1/typebots/${dto.publicName}`, { timeout: 10000 });
      } catch (error: any) {
        // Se for 404, o typebot não existe
        if (error.response?.status === 404) {
          throw new HttpException({
            success: false,
            message: `Typebot "${dto.publicName}" não encontrado. Verifique o Public Name.`,
          }, HttpStatus.BAD_REQUEST);
        }
        // Outros erros de conexão
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
          throw new HttpException({
            success: false,
            message: 'Não foi possível conectar ao servidor Typebot. Verifique a URL.',
          }, HttpStatus.BAD_REQUEST);
        }
        // Se não for erro crítico, apenas logar e continuar
      }
    }

    const result = await this.integrationsService.createTypebot(dto, req.user.id);
    return {
      ...result,
      success: true,
      message: 'Integração Typebot configurada com sucesso!',
    };
  }

  @Post('typebot/test')
  async testTypebot(@Body() dto: CreateTypebotDto) {
    if (!dto.apiUrl || !dto.publicName) {
      throw new HttpException({
        success: false,
        message: 'API URL e Public Name são obrigatórios para testar',
      }, HttpStatus.BAD_REQUEST);
    }

    try {
      const apiUrl = dto.apiUrl.endsWith('/') ? dto.apiUrl.slice(0, -1) : dto.apiUrl;
      
      // Testar se o typebot existe
      const response = await axios.get(
        `${apiUrl}/api/v1/typebots/${dto.publicName}`,
        { timeout: 10000 }
      );

      const typebotData = response.data?.typebot || response.data;
      
      return {
        success: true,
        message: `Conexão com Typebot OK! Bot "${typebotData?.name || dto.publicName}" encontrado.`,
        typebot: {
          id: typebotData?.id,
          name: typebotData?.name,
          publicId: typebotData?.publicId || dto.publicName,
        },
      };
    } catch (error: any) {
      const errorMessage = error.response?.status === 404
        ? `Typebot "${dto.publicName}" não encontrado`
        : error.response?.status === 401
        ? 'Acesso não autorizado ao Typebot'
        : error.code === 'ECONNREFUSED'
        ? 'Servidor Typebot não acessível'
        : error.code === 'ENOTFOUND'
        ? 'URL do Typebot não encontrada'
        : 'Erro: ' + (error.message || 'Verifique as configurações');

      throw new HttpException({
        success: false,
        message: errorMessage,
      }, HttpStatus.BAD_REQUEST);
    }
  }

  @Post('n8n')
  async createN8n(@Body() dto: CreateN8nDto, @Request() req) {
    // Validar URL do webhook n8n se habilitado
    if (dto.enabled) {
      if (!dto.webhookUrl) {
        throw new HttpException({
          success: false,
          message: 'n8n requer Webhook URL',
        }, HttpStatus.BAD_REQUEST);
      }

      try {
        const url = new URL(dto.webhookUrl);
        if (!url.protocol.startsWith('http')) {
          throw new HttpException({
            success: false,
            message: 'URL do webhook n8n inválida. Use http:// ou https://',
          }, HttpStatus.BAD_REQUEST);
        }
      } catch (error: any) {
        if (error instanceof HttpException) throw error;
        throw new HttpException({
          success: false,
          message: 'URL do webhook n8n inválida',
        }, HttpStatus.BAD_REQUEST);
      }
    }

    const result = await this.integrationsService.createN8n(dto, req.user.id);
    return {
      ...result,
      success: true,
      message: 'Integração n8n configurada com sucesso!',
    };
  }

  @Post('n8n/test')
  async testN8n(@Body() dto: CreateN8nDto) {
    if (!dto.webhookUrl) {
      throw new HttpException({
        success: false,
        message: 'Webhook URL é obrigatório para testar',
      }, HttpStatus.BAD_REQUEST);
    }

    try {
      // Validar URL
      const url = new URL(dto.webhookUrl);
      if (!url.protocol.startsWith('http')) {
        throw new HttpException({
          success: false,
          message: 'URL inválida. Use http:// ou https://',
        }, HttpStatus.BAD_REQUEST);
      }

      // Preparar headers
      const headers: any = { 'Content-Type': 'application/json' };
      if (dto.basicAuthUser && dto.basicAuthPassword) {
        const auth = Buffer.from(`${dto.basicAuthUser}:${dto.basicAuthPassword}`).toString('base64');
        headers['Authorization'] = `Basic ${auth}`;
      }

      // Enviar requisição de teste
      const testPayload = {
        test: true,
        timestamp: new Date().toISOString(),
        message: 'Teste de conexão GO-API',
      };

      const response = await axios.post(dto.webhookUrl, testPayload, {
        headers,
        timeout: 15000,
        validateStatus: (status) => status < 500, // Aceitar qualquer status < 500
      });

      // n8n pode retornar diferentes status codes dependendo da configuração
      if (response.status >= 200 && response.status < 400) {
        return {
          success: true,
          message: `Conexão com n8n OK! Webhook respondeu com status ${response.status}.`,
          response: {
            status: response.status,
            data: response.data,
          },
        };
      } else {
        return {
          success: true,
          message: `Webhook acessível, mas retornou status ${response.status}. Verifique a configuração do workflow.`,
          response: {
            status: response.status,
          },
        };
      }
    } catch (error: any) {
      const errorMessage = error.response?.status === 401
        ? 'Autenticação falhou. Verifique usuário e senha.'
        : error.response?.status === 404
        ? 'Webhook não encontrado. Verifique a URL.'
        : error.code === 'ECONNREFUSED'
        ? 'Servidor n8n não acessível'
        : error.code === 'ENOTFOUND'
        ? 'URL não encontrada'
        : error.code === 'ETIMEDOUT'
        ? 'Timeout - servidor demorou para responder'
        : 'Erro: ' + (error.message || 'Verifique as configurações');

      throw new HttpException({
        success: false,
        message: errorMessage,
      }, HttpStatus.BAD_REQUEST);
    }
  }

  @Post('chatwoot')
  async createChatwoot(@Body() dto: CreateChatwootDto, @Request() req) {
    // Validar conexão com Chatwoot se habilitado
    if (dto.enabled) {
      if (!dto.url || !dto.accountId || !dto.token) {
        throw new HttpException({
          success: false,
          message: 'Chatwoot requer URL, Account ID e Token',
        }, HttpStatus.BAD_REQUEST);
      }

      try {
        const baseUrl = dto.url.endsWith('/') ? dto.url.slice(0, -1) : dto.url;
        const response = await axios.get(
          `${baseUrl}/api/v1/accounts/${dto.accountId}/inboxes`,
          {
            headers: {
              'Content-Type': 'application/json',
              api_access_token: dto.token,
            },
            timeout: 10000,
          }
        );

        if (response.status !== 200) {
          throw new Error('Falha na conexão');
        }
      } catch (error: any) {
        const errorMessage = error.response?.status === 401 
          ? 'Token do Chatwoot inválido ou sem permissão'
          : error.response?.status === 404
          ? 'Account ID do Chatwoot não encontrado'
          : error.code === 'ECONNREFUSED'
          ? 'Não foi possível conectar ao servidor Chatwoot'
          : error.code === 'ENOTFOUND'
          ? 'URL do Chatwoot não encontrada'
          : 'Erro ao conectar com Chatwoot: ' + (error.message || 'Verifique as credenciais');

        throw new HttpException({
          success: false,
          message: errorMessage,
          details: error.response?.data || null,
        }, HttpStatus.BAD_REQUEST);
      }
    }
    
    const result = await this.integrationsService.createChatwoot(dto, req.user.id);
    return {
      ...result,
      success: true,
      message: 'Integração Chatwoot configurada com sucesso! Conexão validada.',
    };
  }

  @Post('chatwoot/test')
  async testChatwoot(@Body() dto: CreateChatwootDto) {
    if (!dto.url || !dto.accountId || !dto.token) {
      throw new HttpException({
        success: false,
        message: 'URL, Account ID e Token são obrigatórios para testar',
      }, HttpStatus.BAD_REQUEST);
    }

    try {
      const baseUrl = dto.url.endsWith('/') ? dto.url.slice(0, -1) : dto.url;
      const response = await axios.get(
        `${baseUrl}/api/v1/accounts/${dto.accountId}/inboxes`,
        {
          headers: {
            'Content-Type': 'application/json',
            api_access_token: dto.token,
          },
          timeout: 10000,
        }
      );

      const inboxes = response.data?.payload || [];
      return {
        success: true,
        message: `Conexão com Chatwoot OK! ${inboxes.length} inbox(es) encontrada(s).`,
        inboxes: inboxes.map((i: any) => ({ id: i.id, name: i.name })),
      };
    } catch (error: any) {
      const errorMessage = error.response?.status === 401 
        ? 'Token inválido ou sem permissão'
        : error.response?.status === 404
        ? 'Account ID não encontrado'
        : error.code === 'ECONNREFUSED'
        ? 'Servidor Chatwoot não acessível'
        : error.code === 'ENOTFOUND'
        ? 'URL não encontrada'
        : 'Erro: ' + (error.message || 'Verifique as credenciais');

      throw new HttpException({
        success: false,
        message: errorMessage,
      }, HttpStatus.BAD_REQUEST);
    }
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateIntegrationDto, @Request() req) {
    return this.integrationsService.update(id, dto, req.user.id);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @Request() req) {
    return this.integrationsService.delete(id, req.user.id);
  }
}
