import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Blog } from './blog.entity';
import { CreateBlogDto } from './dto/create-blog.dto';
import { UpdateBlogDto } from './dto/update-blog.dto';
import { TokenPayload } from '../auth/crypto.service';

@Injectable()
export class BlogsService {
  constructor(
    @InjectRepository(Blog)
    private readonly blogRepository: Repository<Blog>,
  ) {}

  // Create Blog (Authenticated User or Admin)
  async create(createBlogDto: CreateBlogDto, user: TokenPayload): Promise<Blog> {
    const blog = this.blogRepository.create({
      title: createBlogDto.title.trim(),
      content: createBlogDto.content.trim(),
      category: createBlogDto.category.trim() || 'DevOps',
      authorId: user.sub,
      authorUsername: user.username,
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
  async update(id: number, updateBlogDto: UpdateBlogDto, user: TokenPayload): Promise<Blog> {
    const blog = await this.findOne(id);

    if (blog.authorId !== user.sub && user.role !== 'admin') {
      throw new ForbiddenException('You can only update your own blog posts');
    }

    if (updateBlogDto.title !== undefined) blog.title = updateBlogDto.title.trim();
    if (updateBlogDto.content !== undefined) blog.content = updateBlogDto.content.trim();
    if (updateBlogDto.category !== undefined) blog.category = updateBlogDto.category.trim();

    return await this.blogRepository.save(blog);
  }
}
