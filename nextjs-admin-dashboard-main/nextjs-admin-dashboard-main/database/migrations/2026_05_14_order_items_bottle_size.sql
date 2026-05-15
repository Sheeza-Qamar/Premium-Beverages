-- Adds per–order line bottle size (e.g. 500ml, 1 litre) for production / invoicing context.
ALTER TABLE order_items
  ADD COLUMN bottle_size VARCHAR(80) NULL AFTER bottle_type;
