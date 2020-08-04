import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import IUpdateProductsQuantityDTO from '@modules/products/dtos/IUpdateProductsQuantityDTO';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('Customer not found');
    }

    const productsId = products.map(product => ({ id: product.id }));
    const findProducts = await this.productsRepository.findAllById(productsId);

    if (findProducts.length !== products.length) {
      throw new AppError('Product not found');
    }

    const mapProductById = findProducts.reduce(
      (acc, curr) => ({
        ...acc,
        [curr.id]: {
          price: curr.price,
          quantity: curr.quantity,
        },
      }),
      {},
    ) as {
      [key: string]: {
        price: number;
        quantity: number;
      };
    };

    const updatedProductsQuantity: IUpdateProductsQuantityDTO[] = products.map(
      product => {
        if (product.quantity > mapProductById[product.id].quantity) {
          throw new AppError(`Product ${product.id} quantity insuficient`);
        }

        return {
          id: product.id,
          quantity: mapProductById[product.id].quantity - product.quantity,
        };
      },
    );

    await this.productsRepository.updateQuantity(updatedProductsQuantity);

    const order = await this.ordersRepository.create({
      customer,
      products: products.map(product => ({
        product_id: product.id,
        quantity: product.quantity,
        price: mapProductById[product.id].price,
      })),
    });

    return order;
  }
}

export default CreateOrderService;
