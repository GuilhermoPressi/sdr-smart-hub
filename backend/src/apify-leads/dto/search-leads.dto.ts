import { IsEnum, IsString, IsInt, Min, Max } from 'class-validator';

export enum LeadSource {
  GOOGLE = 'google',
  FACEBOOK = 'facebook',
}

export class SearchLeadsDto {
  @IsEnum(LeadSource, { message: 'source deve ser: google ou facebook' })
  source: LeadSource;

  @IsString()
  query: string;

  @IsInt()
  @Min(1)
  @Max(100)
  limit: number;
}
