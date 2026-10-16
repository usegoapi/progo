import type { NextApiRequest, NextApiResponse } from 'next';
import { readPublicConfig } from '@/lib/branding';

/**
 * Configuração pública do painel (marca + URL da API).
 * Nunca retorne segredos aqui: esta rota é acessível sem autenticação.
 */
export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.status(200).json(readPublicConfig());
}
