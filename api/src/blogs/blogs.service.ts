import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Blog } from './blog.entity';
import { User } from '../users/user.entity';
import { CreateBlogDto } from './dto/create-blog.dto';
import { UpdateBlogDto } from './dto/update-blog.dto';
import { TokenPayload } from '../auth/crypto.service';

@Injectable()
export class BlogsService {
  constructor(
    @InjectRepository(Blog)
    private readonly blogRepository: Repository<Blog>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  // Create Blog (Authenticated User or Admin)
  async create(createBlogDto: CreateBlogDto, user: any): Promise<Blog> {
    let authorId = user?.sub || user?.id;
    let authorUsername = user?.username;

    // Ensure we resolve a real database user for the foreign key constraint
    let dbAuthor: User | null = null;
    if (authorId && authorId > 0) {
      dbAuthor = await this.userRepository.findOne({ where: { id: authorId } });
    }

    if (!dbAuthor && user?.clerkId) {
      dbAuthor = await this.userRepository.findOne({ where: { clerkId: user.clerkId } });
    }

    if (!dbAuthor && user?.email) {
      dbAuthor = await this.userRepository.findOne({ where: { email: user.email } });
    }

    if (dbAuthor) {
      authorId = dbAuthor.id;
      authorUsername = dbAuthor.username || authorUsername;
    }

    if (!authorId || authorId <= 0) {
      throw new UnauthorizedException('Valid author account is required to publish articles');
    }

    const blog = this.blogRepository.create({
      title: createBlogDto.title.trim(),
      content: createBlogDto.content.trim(),
      category: createBlogDto.category?.trim() || 'DevOps',
      authorId,
      authorUsername: authorUsername || 'author',
    });
    return await this.blogRepository.save(blog);
  }

  // Paginated Public Feed of Blogs
  async findAll(
    page = 1,
    limit = 6,
    search = '',
    category = '',
  ): Promise<{
    items: Blog[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const p = Math.max(1, Number(page) || 1);
    const l = Math.min(50, Math.max(1, Number(limit) || 6));
    const skip = (p - 1) * l;

    const queryBuilder = this.blogRepository.createQueryBuilder('blog');

    if (search) {
      queryBuilder.andWhere(
        '(blog.title LIKE :search OR blog.content LIKE :search OR blog.authorUsername LIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (category && category !== 'All') {
      queryBuilder.andWhere('blog.category = :category', { category });
    }

    queryBuilder.orderBy('blog.createdAt', 'DESC');
    queryBuilder.skip(skip).take(l);

    const [items, total] = await queryBuilder.getManyAndCount();

    return {
      items,
      total,
      page: p,
      limit: l,
      totalPages: Math.ceil(total / l) || 1,
    };
  }

  // Find Single Blog
  async findOne(id: number): Promise<Blog> {
    const blog = await this.blogRepository.findOne({ where: { id } });
    if (!blog) {
      throw new NotFoundException(`Blog with ID ${id} not found`);
    }
    return blog;
  }

  // Update Blog (Author or Admin Only)
  async update(id: number, updateBlogDto: UpdateBlogDto, user: any): Promise<Blog> {
    const blog = await this.findOne(id);
    const userId = user?.sub || user?.id;

    let isOwner = blog.authorId === userId;
    if (!isOwner && (user?.clerkId || user?.email)) {
      const dbAuthor = await this.userRepository.findOne({ where: { id: blog.authorId } });
      if (
        dbAuthor &&
        ((user?.clerkId && dbAuthor.clerkId === user.clerkId) ||
          (user?.email && dbAuthor.email === user.email))
      ) {
        isOwner = true;
      }
    }

    if (!isOwner && user?.role !== 'admin') {
      throw new ForbiddenException('You can only update your own blog posts');
    }

    const newTitle = updateBlogDto.title !== undefined ? updateBlogDto.title.trim() : blog.title;
    const newContent = updateBlogDto.content !== undefined ? updateBlogDto.content.trim() : blog.content;

    blog.title = newTitle;
    blog.content = newContent;
    if (updateBlogDto.category !== undefined) blog.category = updateBlogDto.category.trim();

    return await this.blogRepository.save(blog);
  }

  // Delete Blog (Author or Admin Only)
  async delete(id: number, user: any): Promise<{ success: boolean; message: string }> {
    const blog = await this.findOne(id);
    const userId = user?.sub || user?.id;

    let isOwner = blog.authorId === userId;
    if (!isOwner && (user?.clerkId || user?.email)) {
      const dbAuthor = await this.userRepository.findOne({ where: { id: blog.authorId } });
      if (
        dbAuthor &&
        ((user?.clerkId && dbAuthor.clerkId === user.clerkId) ||
          (user?.email && dbAuthor.email === user.email))
      ) {
        isOwner = true;
      }
    }

    if (!isOwner && user?.role !== 'admin') {
      throw new ForbiddenException('You can only delete your own blog posts');
    }

    await this.blogRepository.remove(blog);
    return { success: true, message: `Blog #${id} deleted successfully` };
  }
}
