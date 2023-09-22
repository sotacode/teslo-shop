import { Injectable, InternalServerErrorException, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { PaginationDto } from 'src/common/dtos/pagination.dto';
import { validate as isUUID } from 'uuid'; 
import { ProductImage } from './entities/product-image.entity';
import { User } from 'src/auth/entities/user.entity';

@Injectable()
export class ProductsService {

  private readonly logger = new Logger('ProcuctService');

  constructor(

    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,

    @InjectRepository(ProductImage)
    private readonly productImageRepository: Repository<ProductImage>,

    private readonly dataSource: DataSource

  ) { }

  async create(createProductDto: CreateProductDto, user: User) {
    try {
      const { images = [], ...productDetails} = createProductDto;

      const product = this.productRepository.create({
        ...productDetails,
        images: images.map( image => this.productImageRepository.create({url: image})),
        user
      });
      await this.productRepository.save(product);
      return { ...product, images};
    } catch (error) {
      this.handleDBExeptions(error);
    }
  }

  async findAll(paginationDto: PaginationDto) {
    const { limit = 3, offset = 0 } = paginationDto;
    try {
      const products = await this.productRepository.find({
        take: limit,
        skip: offset,
        relations: {
          images: true
        }
        //TODO RELACIONES
      });
      return products.map( product => ({
        ...product,
        images: product.images.map( img => img.url )
      }) )
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
        const queryBuilder = this.productRepository.createQueryBuilder('prod');
        product = await queryBuilder
          .where(`title =:title or slug =:slug`, {
            title: term,
            slug: term
          })
          .leftJoinAndSelect('prod.images','prodImages')
          .getOne();
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

  async findOnePlane(term: string){
    const {images = [], ...productDetails} = await this.findOne(term);
    return {...productDetails, images: images.map( image => image.url)}
  }

  async update(id: string, updateProductDto: UpdateProductDto, user: User) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const { images, ...toUpdate } = updateProductDto;
      const product = await this.productRepository.preload({
        id,
        ...toUpdate
      });
      if(!product){
        throw new NotFoundException(`Product with id: ${id} not found.`)
      }
      if(images){
        await queryRunner.manager.delete(ProductImage, { product: {id} })
        product.images = images.map( image => this.productImageRepository.create({url: image}))
      }

      product.user = user
      await queryRunner.manager.save(product)
      await queryRunner.commitTransaction();
      await queryRunner.release()
      return this.findOnePlane(id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      await queryRunner.release();
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

  async deleteAllProducts(){
    const query = this.productRepository.createQueryBuilder('product');
    try {
      return query.delete().where({}).execute();
    } catch (error) {
      this.handleDBExeptions(error)
    }
  }
}
