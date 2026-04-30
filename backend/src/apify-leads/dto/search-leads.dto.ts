import { IsEnum, IsString, IsInt, Min, Max } from 'class-validator';

export enum LeadSource {
  INSTAGRAM = 'instagram',
  LINKEDIN = 'linkedin',
  WEBSITE = 'website',
  GOOGLE = 'google',
}

export class SearchLeadsDto {
  @IsEnum(LeadSource, {
    message: 'source deve ser: instagram, linkedin, website ou google',
  })
  source: LeadSource;

  @IsString()
  query: string;

  @IsInt()
  @Min(1)
  @Max(100)
  limit: number;
}
