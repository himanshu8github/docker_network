import { IsEmail, IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @Length(3, 30, { message: 'Username must be between 3 and 30 characters' })
  @Matches(/^[a-zA-Z0-9]+$/, { message: 'Username must be strictly alphanumeric (no special characters or spaces)' })
  username: string;

  @IsString()
  @IsNotEmpty()
  @Length(6, 100, { message: 'Password must be at least 6 characters long' })
  password: string;
}
