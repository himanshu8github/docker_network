import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class CreateBlogDto {
  @IsString()
  @IsNotEmpty()
  @Length(5, 200, { message: 'Title must be between 5 and 200 characters' })
  @Matches(/^((?!<img|!\[|data:image)[\s\S])*$/i, {
    message: 'Images are strictly prohibited in blog title',
  })
  @Matches(/^[^\p{Extended_Pictographic}]*$/u, {
    message: 'Emojis are strictly prohibited in blog title',
  })
  title: string;

  @IsString()
  @IsNotEmpty()
  @Length(100, 1500, {
    message: 'Blog content must be between 100 and 1,500 characters',
  })
  @Matches(/^((?!<img|!\[|data:image)[\s\S])*$/i, {
    message: 'Images are strictly prohibited in blog content (plain text only)',
  })
  @Matches(/^[^\p{Extended_Pictographic}]*$/u, {
    message: 'Emojis are strictly prohibited in blog content',
  })
  content: string;

  @IsString()
  @IsNotEmpty()
  category: string;
}
