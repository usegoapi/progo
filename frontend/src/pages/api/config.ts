import type { NextApiRequest, NextApiResponse } from 'next';

// Esta API route roda no servidor e tem acesso às variáveis de ambiente
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({
    adminEmail: process.env.ADMIN_EMAIL || 'admin@goapi.com',
    adminPassword: process.env.ADMIN_PASSWORD || 'admin123',
    apiUrl: process.env.API_URL || '',
  });
}
