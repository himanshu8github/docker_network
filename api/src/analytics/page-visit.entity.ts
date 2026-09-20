import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('page_visits')
export class PageVisit {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100, default: '/home' })
  endpoint: string;

  @Column({ type: 'varchar', length: 100, default: '127.0.0.1' })
  clientIp: string;

  @Column({ type: 'varchar', length: 50, default: 'LOCAL' })
  country: string;

  @Column({ type: 'varchar', length: 100, default: 'direct' })
  cfRay: string;

  @Column({ type: 'text', nullable: true })
  userAgent: string;

  @CreateDateColumn()
  createdAt: Date;
}
