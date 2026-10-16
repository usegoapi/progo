import { Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { env } from '../config/env';

const logger = new Logger('Media');

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg; codecs=opus',
  opus: 'audio/ogg; codecs=opus',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  '3gp': 'video/3gpp',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  csv: 'text/csv',
  txt: 'text/plain',
  zip: 'application/zip',
  json: 'application/json',
};

const DEFAULT_MIME = { image: 'image/jpeg', audio: 'audio/mpeg', video: 'video/mp4', document: 'application/octet-stream' };

export type MediaKind = keyof typeof DEFAULT_MIME;

export function extensionFromUrl(url: string): string | undefined {
  if (url.startsWith('data:')) return undefined;
  try {
    const ext = path.extname(new URL(url).pathname).slice(1).toLowerCase();
    return ext || undefined;
  } catch {
    return undefined;
  }
}

export function resolveMimeType(kind: MediaKind, url: string, headerType?: string): string {
  const fromHeader = headerType?.split(';')[0].trim().toLowerCase();
  if (fromHeader && fromHeader !== 'application/octet-stream' && fromHeader.includes('/')) {
    return fromHeader === 'audio/ogg' ? 'audio/ogg; codecs=opus' : fromHeader;
  }
  const ext = extensionFromUrl(url);
  return (ext && MIME_BY_EXT[ext]) || DEFAULT_MIME[kind];
}

export function filenameFromUrl(url: string, fallback = 'arquivo'): string {
  if (url.startsWith('data:')) return fallback;
  try {
    const name = decodeURIComponent(path.basename(new URL(url).pathname));
    return name && name !== '/' ? name.slice(0, 200) : fallback;
  } catch {
    return fallback;
  }
}

/** Para auditoria: nunca persiste data URIs (podem ter megabytes e dados pessoais). */
export const auditableUrl = (url: string) => (url.startsWith('data:') ? '[base64]' : url.slice(0, 2048));

let ffmpegConfigured = false;
function configureFfmpeg() {
  if (ffmpegConfigured) return;
  ffmpegConfigured = true;
  const candidates = [env.ffmpegPath, '/usr/bin/ffmpeg'].filter(Boolean) as string[];
  const found = candidates.find((p) => fs.existsSync(p));
  if (found) {
    ffmpeg.setFfmpegPath(found);
    return;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    ffmpeg.setFfmpegPath(require('@ffmpeg-installer/ffmpeg').path);
  } catch {
    logger.warn('ffmpeg não encontrado: áudios serão enviados sem conversão para voz (PTT).');
  }
}

/** Converte qualquer áudio para OGG/Opus mono 48kHz (formato de nota de voz do WhatsApp). */
export function convertToOggOpus(input: Buffer, timeoutMs = 60_000): Promise<Buffer> {
  configureFfmpeg();
  const id = crypto.randomUUID();
  const inputPath = path.join(os.tmpdir(), `goapi-${id}.in`);
  const outputPath = path.join(os.tmpdir(), `goapi-${id}.ogg`);
  fs.writeFileSync(inputPath, input);

  return new Promise<Buffer>((resolve, reject) => {
    const command = ffmpeg(inputPath)
      .noVideo()
      .audioCodec('libopus')
      .audioFrequency(48_000)
      .audioChannels(1)
      .audioBitrate('64k')
      .outputOptions(['-avoid_negative_ts make_zero', '-application voip'])
      .format('ogg');

    const timer = setTimeout(() => {
      command.kill('SIGKILL');
      reject(new Error('Tempo limite na conversão do áudio'));
    }, timeoutMs);

    command
      .on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      })
      .on('end', () => {
        clearTimeout(timer);
        try {
          resolve(fs.readFileSync(outputPath));
        } catch (err) {
          reject(err);
        }
      })
      .save(outputPath);
  }).finally(() => {
    fs.rm(inputPath, { force: true }, () => undefined);
    fs.rm(outputPath, { force: true }, () => undefined);
  });
}
