import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AppUser } from '../users/app-user.entity.js';
import { Equipment } from '../equipment/equipment.entity.js';

export type DeferralStatus = 'pending' | 'approved' | 'rejected';
export type ApproverRole = 'supervisor' | 'department_manager';

// Table, constraints and indexes are defined in migration
// 1764000000001-CreateDeferralRequest; this class only maps the columns.
@Entity({ name: 'deferral_request' })
export class DeferralRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'equipment_id', type: 'integer' })
  equipmentId: number;

  @ManyToOne(() => Equipment)
  @JoinColumn({ name: 'equipment_id' })
  equipment?: Equipment;

  @Column({ name: 'requested_by', type: 'integer' })
  requestedById: number;

  @ManyToOne(() => AppUser)
  @JoinColumn({ name: 'requested_by' })
  requestedBy?: AppUser;

  @Column({ name: 'previous_due_date', type: 'date' })
  previousDueDate: string;

  @Column({ name: 'cycle_base_due_date', type: 'date' })
  cycleBaseDueDate: string;

  @Column({ name: 'requested_due_date', type: 'date' })
  requestedDueDate: string;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: DeferralStatus;

  @Column({ name: 'required_approver_role', type: 'varchar', length: 30 })
  requiredApproverRole: ApproverRole;

  @Column({ name: 'policy_note', type: 'text', nullable: true })
  policyNote: string | null;

  @Column({ name: 'decided_by', type: 'integer', nullable: true })
  decidedById: number | null;

  @ManyToOne(() => AppUser)
  @JoinColumn({ name: 'decided_by' })
  decidedBy?: AppUser | null;

  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true })
  decidedAt: Date | null;

  @Column({ name: 'decision_note', type: 'text', nullable: true })
  decisionNote: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
