import { AppointmentChannel, AppointmentStatus, ServiceItemStatus } from "@prisma/client";

export interface AppointmentServiceItemResponse {
  service_id: number;
  service_name: string;
  price_charged: number;
  status: ServiceItemStatus;
}

export interface AppointmentClientResponse {
  id: number;
  name: string;
  email: string;
  phone: string | null;
}

export interface AppointmentDetailResponse {
  id: number;
  client: AppointmentClientResponse;
  client_id: number;
  created_by: number;
  scheduled_at: Date;
  ends_at: Date;
  status: AppointmentStatus;
  channel: AppointmentChannel;
  duration: number;
  total: number;
  services: AppointmentServiceItemResponse[];
  created_at: Date;
  updated_at: Date;
}

export interface SameWeekSuggestion {
  suggested_date: Date;
  reference_appointment_id: number;
}

export interface AppointmentResponse {
  appointment: AppointmentDetailResponse;
}

export interface CreateAppointmentResponse {
  appointment: AppointmentDetailResponse;
  suggestion?: SameWeekSuggestion;
}

export interface ListAppointmentsResponse {
  appointments: AppointmentDetailResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

