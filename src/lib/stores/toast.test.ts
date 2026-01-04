/**
 * Toast Store Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toasts } from './toast.svelte';
import { get } from 'svelte/store';

describe('toasts store', () => {
	beforeEach(() => {
		toasts.clear();
	});

	it('should start empty', () => {
		const current = get(toasts);
		expect(current).toHaveLength(0);
	});

	it('should add a toast', () => {
		toasts.add({ type: 'info', message: 'Test message' });
		const current = get(toasts);
		expect(current).toHaveLength(1);
		expect(current[0].message).toBe('Test message');
		expect(current[0].type).toBe('info');
	});

	it('should add success toast', () => {
		toasts.success('Success!');
		const current = get(toasts);
		expect(current[0].type).toBe('success');
	});

	it('should add error toast', () => {
		toasts.error('Error!');
		const current = get(toasts);
		expect(current[0].type).toBe('error');
	});

	it('should add warning toast', () => {
		toasts.warning('Warning!');
		const current = get(toasts);
		expect(current[0].type).toBe('warning');
	});

	it('should remove toast by id', () => {
		const id = toasts.add({ type: 'info', message: 'Test' });
		expect(get(toasts)).toHaveLength(1);
		toasts.remove(id);
		expect(get(toasts)).toHaveLength(0);
	});

	it('should clear all toasts', () => {
		toasts.success('One');
		toasts.error('Two');
		toasts.warning('Three');
		expect(get(toasts)).toHaveLength(3);
		toasts.clear();
		expect(get(toasts)).toHaveLength(0);
	});

	it('should support action on toast', () => {
		const onClick = vi.fn();
		toasts.error('Error with retry', { label: 'Retry', onClick });
		const current = get(toasts);
		expect(current[0].action).toBeDefined();
		expect(current[0].action?.label).toBe('Retry');
	});

	it('should generate unique ids', () => {
		const id1 = toasts.add({ type: 'info', message: 'First' });
		const id2 = toasts.add({ type: 'info', message: 'Second' });
		expect(id1).not.toBe(id2);
	});
});
