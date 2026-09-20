import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';

@Injectable()
export class BloomFilterService implements OnModuleInit {
  private readonly size = 10000; // Bit array size
  private readonly bitArray: Uint8Array = new Uint8Array(Math.ceil(this.size / 8));
  private readonly k = 3; // Number of hash functions

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async onModuleInit() {
    // Populate Bloom filter on boot with all existing usernames
    try {
      const users = await this.userRepository.find({ select: ['username'] });
      for (const u of users) {
        if (u.username) {
          this.add(u.username.toLowerCase());
        }
      }
    } catch (err) {
      console.warn('Bloom filter initial sync pending DB readiness:', err.message);
    }
  }

  private hash(str: string, seed: number): number {
    let hash = seed ^ 2166136261;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return Math.abs(hash) % this.size;
  }

  private setBit(pos: number) {
    const byteIdx = Math.floor(pos / 8);
    const bitIdx = pos % 8;
    this.bitArray[byteIdx] |= 1 << bitIdx;
  }

  private getBit(pos: number): boolean {
    const byteIdx = Math.floor(pos / 8);
    const bitIdx = pos % 8;
    return (this.bitArray[byteIdx] & (1 << bitIdx)) !== 0;
  }

  add(username: string) {
    const normalized = username.toLowerCase().trim();
    for (let i = 0; i < this.k; i++) {
      const pos = this.hash(normalized, i * 31);
      this.setBit(pos);
    }
  }

  // Returns false if definitely NOT present (i.e. available!)
  // Returns true if possibly present (requires DB confirmation)
  mightContain(username: string): boolean {
    const normalized = username.toLowerCase().trim();
    for (let i = 0; i < this.k; i++) {
      const pos = this.hash(normalized, i * 31);
      if (!this.getBit(pos)) {
        return false; // Definitely not in set
      }
    }
    return true; // Possibly in set
  }
}
