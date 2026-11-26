import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { IsDateOnly } from '../common/is-date-only.validator.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateDeferralRequestDto {
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  equipmentId: number;

  @IsDateOnly()
  requestedDueDate: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason: string;
}

export class ApproveDeferralDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class RejectDeferralDto {
  /** A rejection must say why, so the requester knows what to change. */
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  note: string;
}
