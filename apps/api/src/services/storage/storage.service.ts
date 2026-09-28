import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';

export interface StorageProvider {
  saveFile(key: string, streamOrBuffer: Readable | Buffer): Promise<void>;
  getFileStream(key: string): Promise<Readable>;
  deleteFile(key: string): Promise<void>;
}

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export class LocalStorageProvider implements StorageProvider {
  async saveFile(key: string, streamOrBuffer: Readable | Buffer): Promise<void> {
    const filePath = path.join(UPLOAD_DIR, key);
    if (Buffer.isBuffer(streamOrBuffer)) {
      await fs.promises.writeFile(filePath, streamOrBuffer);
    } else {
      await new Promise((resolve, reject) => {
        const writeStream = fs.createWriteStream(filePath);
        streamOrBuffer.pipe(writeStream);
        writeStream.on('finish', () => resolve(true));
        writeStream.on('error', (err) => reject(err));
      });
    }
  }

  async getFileStream(key: string): Promise<Readable> {
    const filePath = path.join(UPLOAD_DIR, key);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Storage file ${key} not found`);
    }
    return fs.createReadStream(filePath);
  }

  async deleteFile(key: string): Promise<void> {
    const filePath = path.join(UPLOAD_DIR, key);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
  }
}

export class S3StorageProvider implements StorageProvider {
  private bucket: string;

  constructor() {
    this.bucket = process.env.AWS_S3_BUCKET || 'intentflow-files';
  }

  async saveFile(key: string, streamOrBuffer: Readable | Buffer): Promise<void> {
    // S3-compatible HTTP PUT upload
    const endpoint = process.env.AWS_ENDPOINT || `https://s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com`;
    const url = `${endpoint}/${this.bucket}/${key}`;

    const headers: Record<string, string> = {
      'x-amz-acl': 'private',
    };
    if (process.env.AWS_ACCESS_KEY_ID) {
      headers['Authorization'] = `AWS ${process.env.AWS_ACCESS_KEY_ID}:${process.env.AWS_SECRET_ACCESS_KEY}`;
    }

    let body: any = streamOrBuffer;
    if (Buffer.isBuffer(streamOrBuffer)) {
      body = streamOrBuffer;
    }

    const res = await fetch(url, { method: 'PUT', headers, body });
    if (!res.ok) {
      throw new Error(`S3 upload failed with status ${res.status}`);
    }
  }

  async getFileStream(key: string): Promise<Readable> {
    const endpoint = process.env.AWS_ENDPOINT || `https://s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com`;
    const url = `${endpoint}/${this.bucket}/${key}`;
    const res = await fetch(url);
    if (!res.ok || !res.body) {
      throw new Error(`S3 download failed with status ${res.status}`);
    }
    return Readable.fromWeb(res.body as any);
  }

  async deleteFile(key: string): Promise<void> {
    const endpoint = process.env.AWS_ENDPOINT || `https://s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com`;
    const url = `${endpoint}/${this.bucket}/${key}`;
    await fetch(url, { method: 'DELETE' });
  }
}

export class SupabaseStorageProvider implements StorageProvider {
  private supabaseUrl: string;
  private bucket: string;

  constructor() {
    this.supabaseUrl = process.env.SUPABASE_URL || '';
    this.bucket = process.env.SUPABASE_STORAGE_BUCKET || 'project-attachments';
  }

  async saveFile(key: string, streamOrBuffer: Readable | Buffer): Promise<void> {
    const url = `${this.supabaseUrl}/storage/v1/object/${this.bucket}/${key}`;
    const keyHeader = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${keyHeader}`,
        apikey: keyHeader,
      },
      body: streamOrBuffer as any,
    });

    if (!res.ok) {
      throw new Error(`Supabase storage upload failed with status ${res.status}`);
    }
  }

  async getFileStream(key: string): Promise<Readable> {
    const url = `${this.supabaseUrl}/storage/v1/object/authenticated/${this.bucket}/${key}`;
    const keyHeader = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${keyHeader}`,
        apikey: keyHeader,
      },
    });

    if (!res.ok || !res.body) {
      throw new Error(`Supabase storage download failed with status ${res.status}`);
    }

    return Readable.fromWeb(res.body as any);
  }

  async deleteFile(key: string): Promise<void> {
    const url = `${this.supabaseUrl}/storage/v1/object/${this.bucket}/${key}`;
    const keyHeader = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${keyHeader}`,
        apikey: keyHeader,
      },
    });
  }
}

export function sanitizeFileName(fileName: string): string {
  const name = path.basename(fileName);
  return name.replace(/[^a-zA-Z0-9_.-]/g, '_');
}

export function validateFile(fileName: string, mimeType: string, size: number): { valid: boolean; reason?: string } {
  const MAX_SIZE = 25 * 1024 * 1024; // 25MB
  if (size > MAX_SIZE) {
    return { valid: false, reason: 'File size exceeds maximum 25MB limit' };
  }

  const FORBIDDEN_EXTS = ['.exe', '.bat', '.cmd', '.sh', '.dll', '.scr', '.msi', '.vbs', '.com'];
  const ext = path.extname(fileName).toLowerCase();
  if (FORBIDDEN_EXTS.includes(ext)) {
    return { valid: false, reason: `Executable file extension "${ext}" is not permitted for security` };
  }

  return { valid: true };
}

export class StorageService {
  private provider: StorageProvider;

  constructor() {
    const mode = (process.env.STORAGE_PROVIDER || '').toLowerCase();
    if (mode === 's3' || (process.env.S3_BUCKET && process.env.S3_ACCESS_KEY)) {
      this.provider = new S3StorageProvider();
    } else if (mode === 'supabase' || (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)) {
      this.provider = new SupabaseStorageProvider();
    } else {
      this.provider = new LocalStorageProvider();
    }
  }

  getProvider(): StorageProvider {
    return this.provider;
  }
}
