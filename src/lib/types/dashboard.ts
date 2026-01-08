/**
 * Dashboard Types
 * TypeScript interfaces for the Real-Time System Status Dashboard
 */

export type ServiceStatus = 'healthy' | 'degraded' | 'down' | 'unknown';

export interface HealthCheck {
	id: string;
	serviceId: string;
	status: ServiceStatus;
	responseTime: number; // milliseconds
	timestamp: Date;
	error?: string;
	metadata?: Record<string, unknown>;
}

export interface Service {
	id: string;
	name: string;
	url: string;
	description?: string;
	status: ServiceStatus;
	lastCheck: Date | null;
	lastResponseTime: number | null;
	uptimePercentage: number;
	consecutiveFailures: number;
	createdAt: Date;
	tags?: string[];
}

export interface ServiceWithHistory extends Service {
	recentChecks: HealthCheck[];
	incidents: Incident[];
}

export interface Incident {
	id: string;
	serviceId: string;
	startTime: Date;
	endTime: Date | null;
	status: 'ongoing' | 'resolved';
	type: 'degraded' | 'down';
	description?: string;
}

export interface AlertConfig {
	id: string;
	serviceId: string;
	responseTimeThreshold: number; // ms
	consecutiveFailuresThreshold: number;
	enabled: boolean;
	notifyOnRecovery: boolean;
}

export interface DashboardStats {
	totalServices: number;
	healthyServices: number;
	degradedServices: number;
	downServices: number;
	averageResponseTime: number;
	overallUptime: number;
}

// Polling configuration
export interface PollingConfig {
	defaultInterval: number; // ms - default 30 seconds
	healthyInterval: number; // ms - for healthy services
	degradedInterval: number; // ms - faster polling for degraded
	downInterval: number; // ms - fastest polling for down services
}

export const DEFAULT_POLLING_CONFIG: PollingConfig = {
	defaultInterval: 30000,
	healthyInterval: 30000,
	degradedInterval: 15000,
	downInterval: 5000
};
