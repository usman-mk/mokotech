import { Column, Entity, PrimaryColumn } from 'typeorm';

export type Criticality = 'A' | 'B' | 'C';

// Maps the existing equipment table from seed.sql.
@Entity({ name: 'equipment' })
export class Equipment {
  @PrimaryColumn({ type: 'integer' })
  id: number;

  @Column({ name: 'tag_no', type: 'varchar', length: 30 })
  tagNo: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 60 })
  location: string;

  @Column({ type: 'char', length: 1 })
  criticality: Criticality;

  // 'date' columns come back from pg as 'YYYY-MM-DD' strings, which avoids
  // timezone shifts that a JS Date would introduce.
  @Column({ name: 'next_due_date', type: 'date' })
  nextDueDate: string;
}
