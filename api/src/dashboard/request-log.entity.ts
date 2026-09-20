import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('request_logs')
export class RequestLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 16 })
  method: string;

  @Column({ type: 'varchar', length: 500 })
  url: string;

  @Column({ type: 'int' })
  statusCode: number;

  @Column({ type: 'int', default: 0 })
  durationMs: number;

  @Column({ type: 'varchar', length: 100, default: '127.0.0.1' })
  clientIp: string;

  @Column({ type: 'varchar', length: 50, default: 'LOCAL' })
  country: string;

  @Column({ type: 'varchar', length: 100, default: 'direct' })
  cfRay: string;

  @Column({ type: 'varchar', length: 500, default: 'Unknown' })
  userAgent: string;

  @Index()
  @CreateDateColumn()
  createdAt: Date;
}
