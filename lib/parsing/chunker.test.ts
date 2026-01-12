import { describe, it, expect } from 'vitest'
import {
  chunkFile,
  detectLanguage,
  calculateFileHash,
  estimateTokens,
} from './chunker'

describe('chunker', () => {
  describe('detectLanguage', () => {
    it('should detect TypeScript', () => {
      expect(detectLanguage('file.ts')).toBe('typescript')
      expect(detectLanguage('file.tsx')).toBe('typescript')
    })

    it('should detect JavaScript', () => {
      expect(detectLanguage('file.js')).toBe('javascript')
      expect(detectLanguage('file.jsx')).toBe('javascript')
      expect(detectLanguage('file.mjs')).toBe('javascript')
    })

    it('should detect Python', () => {
      expect(detectLanguage('file.py')).toBe('python')
    })

    it('should detect Go', () => {
      expect(detectLanguage('file.go')).toBe('go')
    })

    it('should detect Prisma', () => {
      expect(detectLanguage('schema.prisma')).toBe('prisma')
    })

    it('should return text for unknown extensions', () => {
      expect(detectLanguage('file.unknown')).toBe('text')
    })
  })

  describe('chunkFile', () => {
    it('should return empty array for empty content', () => {
      expect(chunkFile('', 'file.ts')).toEqual([])
      expect(chunkFile('   ', 'file.ts')).toEqual([])
    })

    it('should chunk TypeScript function', () => {
      const code = `
export function greet(name: string): string {
  const greeting = 'Hello, ' + name;
  return greeting;
}
`.trim()

      const chunks = chunkFile(code, 'utils.ts')

      expect(chunks.length).toBeGreaterThan(0)
      expect(chunks[0].chunk_type).toBe('function')
      expect(chunks[0].symbol_name).toBe('greet')
      expect(chunks[0].language).toBe('typescript')
    })

    it('should chunk TypeScript arrow function', () => {
      const code = `
export const processData = async (data: string[]): Promise<void> => {
  for (const item of data) {
    console.log(item);
  }
};
`.trim()

      const chunks = chunkFile(code, 'processor.ts')

      expect(chunks.length).toBeGreaterThan(0)
      expect(chunks[0].chunk_type).toBe('function')
      expect(chunks[0].symbol_name).toBe('processData')
    })

    it('should chunk TypeScript class', () => {
      const code = `
export class UserService {
  private users: User[] = [];

  async getUser(id: string): Promise<User | null> {
    return this.users.find(u => u.id === id) || null;
  }

  async createUser(data: CreateUserDto): Promise<User> {
    const user = { id: crypto.randomUUID(), ...data };
    this.users.push(user);
    return user;
  }
}
`.trim()

      const chunks = chunkFile(code, 'user-service.ts')

      expect(chunks.length).toBeGreaterThan(0)
      expect(chunks[0].chunk_type).toBe('class')
      expect(chunks[0].symbol_name).toBe('UserService')
    })

    it('should chunk TypeScript interface', () => {
      const code = `
export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}
`.trim()

      const chunks = chunkFile(code, 'types.ts')

      expect(chunks.length).toBeGreaterThan(0)
      expect(chunks[0].chunk_type).toBe('interface')
      expect(chunks[0].symbol_name).toBe('User')
    })

    it('should chunk Python function', () => {
      const code = `
def calculate_total(items):
    total = 0
    for item in items:
        total += item.price
    return total
`.trim()

      const chunks = chunkFile(code, 'utils.py')

      expect(chunks.length).toBeGreaterThan(0)
      expect(chunks[0].chunk_type).toBe('function')
      expect(chunks[0].symbol_name).toBe('calculate_total')
      expect(chunks[0].language).toBe('python')
    })

    it('should chunk Python class', () => {
      const code = `
class UserRepository:
    def __init__(self, db):
        self.db = db

    def find_by_id(self, user_id):
        return self.db.query(User).filter(User.id == user_id).first()
`.trim()

      const chunks = chunkFile(code, 'repository.py')

      expect(chunks.length).toBeGreaterThan(0)
      expect(chunks[0].chunk_type).toBe('class')
      expect(chunks[0].symbol_name).toBe('UserRepository')
    })

    it('should chunk Go function', () => {
      const code = `
func GetUser(ctx context.Context, id string) (*User, error) {
    user, err := db.FindUser(ctx, id)
    if err != nil {
        return nil, err
    }
    return user, nil
}
`.trim()

      const chunks = chunkFile(code, 'handlers.go')

      expect(chunks.length).toBeGreaterThan(0)
      expect(chunks[0].chunk_type).toBe('function')
      expect(chunks[0].symbol_name).toBe('GetUser')
      expect(chunks[0].language).toBe('go')
    })

    it('should handle package.json as single chunk', () => {
      const code = JSON.stringify({
        name: 'my-app',
        version: '1.0.0',
        dependencies: {
          react: '^18.0.0',
        },
      }, null, 2)

      const chunks = chunkFile(code, 'package.json')

      expect(chunks.length).toBe(1)
      expect(chunks[0].chunk_type).toBe('config')
      expect(chunks[0].symbol_name).toBe('package.json')
    })

    it('should chunk Prisma schema by model', () => {
      const code = `
generator client {
  provider = "prisma-client-js"
}

model User {
  id    String @id
  name  String
  posts Post[]
}

model Post {
  id       String @id
  title    String
  authorId String
  author   User   @relation(fields: [authorId], references: [id])
}
`.trim()

      const chunks = chunkFile(code, 'schema.prisma')

      expect(chunks.length).toBe(2)
      expect(chunks[0].chunk_type).toBe('type')
      expect(chunks[0].symbol_name).toBe('User')
      expect(chunks[1].symbol_name).toBe('Post')
    })

    it('should extract dependencies from imports', () => {
      const code = `
import { useState, useEffect } from 'react';
import axios from 'axios';
import { User } from '@/types';

export function useUser(id: string) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    axios.get('/api/users/' + id).then(res => setUser(res.data));
  }, [id]);

  return user;
}
`.trim()

      const chunks = chunkFile(code, 'use-user.ts')

      expect(chunks.length).toBeGreaterThan(0)
      expect(chunks[0].dependencies).toContain('react')
      expect(chunks[0].dependencies).toContain('axios')
      expect(chunks[0].dependencies).toContain('@/types')
    })

    it('should include correct line numbers', () => {
      const code = `// Comment line 1
// Comment line 2

export function processUserData(user: User): ProcessedUser {
  const { id, name, email } = user;
  const displayName = name || email.split('@')[0];
  const timestamp = Date.now();
  return {
    id,
    displayName,
    processedAt: timestamp,
  };
}
`

      const chunks = chunkFile(code, 'file.ts')

      expect(chunks.length).toBeGreaterThan(0)
      expect(chunks[0].start_line).toBe(4)
      expect(chunks[0].end_line).toBeGreaterThan(4)
      expect(chunks[0].symbol_name).toBe('processUserData')
    })

    it('should fall back to fixed-size chunking for plain text', () => {
      const longText = 'Line of text.\n'.repeat(100)
      const chunks = chunkFile(longText, 'readme.txt')

      expect(chunks.length).toBeGreaterThan(0)
      expect(chunks[0].chunk_type).toBe('other')
    })
  })

  describe('calculateFileHash', () => {
    it('should return consistent hash for same content', () => {
      const content = 'Hello, world!'
      const hash1 = calculateFileHash(content)
      const hash2 = calculateFileHash(content)

      expect(hash1).toBe(hash2)
      expect(hash1).toHaveLength(64) // SHA-256 hex length
    })

    it('should return different hash for different content', () => {
      const hash1 = calculateFileHash('Hello')
      const hash2 = calculateFileHash('World')

      expect(hash1).not.toBe(hash2)
    })
  })

  describe('estimateTokens', () => {
    it('should estimate token count', () => {
      const text = 'function hello() { return "world"; }'
      const tokens = estimateTokens(text)

      expect(tokens).toBeGreaterThan(0)
      expect(tokens).toBeLessThan(text.length)
    })
  })
})
