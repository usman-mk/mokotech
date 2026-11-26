import { Column, Entity, PrimaryColumn } from 'typeorm';

export type UserRole = 'requester' | 'supervisor' | 'department_manager';

// Maps the existing app_user table from seed.sql.
@Entity({ name: 'app_user' })
export class AppUser {
  @PrimaryColumn({ type: 'integer' })
  id: number;

  @Column({ type: 'varchar', length: 50 })
  username: string;

  @Column({ name: 'full_name', type: 'varchar', length: 120 })
  fullName: string;

  @Column({ type: 'varchar', length: 30 })
  role: UserRole;
}
