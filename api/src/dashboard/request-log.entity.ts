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

  @Index()
  @Column({ type: 'varchar', length: 100, nullable: true })
  journeyId: string;

  @Index()
  @Column({ type: 'varchar', length: 100, nullable: true })
  referenceId: string;

  @Column({ type: 'varchar', length: 16 })
  method: string;

  @Column({ type: 'varchar', length: 500 })
  url: string;

  @Column({ type: 'int' })
  statusCode: number;

  @Column({ type: 'int', default: 0 })
  durationMs: number;

  @Column({ type: 'varchar', length: 100, default: '127.0.0.1' })
  userIp: string;

  @Column({ type: 'varchar', length: 100, default: '127.0.0.1' })
  realIp: string;

  @Column({ type: 'varchar', length: 100, default: 'LOCAL' })
  country: string;

  @Column({ type: 'varchar', length: 255, default: 'Unknown' })
  userLocation: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  userDeviceId: string;

  @Column({ type: 'varchar', length: 100, default: 'direct' })
  cfRay: string;

  @Column({ type: 'varchar', length: 500, default: 'Unknown' })
  userAgent: string;

  @Index()
  @CreateDateColumn()
  createdAt: Date;
}
