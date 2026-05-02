import { IsString, IsInt, Min, Max } from 'class-validator';

export class SearchLeadsDto {
  @IsString()
  query: string;

  @IsInt()
  @Min(1)
  @Max(100)
  limit: number;
}
