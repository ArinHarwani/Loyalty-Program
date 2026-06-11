-- Migration to add ON DELETE CASCADE to foreign keys pointing to the merchants table

-- 1. Enrollments table
ALTER TABLE public.enrollments DROP CONSTRAINT IF EXISTS enrollments_merchant_id_fkey;
ALTER TABLE public.enrollments 
  ADD CONSTRAINT enrollments_merchant_id_fkey 
  FOREIGN KEY (merchant_id) 
  REFERENCES public.merchants(id) 
  ON DELETE CASCADE;

-- 2. Transactions table
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_merchant_id_fkey;
ALTER TABLE public.transactions 
  ADD CONSTRAINT transactions_merchant_id_fkey 
  FOREIGN KEY (merchant_id) 
  REFERENCES public.merchants(id) 
  ON DELETE CASCADE;

-- 3. QR Tokens table
ALTER TABLE public.qr_tokens DROP CONSTRAINT IF EXISTS qr_tokens_merchant_id_fkey;
ALTER TABLE public.qr_tokens 
  ADD CONSTRAINT qr_tokens_merchant_id_fkey 
  FOREIGN KEY (merchant_id) 
  REFERENCES public.merchants(id) 
  ON DELETE CASCADE;

-- 4. Message Logs table
ALTER TABLE public.message_logs DROP CONSTRAINT IF EXISTS message_logs_merchant_id_fkey;
ALTER TABLE public.message_logs 
  ADD CONSTRAINT message_logs_merchant_id_fkey 
  FOREIGN KEY (merchant_id) 
  REFERENCES public.merchants(id) 
  ON DELETE CASCADE;
