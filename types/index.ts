// Define the supported intents.
export type Intent =
  | "order_tracking"
  | "product_inquiry"
  | "returns_exchange"
  | "change_delivery"
  | "return_status"
  | "promo_code"
  | "returns_policy"
  | "delivery_issue"
  | "product_sizing"
  | "conversation_end"
  | "other-general"
  | "other-order"
  | "update_order";

export type ClassifiedMessage = {
  intent: Intent;
  parameters: {
    order_number: string;
    email: string;
    product_handle: string;
    new_delivery_info: string;
    delivery_status: string;
    tracking_number: string;
    delivery_address_confirmed: boolean;
    return_type: string;
    returns_website_sent: boolean;
    product_name: string;
    size_query: string;
    update_type: string;
    height: string;
    fit: string;
  };
  language: string;
};

export type OrderFulfillment = {
  id: number;
  admin_graphql_api_id: string;
  created_at: string;
  location_id: number;
  name: string;
  order_id: number;
  shipment_status: string;
  status: string;
  tracking_company: string;
  tracking_number: string;
  tracking_url: string;
};
export type Order = {
  id: string;
  name: string;
  subtotal_price: string;
  contact_email: string;
  admin_graphql_api_id: string;
  shipping_address: {
    name: string;
    address1: string;
    address2: string;
    city: string;
    country: string;
    zip: string;
    province: string;
    country_name: string;
    country_code: string;
    first_name: string;
    last_name: string;
    phone: string;
  };
  customer: CustomerData | undefined;
  fulfillments: OrderFulfillment[];
};

export type OrderLineItem = {
  id: string;
  title: string;
  price: string;
  variant_id: string;
  variant_title: string;
  quantity: number;
  action: string | null;
  reason?: string;
  confirmed?: boolean;
  changed?: boolean;
  new_variant_id?: string;
  new_variant_title?: string;
  discount_allocations?: DiscountAllocation[];
  product_id: number;
};
export type DiscountAllocation = {
  amount: number;
};

export type ShopifyData = {
  success: boolean;
  order: Order[];
};

export type ShopifyDataTracking = {
  success: boolean;
  error?: "InvalidOrderNumber" | "EmailMismatch" | undefined;
  order?: Order | undefined;
};

export type ShopifyDataProduct = {
  success: boolean;
  product?: Product;
};
export type Product = {
  title: string;
  description: string;
  images: Image[];
};
export type Image = {
  src: string;
};

export type OpenAIResponse = {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
};

export type Ticket = {
  id: string;
  orderNumber: string | null;
  email: string | null;
  createdAt: string;
  updatedAt: string;
  status: string;
  name: string | null;
  admin: boolean;
};

export type Message = {
  id?: number;
  sender: string;
  text: string;
  timestamp: string;
  ticketId?: string | null;
};

export type OpenAIMessage = {
  role: string;
  content: string;
};

export type CustomerData = {
  first_name: string;
  last_name: string;
};
