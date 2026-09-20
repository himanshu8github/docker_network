import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class UpdateBlogDto {
  @IsString()
  @IsOptional()
  @Length(5, 200)
  @Matches(/^((?!<img|!\[|data:image)[\s\S])*$/i, {
    message: 'Images are strictly prohibited',
  })
  @Matches(/^[^\p{Extended_Pictographic}]*$/u, {
    message: 'Emojis are strictly prohibited',
  })
  title?: string;

  @IsString()
  @IsOptional()
  @Length(100, 1500)
  @Matches(/^((?!<img|!\[|data:image)[\s\S])*$/i, {
    message: 'Images are strictly prohibited in blog content (plain text only)',
  })
  @Matches(/^[^\p{Extended_Pictographic}]*$/u, {
    message: 'Emojis are strictly prohibited',
  })
  content?: string;

  @IsString()
  @IsOptional()
  category?: string;
}
