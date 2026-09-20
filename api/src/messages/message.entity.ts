import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50, default: 'incident' })
  tab: string; // 'incident' | 'insight' | 'telemetry'

  @Column({ type: 'varchar', length: 255, default: '' })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'varchar', length: 50, default: 'operational' })
  status: string; // 'operational' | 'resolved' | 'degraded' | 'deployed' | 'investigating'

  @Column({ type: 'varchar', length: 50, default: 'General' })
  category: string; // 'Docker' | 'AWS' | 'Networking' | 'Security' | 'Nginx' | 'Database'

  @Column({ type: 'varchar', length: 50, default: 'Production' })
  environment: string; // 'Production' | 'Staging' | 'Edge'

  @Column({ type: 'varchar', length: 100, default: 'DevOps Engineer' })
  author: string;

  @Column({ type: 'text', nullable: true })
  metadata: string; // Extra JSON string payload (e.g. latency, commit hash, region)

  @CreateDateColumn()
  createdAt: Date;
}
