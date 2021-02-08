import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
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
  ) { }

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('User not found', 404);
    }

    const existentProducts = await this.productsRepository.findAllById(products);

    if (!existentProducts.length) {
      throw new AppError('Inexistent products', 406);
    }

    const productsIds = existentProducts.map(product => product.id);
    const inexistentProducts = products.filter(product => !productsIds.includes(product.id));

    if (inexistentProducts.length) {
      throw new AppError(`Inexistent product: ${inexistentProducts[0].id}`, 403);
    }

    const unavaibleProducts = products.filter(product => {
      return existentProducts.find(p => p.id === product.id)!.quantity <= product.quantity;
    })

    if (unavaibleProducts.length) {
      throw new AppError(`Product unavaible: ${unavaibleProducts[0].id}`)
    }

    const formattedProducts = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: existentProducts.find(p => p.id === product.id)!.price
    }));

    const order = await this.ordersRepository.create({
      customer,
      products: formattedProducts
    });

    const { order_products } = order;

    const quantity = order_products.map(product => ({
      id: product.id,
      quantity: existentProducts.find(p => p.id === product.id)!.quantity - product.quantity
    }));

    await this.productsRepository.updateQuantity(quantity);

    return order;
  }
}

export default CreateOrderService;
