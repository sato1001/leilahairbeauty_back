export interface ServiceResponse {
  id: number;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

