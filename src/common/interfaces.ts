export interface NotificationEvent {
    id: number;
    event_type: string;
    description?: string;
}

export interface NotificationSetting {
    id: number;
    event_id: number;
    is_muted: boolean;
}

export interface Tenant {
    id: number;
    tenant_name: string;
    description?: string;
}

export interface Notification {
    id: number;
    event_id: number;
    tenant_id: number;
    message: string;
    created_at: Date;
}

export interface NotificationSettingData {
    id: number;
    event_type: string;
    is_muted: boolean;
}