import { Injectable, InternalServerErrorException, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { PaginationDto } from 'src/common/dtos/pagination.dto';
import { validate as isUUID } from 'uuid'; 

@Injectable()
export class ProductsService {

  private readonly logger = new Logger('ProcuctService');

  constructor(

    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>

  ) { }

  async create(createProductDto: CreateProductDto) {
    try {
      const product = this.productRepository.create(createProductDto);
      await this.productRepository.save(product);
      return product;
    } catch (error) {
      this.handleDBExeptions(error);
    }
  }

  async findAll(paginationDto: PaginationDto) {
    const { limit = 3, offset = 0 } = paginationDto;
    try {
      return await this.productRepository.find({
        take: limit,
        skip: offset
        //TODO RELACIONES
      });
    } catch (error) {
      this.handleDBExeptions(error);
    }
  }

  async findOne(term: string) {
    try {
      let product: Product;
      if(isUUID(term)){
        product = await this.productRepository.findOneBy({id: term});
      }else{
        const queryBuilder = this.productRepository.createQueryBuilder();
        product = await queryBuilder
          .where(`title =:title or slug =:slug`, {
            title: term,
            slug: term
          }).getOne();
        //product = await this.productRepository.findOneBy({slug: term});
      }
      //const product = await this.productRepository.findOneBy({term});
      if(!product){
        throw new NotFoundException(`Product with term: ${term} not found.`)
      }
      return product;
    } catch (error) {
      this.handleDBExeptions(error);
    }
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    try {
      const product = await this.productRepository.preload({
        id,
        ...updateProductDto
      });
      await this.productRepository.save(product);
      if(!product){
        throw new NotFoundException(`Product with id: ${id} not found.`)
      }
      return product;
    } catch (error) {
      this.handleDBExeptions(error);
    }
    return `This action updates a #${id} product`;
  }

  async remove(id: string) {
    try {
      const product = await this.findOne(id);
      await this.productRepository.remove(product);
      return product;
    } catch (error) {
      this.handleDBExeptions(error);
    }
  }


  private handleDBExeptions(error: any) {
    if (error.code === '23505')
      throw new BadRequestException(error.detail)
    this.logger.error(error);
    throw new InternalServerErrorException(`Unexpected error, check server logs!`)
  }
}
