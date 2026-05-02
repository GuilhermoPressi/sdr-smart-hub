import { IsString, IsInt, Min, Max } from 'class-validator';

export enum LeadSource {
  GOOGLE = 'google',
}

export class SearchLeadsDto {
  @IsString()
  query: string;

  @IsInt()
  @Min(1)
  @Max(100)
  limit: number;
}
